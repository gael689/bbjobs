"""Alertas de empleo del candidato (módulo en desarrollo, detrás de la compuerta).

Toda consulta filtra por el `candidate_id` del que pide: la alerta de otro es 404.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.features import require_new_modules
from app.models.alerts import JobAlert
from app.models.candidate import CandidateProfile
from app.models.catalogs import Industry, Zone
from app.models.core import User, UserRole
from app.models.job import JobPostingModality

router = APIRouter(dependencies=[Depends(require_new_modules)])
MAX_ALERTS = 5

Frequency = Literal["instant", "daily", "weekly"]


class AlertIn(BaseModel):
    industry_id: Optional[uuid.UUID] = None
    zone_id: Optional[uuid.UUID] = None
    modality: Optional[JobPostingModality] = None
    frequency: Frequency = "daily"


class AlertPatch(BaseModel):
    frequency: Optional[Frequency] = None
    is_active: Optional[bool] = None


class AlertOut(BaseModel):
    id: uuid.UUID
    industry_id: Optional[uuid.UUID] = None
    zone_id: Optional[uuid.UUID] = None
    modality: Optional[str] = None
    frequency: str
    is_active: bool
    last_sent_at: Optional[datetime] = None


def _out(a: JobAlert) -> AlertOut:
    return AlertOut(id=a.id, industry_id=a.industry_id, zone_id=a.zone_id,
                    modality=str(getattr(a.modality, "value", a.modality)) if a.modality else None,
                    frequency=a.frequency, is_active=a.is_active, last_sent_at=a.last_sent_at)


async def _profile(db: AsyncSession, user: User) -> CandidateProfile:
    p = (await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id,
                                                         CandidateProfile.deleted_at.is_(None)))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return p


async def _mine(db: AsyncSession, profile: CandidateProfile, alert_id: uuid.UUID) -> JobAlert:
    a = (await db.execute(select(JobAlert).where(JobAlert.id == alert_id, JobAlert.candidate_id == profile.id))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return a


@router.get("/me/candidate/job-alerts", response_model=list[AlertOut])
async def list_alerts(user: User = Depends(require_role([UserRole.candidate])), db: AsyncSession = Depends(get_db)):
    p = await _profile(db, user)
    rows = (await db.execute(select(JobAlert).where(JobAlert.candidate_id == p.id).order_by(JobAlert.created_at))).scalars().all()
    return [_out(a) for a in rows]


@router.post("/me/candidate/job-alerts", response_model=AlertOut, status_code=201)
async def create_alert(payload: AlertIn, user: User = Depends(require_role([UserRole.candidate])),
                       db: AsyncSession = Depends(get_db)):
    p = await _profile(db, user)
    if not (payload.industry_id or payload.zone_id or payload.modality):
        raise HTTPException(status_code=422, detail="Elegí al menos un rubro, una zona o una modalidad")
    n = (await db.execute(select(func.count()).select_from(JobAlert).where(JobAlert.candidate_id == p.id))).scalar_one()
    if n >= MAX_ALERTS:
        raise HTTPException(status_code=409, detail=f"Podés tener hasta {MAX_ALERTS} alertas")
    if payload.industry_id and not (await db.execute(select(Industry.id).where(Industry.id == payload.industry_id))).first():
        raise HTTPException(status_code=422, detail="Rubro inexistente")
    if payload.zone_id and not (await db.execute(select(Zone.id).where(Zone.id == payload.zone_id))).first():
        raise HTTPException(status_code=422, detail="Zona inexistente")
    a = JobAlert(id=uuid.uuid4(), candidate_id=p.id, industry_id=payload.industry_id, zone_id=payload.zone_id,
                 modality=payload.modality.value if payload.modality else None, frequency=payload.frequency,
                 is_active=True)
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return _out(a)


@router.patch("/me/candidate/job-alerts/{alert_id}", response_model=AlertOut)
async def update_alert(alert_id: uuid.UUID, payload: AlertPatch, user: User = Depends(require_role([UserRole.candidate])),
                       db: AsyncSession = Depends(get_db)):
    a = await _mine(db, await _profile(db, user), alert_id)
    if payload.frequency is not None:
        a.frequency = payload.frequency
    if payload.is_active is not None:
        a.is_active = payload.is_active
    await db.commit()
    return _out(a)


@router.delete("/me/candidate/job-alerts/{alert_id}", status_code=204)
async def delete_alert(alert_id: uuid.UUID, user: User = Depends(require_role([UserRole.candidate])),
                       db: AsyncSession = Depends(get_db)):
    a = await _mine(db, await _profile(db, user), alert_id)
    await db.delete(a)
    await db.commit()
