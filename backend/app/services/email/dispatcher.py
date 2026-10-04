"""Dispatcher de la cola de mails. Lo corre el scheduler cada 60 s.

En cada vuelta:
1. Devuelve a `pending` lo que quedó `sending` de una vuelta que se cortó.
2. Sin proveedor (`EMAIL_MODE=off`), marca `skipped` lo vencido y termina.
3. Reclama lo vencido con `FOR UPDATE SKIP LOCKED` (dos procesos no toman el mismo mail), en
   orden de prioridad de categoría (R1) y respetando el tope diario de calentamiento (R10).
4. Para cada mail, **revalida con el estado de ahora**: la política (`policy.decide`) y la
   revalidación propia del aviso (`Rule.still_valid`, p. ej. "¿sigue en No avanza?").
5. Manda en lotes de hasta 100, a no más de 2 pedidos por segundo (límite por defecto de
   Resend). Si un lote falla por un error permanente, reintenta de a uno para aislar al mail
   defectuoso en vez de perder los otros 99 (el batch es todo o nada).
"""
from __future__ import annotations

import asyncio
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import async_session_maker
from app.integrations.resend_client import EmailSendError, OutgoingEmail, idempotency_key
from app.models.core import User
from app.models.email import (
    ALWAYS_SENT,
    EmailCategory,
    EmailOutbox,
    EmailPreference,
    EmailStatus,
    EmailSuppression,
)
from app.models.settings import SettingKey
from app.services.email import policy
from app.services.email.catalog import CATEGORY_PRIORITY, rule_for
from app.services.email.outbox import template_override
from app.services.email.provider import EmailProvider, get_email_provider
from app.services.email.tokens import unsubscribe_api_url
from app.services.settings import get_setting

logger = structlog.get_logger("app.services.email.dispatcher")

CLAIM_LIMIT = 200
BATCH_SIZE = 100
STUCK_AFTER = timedelta(minutes=10)
MAX_ATTEMPTS = 5
# Esperas entre reintentos de un error transitorio: 1 min, 5 min, 30 min, 2 h.
BACKOFF_MINUTES = (1, 5, 30, 120)
# 2 pedidos por segundo = uno cada 0,5 s.
REQUEST_INTERVAL_SECONDS = 0.5


@dataclass
class DispatchStats:
    sent: int = 0
    skipped: int = 0
    deferred: int = 0
    canceled: int = 0
    failed: int = 0
    retried: int = 0
    reasons: dict[str, int] = field(default_factory=dict)

    def note(self, reason: str) -> None:
        self.reasons[reason] = self.reasons.get(reason, 0) + 1


def _priority_order():
    return case(
        {c.value: p for c, p in CATEGORY_PRIORITY.items()},
        value=EmailOutbox.category,
        else_=99,
    )


def _backoff(attempts: int) -> timedelta:
    return timedelta(minutes=BACKOFF_MINUTES[min(attempts, len(BACKOFF_MINUTES)) - 1])


async def _requeue_stuck(db: AsyncSession, now: datetime) -> None:
    await db.execute(
        update(EmailOutbox)
        .where(EmailOutbox.status == EmailStatus.sending.value, EmailOutbox.claimed_at < now - STUCK_AFTER)
        .values(status=EmailStatus.pending.value, claimed_at=None)
    )


async def _sent_today(db: AsyncSession, now: datetime) -> int:
    return (await db.execute(
        select(func.count()).select_from(EmailOutbox).where(
            EmailOutbox.status == EmailStatus.sent.value,
            EmailOutbox.sent_at >= policy.local_day_start(now),
        )
    )).scalar_one()


