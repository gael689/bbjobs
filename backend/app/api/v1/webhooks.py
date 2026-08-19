from fastapi import APIRouter, Depends, Request, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from svix.webhooks import Webhook, WebhookVerificationError
from app.api.deps import get_db
from app.core.config import settings
from app.db.session import async_session_maker
from app.models.core import User
from app.models.company import CompanyProfile
from app.models.payment import (
    MercadoPagoWebhookEvent, Payment, PaymentType, JobFeature, JobFeatureStatus,
    TalentCreditPack, TalentPackStatus,
)
from app.models.job import JobPosting, JobModerationStatus
from app.integrations.mercado_pago import verify_signature, get_mp_client, webhook_signature_required
from app.schemas.payment import TALENT_PACK_CREDITS
from app.services.notifications import create_notification, notify_all_admins
import uuid
import datetime
import structlog

logger = structlog.get_logger("app.api.webhooks")
router = APIRouter()

async def process_mp_payment(event_id: str):
    # Sesión propia — no se reusa la del request que disparó el BackgroundTasks, que puede
    # estar cerrada/devuelta al pool para cuando esta tarea corre.
    async with async_session_maker() as db:
        result = await db.execute(select(MercadoPagoWebhookEvent).where(MercadoPagoWebhookEvent.id == uuid.UUID(event_id)))
        event = result.scalar_one_or_none()
        if not event:
            return

        sdk = get_mp_client()
        if not sdk:
            logger.warning("MP SDK not configured for webhook processing")
            return

        try:
            # Fetch payment status from MP API using data.id — nunca se confía en el status/monto
            # que venga en el payload del webhook, sólo en lo que MP confirme por su propia API.
            data_id = event.raw_payload.get("data", {}).get("id")
            if not data_id:
                raise Exception("No data.id found in payload")

            payment_info = sdk.payment().get(data_id)
            if payment_info["status"] != 200:
                raise Exception("Could not retrieve payment info from MP")

            payment_data = payment_info["response"]
            mp_status = payment_data.get("status")
            external_reference = payment_data.get("external_reference")

            if external_reference:
                res_pay = await db.execute(select(Payment).where(Payment.id == uuid.UUID(external_reference)))
                payment = res_pay.scalar_one_or_none()

                if payment:
                    payment.mp_payment_id = str(data_id)
                    payment.mp_status = mp_status

                    # Pack de la Base de Talento. Va antes del bloque del destacado y no lo
                    # interfiere: para un pago de pack no existe ningún JobFeature con este
                    # payment_id, así que `feature` queda en None y las dos ramas de abajo —
                    # que exigen `feature` — no hacen nada.
                    if payment.type == PaymentType.talent_pack:
                        await _procesar_pack_de_talento(db, payment, mp_status)

                    res_feat = await db.execute(select(JobFeature).where(JobFeature.payment_id == payment.id))
                    feature = res_feat.scalar_one_or_none()
                    res_job = (
                        await db.execute(select(JobPosting).where(JobPosting.id == feature.job_posting_id))
                    ).scalar_one_or_none() if feature else None

                    if mp_status == "approved" and feature and feature.status != JobFeatureStatus.active:
                        payment.paid_at = datetime.datetime.now(datetime.timezone.utc)
                        feature.status = JobFeatureStatus.active
                        feature.starts_at = payment.paid_at
                        # La duración del destacado NO es un timer propio — dura exactamente lo
                        # que dure la búsqueda (se copia expires_at, no now + N días fijos).
                        feature.ends_at = res_job.expires_at if res_job else None

                        if res_job:
                            res_job.is_featured = True
                            res_job.featured_until = feature.ends_at

                            res_company = await db.execute(
                                select(CompanyProfile).where(CompanyProfile.id == res_job.company_id)
                            )
                            company = res_company.scalar_one_or_none()
                            if company:
                                already_public = res_job.moderation_status == JobModerationStatus.approved
                                body = (
                                    f"¡'{res_job.title}' ya está destacada en el portal!"
                                    if already_public else
                                    f"Se acreditó el pago para destacar '{res_job.title}'. Se va a "
                                    "mostrar destacada apenas Talency apruebe la búsqueda — mientras "
                                    "tanto, tiene prioridad de revisión."
                                )
                                await create_notification(
                                    db, user_id=company.user_id, type="job_feature_active",
                                    title="Destacado activado", body=body,
                                    link="/dashboard/company/pagos",
                                )

                            await notify_all_admins(
                                db, type="admin_payment_received",
                                title="Nuevo pago recibido",
                                body=f"Se acreditaron ${payment.amount:.0f} {payment.currency} por destacar '{res_job.title}'.",
                                link="/dashboard/admin/pagos",
                            )

                    elif mp_status in ("rejected", "cancelled") and feature and feature.status == JobFeatureStatus.pending_payment:
                        feature.status = JobFeatureStatus.canceled
                        if res_job:
                            res_company = await db.execute(
                                select(CompanyProfile).where(CompanyProfile.id == res_job.company_id)
                            )
                            company = res_company.scalar_one_or_none()
                            if company:
                                await create_notification(
                                    db, user_id=company.user_id, type="job_feature_rejected",
                                    title="El pago no se acreditó",
                                    body=f"Tu pago para destacar '{res_job.title}' fue rechazado o cancelado. Podés volver a intentarlo desde tu panel.",
                                    link="/dashboard/company/estadisticas",
                                )
                    # pending/in_process: sólo se guardó mp_status más arriba, sin notificar — MP
                    # suele reintentar la notificación varias veces mientras procesa.

            event.processed_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
        except Exception as e:
            event.processing_error = str(e)
            await db.commit()
            logger.error("mp_webhook_processing_failed", error=str(e), event_id=event_id)

