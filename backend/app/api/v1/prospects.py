"""Prospección: sincronización desde el centro y panel de Talency.

Módulo en desarrollo: 404 con la compuerta cerrada. El endpoint de sincronización no usa Clerk:
lo llama el centro de Gael con una firma HMAC (`LEADGEN_SYNC_SECRET`) y un timestamp.
"""
from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.core.features import require_new_modules
from app.models.core import User, UserRole
from app.models.email import EmailSuppression
from app.models.prospect import Prospect, ProspectEmail, ProspectEvent, ProspectStage, ProspectSync
from app.services import prospects as service

router = APIRouter(dependencies=[Depends(require_new_modules)])

MAX_BODY_BYTES = 2_000_000


# ── Sincronización (centro → BBJobs) ────────────────────────────────────────────────────

class SyncEmail(BaseModel):
    email: str = Field(max_length=255)
    mx_valid: Optional[bool] = None


class SyncCompany(BaseModel):
    external_id: str = Field(max_length=255)
    name: str = Field(max_length=255)
    category: Optional[str] = Field(default=None, max_length=255)
    locality: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=500)
    phone: Optional[str] = Field(default=None, max_length=50)
    whatsapp: Optional[str] = Field(default=None, max_length=50)
    website: Optional[str] = Field(default=None, max_length=500)
    instagram: Optional[str] = Field(default=None, max_length=500)
    facebook: Optional[str] = Field(default=None, max_length=500)
    linkedin: Optional[str] = Field(default=None, max_length=500)
    rating: Optional[float] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    emails: list[SyncEmail] = Field(default_factory=list, max_length=10)


class SyncPayload(BaseModel):
    sync_id: str = Field(min_length=8, max_length=100)
    companies: list[SyncCompany] = Field(default_factory=list, max_length=service.MAX_BATCH)
    suppressions: list[str] = Field(default_factory=list, max_length=5000)


class SyncResponse(BaseModel):
    sync_id: str
    received: int
    created: int
    updated: int
    discarded: int
    suppressed: int
    discarded_reasons: dict[str, int]
    replayed: bool


@router.post("/integrations/leadgen/sync", response_model=SyncResponse)
async def leadgen_sync(request: Request, db: AsyncSession = Depends(get_db)):
    if not settings.LEADGEN_SYNC_SECRET:
        raise HTTPException(status_code=503, detail="Sincronización no configurada")
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Lote demasiado grande")
    if not service.verify_signature(
        settings.LEADGEN_SYNC_SECRET,
        request.headers.get("x-bbjobs-timestamp"),
        request.headers.get("x-bbjobs-signature"),
        body,
    ):
        raise HTTPException(status_code=401, detail="Firma inválida")
    try:
        payload = SyncPayload.model_validate(json.loads(body))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)[:500])
    result = await service.apply_sync(db, payload.model_dump())
    return SyncResponse(**result.__dict__)


# ── Panel de Talency ────────────────────────────────────────────────────────────────────

_admin = require_role([UserRole.admin])


class ProspectFilter(BaseModel):
    q: Optional[str] = Field(default=None, max_length=100)
    category: Optional[str] = None
    locality: Optional[str] = None
    stage: Optional[ProspectStage] = None
    has_email: Optional[bool] = None
    has_whatsapp: Optional[bool] = None
    never_contacted: bool = False
    contactable: bool = False

    def as_dict(self) -> dict:
        d = self.model_dump()
        if d["stage"] is not None:
            d["stage"] = d["stage"].value
        return d


def _filter_from_query(
    q: Optional[str] = Query(default=None, max_length=100),
    category: Optional[str] = None,
    locality: Optional[str] = None,
    stage: Optional[ProspectStage] = None,
    has_email: Optional[bool] = None,
    has_whatsapp: Optional[bool] = None,
    never_contacted: bool = False,
    contactable: bool = False,
) -> ProspectFilter:
    return ProspectFilter(q=q, category=category, locality=locality, stage=stage, has_email=has_email,
                          has_whatsapp=has_whatsapp, never_contacted=never_contacted, contactable=contactable)


class ProspectRow(BaseModel):
    id: uuid.UUID
    name: str
    category: Optional[str] = None
    locality: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    website: Optional[str] = None
    stage: str
    primary_email: Optional[str] = None
    do_not_contact: bool
    last_contacted_at: Optional[datetime] = None
    created_at: datetime


class ProspectPage(BaseModel):
    total: int
    page: int
    size: int
    items: list[ProspectRow]


