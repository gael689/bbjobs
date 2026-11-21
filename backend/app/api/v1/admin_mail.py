"""Mails para el equipo de Talency: qué salió, qué contestó la gente y cómo está la cuenta.

Sólo lectura de la cola (`email_outbox`, sin el cuerpo de los mails) más la bandeja de respuestas
(`email_replies`). Módulo en desarrollo: detrás de la compuerta `MODULOS_NUEVOS_ACTIVOS`.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.core.features import require_new_modules
from app.integrations import resend_client
from app.models.core import User, UserRole
from app.models.email import EmailOutbox, EmailReply, EmailStatus
from app.models.prospect import Prospect
from app.services.email import digests
from app.services.email.policy import local_day_start

logger = structlog.get_logger("app.api.admin_mail")
router = APIRouter(dependencies=[Depends(require_new_modules)])
_admin = require_role([UserRole.admin])

Delivery = Literal["pendiente", "enviado", "entregado", "rebotado", "queja", "fallido", "saltado"]


def delivery_of(row: EmailOutbox) -> str:
    """Una sola palabra para el estado de un mail, la peor noticia primero."""
    if row.complained_at is not None:
        return "queja"
    if row.bounced_at is not None and row.bounce_permanent is not False:
        return "rebotado"
    if row.status == EmailStatus.failed.value:
        return "fallido"
    if row.status in (EmailStatus.skipped.value, EmailStatus.canceled.value):
        return "saltado"
    if row.status in (EmailStatus.pending.value, EmailStatus.sending.value):
        return "pendiente"
    return "entregado" if row.delivered_at is not None else "enviado"


class SentItem(BaseModel):
    id: uuid.UUID
    to_email: str
    category: str
    template_key: str
    subject: str
    delivery: Delivery
    touch: int
    scheduled_at: datetime
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    opened_at: Optional[datetime]
    clicked_at: Optional[datetime]
    bounced_at: Optional[datetime]
    bounce_permanent: Optional[bool]
    complained_at: Optional[datetime]
    last_error: Optional[str]


class SentPage(BaseModel):
    total: int
    page: int
    per_page: int
    items: list[SentItem]


@router.get("/admin/mail/sent", response_model=SentPage)
async def sent_mails(
    category: Optional[str] = None, delivery: Optional[Delivery] = None,
    q: Optional[str] = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1), per_page: int = Query(default=30, ge=1, le=100),
    _: User = Depends(_admin), db: AsyncSession = Depends(get_db),
):
    stmt = select(EmailOutbox)
    if category:
        stmt = stmt.where(EmailOutbox.category == category)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(EmailOutbox.to_email).like(like), func.lower(EmailOutbox.subject).like(like)))
    if delivery == "queja":
        stmt = stmt.where(EmailOutbox.complained_at.is_not(None))
    elif delivery == "rebotado":
        stmt = stmt.where(EmailOutbox.bounced_at.is_not(None), EmailOutbox.bounce_permanent.is_distinct_from(False))
    elif delivery == "fallido":
        stmt = stmt.where(EmailOutbox.status == EmailStatus.failed.value)
    elif delivery == "saltado":
        stmt = stmt.where(EmailOutbox.status.in_([EmailStatus.skipped.value, EmailStatus.canceled.value]))
    elif delivery == "pendiente":
        stmt = stmt.where(EmailOutbox.status.in_([EmailStatus.pending.value, EmailStatus.sending.value]))
    elif delivery == "entregado":
        stmt = stmt.where(EmailOutbox.status == EmailStatus.sent.value, EmailOutbox.delivered_at.is_not(None))
    elif delivery == "enviado":
        stmt = stmt.where(EmailOutbox.status == EmailStatus.sent.value, EmailOutbox.delivered_at.is_(None))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(
        stmt.order_by(func.coalesce(EmailOutbox.sent_at, EmailOutbox.scheduled_at).desc())
        .offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return SentPage(total=total, page=page, per_page=per_page, items=[SentItem(
        id=r.id, to_email=r.to_email, category=r.category, template_key=r.template_key, subject=r.subject,
        delivery=delivery_of(r), touch=r.touch, scheduled_at=r.scheduled_at, sent_at=r.sent_at,
        delivered_at=r.delivered_at, opened_at=r.opened_at, clicked_at=r.clicked_at, bounced_at=r.bounced_at,
        bounce_permanent=r.bounce_permanent, complained_at=r.complained_at, last_error=r.last_error,
    ) for r in rows])


# ── Respuestas ──────────────────────────────────────────────────────────────────────────

class ReplyItem(BaseModel):
    id: uuid.UUID
    from_email: str
    to_email: str
    subject: str
    body: str
    status: Literal["nueva", "atendida"]
    kind: Literal["usuario", "prospecto", "desconocido"]
    who: Optional[str]               # nombre de la empresa prospecto, si se sabe
    received_at: datetime
    attended_at: Optional[datetime]


class ReplyPage(BaseModel):
    total: int
    new: int
    page: int
    per_page: int
    items: list[ReplyItem]


@router.get("/admin/mail/replies", response_model=ReplyPage)
async def replies(
    status: Literal["nueva", "atendida", "todas"] = "nueva",
    page: int = Query(default=1, ge=1), per_page: int = Query(default=30, ge=1, le=100),
    _: User = Depends(_admin), db: AsyncSession = Depends(get_db),
):
    base = select(EmailReply, Prospect.name).outerjoin(Prospect, Prospect.id == EmailReply.prospect_id)
    if status != "todas":
        base = base.where(EmailReply.status == status)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    new = (await db.execute(select(func.count()).select_from(EmailReply).where(EmailReply.status == "nueva"))).scalar_one()
    rows = (await db.execute(
        base.order_by(EmailReply.received_at.desc()).offset((page - 1) * per_page).limit(per_page))).all()
    return ReplyPage(total=total, new=new, page=page, per_page=per_page, items=[ReplyItem(
        id=r.id, from_email=r.from_email, to_email=r.to_email, subject=r.subject, body=r.body, status=r.status,
        kind="prospecto" if r.prospect_id else ("usuario" if r.user_id else "desconocido"),
        who=name, received_at=r.received_at, attended_at=r.attended_at,
    ) for r, name in rows])


class ReplyUpdate(BaseModel):
    status: Literal["nueva", "atendida"]


@router.patch("/admin/mail/replies/{reply_id}")
async def update_reply(reply_id: uuid.UUID, payload: ReplyUpdate, admin: User = Depends(_admin),
                       db: AsyncSession = Depends(get_db)):
    reply = (await db.execute(select(EmailReply).where(EmailReply.id == reply_id))).scalar_one_or_none()
    if reply is None:
        raise HTTPException(status_code=404, detail="Respuesta no encontrada")
    reply.status = payload.status
    reply.attended_at = datetime.now(timezone.utc) if payload.status == "atendida" else None
    reply.attended_by_user_id = admin.id if payload.status == "atendida" else None
    await db.commit()
    return {"id": str(reply.id), "status": reply.status}


# ── Salud ───────────────────────────────────────────────────────────────────────────────

HEALTH_DAYS = 14


class CategoryStats(BaseModel):
    category: str
    sent: int
    delivered: int
    opened: int
    bounced: int
    complained: int


class DayStats(BaseModel):
    day: str
    sent: int
    bounced: int
    complained: int


class DomainOut(BaseModel):
    name: str
    verified: bool
    status: str


class HealthOut(BaseModel):
    mode: str
    resend_configured: bool
    sent_today: int
    daily_cap: int
    replies_new: int
    # Último chequeo de la cuenta (últimos 7 días), con los límites de Resend.
    sent_7d: int
    bounce_pct: float
    complaint_pct: float
    bounce_limit_pct: float
    complaint_limit_pct: float
    min_sample: int
    unhealthy: bool
    by_category: list[CategoryStats]
    daily: list[DayStats]
    domains: Optional[list[DomainOut]] = None
    domains_error: Optional[str] = None


@router.get("/admin/mail/health", response_model=HealthOut)
async def mail_health(_: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    since = local_day_start(now) - timedelta(days=HEALTH_DAYS - 1)
    health = await digests.email_health(db, now)
    hard_bounce = EmailOutbox.bounce_permanent.is_distinct_from(False)

    cats = (await db.execute(
        select(EmailOutbox.category, func.count(), func.count(EmailOutbox.delivered_at),
               func.count(EmailOutbox.opened_at),
               func.count().filter(EmailOutbox.bounced_at.is_not(None), hard_bounce),
               func.count(EmailOutbox.complained_at))
        .where(EmailOutbox.sent_at >= since, EmailOutbox.status == EmailStatus.sent.value)
        .group_by(EmailOutbox.category).order_by(func.count().desc())
    )).all()
    day = func.date(func.timezone("America/Argentina/Buenos_Aires", EmailOutbox.sent_at))
    days = {str(d): (s, b, c) for d, s, b, c in (await db.execute(
        select(day, func.count(), func.count().filter(EmailOutbox.bounced_at.is_not(None), hard_bounce),
               func.count(EmailOutbox.complained_at))
        .where(EmailOutbox.sent_at >= since, EmailOutbox.status == EmailStatus.sent.value).group_by(day)
    )).all()}
    daily = []
    for i in range(HEALTH_DAYS):
        d = (local_day_start(now) - timedelta(days=HEALTH_DAYS - 1 - i)).astimezone(
            digests.AR_TZ).date().isoformat()
        s, b, c = days.get(d, (0, 0, 0))
        daily.append(DayStats(day=d, sent=s, bounced=b, complained=c))

    sent_today = (await db.execute(select(func.count()).select_from(EmailOutbox).where(
        EmailOutbox.status == EmailStatus.sent.value, EmailOutbox.sent_at >= local_day_start(now)))).scalar_one()
    replies_new = (await db.execute(select(func.count()).select_from(EmailReply).where(
        EmailReply.status == "nueva"))).scalar_one()

    domains, error = None, None
    key = settings.RESEND_API_KEY
    if key:
        try:
            domains = [DomainOut(name=d.get("name", ""), status=str(d.get("status", "")),
                                 verified=str(d.get("status", "")).lower() == "verified")
                       for d in await resend_client.list_domains(api_key=key)]
        except Exception as exc:   # clave sin permiso completo, sin red…: la pantalla lo explica
            error = str(exc)[:200]
            logger.warning("mail_health_dominios_fallo", error=error)

    return HealthOut(
        mode=settings.EMAIL_MODE, resend_configured=bool(key), sent_today=sent_today,
        daily_cap=settings.EMAIL_DAILY_CAP, replies_new=replies_new, sent_7d=health["sent"],
        bounce_pct=round(health["bounce_pct"], 2), complaint_pct=round(health["complaint_pct"], 3),
        bounce_limit_pct=digests.BOUNCE_LIMIT_PCT, complaint_limit_pct=digests.COMPLAINT_LIMIT_PCT,
        min_sample=digests.MIN_SAMPLE, unhealthy=health["unhealthy"],
        by_category=[CategoryStats(category=c, sent=s, delivered=d, opened=o, bounced=b, complained=q)
                     for c, s, d, o, b, q in cats],
        daily=daily, domains=domains, domains_error=error,
    )