async def _procesar_pack_de_talento(db, payment: Payment, mp_status: str) -> None:
    """Activa (o cancela) el pack de créditos según lo que confirme MP.

    El webhook es la **única** vía por la que un pack pasa a `active`: el frontend nunca lo
    activa, igual que con el destacado. Y es idempotente — MP reintenta la misma notificación
    varias veces, así que un pack ya activo no se vuelve a tocar ni se re-notifica."""
    if not payment.related_talent_pack_id:
        return

    pack = (
        await db.execute(
            select(TalentCreditPack).where(TalentCreditPack.id == payment.related_talent_pack_id)
        )
    ).scalar_one_or_none()
    if not pack:
        return

    ahora = datetime.datetime.now(datetime.timezone.utc)
    company = (
        await db.execute(select(CompanyProfile).where(CompanyProfile.id == pack.company_id))
    ).scalar_one_or_none()

    # `payment.paid_at` es el candado: MP reintenta la misma notificación varias veces y un
    # pago ya acreditado no se vuelve a contar.
    if mp_status == "approved" and payment.paid_at is None:
        payment.paid_at = ahora

        if pack.status == TalentPackStatus.pending_payment:
            pack.status = TalentPackStatus.active
            pack.activated_at = ahora
            sumados = pack.credits_total
        else:
            # El pack ya estaba activo (o agotado) y entra OTRO pago acreditado sobre él.
            # Pasa si la empresa reintentó la compra y terminó pagando las dos veces: pagó
            # dos packs, le corresponden dos. Se suman en vez de perderse — y si estaba
            # agotado, vuelve a quedar activo.
            pack.credits_total += TALENT_PACK_CREDITS
            pack.status = TalentPackStatus.active
            sumados = TALENT_PACK_CREDITS
            logger.info(
                "talent_pack_pago_adicional",
                pack_id=str(pack.id), company_id=str(pack.company_id), sumados=sumados,
            )

        if company:
            await create_notification(
                db, user_id=company.user_id, type="talent_pack_active",
                title="Ya tenés acceso a la Base de Talento",
                body=(
                    f"Se acreditó tu pago. Sumaste {sumados} contactos para usar con los "
                    "perfiles que quieras."
                ),
                link="/dashboard/company/talento",
            )
        await notify_all_admins(
            db, type="admin_payment_received",
            title="Nuevo pago recibido",
            body=(
                f"Se acreditaron ${payment.amount:.0f} {payment.currency} por un pack de la "
                "Base de Talento."
            ),
            link="/dashboard/admin/pagos",
        )

    elif mp_status in ("rejected", "cancelled") and pack.status == TalentPackStatus.pending_payment:
        pack.status = TalentPackStatus.canceled
        if company:
            await create_notification(
                db, user_id=company.user_id, type="talent_pack_rejected",
                title="El pago no se acreditó",
                body=(
                    "Tu pago del pack de la Base de Talento fue rechazado o cancelado. "
                    "Podés volver a intentarlo desde tu panel."
                ),
                link="/dashboard/company/talento",
            )
    # pending/in_process: no se toca el pack. MP reintenta mientras procesa.


