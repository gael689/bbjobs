"""Revisión de CV para postulantes (MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md §6).

La plataforma sólo hace tres cosas: **cobrar** (Mercado Pago), **avisar** (a Talency y al
postulante) y **registrar**. El contacto y la devolución son por fuera, por WhatsApp o mail.
No interviene la IA: ni el CV ni los datos del servicio salen hacia ningún modelo.

Reglas (§6.2): C2 hace falta CV y teléfono · C3 una revisión abierta a la vez (se reutiliza la
que quedó sin pagar) · C4 se congela el CV pagado · C5 consentimiento de contacto · C9 un segundo
pago aprobado no reabre nada, avisa para devolver · C10 sin pagar a las 24 h se cancela ·
C11 los estados los cambia el admin, salvo `pending_payment → paid`, que es del webhook.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.mercado_pago import create_preference
from app.models.candidate import CandidateProfile
from app.models.core import User
from app.models.payment import (
    CV_REVIEW_ADMIN_TRANSITIONS,
    CV_REVIEW_OPEN_STATUSES,
    CvReviewOrder,
    CvReviewStatus,
    Payment,
    PaymentType,
)
from app.models.settings import SettingKey
from app.schemas.payment import CV_REVIEW_CURRENCY, cv_review_price
from app.services.notifications import create_notification, notify_all_admins
from app.services.settings import get_setting

logger = structlog.get_logger("app.services.cv_review")

PENDING_PAYMENT_TTL = timedelta(hours=24)
REMINDERS = (timedelta(hours=24), timedelta(hours=48))
OBJECTIVE_MAX = 500
MP_REFUND_STATUSES = ("refunded", "charged_back")

_OPEN = tuple(s.value for s in CV_REVIEW_OPEN_STATUSES)


class CvReviewError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class Eligibility:
    can_buy: bool
    reason: str | None


async def sales_enabled(db: AsyncSession) -> bool:
    return await get_setting(db, SettingKey.revision_cv_activa)


async def open_order(db: AsyncSession, candidate_id: uuid.UUID) -> CvReviewOrder | None:
    return (await db.execute(
        select(CvReviewOrder).where(
            CvReviewOrder.candidate_id == candidate_id, CvReviewOrder.status.in_(_OPEN)
        )
    )).scalar_one_or_none()


async def eligibility(db: AsyncSession, candidate: CandidateProfile) -> Eligibility:
    if not await sales_enabled(db):
        return Eligibility(False, "La revisión de CV no está disponible en este momento.")
    if not candidate.cv_file_url:
        return Eligibility(False, "Primero cargá tu CV en tu perfil.")
    if not (candidate.phone or "").strip():
        return Eligibility(False, "Primero cargá tu teléfono en tu perfil.")
    current = await open_order(db, candidate.id)
    if current is not None and current.status != CvReviewStatus.pending_payment.value:
        return Eligibility(False, "Ya tenés una revisión en curso.")
    return Eligibility(True, None)


async def start_checkout(
    db: AsyncSession,
    *,
    user: User,
    candidate: CandidateProfile,
    objective: str | None,
    contact_channel: str,
    contact_value: str | None,
    consent: bool,
) -> tuple[CvReviewOrder, Payment, str]:
    """Crea (o reutiliza) la orden, un `Payment` nuevo y la preferencia de Mercado Pago, y
    commitea. Devuelve el link de pago."""
    check = await eligibility(db, candidate)
    if not check.can_buy:
        raise CvReviewError(check.reason or "No disponible", 409)
    if not consent:
        raise CvReviewError("Necesitamos tu permiso para que Talency te contacte.", 422)
    if contact_channel not in ("whatsapp", "email"):
        raise CvReviewError("Elegí WhatsApp o mail.", 422)

    value = (contact_value or "").strip() or (candidate.phone if contact_channel == "whatsapp" else user.email)
    objective = (objective or "").strip()[:OBJECTIVE_MAX] or None
    now = datetime.now(timezone.utc)
    price = cv_review_price()

    order = await open_order(db, candidate.id)
    if order is None:
        order = CvReviewOrder(id=uuid.uuid4(), candidate_id=candidate.id, status=CvReviewStatus.pending_payment.value)
        db.add(order)
    # Reutilizar la que quedó sin pagar (C3): se refrescan datos, CV y precio.
    order.objective = objective
    order.contact_channel = contact_channel
    order.contact_value = value[:255]
    order.contact_consent_at = now
    order.cv_file_url_snapshot = candidate.cv_file_url
    order.cv_uploaded_at_snapshot = candidate.cv_uploaded_at
    order.price = price
    order.currency = CV_REVIEW_CURRENCY

    payment = Payment(
        id=uuid.uuid4(),
        candidate_id=candidate.id,
        type=PaymentType.cv_review,
        amount=price,
        currency=CV_REVIEW_CURRENCY,
        related_cv_review_id=order.id,
    )
    db.add(payment)
    await db.flush()

    success_url = f"{settings.FRONTEND_URL}/dashboard/candidate/revision-cv?payment_id={payment.id}"
    init_point = create_preference(
        title="Revisión de CV — BBJobs",
        price=price,
        external_reference=str(payment.id),
        success_url=success_url,
    )
    await db.commit()
    logger.info("cv_review_checkout", order_id=str(order.id), payment_id=str(payment.id))
    return order, payment, init_point


async def _candidate_user_and_name(db: AsyncSession, candidate_id: uuid.UUID) -> tuple[uuid.UUID | None, str]:
    row = (await db.execute(
        select(CandidateProfile.user_id, CandidateProfile.first_name, CandidateProfile.last_name)
        .where(CandidateProfile.id == candidate_id)
    )).first()
    if row is None:
        return None, "Postulante"
    return row.user_id, f"{row.first_name} {row.last_name}".strip()


def _contact_line(order: CvReviewOrder) -> str:
    canal = "WhatsApp" if order.contact_channel == "whatsapp" else "mail"
    return f"Contacto por {canal}: {order.contact_value or 'sin dato'}."


async def process_payment(db: AsyncSession, payment: Payment, mp_status: str, previous_mp_status: str | None) -> None:
    """La llama el webhook de Mercado Pago, que es la única vía para pasar a `paid`.

    Idempotente: `payment.paid_at` es el candado (MP reintenta la misma notificación)."""
    if not payment.related_cv_review_id:
        return
    order = (await db.execute(
        select(CvReviewOrder).where(CvReviewOrder.id == payment.related_cv_review_id)
    )).scalar_one_or_none()
    if order is None:
        return
    now = datetime.now(timezone.utc)
    user_id, name = await _candidate_user_and_name(db, order.candidate_id)

    if mp_status == "approved" and payment.paid_at is None:
        payment.paid_at = now
        payable = order.status in (CvReviewStatus.pending_payment.value, CvReviewStatus.canceled.value)
        other_open = (await db.execute(
            select(func.count()).select_from(CvReviewOrder).where(
                CvReviewOrder.candidate_id == order.candidate_id,
                CvReviewOrder.id != order.id,
                CvReviewOrder.status.in_(_OPEN),
            )
        )).scalar_one()
        if payable and not other_open:
            # Un pago que llega tarde sobre una orden vencida (`canceled`) se respeta igual.
            order.status = CvReviewStatus.paid.value
            order.paid_at = now
            order.canceled_at = None
            if user_id:
                await create_notification(
                    db, user_id=user_id, type="cv_review_paid",
                    title="Recibimos tu pago de la revisión de CV",
                    body=("Talency te va a contactar en las próximas 48 horas hábiles para revisar tu CV. "
                          "La devolución es por WhatsApp o mail, fuera de la plataforma."),
                    link="/dashboard/candidate/revision-cv", ref_id=order.id,
                )
            objetivo = f" Busca: {order.objective}." if order.objective else ""
            await notify_all_admins(
                db, type="admin_cv_review_new",
                title="Nueva revisión de CV pagada",
                body=f"{name} pagó la revisión de CV.{objetivo} {_contact_line(order)}",
                link="/dashboard/admin/revisiones-cv",
            )
        else:
            # C9: ya estaba pagada (o hay otra abierta). Le corresponde una devolución.
            logger.warning("cv_review_pago_duplicado", order_id=str(order.id), payment_id=str(payment.id))
            await notify_all_admins(
                db, type="admin_cv_review_duplicate_payment",
                title="Pago duplicado de revisión de CV",
                body=(f"{name} pagó dos veces la revisión de CV (${payment.amount:.0f}). "
                      "Hay que devolver uno desde Mercado Pago."),
                link="/dashboard/admin/revisiones-cv",
            )

    elif mp_status in ("rejected", "cancelled") and order.status == CvReviewStatus.pending_payment.value:
        # La orden sigue abierta: puede reintentar con otro medio (se reutiliza, C3).
        if user_id:
            await create_notification(
                db, user_id=user_id, type="cv_review_payment_rejected",
                title="El pago de la revisión de CV no se acreditó",
                body="Podés volver a intentarlo desde tu panel.",
                link="/dashboard/candidate/revision-cv",
            )

    elif mp_status in MP_REFUND_STATUSES and previous_mp_status != mp_status:
        if order.status != CvReviewStatus.refunded.value:
            order.status = CvReviewStatus.refunded.value
            order.refunded_at = now


async def change_status(
    db: AsyncSession, order: CvReviewOrder, new_status: CvReviewStatus, *, admin: User, note: str | None,
) -> CvReviewOrder:
    """Transición manual del admin (C11). Avisa al postulante al tomarla y al cerrarla."""
    current = CvReviewStatus(order.status)
    if new_status not in CV_REVIEW_ADMIN_TRANSITIONS.get(current, frozenset()):
        raise CvReviewError(f"No se puede pasar de '{current.value}' a '{new_status.value}'.", 400)
    now = datetime.now(timezone.utc)
    order.status = new_status.value
    if note is not None:
        order.admin_note = note.strip()[:2000] or None
    user_id, _ = await _candidate_user_and_name(db, order.candidate_id)

    if new_status == CvReviewStatus.in_progress:
        order.taken_at = now
        order.taken_by_admin_id = admin.id
        if user_id:
            await create_notification(
                db, user_id=user_id, type="cv_review_in_progress",
                title="Talency ya está revisando tu CV",
                body="En breve te contactan por el medio que elegiste.",
                link="/dashboard/candidate/revision-cv", ref_id=order.id,
            )
    elif new_status == CvReviewStatus.delivered:
        order.delivered_at = now
        if user_id:
            await create_notification(
                db, user_id=user_id, type="cv_review_delivered",
                title="Cerramos tu revisión de CV",
                body=("Talency te envió la devolución por WhatsApp o mail. "
                      "Si no recibiste nada, respondé este mensaje o escribinos desde Contacto."),
                link="/dashboard/candidate/revision-cv", ref_id=order.id,
            )
    elif new_status == CvReviewStatus.refunded:
        order.refunded_at = now
    return order


async def housekeeping(db: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """Reloj (cada hora): vence las órdenes sin pagar (C10) y avisa a Talency de las pagadas
    que nadie tomó (C7), una sola vez a las 24 h y otra a las 48 h. No commitea."""
    now = now or datetime.now(timezone.utc)
    stats = {"vencidas": 0, "recordatorios": 0}

    stale = (await db.execute(
        select(CvReviewOrder).where(
            CvReviewOrder.status == CvReviewStatus.pending_payment.value,
            CvReviewOrder.created_at < now - PENDING_PAYMENT_TTL,
        )
    )).scalars().all()
    for order in stale:
        order.status = CvReviewStatus.canceled.value
        order.canceled_at = now
        stats["vencidas"] += 1

    waiting = (await db.execute(
        select(CvReviewOrder).where(
            CvReviewOrder.status == CvReviewStatus.paid.value,
            CvReviewOrder.paid_at.is_not(None),
        )
    )).scalars().all()
    for order in waiting:
        for after, field in zip(REMINDERS, ("reminder_24h_sent_at", "reminder_48h_sent_at")):
            if getattr(order, field) is None and order.paid_at <= now - after:
                setattr(order, field, now)
                _, name = await _candidate_user_and_name(db, order.candidate_id)
                horas = int(after.total_seconds() // 3600)
                await notify_all_admins(
                    db, type="admin_cv_review_overdue",
                    title=f"Revisión de CV sin contactar hace {horas} h",
                    body=f"{name} pagó la revisión y todavía nadie la tomó. {_contact_line(order)}",
                    link="/dashboard/admin/revisiones-cv",
                )
                stats["recordatorios"] += 1
    return stats
