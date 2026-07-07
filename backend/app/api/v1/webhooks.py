from fastapi import APIRouter, Depends, Request, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from svix.webhooks import Webhook, WebhookVerificationError
from app.api.deps import get_db
from app.core.config import settings
from app.models.core import User
from app.models.payment import MercadoPagoWebhookEvent, Payment, JobFeature, JobFeatureStatus
from app.models.job import JobPosting
from app.integrations.mercado_pago import verify_signature, get_mp_client
import uuid
import datetime
import structlog

logger = structlog.get_logger("app.api.webhooks")
router = APIRouter()

async def process_mp_payment(event_id: str, db: AsyncSession):
    # Retrieve the event
    result = await db.execute(select(MercadoPagoWebhookEvent).where(MercadoPagoWebhookEvent.id == uuid.UUID(event_id)))
    event = result.scalar_one_or_none()
    if not event:
        return
        
    sdk = get_mp_client()
    if not sdk:
        logger.warning("MP SDK not configured for webhook processing")
        return
        
    try:
        # Fetch payment status from MP API using data.id
        data_id = event.raw_payload.get("data", {}).get("id")
        if not data_id:
            raise Exception("No data.id found in payload")
            
        payment_info = sdk.payment().get(data_id)
        if payment_info["status"] != 200:
            raise Exception("Could not retrieve payment info from MP")
            
        payment_data = payment_info["response"]
        mp_status = payment_data.get("status")
        external_reference = payment_data.get("external_reference")
        
        if mp_status == "approved" and external_reference:
            # Find the internal payment
            res_pay = await db.execute(select(Payment).where(Payment.id == uuid.UUID(external_reference)))
            payment = res_pay.scalar_one_or_none()
            if payment:
                payment.mp_payment_id = str(data_id)
                payment.mp_status = mp_status
                payment.paid_at = datetime.datetime.now(datetime.timezone.utc)
                
                # Check if it relates to a JobFeature
                res_feat = await db.execute(select(JobFeature).where(JobFeature.payment_id == payment.id))
                feature = res_feat.scalar_one_or_none()
                if feature and feature.status != JobFeatureStatus.active:
                    feature.status = JobFeatureStatus.active
                    feature.starts_at = datetime.datetime.now(datetime.timezone.utc)
                    feature.ends_at = feature.starts_at + datetime.timedelta(days=7) # N days = 7
                    
                    # Update JobPosting
                    res_job = await db.execute(select(JobPosting).where(JobPosting.id == feature.job_posting_id))
                    job = res_job.scalar_one_or_none()
                    if job:
                        job.is_featured = True
                        job.featured_until = feature.ends_at
                        
        event.processed_at = datetime.datetime.now(datetime.timezone.utc)
        await db.commit()
    except Exception as e:
        event.processing_error = str(e)
        await db.commit()
        logger.error("mp_webhook_processing_failed", error=str(e), event_id=event_id)

@router.post("/webhooks/mercado-pago")
async def mp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    x_signature = request.headers.get("x-signature")
    x_request_id = request.headers.get("x-request-id")
    
    payload = await request.json()
    data_id = str(payload.get("data", {}).get("id", ""))
    
    # Very basic validation structure
    if x_signature and x_request_id:
        if not verify_signature(x_signature, x_request_id, data_id, x_signature): # Simplification for parsing ts from x_signature
            raise HTTPException(status_code=401, detail="Invalid signature")

    mp_event_id = str(payload.get("id"))
    topic = payload.get("action") or payload.get("type") or "payment"

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
    
    background_tasks.add_task(process_mp_payment, str(event.id), db)

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