def _es_notificacion_de_pago(payload: dict) -> bool:
    """MP manda varios tipos por el mismo endpoint. Sólo nos interesan los de pago.

    `type` viene como "payment" y `action` como "payment.created"/"payment.updated"; las de
    orden llegan como "merchant_order". Si no viene ninguno de los dos campos se asume pago,
    que es el comportamiento que había antes."""
    tipo = payload.get("type")
    accion = payload.get("action")
    if tipo is None and accion is None:
        return True
    return str(tipo or "").startswith("payment") or str(accion or "").startswith("payment")


def resolve_signature_data_id(query_params, payload: dict) -> str:
    """
    MP firma x-signature con el `data.id` que viene en el QUERY STRING de la URL del webhook, no
    necesariamente el mismo valor que trae el body -- pueden no coincidir en algunas variantes de
    notificación. Usar el del body acá rompe la verificación de firma en esos casos apenas haya
    un MP_WEBHOOK_SECRET real cargado (hoy pasa desapercibido porque sin secret no se valida nada).
    """
    from_query = query_params.get("data.id")
    if from_query:
        return str(from_query)
    return str(payload.get("data", {}).get("id", ""))


@router.post("/webhooks/mercado-pago")
async def mp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    x_signature = request.headers.get("x-signature")
    x_request_id = request.headers.get("x-request-id")

    payload = await request.json()
    data_id = resolve_signature_data_id(request.query_params, payload)

    # Con secret configurado la firma es obligatoria. Antes se validaba sólo `if x_signature
    # and x_request_id`: bastaba con no mandar los headers para saltear la verificación entera
    # y postear cualquier cosa a este endpoint.
    if webhook_signature_required():
        if not x_signature or not x_request_id:
            raise HTTPException(status_code=401, detail="Missing signature headers")
        if not verify_signature(x_signature, x_request_id, data_id):
            raise HTTPException(status_code=401, detail="Invalid signature")

    mp_event_id = str(payload.get("id"))
    topic = payload.get("action") or payload.get("type") or "payment"

    # MP también notifica `merchant_order`, donde data.id es un id de orden y no de pago.
    # Pasárselo a payment().get() fallaba y quedaba registrado como error de procesamiento,
    # ensuciando el log con fallas que no son tales.
    if not _es_notificacion_de_pago(payload):
        return {"status": "ignored", "topic": topic}

    # Idempotency check
    result = await db.execute(select(MercadoPagoWebhookEvent).where(MercadoPagoWebhookEvent.mp_event_id == mp_event_id))
    if result.scalar_one_or_none():
        return {"status": "already processed"}

    event = MercadoPagoWebhookEvent(
        mp_event_id=mp_event_id,
        topic=topic,
        raw_payload=payload
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Sin pasar `db`: process_mp_payment abre su propia sesión (ver arriba).
    background_tasks.add_task(process_mp_payment, str(event.id))

    return {"status": "ok"}


@router.post("/webhooks/clerk")
async def clerk_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Red de seguridad ante cambios hechos directamente en el dashboard de Clerk (fuera de
    nuestra app). La provisión real del User local es JIT en onboarding; este webhook sólo
    reconcilia `user.deleted` / `user.updated`. Idempotente por clerk_user_id (no requiere
    tabla de eventos: desactivar dos veces o sincronizar el mismo email es un no-op).
    """
    body = await request.body()
    try:
        event = Webhook(settings.CLERK_WEBHOOK_SECRET).verify(body, dict(request.headers))
    except WebhookVerificationError:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event_type = event.get("type")
    data = event.get("data", {})
    clerk_user_id = data.get("id")
    if not clerk_user_id:
        return {"status": "ignored"}

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()

    if event_type == "user.deleted":
        if user and user.is_active:
            user.is_active = False
            user.deleted_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()
            logger.info("clerk_user_deleted_webhook", clerk_user_id=clerk_user_id)

    elif event_type == "user.updated":
        if user:
            email_addresses = data.get("email_addresses", [])
            primary_id = data.get("primary_email_address_id")
            primary_email = next(
                (e.get("email_address") for e in email_addresses if e.get("id") == primary_id),
                None,
            )
            if primary_email and primary_email != user.email:
                user.email = primary_email
                await db.commit()
                logger.info("clerk_user_email_synced", clerk_user_id=clerk_user_id)

    return {"status": "ok"}