async def _claim(db: AsyncSession, now: datetime, limit: int, only_critical: bool) -> list[EmailOutbox]:
    query = (
        select(EmailOutbox)
        .where(EmailOutbox.status == EmailStatus.pending.value, EmailOutbox.scheduled_at <= now)
        .order_by(_priority_order(), EmailOutbox.scheduled_at)
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    if only_critical:
        query = query.where(EmailOutbox.category.in_([c.value for c in ALWAYS_SENT]))
    rows = list((await db.execute(query)).scalars().all())
    for row in rows:
        row.status = EmailStatus.sending.value
        row.claimed_at = now
    return rows


async def _recipient_state(db: AsyncSession, row: EmailOutbox) -> tuple[User | None, policy.Recipient | None]:
    if row.user_id is None:
        return None, None
    user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
    if user is None:
        return None, None
    suppressed = (await db.execute(
        select(func.count()).select_from(EmailSuppression).where(
            func.lower(EmailSuppression.email) == user.email.lower()
        )
    )).scalar_one() > 0
    pref = (await db.execute(
        select(EmailPreference.enabled).where(
            EmailPreference.user_id == user.id, EmailPreference.category == row.category
        )
    )).scalar_one_or_none()
    return user, policy.Recipient(
        email=user.email,
        is_active=user.is_active,
        deleted=user.deleted_at is not None,
        suppressed=suppressed,
        category_enabled=True if pref is None else pref,
    )


async def _noncritical_sent_today(db: AsyncSession, user_id, now: datetime) -> int:
    return (await db.execute(
        select(func.count()).select_from(EmailOutbox).where(
            EmailOutbox.user_id == user_id,
            EmailOutbox.status == EmailStatus.sent.value,
            EmailOutbox.sent_at >= policy.local_day_start(now),
            EmailOutbox.category.notin_([c.value for c in ALWAYS_SENT]),
        )
    )).scalar_one()


def _outgoing(row: EmailOutbox, to: str) -> OutgoingEmail:
    headers: dict[str, str] = {}
    category = EmailCategory(row.category)
    if category not in ALWAYS_SENT and row.user_id is not None:
        # RFC 8058: baja de un click desde el cliente de correo (Gmail/Yahoo lo exigen en volumen).
        headers["List-Unsubscribe"] = f"<{unsubscribe_api_url(row.user_id, category)}>"
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    return OutgoingEmail(
        to=to,
        subject=row.subject,
        html=row.html,
        text=row.text,
        headers=headers,
        tags={"tipo": row.template_key, "categoria": row.category},
        idempotency_key=idempotency_key("outbox", row.id),
    )


def _mark_sent(row: EmailOutbox, provider_id: str, now: datetime, stats: DispatchStats) -> None:
    row.status = EmailStatus.sent.value
    row.sent_at = now
    row.provider_message_id = provider_id
    row.attempts += 1
    row.last_error = None
    stats.sent += 1


def _mark_error(row: EmailOutbox, err: EmailSendError, now: datetime, stats: DispatchStats) -> None:
    row.attempts += 1
    row.last_error = str(err)[:1000]
    if err.transient and row.attempts < MAX_ATTEMPTS:
        row.status = EmailStatus.pending.value
        row.claimed_at = None
        row.scheduled_at = now + _backoff(row.attempts)
        stats.retried += 1
    else:
        row.status = EmailStatus.failed.value
        stats.failed += 1


async def _send_chunk(
    provider: EmailProvider, chunk: list[tuple[EmailOutbox, OutgoingEmail]], now: datetime,
    stats: DispatchStats,
) -> None:
    if len(chunk) == 1:
        row, msg = chunk[0]
        try:
            _mark_sent(row, await provider.send(msg), now, stats)
        except EmailSendError as err:
            _mark_error(row, err, now, stats)
        return

    ids = ",".join(sorted(str(row.id) for row, _ in chunk))
    key = idempotency_key("outbox-batch", hashlib.sha256(ids.encode()).hexdigest())
    try:
        provider_ids = await provider.send_batch([m for _, m in chunk], idempotency_key=key)
        for (row, _), pid in zip(chunk, provider_ids):
            _mark_sent(row, pid, now, stats)
    except EmailSendError as err:
        if err.transient:
            for row, _ in chunk:
                _mark_error(row, err, now, stats)
            return
        # Permanente: uno del lote está mal. De a uno, para no perder a los demás.
        logger.warning("email_lote_rechazado_reintento_individual", size=len(chunk), error=str(err)[:200])
        for item in chunk:
            await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
            await _send_chunk(provider, [item], now, stats)


async def dispatch_due(
    *,
    session_maker=async_session_maker,
    provider: EmailProvider | None = None,
    now: datetime | None = None,
    use_configured_provider: bool = True,
) -> DispatchStats:
    stats = DispatchStats()
    now = now or datetime.now(timezone.utc)
    if provider is None and use_configured_provider:
        provider = get_email_provider()

    async with session_maker() as db:
        await _requeue_stuck(db, now)

        if provider is None:
            result = await db.execute(
                update(EmailOutbox)
                .where(EmailOutbox.status == EmailStatus.pending.value, EmailOutbox.scheduled_at <= now)
                .values(status=EmailStatus.skipped.value, last_error="sin proveedor de mails (EMAIL_MODE=off)")
            )
            stats.skipped += result.rowcount or 0
            await db.commit()
            return stats

        remaining = CLAIM_LIMIT
        only_critical = False
        if settings.EMAIL_DAILY_CAP:
            remaining = min(CLAIM_LIMIT, settings.EMAIL_DAILY_CAP - await _sent_today(db, now))
            if remaining <= 0:
                # Tope de calentamiento alcanzado: sólo salen los de la cuenta (pagos, verificación).
                remaining, only_critical = CLAIM_LIMIT, True

        rows = await _claim(db, now, remaining, only_critical)
        await db.commit()
        if not rows:
            return stats

        enabled = await get_setting(db, SettingKey.emails_automaticos_activos)
        # R12: con rebotes o quejas por encima del límite, novedades y recordatorios se frenan
        # solos 24 h (los avisos de cuenta y de postulaciones siguen). Lo muestra el resumen del
        # equipo; se destraba solo cuando los números vuelven a la normalidad.
        from app.services.email.digests import email_health
        health = await email_health(db, now)
        braked = {EmailCategory.novedades.value, EmailCategory.recordatorios.value} if health["unhealthy"] else set()
        if braked:
            logger.error("email_freno_por_salud", **{k: v for k, v in health.items() if k != "unhealthy"})
        to_send: list[tuple[EmailOutbox, OutgoingEmail]] = []
        sent_in_run: dict = {}
        templates: dict = {}

        for row in rows:
            rule = rule_for(row.template_key)
            if row.template_key not in templates:
                templates[row.template_key] = await template_override(db, row.template_key)
            override = templates[row.template_key]

            if rule.still_valid is not None and row.ref_id is not None:
                if not await rule.still_valid(db, row.ref_id):
                    row.status = EmailStatus.canceled.value
                    row.last_error = "el aviso dejó de tener sentido antes de salir"
                    stats.canceled += 1
                    continue

            if row.category in braked:
                row.status = EmailStatus.pending.value
                row.claimed_at = None
                row.scheduled_at = now + timedelta(hours=24)
                stats.deferred += 1
                stats.note("freno por salud de los mails")
                continue

            user, recipient = await _recipient_state(db, row)
            if recipient is None:
                row.status = EmailStatus.skipped.value
                row.last_error = "sin usuario"
                stats.skipped += 1
                continue

            already = sent_in_run.get(user.id)
            if already is None:
                already = await _noncritical_sent_today(db, user.id, now)
            decision = policy.decide(
                rule, recipient, now=now, emails_enabled=enabled,
                template_enabled=override.enabled if override else True,
                sent_today_noncritical=already,
            )
            if isinstance(decision, policy.Skip):
                row.status = EmailStatus.skipped.value
                row.last_error = decision.reason
                stats.skipped += 1
                stats.note(decision.reason)
            elif isinstance(decision, policy.Defer):
                row.status = EmailStatus.pending.value
                row.claimed_at = None
                row.scheduled_at = decision.until
                stats.deferred += 1
                stats.note(decision.reason)
            else:
                row.to_email = user.email  # la dirección de hoy, no la de cuando se encoló
                to_send.append((row, _outgoing(row, user.email)))
                if not rule.critical:
                    sent_in_run[user.id] = already + 1

        for start in range(0, len(to_send), BATCH_SIZE):
            if start:
                await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
            await _send_chunk(provider, to_send[start:start + BATCH_SIZE], now, stats)

        await db.commit()

    if stats.sent or stats.failed or stats.canceled:
        logger.info("email_dispatch", sent=stats.sent, skipped=stats.skipped, deferred=stats.deferred,
                    canceled=stats.canceled, failed=stats.failed, retried=stats.retried)
    return stats
