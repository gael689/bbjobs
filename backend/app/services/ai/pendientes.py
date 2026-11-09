"""Recomendados que la empresa todavía no miró: la "bombita" del panel y el contador del menú
(PLAN-FINAL-IA-Y-MAILS §4).

Depende de algo **pendiente**, no de un aviso suelto: cuenta los recomendados ≥ 70 de cada
búsqueda activa de la empresa con `company_viewed_at` en NULL. Se apagan cuando la empresa abre
los Recomendados de esa búsqueda (`mark_viewed`, desde `api/v1/recommendations.py`).

No cuentan: los de la Base de Talento que quedan fuera de lo que la empresa ve (su cupo por
búsqueda, `RECS_TALENT_FREE_COUNT` / `RECS_TALENT_PACK_COUNT`, con el mismo orden que la pantalla)
ni los que marcó 👎. Sin IA ni llamadas a Gemini: una sola consulta, **siempre filtrada por
`company_id`** (no hay RLS: este filtro es lo único que separa a una empresa de otra).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import case, exists, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.ai import JobRecommendation
from app.models.job import JobModerationStatus, JobPosting, JobPostingStatus
from app.models.payment import TalentCreditPack, TalentPackStatus
from app.services.ai.scoring import RECOMMENDED_THRESHOLD


async def pending_by_job(db: AsyncSession, company_id: uuid.UUID) -> list[dict]:
    """[{job_id, title, count}] de las búsquedas con recomendados sin mirar, de más a menos."""
    has_pack = exists().where(TalentCreditPack.company_id == company_id,
                              TalentCreditPack.status == TalentPackStatus.active.value)
    talent_limit = case((has_pack, settings.RECS_TALENT_PACK_COUNT), else_=settings.RECS_TALENT_FREE_COUNT)
    # Puesto de cada fila dentro de su búsqueda y fuente, en el orden de la pantalla de Recomendados.
    ranked = (
        select(
            JobRecommendation.id.label("rec_id"),
            func.row_number().over(
                partition_by=(JobRecommendation.job_id, JobRecommendation.source),
                order_by=(JobRecommendation.final_score.desc(), JobRecommendation.computed_at),
            ).label("pos"),
        )
        .join(JobPosting, JobPosting.id == JobRecommendation.job_id)
        .where(JobPosting.company_id == company_id)
        .subquery()
    )
    rows = (await db.execute(
        select(JobPosting.id, JobPosting.title, func.count(JobRecommendation.id))
        .join(JobRecommendation, JobRecommendation.job_id == JobPosting.id)
        .join(ranked, ranked.c.rec_id == JobRecommendation.id)
        .where(
            JobPosting.company_id == company_id,
            JobPosting.status == JobPostingStatus.active,
            JobPosting.moderation_status == JobModerationStatus.approved,
            JobPosting.deleted_at.is_(None),
            JobRecommendation.final_score >= RECOMMENDED_THRESHOLD,
            JobRecommendation.rerank_status == "done",  # como los avisos (plan final §2.4)
            JobRecommendation.company_viewed_at.is_(None),
            or_(JobRecommendation.feedback.is_(None), JobRecommendation.feedback != -1),
            or_(JobRecommendation.source == "applicant", ranked.c.pos <= talent_limit),
        )
        .group_by(JobPosting.id, JobPosting.title)
        .order_by(func.count(JobRecommendation.id).desc(), JobPosting.title)
    )).all()
    return [{"job_id": job_id, "title": title, "count": n} for job_id, title, n in rows]


async def mark_viewed(db: AsyncSession, job_id: uuid.UUID, candidate_ids: list[uuid.UUID],
                      now: datetime | None = None) -> None:
    """La empresa abrió los Recomendados de `job_id` y vio estas filas. El llamador ya verificó que
    la búsqueda es suya. No commitea."""
    if not candidate_ids:
        return
    await db.execute(
        update(JobRecommendation)
        .where(JobRecommendation.job_id == job_id, JobRecommendation.candidate_id.in_(candidate_ids),
               JobRecommendation.company_viewed_at.is_(None))
        .values(company_viewed_at=now or datetime.now(timezone.utc))
    )
