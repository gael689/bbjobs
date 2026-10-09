"""Asistentes con IA para empresas y candidatos (Frente 6, puntos 3 y 5). Módulo en desarrollo:
404 con la compuerta cerrada y `{available: false}` con el interruptor `asistente_ia_activo`
apagado, sin Gemini o sin presupuesto. Nunca guardan nada por su cuenta: proponen, y la persona
decide qué usa (la búsqueda la sigue moderando Talency).

- `GET  /me/company/ai/job-draft/status` — ¿mostrar el bloque "¿Te ayudamos a redactarla?"? (gratis)
- `POST /me/company/ai/job-draft` — propuesta de aviso a partir de unas líneas de la empresa.
- `GET  /me/candidate/ai/skill-suggestions` — habilidades del catálogo que el CV respalda.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_company, require_role
from app.core.features import require_new_modules
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile
from app.models.core import User, UserRole
from app.models.job import JobPostingModality
from app.services.ai import job_writer, skill_suggest
from app.services.ai.job_writer import JobDraftResponse
from app.services.ai.skill_suggest import SkillSuggestionsResponse

router = APIRouter(dependencies=[Depends(require_new_modules)])


class JobDraftRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=job_writer.MAX_INPUT_CHARS)
    title: Optional[str] = Field(default=None, max_length=255)
    zone_id: Optional[uuid.UUID] = None
    modality: Optional[JobPostingModality] = None


class AvailabilityResponse(BaseModel):
    available: bool


@router.get("/me/company/ai/job-draft/status", response_model=AvailabilityResponse)
async def job_draft_status(
    _: CompanyProfile = Depends(require_company),
    db: AsyncSession = Depends(get_db),
):
    return AvailabilityResponse(available=await job_writer.is_available(db))


@router.post("/me/company/ai/job-draft", response_model=JobDraftResponse, response_model_exclude_none=True)
async def job_draft(
    payload: JobDraftRequest,
    company: CompanyProfile = Depends(require_company),
    db: AsyncSession = Depends(get_db),
):
    """Propuesta de título, descripción, requisitos, sector y habilidades (del catálogo), más las
    advertencias por requisitos discriminatorios. Es una sugerencia: no se guarda nada."""
    modality = payload.modality.value if payload.modality else None
    return await job_writer.draft(db, company.id, payload.text, title=payload.title,
                                  zone_id=payload.zone_id, modality=modality)


@router.get("/me/candidate/ai/skill-suggestions", response_model=SkillSuggestionsResponse)
async def skill_suggestions(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    """Hasta 10 habilidades del catálogo que el CV (redactado) respalda y el candidato todavía no
    tiene, cada una con su evidencia. Sumarlas es decisión del candidato (PUT /me/candidate/skills)."""
    profile = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == current_user.id,
                                       CandidateProfile.deleted_at.is_(None))
    )).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    from app.services.ai.jobs import fetch_cv   # descarga firmada de Cloudinary (import diferido)

    return await skill_suggest.suggest(db, profile, current_user.email, fetch=fetch_cv)
