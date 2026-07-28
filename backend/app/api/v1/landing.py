from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, asc
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from app.api.deps import get_db, require_role
from app.models.core import User, UserRole
from app.models.landing import LandingStat, LandingStatSource
from app.models.job import JobPosting, Application, JobPostingStatus, JobModerationStatus
from app.models.company import CompanyProfile, VerificationStatus
from app.models.candidate import CandidateProfile
from pydantic import BaseModel

router = APIRouter()

class LandingStatResponse(BaseModel):
    id: uuid.UUID
    icon: str
    source: LandingStatSource
    value: str
    label: str
    sort_order: int
    visible: bool
    hide_when_zero: bool
    class Config:
        from_attributes = True

class LandingStatCreate(BaseModel):
    icon: str = "BriefcaseIcon"
    source: LandingStatSource = LandingStatSource.manual
    value: str = ""
    label: str
    sort_order: int = 0
    visible: bool = True
    hide_when_zero: bool = True

class LandingStatUpdate(BaseModel):
    icon: Optional[str] = None
    source: Optional[LandingStatSource] = None
    value: Optional[str] = None
    label: Optional[str] = None
    sort_order: Optional[int] = None
    visible: Optional[bool] = None
    hide_when_zero: Optional[bool] = None

class ReorderItem(BaseModel):
    id: uuid.UUID
    sort_order: int

class ReorderPayload(BaseModel):
    items: List[ReorderItem]

def _format_ar(n: int) -> str:
    """1240 -> '1.240' (separador de miles es-AR, como lo escribió Eugenia en el PDF)."""
    return f"{n:,}".replace(",", ".")


# Subquery escalar por fuente. Se arman como subqueries y no como queries sueltas porque
# este endpoint corre en cada visita a la home: 4 counts secuenciales son 4 round-trips a la
# base, y acá se resuelven todos en uno solo.
_SOURCE_SUBQUERIES = {
    # Mismo criterio que el listado público de /jobs (jobs.py:159) — el número que se muestra
    # tiene que coincidir con lo que el visitante ve al entrar a /empleos.
    LandingStatSource.active_jobs: (
        select(func.count()).select_from(JobPosting).where(
            JobPosting.status == JobPostingStatus.active,
            JobPosting.moderation_status == JobModerationStatus.approved,
            JobPosting.deleted_at.is_(None),
        )
    ),
    LandingStatSource.verified_companies: (
        select(func.count()).select_from(CompanyProfile).where(
            CompanyProfile.verification_status == VerificationStatus.verified
        )
    ),
    LandingStatSource.registered_candidates: select(func.count()).select_from(CandidateProfile),
    LandingStatSource.total_applications: select(func.count()).select_from(Application),
}


async def _compute_stat_values(db: AsyncSession, sources: set[LandingStatSource]) -> dict[LandingStatSource, int]:
    """Resuelve en una sola query sólo las fuentes que realmente se van a mostrar."""
    wanted = [s for s in _SOURCE_SUBQUERIES if s in sources]
    if not wanted:
        return {}

    row = (await db.execute(
        select(*[_SOURCE_SUBQUERIES[s].scalar_subquery().label(s.value) for s in wanted])
    )).one()

    return {s: (getattr(row, s.value) or 0) for s in wanted}


@router.get("/public/landing-stats", response_model=List[LandingStatResponse])
async def get_public_landing_stats(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LandingStat)
        .where(LandingStat.visible == True)
        .order_by(LandingStat.sort_order.asc())
    )
    stats = list(result.scalars().all())

    computed = await _compute_stat_values(
        db, {s.source for s in stats if s.source != LandingStatSource.manual}
    )

    out: List[LandingStatResponse] = []
    for stat in stats:
        resolved = LandingStatResponse.model_validate(stat)
        if stat.source != LandingStatSource.manual:
            count = computed.get(stat.source, 0)
            if count == 0 and stat.hide_when_zero:
                continue
            # Se pisa sobre la copia Pydantic, nunca sobre el objeto ORM: mutar el ORM lo
            # marcaría dirty y SQLAlchemy podría persistir el número calculado en la tabla.
            resolved.value = _format_ar(count)
        out.append(resolved)
    return out

class AdminLandingStatResponse(LandingStatResponse):
    """Igual que la pública, más lo que el admin necesita para decidir: cuánto da hoy el
    indicador calculado y si con ese número quedaría oculto en la landing."""
    computed_value: Optional[str] = None
    hidden_now: bool = False


@router.get("/admin/landing-stats", response_model=List[AdminLandingStatResponse])
async def get_admin_landing_stats(
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LandingStat).order_by(LandingStat.sort_order.asc())
    )
    stats = list(result.scalars().all())

    computed = await _compute_stat_values(
        db, {s.source for s in stats if s.source != LandingStatSource.manual}
    )

    out: List[AdminLandingStatResponse] = []
    for stat in stats:
        row = AdminLandingStatResponse.model_validate(stat)
        if stat.source != LandingStatSource.manual:
            count = computed.get(stat.source, 0)
            row.computed_value = _format_ar(count)
            row.hidden_now = count == 0 and stat.hide_when_zero
        out.append(row)
    return out

@router.post("/admin/landing-stats", response_model=LandingStatResponse)
async def create_landing_stat(
    payload: LandingStatCreate,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    stat = LandingStat(**payload.model_dump())
    db.add(stat)
    await db.commit()
    await db.refresh(stat)
    return stat

@router.patch("/admin/landing-stats/reorder")
async def reorder_landing_stats(
    payload: ReorderPayload,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all items to update
    stat_ids = [item.id for item in payload.items]
    result = await db.execute(select(LandingStat).where(LandingStat.id.in_(stat_ids)))
    stats = result.scalars().all()
    
    stat_map = {stat.id: stat for stat in stats}
    for item in payload.items:
        if item.id in stat_map:
            stat_map[item.id].sort_order = item.sort_order
            
    await db.commit()
    return {"status": "ok"}

@router.patch("/admin/landing-stats/{id}", response_model=LandingStatResponse)
async def update_landing_stat(
    id: uuid.UUID,
    payload: LandingStatUpdate,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LandingStat).where(LandingStat.id == id))
    stat = result.scalar_one_or_none()
    if not stat:
        raise HTTPException(status_code=404, detail="Landing stat not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(stat, key, value)
    
    await db.commit()
    await db.refresh(stat)
    return stat

@router.delete("/admin/landing-stats/{id}")
async def delete_landing_stat(
    id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LandingStat).where(LandingStat.id == id))
    stat = result.scalar_one_or_none()
    if not stat:
        raise HTTPException(status_code=404, detail="Landing stat not found")
    
    await db.delete(stat)
    await db.commit()
    return {"status": "ok"}
