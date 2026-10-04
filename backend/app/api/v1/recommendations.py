"""Candidatos recomendados con IA (módulo en desarrollo, detrás de la compuerta).

Aislamiento sin RLS: **toda consulta de empresa filtra por su `company_id`** (la búsqueda tiene
que ser suya; si no, 404), y lo prueba un test de acceso cruzado.

Lo que ve la empresa:
- **Todos** sus postulantes, ordenados, con puntaje, motivos y la tabla de requisitos con la
  evidencia citada. Ordenar no es descartar.
- Hasta 3 perfiles **ciegos** de la Base de Talento por búsqueda (10 con un pack activo). La
  evidencia de un perfil ciego se muestra tapada hasta que lo desbloquea, como hoy.
- Siempre la aclaración: "orientativo, decide la empresa" (política de Google para empleo).
"""
from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role, require_verified_company
from app.core.config import settings
from app.core.features import require_new_modules
from app.db.session import async_session_maker
from app.integrations.gemini_client import AIUnavailable, get_provider
from app.models.ai import (
    AiUsageLog, CandidateAiIndex, CandidateChunk, CandidateCvText, JobAiProfile, JobRecommendation,
    RecommendationRefresh,
)
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile
from app.models.core import User, UserRole
from app.models.job import Application, JobPosting
from app.models.payment import TalentCreditPack, TalentPackStatus, TalentUnlock
from app.models.settings import SettingKey
from app.services.ai import pipeline
from app.services.email.policy import local_day_start
from app.services.settings import get_setting

logger = structlog.get_logger("app.api.recommendations")
router = APIRouter(dependencies=[Depends(require_new_modules)])

DISCLAIMER = ("Orden orientativo calculado con los datos del perfil y del CV. La decisión es siempre "
              "de la empresa. No se usan edad, género, foto ni estado civil.")


def provider_or_none():
    try:
        return get_provider()
    except AIUnavailable:
        return None


async def recompute_job(job_id: uuid.UUID, *, rerank_enabled: bool) -> None:
    """Corre en segundo plano con sesión propia (no la del pedido, que ya se cerró)."""
    async with async_session_maker() as db:
        job = (await db.execute(select(JobPosting).where(JobPosting.id == job_id))).scalar_one_or_none()
        if job is None:
            return
        try:
            stats = await pipeline.compute_recommendations(db, provider_or_none(), job, rerank_enabled=rerank_enabled)
            await db.commit()
            logger.info("recs_recalculados", job_id=str(job_id), **stats)
        except Exception as exc:
            await db.rollback()
            logger.error("recs_error", job_id=str(job_id), error=str(exc)[:300])


def candidate_ref(company_id: uuid.UUID, candidate_id: uuid.UUID) -> str:
    """Referencia opaca de un candidato para una empresa (HMAC con SECRET_KEY). No sale del UUID
    real: un perfil ciego no se puede cruzar con otros listados ni entre empresas."""
    digest = hmac.new(settings.SECRET_KEY.encode(), f"rec:{company_id}:{candidate_id}".encode(), hashlib.sha256)
    return "#" + digest.hexdigest()[:8].upper()


async def _own_job(db: AsyncSession, company: CompanyProfile, job_id: uuid.UUID) -> JobPosting:
    job = (await db.execute(
        select(JobPosting).where(JobPosting.id == job_id, JobPosting.company_id == company.id,
                                 JobPosting.deleted_at.is_(None))
    )).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return job


# ── Empresa ─────────────────────────────────────────────────────────────────────────────

class RequirementOut(BaseModel):
    id: str
    texto: str
    tipo: str


class EvalOut(BaseModel):
    req_id: str
    verdict: str
    evidence: Optional[str] = None


class RecOut(BaseModel):
    candidate_ref: str
    candidate_id: Optional[uuid.UUID] = None     # sólo postulantes y perfiles desbloqueados
    application_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    source: Literal["applicant", "talent"]
    score: int
    recommended: bool
    coverage: float
    reasons: list[str]
    evaluations: list[EvalOut]
    locked: bool
    feedback: Optional[int] = None


class RecsResponse(BaseModel):
    enabled: bool
    status: Literal["ok", "calculando", "apagado"]
    disclaimer: str
    requirements: list[RequirementOut] = []
    discarded_requirements: list[dict] = []
    applicants: list[RecOut] = []
    talent: list[RecOut] = []
    talent_limit: int = 0
    computed_at: Optional[datetime] = None


