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

from app.core.features import new_modules_enabled
from app.models.core import User
from app.models.email import EmailOutbox, EmailStatus, EmailTemplate
from app.models.settings import SettingKey
from app.services.email.catalog import rule_for
from app.services.email.copy import clean_value, copy_for, fill_copy, first_name, greeting
from app.services.email.provider import resolve_mode
from app.services.email.render import render_email, substitute
from app.services.email.tokens import unsubscribe_page_url
from app.services.settings import get_setting

logger = structlog.get_logger("app.services.email.outbox")


async def emails_enabled(db: AsyncSession) -> bool:
    if not new_modules_enabled() or resolve_mode() == "off":
        return False
    return await get_setting(db, SettingKey.emails_automaticos_activos)


async def template_override(db: AsyncSession, key: str) -> EmailTemplate | None:
    return (await db.execute(select(EmailTemplate).where(EmailTemplate.key == key))).scalar_one_or_none()


def manage_url_for(role: str | None) -> str | None:
    """"Administrar notificaciones": la sección de mails del perfil de cada rol."""
    return {"candidate": "/dashboard/candidate/perfil#mails",
            "company": "/dashboard/company/perfil#mails"}.get(str(getattr(role, "value", role) or ""))


def build_content(
    *, user_id: uuid.UUID, category, title: str, body: str, link: str | None,
    cta_label: str, unsubscribable: bool, override: EmailTemplate | None,
    type: str | None = None, variables: dict | None = None, role: str | None = None,
):
    """Asunto, HTML y texto.

    Si el `type` tiene texto de mail (`copy.py`), sale ése con sus variables; si no, el título y
    el cuerpo de la notificación, como siempre. Las plantillas editables del panel de Talency
    pisan asunto y texto con las variables `{{titulo}}`, `{{mensaje}}`, `{{nombre}}`, `{{puesto}}`
    y `{{empresa}}`; todo se reemplaza en texto plano y el renderer escapa después."""
    variables = {k: clean_value(v) for k, v in (variables or {}).items()}
    variables.setdefault("titulo", clean_value(title))
    variables.setdefault("mensaje", clean_value(body))
    copy = copy_for(type) if type else None
    if copy is not None:
        filled = fill_copy(copy, variables, link)
        heading, subject, text = filled.heading, filled.subject, filled.body
        cta, link = filled.cta_label or cta_label, filled.link
        hello = greeting(variables.get("nombre"))
    else:
        heading, subject, text, cta, hello = title, title, body, cta_label, None
    if override and override.subject_override:
        subject = substitute(override.subject_override, variables)
    if override and override.body_override:
        text = substitute(override.body_override, variables)
    rendered = render_email(
        heading=heading,
        body=text,
        cta_label=cta if link and cta else None,
        cta_url=link if cta else None,
        greeting=hello,
        manage_url=manage_url_for(role) if unsubscribable else None,
        unsubscribe_url=unsubscribe_page_url(user_id, category) if unsubscribable else None,
    )
    return subject[:500], rendered


async def recipient_variables(db: AsyncSession, user: User) -> dict[str, str]:
    """`{nombre}` de quien recibe (y `{empresa}` si es una empresa). Sin nombre cargado, el
    saludo queda en "¡Hola!"."""
    from app.models.candidate import CandidateProfile
    from app.models.company import CompanyProfile
    from app.models.core import AdminProfile

    role = str(getattr(user.role, "value", user.role))
    if role == "candidate":
        name = (await db.execute(select(CandidateProfile.first_name).where(
            CandidateProfile.user_id == user.id))).scalar_one_or_none()
        return {"nombre": first_name(name)}
    if role == "company":
        row = (await db.execute(select(CompanyProfile.responsible_full_name, CompanyProfile.legal_name).where(
            CompanyProfile.user_id == user.id))).first()
        return {"nombre": first_name(row[0]), "empresa": row[1] or ""} if row else {}
    if role == "admin":
        name = (await db.execute(select(AdminProfile.full_name).where(
            AdminProfile.user_id == user.id))).scalar_one_or_none()
        return {"nombre": first_name(name)}
    return {}


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
    email_vars: dict | None = None,
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

    now = now or datetime.now(timezone.utc)
    if rule.once_per_day:
        from sqlalchemy import func

        from app.services.email.policy import local_day_start

        today = (await db.execute(select(func.count()).select_from(EmailOutbox).where(
            EmailOutbox.user_id == user.id, EmailOutbox.template_key == type,
            EmailOutbox.created_at >= local_day_start(now),
        ))).scalar_one()
        if today:
            return None   # ya hubo uno hoy: éste queda sólo en la web

    variables = {**await recipient_variables(db, user), **(email_vars or {})}
    subject, rendered = build_content(
        user_id=user.id, category=rule.category, title=title, body=body, link=link,
        cta_label=rule.cta_label, unsubscribable=rule.unsubscribable, override=override,
        type=type, variables=variables, role=user.role,
    )
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