async def _primary_emails(db: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not ids:
        return {}
    rows = (await db.execute(
        select(ProspectEmail.prospect_id, ProspectEmail.email)
        .where(ProspectEmail.prospect_id.in_(ids),
               ~select(EmailSuppression.id).where(EmailSuppression.email == ProspectEmail.email).exists())
        .order_by(ProspectEmail.is_primary.desc())
    )).all()
    out: dict[uuid.UUID, str] = {}
    for pid, email in rows:
        out.setdefault(pid, email)
    return out


def _row(p: Prospect, email: Optional[str]) -> ProspectRow:
    return ProspectRow(
        id=p.id, name=p.name, category=p.category, locality=p.locality, phone=p.phone, whatsapp=p.whatsapp,
        website=p.website, stage=p.stage, primary_email=email, do_not_contact=p.do_not_contact,
        last_contacted_at=p.last_contacted_at, created_at=p.created_at,
    )


@router.get("/admin/prospects", response_model=ProspectPage)
async def list_prospects(
    f: ProspectFilter = Depends(_filter_from_query),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
    _: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    clauses = service.filter_clauses(f.as_dict())
    total = (await db.execute(select(func.count()).select_from(Prospect).where(*clauses))).scalar_one()
    items = (await db.execute(
        select(Prospect).where(*clauses).order_by(Prospect.name).offset((page - 1) * size).limit(size)
    )).scalars().all()
    emails = await _primary_emails(db, [p.id for p in items])
    return ProspectPage(total=total, page=page, size=size, items=[_row(p, emails.get(p.id)) for p in items])


class FacetValue(BaseModel):
    value: str
    count: int


class Facets(BaseModel):
    categories: list[FacetValue]
    localities: list[FacetValue]
    stages: list[FacetValue]


@router.get("/admin/prospects/facets", response_model=Facets)
async def prospect_facets(_: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    """Valores para los desplegables de filtros, con cuántas empresas hay en cada uno."""
    async def facet(col):
        rows = (await db.execute(
            select(col, func.count()).where(col.is_not(None)).group_by(col).order_by(func.count().desc()).limit(200)
        )).all()
        return [FacetValue(value=v, count=n) for v, n in rows]

    return Facets(categories=await facet(Prospect.category), localities=await facet(Prospect.locality),
                  stages=await facet(Prospect.stage))


class EventOut(BaseModel):
    kind: str
    detail: Optional[str] = None
    created_at: datetime


class ProspectDetail(ProspectRow):
    address: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    linkedin: Optional[str] = None
    rating: Optional[float] = None
    notes: Optional[str] = None
    emails: list[str]
    suppressed_emails: list[str]
    company_profile_id: Optional[uuid.UUID] = None
    events: list[EventOut]


async def _get(db: AsyncSession, prospect_id: uuid.UUID) -> Prospect:
    p = (await db.execute(select(Prospect).where(Prospect.id == prospect_id))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return p


@router.get("/admin/prospects/{prospect_id}", response_model=ProspectDetail)
async def prospect_detail(prospect_id: uuid.UUID, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    p = await _get(db, prospect_id)
    all_emails = (await db.execute(
        select(ProspectEmail.email).where(ProspectEmail.prospect_id == p.id).order_by(ProspectEmail.is_primary.desc())
    )).scalars().all()
    suppressed = await service._suppressed_set(db, list(all_emails))
    events = (await db.execute(
        select(ProspectEvent).where(ProspectEvent.prospect_id == p.id).order_by(ProspectEvent.created_at.desc())
    )).scalars().all()
    usable = [e for e in all_emails if e not in suppressed]
    base = _row(p, usable[0] if usable else None).model_dump()
    return ProspectDetail(
        **base, address=p.address, instagram=p.instagram, facebook=p.facebook, linkedin=p.linkedin,
        rating=p.rating, notes=p.notes, emails=usable, suppressed_emails=sorted(suppressed),
        company_profile_id=p.company_profile_id,
        events=[EventOut(kind=e.kind, detail=e.detail, created_at=e.created_at) for e in events],
    )


class ProspectUpdate(BaseModel):
    stage: Optional[ProspectStage] = None
    notes: Optional[str] = Field(default=None, max_length=5000)


@router.patch("/admin/prospects/{prospect_id}", response_model=ProspectDetail)
async def update_prospect(
    prospect_id: uuid.UUID, payload: ProspectUpdate,
    admin: User = Depends(_admin), db: AsyncSession = Depends(get_db),
):
    p = await _get(db, prospect_id)
    if payload.stage is not None and payload.stage.value != p.stage:
        db.add(ProspectEvent(prospect_id=p.id, kind="etapa", detail=f"{p.stage} → {payload.stage.value}",
                             actor_user_id=admin.id))
        p.stage = payload.stage.value
    if payload.notes is not None:
        p.notes = payload.notes.strip() or None
    await db.commit()
    return await prospect_detail(prospect_id, _=admin, db=db)


class ContactLog(BaseModel):
    kind: Literal["whatsapp", "llamada", "nota"]
    detail: Optional[str] = Field(default=None, max_length=2000)


@router.post("/admin/prospects/{prospect_id}/events", response_model=ProspectDetail)
async def log_contact(
    prospect_id: uuid.UUID, payload: ContactLog,
    admin: User = Depends(_admin), db: AsyncSession = Depends(get_db),
):
    """"WhatsApp enviado" / "llamada hecha" / nota. WhatsApp es asistido: Eugenia lo manda desde
    su teléfono con el link `wa.me` y acá sólo queda registrado."""
    p = await _get(db, prospect_id)
    db.add(ProspectEvent(prospect_id=p.id, kind=payload.kind, detail=payload.detail, actor_user_id=admin.id))
    if payload.kind in ("whatsapp", "llamada"):
        p.last_contacted_at = func.now()
        if p.stage == ProspectStage.nueva.value:
            p.stage = ProspectStage.contactada.value
    await db.commit()
    return await prospect_detail(prospect_id, _=admin, db=db)


class Selection(BaseModel):
    """De a una / varias (`ids`) o **todas las que cumplen un filtro** (`filter`)."""
    ids: Optional[list[uuid.UUID]] = Field(default=None, max_length=5000)
    filter: Optional[ProspectFilter] = None


class BulkAction(Selection):
    action: Literal["set_stage", "discard", "delete"]
    stage: Optional[ProspectStage] = None


class BulkResult(BaseModel):
    affected: int


def _selection_clauses(sel: Selection) -> list:
    if sel.ids:
        return [Prospect.id.in_(sel.ids)]
    if sel.filter is not None:
        return service.filter_clauses(sel.filter.as_dict())
    raise HTTPException(status_code=422, detail="Elegí empresas o un filtro")


@router.post("/admin/prospects/selection/count", response_model=BulkResult)
async def selection_count(sel: Selection, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    """Cuántas empresas abarca una selección, antes de confirmar una acción en masa."""
    n = (await db.execute(select(func.count()).select_from(Prospect).where(*_selection_clauses(sel)))).scalar_one()
    return BulkResult(affected=n)


@router.post("/admin/prospects/bulk", response_model=BulkResult)
async def bulk_action(payload: BulkAction, admin: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    clauses = _selection_clauses(payload)
    targets = (await db.execute(select(Prospect).where(*clauses))).scalars().all()
    if payload.action == "delete":
        # Borrado definitivo (privacidad, plan §4). Las supresiones de sus mails, si hay, quedan.
        ids = [p.id for p in targets]
        if ids:
            await db.execute(delete(Prospect).where(Prospect.id.in_(ids)))
        await db.commit()
        return BulkResult(affected=len(ids))

    new_stage = ProspectStage.descartada if payload.action == "discard" else payload.stage
    if new_stage is None:
        raise HTTPException(status_code=422, detail="Falta la etapa")
    changed = 0
    for p in targets:
        if p.stage != new_stage.value:
            db.add(ProspectEvent(prospect_id=p.id, kind="etapa", detail=f"{p.stage} → {new_stage.value} (en masa)",
                                 actor_user_id=admin.id))
            p.stage = new_stage.value
            changed += 1
    await db.commit()
    return BulkResult(affected=changed)


@router.get("/admin/prospects-export.csv")
async def export_csv(
    f: ProspectFilter = Depends(_filter_from_query),
    _: User = Depends(_admin),
    db: AsyncSession = Depends(get_db),
):
    items = (await db.execute(
        select(Prospect).where(*service.filter_clauses(f.as_dict())).order_by(Prospect.name).limit(20000)
    )).scalars().all()
    emails = await _primary_emails(db, [p.id for p in items])
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["empresa", "rubro", "localidad", "telefono", "whatsapp", "mail", "web", "etapa"])
    for p in items:
        # Las celdas que empiezan con = + - @ se neutralizan: un nombre armado así ejecutaría una
        # fórmula al abrir el CSV en Excel.
        row = [p.name, p.category, p.locality, p.phone, p.whatsapp, emails.get(p.id), p.website, p.stage]
        writer.writerow([("'" + v) if isinstance(v, str) and v[:1] in "=+-@" else (v or "") for v in row])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue().encode("utf-8-sig")]), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="empresas.csv"'},
    )


class SyncRow(BaseModel):
    sync_id: str
    received: int
    created: int
    updated: int
    discarded: int
    suppressed: int
    discarded_reasons: dict[str, int]
    created_at: datetime


@router.get("/admin/prospect-syncs", response_model=list[SyncRow])
async def list_syncs(_: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ProspectSync).order_by(ProspectSync.created_at.desc()).limit(100))).scalars().all()
    return [SyncRow(sync_id=r.sync_id, received=r.received, created=r.created, updated=r.updated,
                    discarded=r.discarded, suppressed=r.suppressed, discarded_reasons=r.discarded_reasons or {},
                    created_at=r.created_at) for r in rows]