async def _talent_limit(db: AsyncSession, company_id: uuid.UUID) -> int:
    has_pack = (await db.execute(
        select(func.count()).select_from(TalentCreditPack).where(
            TalentCreditPack.company_id == company_id, TalentCreditPack.status == TalentPackStatus.active.value)
    )).scalar_one()
    return settings.RECS_TALENT_PACK_COUNT if has_pack else settings.RECS_TALENT_FREE_COUNT


@router.get("/me/company/jobs/{job_id}/recommendations", response_model=RecsResponse)
async def job_recommendations(
    job_id: uuid.UUID, background: BackgroundTasks,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    job = await _own_job(db, company, job_id)
    if not await get_setting(db, SettingKey.ia_recomendaciones_activas):
        return RecsResponse(enabled=False, status="apagado", disclaimer=DISCLAIMER)

    profile = (await db.execute(select(JobAiProfile).where(JobAiProfile.job_id == job.id))).scalar_one_or_none()
    rows = (await db.execute(
        select(JobRecommendation, CandidateProfile.first_name, CandidateProfile.last_name)
        .join(CandidateProfile, CandidateProfile.id == JobRecommendation.candidate_id)
        .where(JobRecommendation.job_id == job.id)
        .order_by(JobRecommendation.final_score.desc(), JobRecommendation.computed_at)
    )).all()
    if not rows:
        background.add_task(recompute_job, job.id, rerank_enabled=True)
        return RecsResponse(enabled=True, status="calculando", disclaimer=DISCLAIMER)

    apps = dict((await db.execute(
        select(Application.candidate_id, Application.id).where(Application.job_posting_id == job.id,
                                                               Application.deleted_at.is_(None))
    )).all())
    unlocked = set((await db.execute(
        select(TalentUnlock.candidate_id).where(TalentUnlock.company_id == company.id)
    )).scalars().all())
    limit = await _talent_limit(db, company.id)

    def out(rec: JobRecommendation, first: str, last: str) -> RecOut:
        is_applicant = rec.source == "applicant"
        visible = is_applicant or rec.candidate_id in unlocked
        evidence = rec.evidence or {}
        return RecOut(
            candidate_ref=candidate_ref(company.id, rec.candidate_id),
            candidate_id=rec.candidate_id if visible else None,
            application_id=apps.get(rec.candidate_id),
            name=f"{first} {last}".strip() if visible else None,
            source=rec.source, score=rec.final_score,
            recommended=rec.final_score >= pipeline.scoring.RECOMMENDED_THRESHOLD,
            coverage=round(rec.coverage, 2), reasons=list(rec.reasons or []),
            evaluations=[EvalOut(req_id=e["req_id"], verdict=e["verdict"],
                                 evidence=evidence.get(e["req_id"]) if visible else None)
                         for e in (rec.req_evals or [])],
            locked=not visible, feedback=rec.feedback,
        )

    applicants = [out(r, f, l) for r, f, l in rows if r.source == "applicant"]
    talent = [out(r, f, l) for r, f, l in rows if r.source == "talent"][:limit]
    return RecsResponse(
        enabled=True, status="ok", disclaimer=DISCLAIMER,
        requirements=[RequirementOut(id=r["id"], texto=r["texto"], tipo=r["tipo"]) for r in (profile.requirements if profile else [])],
        discarded_requirements=profile.discarded if profile else [],
        applicants=applicants, talent=talent, talent_limit=limit,
        computed_at=max(r.computed_at for r, _, _ in rows),
    )


class RefreshResult(BaseModel):
    queued: bool
    remaining_today: int


@router.post("/me/company/jobs/{job_id}/recommendations/refresh", response_model=RefreshResult)
async def refresh_recommendations(
    job_id: uuid.UUID, background: BackgroundTasks,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    job = await _own_job(db, company, job_id)
    if not await get_setting(db, SettingKey.ia_recomendaciones_activas):
        raise HTTPException(status_code=409, detail="Las recomendaciones no están activas")
    used = (await db.execute(
        select(func.count()).select_from(RecommendationRefresh).where(
            RecommendationRefresh.company_id == company.id,
            RecommendationRefresh.created_at >= local_day_start(datetime.now(timezone.utc)))
    )).scalar_one()
    if used >= settings.RECS_REFRESH_PER_DAY:
        raise HTTPException(status_code=429, detail="Llegaste al máximo de actualizaciones de hoy")
    db.add(RecommendationRefresh(id=uuid.uuid4(), company_id=company.id, job_id=job.id))
    await db.commit()
    background.add_task(recompute_job, job.id, rerank_enabled=True)
    return RefreshResult(queued=True, remaining_today=settings.RECS_REFRESH_PER_DAY - used - 1)


class FeedbackIn(BaseModel):
    candidate_ref: str
    value: Literal[-1, 0, 1]


@router.post("/me/company/jobs/{job_id}/recommendations/feedback")
async def recommendation_feedback(
    job_id: uuid.UUID, payload: FeedbackIn,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    """👍/👎 por recomendación: arma el set de evaluación (auditoría R13)."""
    job = await _own_job(db, company, job_id)
    recs = (await db.execute(select(JobRecommendation).where(JobRecommendation.job_id == job.id))).scalars().all()
    target = next((r for r in recs if candidate_ref(company.id, r.candidate_id) == payload.candidate_ref), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Not Found")
    target.feedback = payload.value or None
    await db.commit()
    return {"ok": True}


# ── Candidato: "lo que lee la IA de tu CV" (D14) ────────────────────────────────────────

class AiViewChunk(BaseModel):
    kind: str
    text: str


class AiView(BaseModel):
    cv_status: Optional[str] = None
    chunks: list[AiViewChunk]
    indexed_at: Optional[datetime] = None
    note: str


@router.get("/me/candidate/ai-view", response_model=AiView)
async def candidate_ai_view(user: User = Depends(require_role([UserRole.candidate])), db: AsyncSession = Depends(get_db)):
    profile = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id, CandidateProfile.deleted_at.is_(None))
    )).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    cv = (await db.execute(select(CandidateCvText.status).where(CandidateCvText.candidate_id == profile.id))).scalar_one_or_none()
    idx = (await db.execute(select(CandidateAiIndex.indexed_at).where(CandidateAiIndex.candidate_id == profile.id))).scalar_one_or_none()
    chunks = (await db.execute(
        select(CandidateChunk.kind, CandidateChunk.text).where(CandidateChunk.candidate_id == profile.id)
        .order_by(CandidateChunk.kind, CandidateChunk.ordinal)
    )).all()
    return AiView(
        cv_status=cv, indexed_at=idx, chunks=[AiViewChunk(kind=k, text=t) for k, t in chunks],
        note=("Esto es lo que lee la IA para ordenar perfiles: sin tu nombre, tu contacto, tu edad ni "
              "tus empleadores. Si ves algún dato personal, avisanos."),
    )


# ── Talency ─────────────────────────────────────────────────────────────────────────────

class UsageRow(BaseModel):
    key: Optional[str]
    calls: int
    cost_usd: float


class UsageSummary(BaseModel):
    today_usd: float
    daily_budget_usd: float
    period_usd: float
    by_feature: list[UsageRow]
    by_company: list[UsageRow]


@router.get("/admin/ai/usage", response_model=UsageSummary)
async def ai_usage(days: int = Query(default=30, ge=1, le=365),
                   _: User = Depends(require_role([UserRole.admin])), db: AsyncSession = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    by_feature = (await db.execute(
        select(AiUsageLog.feature, func.count(), func.coalesce(func.sum(AiUsageLog.cost_usd), 0))
        .where(AiUsageLog.created_at >= since).group_by(AiUsageLog.feature)
    )).all()
    by_company = (await db.execute(
        select(CompanyProfile.legal_name, func.count(), func.coalesce(func.sum(AiUsageLog.cost_usd), 0))
        .outerjoin(CompanyProfile, CompanyProfile.id == AiUsageLog.company_id)
        .where(AiUsageLog.created_at >= since).group_by(CompanyProfile.legal_name)
    )).all()
    return UsageSummary(
        today_usd=await pipeline.spent_today(db), daily_budget_usd=settings.AI_DAILY_BUDGET_USD,
        period_usd=float(sum(c for _, _, c in by_feature)),
        by_feature=[UsageRow(key=k, calls=n, cost_usd=float(c)) for k, n, c in by_feature],
        by_company=[UsageRow(key=k, calls=n, cost_usd=float(c)) for k, n, c in by_company],
    )


@router.post("/admin/ai/jobs/{job_id}/recompute")
async def admin_recompute(job_id: uuid.UUID, background: BackgroundTasks,
                          _: User = Depends(require_role([UserRole.admin]))):
    background.add_task(recompute_job, job_id, rerank_enabled=True)
    return {"queued": True}
