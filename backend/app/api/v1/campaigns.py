"""Campañas: panel de Talency (módulo en desarrollo, detrás de la compuerta).

Borrador → (prueba a su propio mail) → **aprobación con la cantidad de destinatarios a la
vista** → programada → en la cola. Nada sale sin el clic de aprobar.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.features import require_new_modules
from app.integrations.gemini_client import AIError, AIUnavailable, get_provider
from app.models.catalogs import Industry, Zone
from app.models.core import User, UserRole
from app.models.email import CampaignStatus, EmailCampaign, EmailCategory, EmailOutbox, EmailStatus
from app.services.ai.pipeline import log_usage
from app.services.email import campaign_ai, campaigns as service
from app.services.email.render import render_email, substitute

router = APIRouter(dependencies=[Depends(require_new_modules)])
_admin = require_role([UserRole.admin])


class FollowUp(BaseModel):
    after_days: int = Field(ge=3, le=60)
    subject: str = Field(max_length=300)
    body: str = Field(max_length=5000)


class CampaignIn(BaseModel):
    name: str = Field(max_length=200)
    target: Literal["users", "prospects"] = "users"
    audience_key: Optional[str] = None
    zone_id: Optional[uuid.UUID] = None
    industry_id: Optional[uuid.UUID] = None
    prospect_selection: Optional[dict] = None     # {"ids": [...]} o {"filter": {...}}
    product: Optional[str] = None
    subject: str = Field(default="", max_length=300)
    preheader: Optional[str] = Field(default=None, max_length=300)
    body: str = Field(default="", max_length=10000)
    cta_label: Optional[str] = Field(default=None, max_length=80)
    cta_url: Optional[str] = Field(default=None, max_length=500)
    follow_ups: list[FollowUp] = Field(default_factory=list, max_length=2)


class CampaignOut(BaseModel):
    id: uuid.UUID
    name: str
    target: str
    audience_key: Optional[str]
    product: Optional[str]
    subject: str
    preheader: Optional[str]
    body: str
    cta_label: Optional[str]
    cta_url: Optional[str]
    follow_ups: list
    status: str
    scheduled_at: Optional[datetime]
    sent_at: Optional[datetime]
    recipients_total: int
    generated_by_ai: bool
    stats: Optional[dict] = None


def _out(c: EmailCampaign, stats: dict | None = None) -> CampaignOut:
    return CampaignOut(id=c.id, name=c.name, target=c.target, audience_key=c.audience_key, product=c.product,
                       subject=c.subject, preheader=c.preheader, body=c.body, cta_label=c.cta_label, cta_url=c.cta_url,
                       follow_ups=c.follow_ups or [], status=c.status, scheduled_at=c.scheduled_at, sent_at=c.sent_at,
                       recipients_total=c.recipients_total, generated_by_ai=c.generated_by_ai, stats=stats)


def _apply(c: EmailCampaign, p: CampaignIn) -> None:
    c.name, c.target, c.audience_key, c.product = p.name, p.target, p.audience_key, p.product
    c.subject, c.preheader, c.body = p.subject, p.preheader, p.body
    c.cta_label, c.cta_url = p.cta_label, p.cta_url
    c.follow_ups = [f.model_dump() for f in p.follow_ups]
    c.audience = (p.prospect_selection or {}) if p.target == "prospects" else {
        "zone_id": str(p.zone_id) if p.zone_id else None, "industry_id": str(p.industry_id) if p.industry_id else None}


async def _get(db: AsyncSession, campaign_id: uuid.UUID) -> EmailCampaign:
    c = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign_id))).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return c


def _raise(err: service.CampaignError):
    raise HTTPException(status_code=err.status_code, detail=err.message)


class AudienceOut(BaseModel):
    key: str
    label: str
    role: str
    product: str
    recipients: int


@router.get("/admin/campaigns/audiences", response_model=list[AudienceOut])
async def audiences(zone_id: Optional[uuid.UUID] = None, industry_id: Optional[uuid.UUID] = None,
                    _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    return [AudienceOut(key=a.key, label=a.label, role=a.role, product=a.product,
                        recipients=await service.audience_count(db, a.key, zone_id, industry_id))
            for a in service.AUDIENCES.values()]


@router.get("/admin/campaigns", response_model=list[CampaignOut])
async def list_campaigns(_: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(EmailCampaign).order_by(EmailCampaign.created_at.desc()).limit(200))).scalars().all()
    return [_out(c) for c in rows]


@router.post("/admin/campaigns", response_model=CampaignOut, status_code=201)
async def create_campaign(payload: CampaignIn, admin: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    c = EmailCampaign(id=uuid.uuid4(), status=CampaignStatus.draft.value, created_by_admin_id=admin.id,
                      recipients_total=0, subject="", body="", name=payload.name)
    _apply(c, payload)
    db.add(c)
    await db.commit()
    return _out(c)


@router.get("/admin/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: uuid.UUID, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    c = await _get(db, campaign_id)
    return _out(c, await service.stats(db, c))


@router.put("/admin/campaigns/{campaign_id}", response_model=CampaignOut)
async def update_campaign(campaign_id: uuid.UUID, payload: CampaignIn, _: User = Depends(_admin),
                          db: AsyncSession = Depends(get_db)):
    c = await _get(db, campaign_id)
    if c.status != CampaignStatus.draft.value:
        raise HTTPException(status_code=409, detail="Sólo se edita un borrador")
    _apply(c, payload)
    await db.commit()
    return _out(c)


class CountOut(BaseModel):
    recipients: int


@router.get("/admin/campaigns/{campaign_id}/recipients", response_model=CountOut)
async def recipients(campaign_id: uuid.UUID, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    try:
        return CountOut(recipients=await service.recipients_count(db, await _get(db, campaign_id)))
    except service.CampaignError as err:
        _raise(err)


@router.post("/admin/campaigns/{campaign_id}/test", status_code=202)
async def send_test(campaign_id: uuid.UUID, admin: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    """Una prueba al mail de la admin (por el canal de avisos, nunca por el de prospección)."""
    c = await _get(db, campaign_id)
    variables = {"nombre": "Eugenia", "empresa": "Empresa de prueba", "localidad": "Bahía Blanca"}
    rendered = render_email(heading=substitute(c.subject, variables), body=substitute(c.body, variables),
                            preheader=c.preheader, cta_label=c.cta_label, cta_url=c.cta_url,
                            footer_note="Esto es una prueba de una campaña. No salió a nadie más.")
    db.add(EmailOutbox(id=uuid.uuid4(), user_id=admin.id, to_email=admin.email, category=EmailCategory.admin.value,
                       template_key="campana_prueba", subject=f"[Prueba] {substitute(c.subject, variables)}"[:500],
                       html=rendered.html, text=rendered.text, status=EmailStatus.pending.value, attempts=0,
                       scheduled_at=datetime.now(timezone.utc)))
    await db.commit()
    return {"queued": True}


class ApproveIn(BaseModel):
    scheduled_at: Optional[datetime] = None
    expected_recipients: int = Field(ge=1)


@router.post("/admin/campaigns/{campaign_id}/approve", response_model=CampaignOut)
async def approve_campaign(campaign_id: uuid.UUID, payload: ApproveIn, admin: User = Depends(_admin),
                           db: AsyncSession = Depends(get_db)):
    """`expected_recipients` es el número que la admin vio en pantalla: si la audiencia cambió
    mucho desde entonces (±10 %), se rechaza para que lo vuelva a mirar."""
    c = await _get(db, campaign_id)
    try:
        n = await service.approve(db, c, admin, payload.scheduled_at)
    except service.CampaignError as err:
        _raise(err)
    if abs(n - payload.expected_recipients) > max(5, payload.expected_recipients // 10):
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"La audiencia cambió: ahora son {n}. Revisala y volvé a aprobar.")
    await db.commit()
    return _out(c)


@router.post("/admin/campaigns/{campaign_id}/cancel", response_model=CampaignOut)
async def cancel_campaign(campaign_id: uuid.UUID, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    c = await _get(db, campaign_id)
    if c.status not in (CampaignStatus.draft.value, CampaignStatus.scheduled.value, CampaignStatus.sent.value):
        raise HTTPException(status_code=409, detail="No se puede cancelar en este estado")
    c.status = CampaignStatus.canceled.value
    # Lo que todavía no salió, no sale.
    pending = (await db.execute(select(EmailOutbox).where(EmailOutbox.campaign_id == c.id,
                                                          EmailOutbox.status == EmailStatus.pending.value))).scalars().all()
    for row in pending:
        row.status, row.last_error = EmailStatus.canceled.value, "campaña cancelada"
    await db.commit()
    return _out(c)


# ── IA ──────────────────────────────────────────────────────────────────────────────────

class DraftIn(BaseModel):
    brief: str = Field(min_length=10, max_length=1500)
    target: Literal["users", "prospects"] = "users"
    audience_key: Optional[str] = None
    product: Optional[str] = None


class DraftOut(BaseModel):
    subjects: list[str]
    preheader: str
    body: str
    cta_label: str


def _provider():
    try:
        return get_provider()
    except AIUnavailable:
        raise HTTPException(status_code=503, detail="La IA no está configurada")


@router.post("/admin/campaigns/ai/draft", response_model=DraftOut)
async def ai_draft(payload: DraftIn, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    """Propone un texto. **No crea ni manda nada**: Eugenia lo copia al borrador, lo edita y aprueba."""
    label = service.AUDIENCES[payload.audience_key].label if payload.audience_key in service.AUDIENCES else None
    try:
        draft, usage = await campaign_ai.draft_campaign(_provider(), brief=payload.brief, target=payload.target,
                                                        audience_label=label, product=payload.product)
    except AIError as exc:
        raise HTTPException(status_code=502, detail=f"La IA no respondió: {exc}")
    await log_usage(db, "campana_borrador", usage)
    await db.commit()
    return DraftOut(subjects=draft.asuntos, preheader=draft.preheader, body=draft.cuerpo, cta_label=draft.boton)


class AudienceTextIn(BaseModel):
    text: str = Field(min_length=3, max_length=500)


class AudienceTextOut(BaseModel):
    audience_key: str
    label: str
    zone_id: Optional[uuid.UUID] = None
    industry_id: Optional[uuid.UUID] = None
    recipients: int
    unresolved: list[str] = []


@router.post("/admin/campaigns/ai/audience", response_model=AudienceTextOut)
async def ai_audience(payload: AudienceTextIn, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    """"Empresas de gastronomía que nunca publicaron" → audiencia + filtros, con la cantidad."""
    try:
        choice, usage = await campaign_ai.audience_from_text(_provider(), payload.text)
    except (AIError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"No pude interpretar el pedido: {exc}")
    unresolved = []
    zone_id = industry_id = None
    if choice.zona:
        zone_id = (await db.execute(select(Zone.id).where(Zone.name.ilike(choice.zona)))).scalar_one_or_none()
        if zone_id is None:
            unresolved.append(f"zona '{choice.zona}'")
    if choice.rubro:
        industry_id = (await db.execute(select(Industry.id).where(Industry.name.ilike(choice.rubro)))).scalar_one_or_none()
        if industry_id is None:
            unresolved.append(f"rubro '{choice.rubro}'")
    await log_usage(db, "campana_audiencia", usage)
    await db.commit()
    aud = service.AUDIENCES[choice.audience_key]
    return AudienceTextOut(audience_key=aud.key, label=aud.label, zone_id=zone_id, industry_id=industry_id,
                           recipients=await service.audience_count(db, aud.key, zone_id, industry_id),
                           unresolved=unresolved)
