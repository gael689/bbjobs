"""Envío de mails de prospección (empresas que todavía no están en BBJobs).

Canal **separado** del de los avisos (PROSPECCION-Y-CAMPANAS-DE-OFERTA-PLAN.md §5): otra API key
(`PROSPECT_RESEND_API_KEY`, idealmente otra cuenta de Resend) y otro remitente/subdominio. El
dispatcher de avisos nunca toca la categoría `prospeccion`.

Reglas (P): días hábiles de 9 a 12 de Argentina · tope diario propio (`PROSPECT_DAILY_CAP`) · una
empresa recibe como mucho un mail de prospección cada 30 días (los seguimientos de la misma
campaña no cuentan) · el 2.º y 3.º toque salen sólo si el anterior se **entregó** y la empresa
no respondió · nunca a una empresa suprimida, dada de baja, registrada o descartada · baja de un
clic (RFC 8058).
"""
from __future__ import annotations

import asyncio
import html
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import async_session_maker
from app.integrations import resend_client
from app.integrations.resend_client import EmailSendError, OutgoingEmail, idempotency_key
from app.models.email import EmailCampaign, EmailCategory, EmailOutbox, EmailStatus, EmailSuppression
from app.models.prospect import Prospect, ProspectEvent, ProspectStage
from app.services.email.policy import AR_TZ, local_day_start
from app.services.email.render import RenderedEmail, absolute_url, substitute
from app.services.email.tokens import prospect_unsubscribe_api_url, prospect_unsubscribe_page_url

logger = structlog.get_logger("app.services.email.prospect_dispatch")

WINDOW_START, WINDOW_END = time(9, 0), time(12, 0)
MIN_DAYS_BETWEEN = 30
REQUEST_INTERVAL_SECONDS = 0.5
_CAT = EmailCategory.prospeccion.value
_CLOSED_STAGES = (ProspectStage.registrada.value, ProspectStage.descartada.value)


class ProspectSender(ABC):
    @abstractmethod
    async def send(self, msg: OutgoingEmail) -> str: ...


class ResendProspectSender(ProspectSender):
    async def send(self, msg: OutgoingEmail) -> str:
        return await resend_client.send_email(msg, api_key=prospect_api_key(),
                                              from_email=settings.PROSPECT_FROM_EMAIL)


class SimulatedProspectSender(ProspectSender):
    def __init__(self) -> None:
        self.sent: list[OutgoingEmail] = []

    async def send(self, msg: OutgoingEmail) -> str:
        self.sent.append(msg)
        return f"sim_{uuid.uuid4().hex}"


def prospect_api_key() -> str | None:
    """La key de prospección. Sin una propia, la misma cuenta de Resend que los avisos (decisión de
    Gael, 10/11/2026): el aislamiento lo da el subdominio `contacto.`, que tiene su reputación."""
    return settings.PROSPECT_RESEND_API_KEY or settings.RESEND_API_KEY


def get_prospect_sender() -> ProspectSender | None:
    mode = (settings.PROSPECT_MODE or "auto").lower()
    if mode == "auto":
        mode = "resend" if prospect_api_key() else "off"
    if mode == "resend" and prospect_api_key():
        if not settings.PROSPECT_REPLY_TO:
            # Sin buzón de respuesta, lo que conteste una empresa iría a `contacto@contacto.`,
            # que no recibe: mejor no mandar nada.
            logger.warning("prospect_sender_sin_reply_to")
            return None
        return ResendProspectSender()
    if mode == "simulate":
        return SimulatedProspectSender()
    return None


def in_window(now: datetime) -> bool:
    local = now.astimezone(AR_TZ)
    return local.weekday() < 5 and WINDOW_START <= local.time() < WINDOW_END


def render_for_prospect(prospect: Prospect, *, subject: str, body: str, cta_label: str | None, cta_url: str | None):
    """Mail de prospección en **texto plano**, como uno escrito a mano (igual que la presentación
    de MBK): sin diseño, sin logo, sin imágenes y sin seguimiento. Llega mejor a la bandeja de
    entrada y no parece publicidad. El `html` que se guarda es sólo el mismo texto, para la vista
    previa del panel; al enviar viaja únicamente el texto (`dispatch_prospects`)."""
    variables = {"empresa": prospect.name, "localidad": prospect.locality or "Bahía Blanca"}
    partes = [substitute(body, variables).strip()]
    link = absolute_url(cta_url)
    if link:
        partes.append(f"{cta_label.strip()}: {link}" if cta_label and cta_label.strip() else link)
    partes.append("--\n" + PIE_PROSPECCION.format(baja=prospect_unsubscribe_page_url(prospect.id)))
    text = "\n\n".join(p for p in partes if p)
    html_preview = ('<div style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;'
                    f'line-height:1.5;color:#1C2230">{html.escape(text)}</div>')
    return substitute(subject, variables)[:500], RenderedEmail(html=html_preview, text=text)


PIE_PROSPECCION = ("Les escribimos porque los datos de contacto de su empresa están publicados.\n"
                   "Para no recibir más mails nuestros: {baja}")


@dataclass
class ProspectDispatchStats:
    sent: int = 0
    skipped: int = 0
    canceled: int = 0
    failed: int = 0
    followups_queued: int = 0


async def _skip(row: EmailOutbox, status: str, reason: str) -> None:
    row.status = status
    row.last_error = reason


