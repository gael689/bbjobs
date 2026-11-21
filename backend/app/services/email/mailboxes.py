"""Casillas de prospección: reparto del cupo, frenos y chequeo de dominio.

- Cada mail de prospección sale de la casilla activa que menos envió hoy (reparto parejo) y que
  todavía tiene cupo. Sin casillas cargadas se usa el remitente fijo de siempre.
- Freno por casilla: una queja, o rebotes duros por encima del límite de Resend (4 %; con menos de
  30 envíos, 3 rebotes), la pausan sola y avisan al equipo. Las demás siguen. El freno de TODA la
  cuenta (`digests.email_health`) es aparte y corta también a las demás.
- Una casilla sólo se activa si su dominio está verificado en Resend; si no queda inactiva con el
  motivo, y nunca sale nada desde la raíz del dominio.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations import resend_client
from app.models.email import EmailCategory, EmailMailbox, EmailOutbox, EmailStatus
from app.services.email.policy import local_day_start

logger = structlog.get_logger("app.services.email.mailboxes")

CHANNEL_CATEGORY = EmailCategory.prospeccion.value
BOUNCE_LIMIT_PCT = 3.0          # un punto por debajo del límite de Resend (4 %): frena antes de que se note
MIN_SAMPLE = 30                 # con menos envíos se mira la cantidad, no el porcentaje
MAX_BOUNCES_SMALL_SAMPLE = 3
WINDOW = 100                    # últimos envíos de la casilla que cuentan
_ADDRESS = re.compile(r"^[a-z0-9][a-z0-9._+-]{0,63}@([a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){1,4})$")


class MailboxError(ValueError):
    """Dirección rechazada: el mensaje se le muestra a Talency."""


def parse_address(raw: str) -> tuple[str, str]:
    """(dirección en minúsculas, dominio). Rechaza la raíz del dominio y las direcciones raras."""
    address = (raw or "").strip().lower()
    m = _ADDRESS.match(address)
    if not m:
        raise MailboxError("La dirección no es válida.")
    domain = m.group(1)
    if domain == settings.MAIL_ROOT_DOMAIN.lower():
        raise MailboxError(f"No se envía desde {domain}: usá un subdominio (por ejemplo contacto.{domain}).")
    return address, domain


def format_from(box: EmailMailbox) -> str:
    name = (box.display_name or "").replace('"', "").replace("<", "").replace(">", "").strip()
    return f"{name} <{box.address}>" if name else box.address


async def domain_status(domain: str) -> tuple[bool | None, str | None]:
    """¿El dominio está verificado en Resend? `None` = no se pudo saber (sin clave o sin red).
    En modo simulado no se consulta: se da por bueno."""
    if (settings.PROSPECT_MODE or "auto").lower() == "simulate":
        return True, None
    key = settings.PROSPECT_RESEND_API_KEY or settings.RESEND_API_KEY
    if not key:
        return None, "Falta la clave de Resend: no se puede verificar el dominio."
    try:
        domains = await resend_client.list_domains(api_key=key)
    except Exception as exc:
        return None, f"No se pudo consultar Resend ({str(exc)[:120]})."
    for d in domains:
        if str(d.get("name", "")).lower() == domain:
            ok = str(d.get("status", "")).lower() == "verified"
            return ok, None if ok else f"El dominio {domain} todavía no está verificado en Resend."
    return False, f"El dominio {domain} no está cargado en Resend."


async def sent_today(db: AsyncSession, now: datetime) -> dict[str, int]:
    rows = (await db.execute(
        select(EmailOutbox.from_email, func.count()).where(
            EmailOutbox.category == CHANNEL_CATEGORY, EmailOutbox.status == EmailStatus.sent.value,
            EmailOutbox.sent_at >= local_day_start(now), EmailOutbox.from_email.is_not(None))
        .group_by(EmailOutbox.from_email))).all()
    return {a: n for a, n in rows}


async def active(db: AsyncSession) -> list[EmailMailbox]:
    return list((await db.execute(
        select(EmailMailbox).where(EmailMailbox.status == "activa").order_by(EmailMailbox.address))).scalars().all())


@dataclass
class Slot:
    box: EmailMailbox
    used: int

    @property
    def left(self) -> int:
        return max(0, self.box.daily_limit - self.used)


async def slots(db: AsyncSession, now: datetime) -> list[Slot]:
    used = await sent_today(db, now)
    return [Slot(b, used.get(b.address, 0)) for b in await active(db)]


def pick(available: list[Slot]) -> Slot | None:
    """La casilla con cupo que menos envió hoy (empate: orden alfabético)."""
    candidates = [s for s in available if s.left > 0]
    return min(candidates, key=lambda s: (s.used, s.box.address)) if candidates else None


# ── Frenos ──────────────────────────────────────────────────────────────────────────────

async def evaluate(db: AsyncSession, address: str | None) -> str | None:
    """Revisa la salud de una casilla y la pausa si hace falta. Devuelve el motivo si la pausó.
    No commitea."""
    if not address:
        return None
    box = (await db.execute(select(EmailMailbox).where(EmailMailbox.address == address))).scalar_one_or_none()
    if box is None or box.status != "activa":
        return None
    recent = (await db.execute(
        select(EmailOutbox.bounced_at, EmailOutbox.bounce_permanent, EmailOutbox.complained_at).where(
            EmailOutbox.from_email == address, EmailOutbox.status == EmailStatus.sent.value,
            EmailOutbox.sent_at >= box.health_since)
        .order_by(EmailOutbox.sent_at.desc()).limit(WINDOW))).all()
    sent = len(recent)
    complaints = sum(1 for _b, _p, c in recent if c is not None)
    bounces = sum(1 for b, p, _c in recent if b is not None and p is not False)
    reason = None
    if complaints:
        reason = f"Freno automático: {complaints} queja(s) de spam."
    elif sent >= MIN_SAMPLE and 100.0 * bounces / sent > BOUNCE_LIMIT_PCT:
        reason = f"Freno automático: {bounces} rebotes en {sent} envíos ({100.0 * bounces / sent:.1f} %)."
    elif sent < MIN_SAMPLE and bounces >= MAX_BOUNCES_SMALL_SAMPLE:
        reason = f"Freno automático: {bounces} rebotes en {sent} envíos."
    if reason:
        box.status, box.status_reason = "pausada", reason
        logger.error("casilla_pausada", address=address, reason=reason)
        from app.services.notifications import notify_all_admins

        await notify_all_admins(
            db, type="admin_email_health", title=f"Se pausó la casilla {address}", body=reason,
            link="/dashboard/admin/mails")
    return reason
