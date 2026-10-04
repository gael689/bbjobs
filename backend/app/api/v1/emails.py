"""Mails: bajas, preferencias del usuario y webhook de eventos de Resend.

Bajas en dos pasos (auditoría M15): el GET del link **nunca da de baja**. Los antivirus y los
escáneres de correo abren los links de los mails; si el GET diera de baja, la gente quedaría
dada de baja sin haber hecho click. El GET redirige a la página `/baja` del frontend, que
confirma con un POST. El POST es también el que usan Gmail y Yahoo desde el header
`List-Unsubscribe-Post` (RFC 8058).
"""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import quote

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from svix.webhooks import Webhook, WebhookVerificationError

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.features import require_new_modules
from app.models.core import User, UserRole
from app.models.email import (
    ALWAYS_SENT,
    EmailCategory,
    EmailOutbox,
    EmailPreference,
    EmailStatus,
    EmailSuppression,
)
from app.services.email.tokens import verify_prospect_token, verify_unsubscribe_token

logger = structlog.get_logger("app.api.email")
# Módulo en desarrollo: 404 en todas sus rutas mientras la compuerta esté cerrada.
router = APIRouter(dependencies=[Depends(require_new_modules)])

# Qué categorías ve cada rol en "Mi cuenta". `cuenta` aparece bloqueada (llega siempre).
CATEGORIES_BY_ROLE: dict[UserRole, list[EmailCategory]] = {
    UserRole.candidate: [
        EmailCategory.cuenta, EmailCategory.postulaciones, EmailCategory.alertas,
        EmailCategory.recordatorios, EmailCategory.novedades,
    ],
    UserRole.company: [
        EmailCategory.cuenta, EmailCategory.postulaciones, EmailCategory.busquedas,
        EmailCategory.alertas, EmailCategory.recordatorios, EmailCategory.novedades,
    ],
    UserRole.admin: [EmailCategory.admin],
}


async def _set_preference(db: AsyncSession, user_id, category: EmailCategory, enabled: bool) -> None:
    stmt = pg_insert(EmailPreference).values(user_id=user_id, category=category.value, enabled=enabled)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_email_pref_user_category",
        set_={"enabled": enabled, "updated_at": datetime.now(timezone.utc)},
    )
    await db.execute(stmt)


# ── Bajas ────────────────────────────────────────────────────────────────────────────────

@router.get("/email/unsubscribe")
async def unsubscribe_landing(t: str = Query(..., max_length=500)):
    """No da de baja: lleva a la página que pide confirmación."""
    return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/baja?t={quote(t, safe='')}", status_code=303)


class UnsubscribeResult(BaseModel):
    ok: bool
    category: str


@router.post("/email/unsubscribe", response_model=UnsubscribeResult)
async def unsubscribe(t: str = Query(..., max_length=500), db: AsyncSession = Depends(get_db)):
    """Baja de una categoría con el token firmado del mail. Sin sesión: tiene que andar desde el
    cliente de correo. Responde 200 (RFC 8058 pide 200/202)."""
    parsed = verify_unsubscribe_token(t)
    if parsed is None:
        raise HTTPException(status_code=400, detail="Link de baja inválido")
    user_id, category = parsed
    exists = (await db.execute(select(User.id).where(User.id == user_id))).scalar_one_or_none()
    if exists is None:
        # La cuenta ya no existe: no hay a quién escribirle. Igual se responde bien.
        return UnsubscribeResult(ok=True, category=category.value)
    await _set_preference(db, user_id, category, False)
    await db.commit()
    logger.info("email_baja", category=category.value)
    return UnsubscribeResult(ok=True, category=category.value)


# ── Bajas de empresas prospecto ──────────────────────────────────────────────────────────

@router.get("/email/unsubscribe-prospect")
async def unsubscribe_prospect_landing(t: str = Query(..., max_length=500)):
    return RedirectResponse(f"{settings.FRONTEND_URL.rstrip('/')}/baja?tipo=empresa&t={quote(t, safe='')}", status_code=303)


@router.post("/email/unsubscribe-prospect", response_model=UnsubscribeResult)
async def unsubscribe_prospect(t: str = Query(..., max_length=500), db: AsyncSession = Depends(get_db)):
    """La empresa no recibe nada más de BBJobs, nunca: todas sus direcciones a la supresión."""
    from app.models.prospect import Prospect, ProspectEmail, ProspectEvent

    prospect_id = verify_prospect_token(t)
    if prospect_id is None:
        raise HTTPException(status_code=400, detail="Link de baja inválido")
    prospect = (await db.execute(select(Prospect).where(Prospect.id == prospect_id))).scalar_one_or_none()
    if prospect is not None:
        emails = (await db.execute(select(ProspectEmail.email).where(ProspectEmail.prospect_id == prospect.id))).scalars().all()
        await _suppress(db, list(emails), "baja_prospecto")
        prospect.do_not_contact, prospect.do_not_contact_reason = True, "baja"
        db.add(ProspectEvent(prospect_id=prospect.id, kind="baja", detail="Pidió no recibir más mails"))
        await db.commit()
    return UnsubscribeResult(ok=True, category="prospeccion")


