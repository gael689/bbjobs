"""Oposición del postulante a la IA (política de privacidad 3.0, §7; Ley 25.326, derecho de oposición).

Con `ai_opt_out_at` cargado, el perfil queda fuera de todo lo automático: no se lee el CV, no
se indexa, no entra al universo de recomendados (ni como postulante ni desde la Base de
Talento), no se resume y no recibe sugerencias de habilidades. Al pedirlo se borra lo que ya
había. Sus postulaciones aparecen igual para la empresa, sin puntaje: la oposición no lo perjudica.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import CandidateAiIndex, CandidateChunk, CandidateCvText, CandidateSummary, JobRecommendation
from app.models.candidate import CandidateProfile

# Todo lo que la IA guarda sobre una persona. account_deletion.py usa la misma lista.
CANDIDATE_AI_MODELS = (CandidateChunk, CandidateCvText, CandidateAiIndex, JobRecommendation, CandidateSummary)


async def purge_candidate_ai(db: AsyncSession, candidate_id: uuid.UUID) -> None:
    """Borra texto del CV, fragmentos, índice, recomendaciones y resúmenes. No commitea."""
    for model in CANDIDATE_AI_MODELS:
        await db.execute(delete(model).where(model.candidate_id == candidate_id))


async def set_opt_out(db: AsyncSession, profile: CandidateProfile, opted_out: bool) -> None:
    """Prende o apaga la oposición. Al prenderla, borra en el acto lo que ya había. No commitea.

    Al apagarla no se recalcula nada acá: el índice nocturno lo levanta solo como un perfil nuevo."""
    if opted_out:
        if profile.ai_opt_out_at is None:
            profile.ai_opt_out_at = datetime.now(timezone.utc)
        await purge_candidate_ai(db, profile.id)
    else:
        profile.ai_opt_out_at = None
