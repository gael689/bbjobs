""""Búsquedas para vos" en el panel del candidato (módulo nuevo, detrás de la compuerta).

- `GET /me/candidate/recommended-jobs`: hasta 10 búsquedas con nivel y "por qué", para el inicio
  del panel.
- `GET /me/candidate/recommended-job-ids`: sólo los ids (hasta 200), para el chip "Encaja con tu
  perfil" de los listados públicos. Lo pide el navegador después de cargar la página, así
  `/empleos` y la home siguen estáticas.

Todo sale de `services/busquedas_para_vos.py`, filtrado por el perfil del usuario que pide: no
hay parámetro de candidato. Sin llamadas a Gemini.
"""
from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.api.v1.candidates import _get_candidate_profile
from app.core.features import require_new_modules
from app.core.urls import job_public_path
from app.models.core import User, UserRole
from app.services import busquedas_para_vos as para_vos

router = APIRouter(dependencies=[Depends(require_new_modules)])


class RecommendedJob(BaseModel):
    id: uuid.UUID
    title: str
    company_name: str
    zone_name: str | None = None
    modality: str
    url: str
    level: Literal["Encaja muy bien", "Encaja"]
    strong: bool
    ai_evaluated: bool
    reasons: list[str]


class RecommendedJobsResponse(BaseModel):
    items: list[RecommendedJob]
    # Lo que le falta al perfil para recibir recomendaciones ("zona", "habilidades").
    profile_gaps: list[str]


class RecommendedJobIdsResponse(BaseModel):
    job_ids: list[uuid.UUID]


@router.get("/me/candidate/recommended-jobs", response_model=RecommendedJobsResponse)
async def recommended_jobs(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_candidate_profile(current_user.id, db)
    found = await para_vos.recommended_jobs(db, profile)
    return RecommendedJobsResponse(
        items=[RecommendedJob(
            id=r.job.id, title=r.job.title, company_name=r.job.company_legal_name_snapshot, zone_name=r.zone_name,
            modality=str(getattr(r.job.modality, "value", r.job.modality)), url=job_public_path(r.job),
            level=r.level, strong=r.strong, ai_evaluated=r.ai_evaluated, reasons=r.reasons,
        ) for r in found],
        profile_gaps=await para_vos.profile_gaps(db, profile),
    )


@router.get("/me/candidate/recommended-job-ids", response_model=RecommendedJobIdsResponse)
async def recommended_job_ids(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_candidate_profile(current_user.id, db)
    found = await para_vos.recommended_jobs(db, profile, limit=para_vos.MAX_IDS)
    return RecommendedJobIdsResponse(job_ids=[r.job.id for r in found])
