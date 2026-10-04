"""Encolar el mail de una notificación, en la misma transacción que el evento que la origina.

Si el evento hace rollback, el mail tampoco existe; si hace commit, el mail queda en la cola y
lo manda el dispatcher. Nunca se llama a Resend desde acá: una caída del proveedor no puede
romper una postulación ni la verificación de una empresa.

No se encola nada si el módulo está apagado (interruptor general o `EMAIL_MODE=off`): así no
se acumulan mails viejos que saldrían todos juntos el día que se prenda, y no se guardan
direcciones de mail sin necesidad.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.core import User
from app.models.email import EmailOutbox, EmailStatus, EmailTemplate
from app.models.settings import SettingKey
from app.services.email.catalog import rule_for
from app.services.email.provider import resolve_mode
from app.services.email.render import render_email, substitute
from app.services.email.tokens import unsubscribe_page_url
from app.services.settings import get_setting

logger = structlog.get_logger("app.services.email.outbox")


async def emails_enabled(db: AsyncSession) -> bool:
    if resolve_mode() == "off":
        return False
    return await get_setting(db, SettingKey.emails_automaticos_activos)


async def template_override(db: AsyncSession, key: str) -> EmailTemplate | None:
    return (await db.execute(select(EmailTemplate).where(EmailTemplate.key == key))).scalar_one_or_none()


def build_content(
    *, user_id: uuid.UUID, category, title: str, body: str, link: str | None,
    cta_label: str, unsubscribable: bool, override: EmailTemplate | None,
):
    """Asunto, HTML y texto. Las variables de las plantillas editables son `{{titulo}}` y
    `{{mensaje}}`; se reemplazan en texto plano y el renderer escapa todo después."""
    variables = {"titulo": title, "mensaje": body}
    subject = substitute(override.subject_override, variables) if override and override.subject_override else title
    text = substitute(override.body_override, variables) if override and override.body_override else body
    rendered = render_email(
        heading=title,
        body=text,
        cta_label=cta_label if link else None,
        cta_url=link,
        unsubscribe_url=unsubscribe_page_url(user_id, category) if unsubscribable else None,
    )
    return subject[:500], rendered


async def queue_email_for_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    link: str | None,
    ref_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> EmailOutbox | None:
    rule = rule_for(type)
    if rule.mode != "instant":
        return None
    if not await emails_enabled(db):
        return None

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None or user.deleted_at is not None or not user.is_active:
        return None

    override = await template_override(db, type)
    if override is not None and not override.enabled:
        return None

    subject, rendered = build_content(
        user_id=user.id, category=rule.category, title=title, body=body, link=link,
        cta_label=rule.cta_label, unsubscribable=rule.unsubscribable, override=override,
    )
    now = now or datetime.now(timezone.utc)
    row = EmailOutbox(
        id=uuid.uuid4(),
        user_id=user.id,
        to_email=user.email,
        category=rule.category.value,
        template_key=type,
        subject=subject,
        html=rendered.html,
        text=rendered.text,
        status=EmailStatus.pending.value,
        attempts=0,
        ref_id=ref_id,
        scheduled_at=now + rule.delay,
    )
    db.add(row)
    return row