# ── Preferencias ("Mi cuenta") ───────────────────────────────────────────────────────────

class PreferenceItem(BaseModel):
    category: str
    enabled: bool
    locked: bool


@router.get("/me/email-preferences", response_model=list[PreferenceItem])
async def get_preferences(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(EmailPreference.category, EmailPreference.enabled).where(EmailPreference.user_id == user.id)
    )).all()
    saved = {c: e for c, e in rows}
    role = UserRole(user.role)
    return [
        PreferenceItem(
            category=c.value,
            enabled=True if c in ALWAYS_SENT else saved.get(c.value, True),
            locked=c in ALWAYS_SENT,
        )
        for c in CATEGORIES_BY_ROLE.get(role, [])
    ]


class PreferenceUpdate(BaseModel):
    preferences: dict[str, bool]


@router.put("/me/email-preferences", response_model=list[PreferenceItem])
async def update_preferences(
    payload: PreferenceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = set(CATEGORIES_BY_ROLE.get(UserRole(user.role), []))
    for raw, enabled in payload.preferences.items():
        try:
            category = EmailCategory(raw)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Categoría desconocida: {raw}")
        if category not in allowed:
            raise HTTPException(status_code=422, detail=f"Categoría no disponible: {raw}")
        if category in ALWAYS_SENT:
            continue  # se ignora en silencio: no se puede apagar
        await _set_preference(db, user.id, category, enabled)
    await db.commit()
    return await get_preferences(user=user, db=db)


# ── Webhook de Resend ────────────────────────────────────────────────────────────────────

_TIMESTAMP_FIELD = {
    "email.delivered": "delivered_at",
    "email.opened": "opened_at",
    "email.clicked": "clicked_at",
    "email.bounced": "bounced_at",
    "email.complained": "complained_at",
}
_SUPPRESS = {"email.bounced": "bounced", "email.complained": "complained"}


async def _suppress(db: AsyncSession, emails: list[str], reason: str) -> None:
    for email in emails:
        stmt = pg_insert(EmailSuppression).values(email=email.lower(), reason=reason)
        await db.execute(stmt.on_conflict_do_nothing(index_elements=["email"]))


@router.post("/webhooks/resend-prospeccion")
async def resend_prospect_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Mismo tratamiento que el de los avisos, para la cuenta de prospección. Un rebote o una
    queja también deja a la empresa como "no contactar"."""
    return await _handle_resend_event(request, db, settings.PROSPECT_RESEND_WEBHOOK_SECRET)


@router.post("/webhooks/resend")
async def resend_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    return await _handle_resend_event(request, db, settings.RESEND_WEBHOOK_SECRET)


async def _handle_resend_event(request: Request, db: AsyncSession, secret: str | None):
    """Idempotente sin tabla de eventos: cada efecto es "poner una fecha si estaba vacía" o
    "insertar una supresión si no existía". Resend reintenta y el mismo evento puede llegar
    dos veces (v3 M6) sin cambiar el resultado."""
    if not secret:
        # Sin secret no hay contra qué verificar: se rechaza (falla cerrado), nunca se acepta.
        raise HTTPException(status_code=503, detail="Webhook de Resend no configurado")
    body = await request.body()
    try:
        event = Webhook(secret).verify(body, dict(request.headers))
    except WebhookVerificationError:
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event_type = event.get("type", "")
    data = event.get("data") or {}
    recipients = [r for r in (data.get("to") or []) if isinstance(r, str)]
    now = datetime.now(timezone.utc)

    if event_type in _SUPPRESS and recipients:
        await _suppress(db, recipients, _SUPPRESS[event_type])
    elif event_type == "suppression.added":
        address = data.get("email") or (recipients[0] if recipients else None)
        if address:
            await _suppress(db, [address], "resend")

    provider_id = data.get("email_id")
    if provider_id:
        row = (await db.execute(
            select(EmailOutbox).where(EmailOutbox.provider_message_id == str(provider_id))
        )).scalar_one_or_none()
        if row is not None:
            field = _TIMESTAMP_FIELD.get(event_type)
            if field and getattr(row, field) is None:
                setattr(row, field, now)
            if event_type == "email.failed":
                row.status = EmailStatus.failed.value
                row.last_error = str(data.get("failed") or data.get("reason") or "email.failed")[:1000]
            if row.prospect_id and event_type in _SUPPRESS:
                from app.models.prospect import Prospect, ProspectEvent

                prospect = (await db.execute(select(Prospect).where(Prospect.id == row.prospect_id))).scalar_one_or_none()
                if prospect is not None and not prospect.do_not_contact:
                    prospect.do_not_contact, prospect.do_not_contact_reason = True, _SUPPRESS[event_type]
                    db.add(ProspectEvent(prospect_id=prospect.id, kind="baja", detail=f"Resend: {event_type}"))

    await db.commit()
    return {"status": "ok"}