async def dispatch_prospects(*, session_maker=async_session_maker, sender: ProspectSender | None = None,
                             now: datetime | None = None, use_configured_sender: bool = True) -> ProspectDispatchStats:
    stats = ProspectDispatchStats()
    now = now or datetime.now(timezone.utc)
    if sender is None and use_configured_sender:
        sender = get_prospect_sender()
    if sender is None or not in_window(now):
        return stats   # fuera de franja o sin canal: la cola espera, no se descarta

    async with session_maker() as db:
        sent_today = (await db.execute(select(func.count()).select_from(EmailOutbox).where(
            EmailOutbox.category == _CAT, EmailOutbox.status == EmailStatus.sent.value,
            EmailOutbox.sent_at >= local_day_start(now)))).scalar_one()
        remaining = settings.PROSPECT_DAILY_CAP - sent_today
        if remaining <= 0:
            return stats
        rows = list((await db.execute(
            select(EmailOutbox).where(EmailOutbox.category == _CAT, EmailOutbox.status == EmailStatus.pending.value,
                                      EmailOutbox.scheduled_at <= now)
            .order_by(EmailOutbox.touch.desc(), EmailOutbox.scheduled_at).limit(remaining)
            .with_for_update(skip_locked=True)
        )).scalars().all())
        for row in rows:
            row.status, row.claimed_at = EmailStatus.sending.value, now
        await db.commit()

        for i, row in enumerate(rows):
            prospect = (await db.execute(select(Prospect).where(Prospect.id == row.prospect_id))).scalar_one_or_none() \
                if row.prospect_id else None
            if prospect is None:
                await _skip(row, EmailStatus.skipped.value, "la empresa ya no existe")
                stats.skipped += 1
                continue
            suppressed = (await db.execute(select(func.count()).select_from(EmailSuppression).where(
                EmailSuppression.email == row.to_email.lower()))).scalar_one()
            if prospect.do_not_contact or suppressed or prospect.stage in _CLOSED_STAGES:
                await _skip(row, EmailStatus.skipped.value, "empresa dada de baja, registrada o descartada")
                stats.skipped += 1
                continue

            if row.touch > 1:
                previous = (await db.execute(select(EmailOutbox).where(
                    EmailOutbox.prospect_id == prospect.id, EmailOutbox.campaign_id == row.campaign_id,
                    EmailOutbox.touch == row.touch - 1))).scalar_one_or_none()
                if previous is None or previous.delivered_at is None or prospect.stage != ProspectStage.contactada.value:
                    await _skip(row, EmailStatus.canceled.value, "el toque anterior no se entregó o la empresa respondió")
                    stats.canceled += 1
                    continue
            else:
                recent = (await db.execute(select(func.count()).select_from(EmailOutbox).where(
                    EmailOutbox.prospect_id == prospect.id, EmailOutbox.category == _CAT,
                    EmailOutbox.status == EmailStatus.sent.value,
                    EmailOutbox.sent_at >= now - timedelta(days=MIN_DAYS_BETWEEN)))).scalar_one()
                if recent:
                    await _skip(row, EmailStatus.skipped.value, "ya recibió un mail de prospección en los últimos 30 días")
                    stats.skipped += 1
                    continue

            if i:
                await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
            msg = OutgoingEmail(
                to=row.to_email, subject=row.subject, html="", text=row.text,  # sólo texto
                headers={"List-Unsubscribe": f"<{prospect_unsubscribe_api_url(prospect.id)}>",
                         "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"},
                tags={"tipo": "prospeccion", "toque": str(row.touch)},
                reply_to=settings.PROSPECT_REPLY_TO, idempotency_key=idempotency_key("prospect", row.id),
            )
            try:
                row.provider_message_id = await sender.send(msg)
            except EmailSendError as err:
                row.attempts += 1
                row.last_error = str(err)[:1000]
                if err.transient and row.attempts < 3:
                    row.status, row.claimed_at = EmailStatus.pending.value, None
                    row.scheduled_at = now + timedelta(days=1)
                else:
                    row.status = EmailStatus.failed.value
                    stats.failed += 1
                continue

            row.status, row.sent_at, row.attempts = EmailStatus.sent.value, now, row.attempts + 1
            stats.sent += 1
            prospect.last_contacted_at = now
            if prospect.stage == ProspectStage.nueva.value:
                prospect.stage = ProspectStage.contactada.value
            campaign = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == row.campaign_id))).scalar_one_or_none() \
                if row.campaign_id else None
            db.add(ProspectEvent(prospect_id=prospect.id, kind="mail_enviado",
                                 detail=f"{campaign.name if campaign else 'Mail'} (toque {row.touch})"))
            # Programar el próximo toque, si la campaña lo tiene.
            follow_ups = (campaign.follow_ups or []) if campaign else []
            if row.touch <= len(follow_ups):
                fu = follow_ups[row.touch - 1]
                subject, rendered = render_for_prospect(prospect, subject=fu.get("subject") or row.subject,
                                                        body=fu.get("body") or "", cta_label=campaign.cta_label,
                                                        cta_url=campaign.cta_url)
                if fu.get("body"):
                    db.add(EmailOutbox(
                        id=uuid.uuid4(), user_id=None, prospect_id=prospect.id, to_email=row.to_email, category=_CAT,
                        template_key="prospeccion", subject=subject, html=rendered.html, text=rendered.text,
                        status=EmailStatus.pending.value, attempts=0, campaign_id=campaign.id, touch=row.touch + 1,
                        scheduled_at=now + timedelta(days=int(fu.get("after_days") or 7)),
                    ))
                    stats.followups_queued += 1
        await db.commit()
    if stats.sent or stats.failed:
        logger.info("prospect_dispatch", **vars(stats))
    return stats
