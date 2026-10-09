"""Centro de IA de Talency: ver todo lo que hace la IA y lanzarlo a mano (módulo en desarrollo).

Pedido de Gael: **"Talency debe ver todo"**. Tres partes, todas sólo para admin y detrás de la
compuerta (`require_new_modules` → 404 cerrada):

1. **Recomendados de cualquier búsqueda** (`/admin/ai/jobs…`): lo mismo que ve la empresa, más lo
   que Talency necesita para gestionar (contacto, alertas, gasto). Reglas de anonimato:
   - nombre y contacto **sólo** de quien se postuló a esa búsqueda o de un perfil que la empresa
     de esa búsqueda ya desbloqueó;
   - un perfil ciego de la Base de Talento sigue ciego (sin nombre, sin id, sin citas), igual que
     lo ve la empresa;
   - la referencia `#XXXXXXXX` es la misma que ve la empresa, para hablar del mismo perfil.
2. **Acciones a mano** (`/admin/ai/actions/…`): encolan en `ai_recompute_queue` o corren en
   segundo plano con sesión propia; ninguna bloquea el pedido más que unos segundos (el borrador
   mensual es **una** llamada). Todas chequean interruptor, cuenta de Gemini y tope de gasto antes
   y responden 409 con un mensaje claro si falta algo. Ninguna manda mails ni cambia estados.
3. **Registro de actividad** (`/admin/ai/activity`): `ai_activity_log` + dos derivados de tablas
   que ya existían (búsquedas en lenguaje natural como agregado diario, sin las frases; avisos de
   "candidatos que encajan" por búsqueda y día). Sólo ids, conteos y montos.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Boolean, Numeric, String, and_, cast, false, func, literal, null, or_, select, union_all, update
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.api.v1.recommendations import DISCLAIMER, SUMMARY_DISCLAIMER, EvalOut, RequirementOut, SummaryLineOut, candidate_ref
from app.core.config import settings
from app.core.features import require_new_modules
from app.db import session as db_session
from app.integrations.gemini_client import AIError, AIProvider, AIUnavailable, get_provider
from app.models.ai import (
    AiActivityLog, AiRecomputeQueue, AiUsageLog, CandidateAiIndex, CandidateCvText, JobAiProfile, JobRecommendation,
)
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile
from app.models.core import User, UserRole
from app.models.job import Application, JobModerationStatus, JobPosting, JobPostingStatus
from app.models.payment import TalentCreditPack, TalentPackStatus, TalentUnlock
from app.models.settings import SettingKey
from app.schemas.common import PageQuery, PageSizeQuery, Paginated
from app.services.ai import activity, pipeline, realtime, scoring
from app.services.email.policy import AR_TZ, local_day_start
from app.services.settings import get_setting

logger = structlog.get_logger("app.api.admin_ai")
router = APIRouter(dependencies=[Depends(require_new_modules)])
admin_only = require_role([UserRole.admin])

AR_ZONE = "America/Argentina/Buenos_Aires"
MAX_PENDING_REVIEW = 100


def _provider() -> AIProvider | None:
    """Punto único para pedir el proveedor (los tests lo reemplazan)."""
    try:
        return get_provider()
    except AIUnavailable:
        return None


async def _fetch_cv(url: str) -> bytes:
    from app.services.ai.jobs import fetch_cv
    return await fetch_cv(url)


async def _require_ai(db: AsyncSession, *, need_recs_switch: bool = True) -> AIProvider:
    """Antes de cada acción: interruptor, cuenta de Gemini y tope de gasto. 409 con el motivo."""
    if need_recs_switch and not await get_setting(db, SettingKey.ia_recomendaciones_activas):
        raise HTTPException(status_code=409, detail="La IA de recomendados está apagada. Prendela en Mails e IA.")
    provider = _provider()
    if provider is None:
        raise HTTPException(status_code=409, detail="Todavía no hay una cuenta de Gemini configurada: la IA no puede trabajar.")
    if not await pipeline.budget_left(db):
        raise HTTPException(
            status_code=409,
            detail=f"Hoy ya se llegó al tope de gasto de IA (USD {settings.AI_DAILY_BUDGET_USD:.2f}). Vuelve a estar disponible mañana.",
        )
    return provider


def _live_job():
    return and_(JobPosting.deleted_at.is_(None), JobPosting.status == JobPostingStatus.active,
                JobPosting.moderation_status == JobModerationStatus.approved)


# ── 1. Recomendados de cualquier búsqueda ───────────────────────────────────────────────

class AdminJobRow(BaseModel):
    job_id: uuid.UUID
    title: str
    company_id: Optional[uuid.UUID] = None
    company_name: str
    status: str
    moderation_status: str
    applicants: int
    recommendations: int
    recommended: int
    best_score: Optional[int] = None
    last_computed_at: Optional[datetime] = None
    queued: bool
    queue_reason: Optional[str] = None
    cost_usd: float


@router.get("/admin/ai/jobs", response_model=Paginated[AdminJobRow])
async def admin_ai_jobs(
    estado: Literal["todas", "activas", "pendientes"] = "todas",
    q: Optional[str] = Query(default=None, max_length=100),
    page: int = PageQuery, page_size: int = PageSizeQuery,
    _: User = Depends(admin_only), db: AsyncSession = Depends(get_db),
):
    apps = (select(Application.job_posting_id.label("job_id"), func.count().label("n"))
            .where(Application.deleted_at.is_(None)).group_by(Application.job_posting_id).subquery())
    recs = (select(JobRecommendation.job_id.label("job_id"), func.count().label("n"),
                   func.count().filter(JobRecommendation.final_score >= scoring.RECOMMENDED_THRESHOLD).label("ok"),
                   func.max(JobRecommendation.final_score).label("best"),
                   func.max(JobRecommendation.computed_at).label("at"))
            .group_by(JobRecommendation.job_id).subquery())
    cost = (select(AiUsageLog.job_id.label("job_id"), func.sum(AiUsageLog.cost_usd).label("usd"))
            .where(AiUsageLog.job_id.is_not(None)).group_by(AiUsageLog.job_id).subquery())

    pending = and_(JobPosting.deleted_at.is_(None), JobPosting.moderation_status == JobModerationStatus.pending_review)
    where = {"activas": _live_job(), "pendientes": pending, "todas": or_(_live_job(), pending)}[estado]
    base = (
        select(JobPosting.id, JobPosting.title, JobPosting.company_id, CompanyProfile.legal_name,
               JobPosting.company_legal_name_snapshot, JobPosting.status, JobPosting.moderation_status,
               func.coalesce(apps.c.n, 0), func.coalesce(recs.c.n, 0), func.coalesce(recs.c.ok, 0), recs.c.best,
               recs.c.at, AiRecomputeQueue.reason, func.coalesce(cost.c.usd, 0))
        .outerjoin(CompanyProfile, CompanyProfile.id == JobPosting.company_id)
        .outerjoin(apps, apps.c.job_id == JobPosting.id)
        .outerjoin(recs, recs.c.job_id == JobPosting.id)
        .outerjoin(cost, cost.c.job_id == JobPosting.id)
        .outerjoin(AiRecomputeQueue, AiRecomputeQueue.job_id == JobPosting.id)
        .where(where)
    )
    if q and q.strip():
        like = f"%{q.strip()}%"
        base = base.where(or_(JobPosting.title.ilike(like), CompanyProfile.legal_name.ilike(like)))
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(
        base.order_by(JobPosting.published_at.desc().nulls_last(), JobPosting.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).all()

    def val(x):
        return str(getattr(x, "value", x))

    items = [AdminJobRow(
        job_id=r[0], title=r[1], company_id=r[2], company_name=r[3] or r[4] or "", status=val(r[5]),
        moderation_status=val(r[6]), applicants=r[7], recommendations=r[8], recommended=r[9], best_score=r[10],
        last_computed_at=r[11], queued=r[12] is not None, queue_reason=r[12], cost_usd=float(r[13]),
    ) for r in rows]
    return Paginated[AdminJobRow](items=items, total=total, page=page, page_size=page_size)


class AdminRecOut(BaseModel):
    candidate_ref: str
    candidate_id: Optional[uuid.UUID] = None       # sólo postulantes y perfiles desbloqueados
    application_id: Optional[uuid.UUID] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Literal["applicant", "talent"]
    unlocked: bool = False
    shown_to_company: bool
    score: int
    recommended: bool
    coverage: float
    hybrid_fit: float
    semantic_pct: Optional[float] = None
    reasons: list[str]
    evaluations: list[EvalOut]
    locked: bool
    rerank_status: str
    alerts: list[str] = []
    feedback: Optional[int] = None
    computed_at: Optional[datetime] = None


class AdminJobInfo(BaseModel):
    id: uuid.UUID
    title: str
    company_id: Optional[uuid.UUID] = None
    company_name: str
    status: str
    moderation_status: str


class AdminRecsResponse(BaseModel):
    enabled: bool
    status: Literal["ok", "sin_calcular", "apagado"]
    disclaimer: str
    job: AdminJobInfo
    requirements: list[RequirementOut] = []
    discarded_requirements: list[dict] = []
    requirements_with_ai: bool = False
    job_injection_flags: int = 0
    applicants: list[AdminRecOut] = []
    talent: list[AdminRecOut] = []
    talent_limit: int = 0
    computed_at: Optional[datetime] = None
    queued: bool = False
    queue_reason: Optional[str] = None
    cost_usd: float = 0.0
    rerank_counts: dict[str, int] = {}


RERANK_ALERTS = {
    "skipped_injection": "El perfil tiene texto que parece una orden para la IA: se ordenó sin IA.",
    "failed": "La evaluación con IA falló: quedó sólo el puntaje sin IA.",
    "skipped_budget": "Se llegó al tope de gasto del día: se evaluó sin IA.",
    "skipped_limit": "Quedó para la próxima vuelta (tope de evaluaciones por corrida).",
    "no_index": "El perfil todavía no está indexado: se ordenó sólo con los datos cargados.",
}


async def _job_or_404(db: AsyncSession, job_id: uuid.UUID) -> JobPosting:
    job = (await db.execute(select(JobPosting).where(JobPosting.id == job_id, JobPosting.deleted_at.is_(None))
                            )).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return job


async def _talent_limit(db: AsyncSession, company_id) -> int:
    has_pack = (await db.execute(select(func.count()).select_from(TalentCreditPack).where(
        TalentCreditPack.company_id == company_id, TalentCreditPack.status == TalentPackStatus.active.value)
    )).scalar_one()
    return settings.RECS_TALENT_PACK_COUNT if has_pack else settings.RECS_TALENT_FREE_COUNT


@router.get("/admin/ai/jobs/{job_id}/recommendations", response_model=AdminRecsResponse)
async def admin_job_recommendations(job_id: uuid.UUID, _: User = Depends(admin_only),
                                    db: AsyncSession = Depends(get_db)):
    """No dispara cálculos (a diferencia de la pantalla de la empresa): para eso están las acciones."""
    job = await _job_or_404(db, job_id)
    company_name = (await db.execute(select(CompanyProfile.legal_name).where(CompanyProfile.id == job.company_id))
                    ).scalar_one_or_none() or job.company_legal_name_snapshot or ""
    info = AdminJobInfo(id=job.id, title=job.title, company_id=job.company_id, company_name=company_name,
                        status=str(getattr(job.status, "value", job.status)),
                        moderation_status=str(getattr(job.moderation_status, "value", job.moderation_status)))
    if not await get_setting(db, SettingKey.ia_recomendaciones_activas):
        return AdminRecsResponse(enabled=False, status="apagado", disclaimer=DISCLAIMER, job=info)

    queue = (await db.execute(select(AiRecomputeQueue.reason).where(AiRecomputeQueue.job_id == job.id))
             ).scalar_one_or_none()
    cost = float((await db.execute(select(func.coalesce(func.sum(AiUsageLog.cost_usd), 0))
                                   .where(AiUsageLog.job_id == job.id))).scalar_one())
    profile = (await db.execute(select(JobAiProfile).where(JobAiProfile.job_id == job.id))).scalar_one_or_none()
    rows = (await db.execute(
        select(JobRecommendation, CandidateProfile.first_name, CandidateProfile.last_name, CandidateProfile.phone,
               User.email)
        .join(CandidateProfile, CandidateProfile.id == JobRecommendation.candidate_id)
        .join(User, User.id == CandidateProfile.user_id)
        .where(JobRecommendation.job_id == job.id)
        .order_by(JobRecommendation.final_score.desc(), JobRecommendation.computed_at)
    )).all()
    base = dict(enabled=True, disclaimer=DISCLAIMER, job=info, queued=queue is not None, queue_reason=queue,
                cost_usd=cost)
    if profile is not None:
        base.update(
            requirements=[RequirementOut(id=r["id"], texto=r["texto"], tipo=r["tipo"]) for r in profile.requirements],
            discarded_requirements=profile.discarded or [], requirements_with_ai=profile.extracted_with_ai,
            job_injection_flags=len(profile.injection_flags or []),
        )
    if not rows:
        return AdminRecsResponse(status="sin_calcular", **base)

    apps = dict((await db.execute(
        select(Application.candidate_id, Application.id).where(Application.job_posting_id == job.id,
                                                               Application.deleted_at.is_(None))
    )).all())
    unlocked = set((await db.execute(
        select(TalentUnlock.candidate_id).where(TalentUnlock.company_id == job.company_id)
    )).scalars().all())
    limit = await _talent_limit(db, job.company_id)
    talent_order = [r.candidate_id for r, *_ in rows if r.source == "talent"]
    shown_talent = set(talent_order[:limit])

    def out(rec: JobRecommendation, first: str, last: str, phone: str | None, email: str | None) -> AdminRecOut:
        is_applicant = rec.source == "applicant" and rec.candidate_id in apps
        is_unlocked = rec.candidate_id in unlocked
        visible = is_applicant or is_unlocked
        evidence = rec.evidence or {}
        alerts = [RERANK_ALERTS[rec.rerank_status]] if rec.rerank_status in RERANK_ALERTS else []
        return AdminRecOut(
            candidate_ref=candidate_ref(job.company_id, rec.candidate_id),
            candidate_id=rec.candidate_id if visible else None,
            application_id=apps.get(rec.candidate_id) if visible else None,
            name=f"{first} {last}".strip() if visible else None,
            email=email if visible else None, phone=(phone or None) if visible else None,
            source=rec.source, unlocked=is_unlocked,
            shown_to_company=rec.source == "applicant" or rec.candidate_id in shown_talent or is_unlocked,
            score=rec.final_score, recommended=rec.final_score >= scoring.RECOMMENDED_THRESHOLD,
            coverage=round(rec.coverage, 2), hybrid_fit=round(rec.hybrid_fit, 3),
            semantic_pct=round(rec.semantic_pct, 3) if rec.semantic_pct is not None else None,
            reasons=list(rec.reasons or []),
            evaluations=[EvalOut(req_id=e["req_id"], verdict=e["verdict"],
                                 evidence=evidence.get(e["req_id"]) if visible else None)
                         for e in (rec.req_evals or [])],
            locked=not visible, rerank_status=rec.rerank_status, alerts=alerts, feedback=rec.feedback,
            computed_at=rec.computed_at,
        )

    counts: dict[str, int] = {}
    for r, *_ in rows:
        counts[r.rerank_status] = counts.get(r.rerank_status, 0) + 1
    return AdminRecsResponse(
        status="ok", **base,
        applicants=[out(*r) for r in rows if r[0].source == "applicant"],
        talent=[out(*r) for r in rows if r[0].source == "talent"],
        talent_limit=limit, computed_at=max(r.computed_at for r, *_ in rows), rerank_counts=counts,
    )


class AdminSummaryResponse(BaseModel):
    candidate_ref: str
    lines: list[SummaryLineOut]
    generated_with_ai: bool
    disclaimer: str = SUMMARY_DISCLAIMER


@router.get("/admin/ai/jobs/{job_id}/recommendations/{ref}/summary", response_model=AdminSummaryResponse)
async def admin_recommendation_summary(job_id: uuid.UUID, ref: str, _: User = Depends(admin_only),
                                       db: AsyncSession = Depends(get_db)):
    """El mismo resumen de 3 líneas que ve la empresa (misma caché). No filtra por empresa, pero
    respeta el anonimato: en un perfil ciego no se muestran las citas."""
    from app.services.ai import summary as summary_svc

    job = await _job_or_404(db, job_id)
    if not await get_setting(db, SettingKey.ia_recomendaciones_activas):
        raise HTTPException(status_code=409, detail="La IA de recomendados está apagada. Prendela en Mails e IA.")
    recs = (await db.execute(select(JobRecommendation).where(JobRecommendation.job_id == job.id))).scalars().all()
    target = next((r for r in recs if candidate_ref(job.company_id, r.candidate_id) == ref), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Not Found")
    visible = target.source == "applicant" or bool((await db.execute(select(TalentUnlock.id).where(
        TalentUnlock.company_id == job.company_id, TalentUnlock.candidate_id == target.candidate_id))).first())

    profile = (await db.execute(select(JobAiProfile).where(JobAiProfile.job_id == job.id))).scalar_one_or_none()
    opaque = "#" + hashlib.sha256(f"{job.id}:{target.candidate_id}".encode()).hexdigest()[:6].upper()
    result = await summary_svc.summarize(
        db, _provider(), target, requirements=list(profile.requirements) if profile else [],
        ref=opaque, company_id=job.company_id, origin="talency",
    )
    await db.commit()
    return AdminSummaryResponse(
        candidate_ref=ref, generated_with_ai=result.generated_with_ai,
        lines=[SummaryLineOut(text=l.text, evidence=l.evidence if visible else None) for l in result.lines],
    )


# ── 2. Acciones a mano ──────────────────────────────────────────────────────────────────

class ActionResult(BaseModel):
    queued: int
    message: str


class ActionsStatus(BaseModel):
    recs_switch_on: bool
    ai_configured: bool
    budget_left: bool
    today_usd: float
    daily_budget_usd: float
    queue: int
    live_jobs: int
    pending_moderation: int


@router.get("/admin/ai/actions/status", response_model=ActionsStatus)
async def actions_status(_: User = Depends(admin_only), db: AsyncSession = Depends(get_db)):
    """Lo que la pestaña Acciones muestra antes de apretar nada."""
    count = lambda stmt: db.execute(select(func.count()).select_from(stmt.subquery()))  # noqa: E731
    return ActionsStatus(
        recs_switch_on=bool(await get_setting(db, SettingKey.ia_recomendaciones_activas)),
        ai_configured=_provider() is not None,
        budget_left=await pipeline.budget_left(db),
        today_usd=await pipeline.spent_today(db), daily_budget_usd=settings.AI_DAILY_BUDGET_USD,
        queue=(await count(select(AiRecomputeQueue.job_id))).scalar_one(),
        live_jobs=(await count(select(JobPosting.id).where(_live_job()))).scalar_one(),
        pending_moderation=(await count(select(JobPosting.id).where(
            JobPosting.deleted_at.is_(None), JobPosting.moderation_status == JobModerationStatus.pending_review
        ))).scalar_one(),
    )


async def _enqueue(db: AsyncSession, job_ids: list[uuid.UUID]) -> int:
    """Encola con motivo "manual" y sin esperar el debounce: la próxima vuelta de 10 minutos la toma."""
    if not job_ids:
        return 0
    now = datetime.now(timezone.utc)
    ready = now - realtime.DEBOUNCE
    stmt = pg_insert(AiRecomputeQueue).values(
        [dict(job_id=j, reason="manual", requested_at=ready, last_requested_at=now) for j in job_ids])
    await db.execute(stmt.on_conflict_do_update(
        index_elements=["job_id"],
        set_={"reason": "manual", "last_requested_at": now,
              "requested_at": func.least(AiRecomputeQueue.requested_at, ready)},
    ))
    return len(job_ids)


@router.post("/admin/ai/actions/recompute-job/{job_id}", response_model=ActionResult)
async def action_recompute_job(job_id: uuid.UUID, _: User = Depends(admin_only), db: AsyncSession = Depends(get_db)):
    job = await _job_or_404(db, job_id)
    if not (job.status == JobPostingStatus.active and job.moderation_status == JobModerationStatus.approved):
        raise HTTPException(status_code=409, detail="Sólo se recalculan búsquedas activas y aprobadas.")
    await _require_ai(db)
    await _enqueue(db, [job.id])
    await activity.log_activity(db, activity.KIND_MANUAL, job_id=job.id, company_id=job.company_id,
                                detail={"accion": "recalcular_busqueda"})
    await db.commit()
    return ActionResult(queued=1, message="Listo: se recalcula en los próximos 10 minutos.")


@router.post("/admin/ai/actions/recompute-all", response_model=ActionResult)
async def action_recompute_all(_: User = Depends(admin_only), db: AsyncSession = Depends(get_db)):
    await _require_ai(db)
    ids = list((await db.execute(select(JobPosting.id).where(_live_job()))).scalars().all())
    if not ids:
        raise HTTPException(status_code=409, detail="No hay búsquedas activas para recalcular.")
    n = await _enqueue(db, ids)
    await activity.log_activity(db, activity.KIND_MANUAL, detail={"accion": "recalcular_todas", "busquedas": n})
    await db.commit()
    per_run = realtime.MAX_JOBS_PER_RUN
    return ActionResult(queued=n, message=(
        f"Se encolaron {n} búsquedas. Se procesan de a {per_run} cada 10 minutos, siempre dentro del tope de gasto."))


async def review_pending_jobs(job_ids: list[uuid.UUID]) -> None:
    """Segundo plano, sesión propia: vectores que falten (una sola llamada para todos) y después
    los chequeos de cada aviso con lo ya guardado. Nunca aprueba ni rechaza."""
    from app.services.ai import moderation

    provider = _provider()
    if provider is None:
        return
    async with db_session.async_session_maker() as db:
        try:
            await moderation.embed_missing(db, provider)
            await db.commit()
        except AIError as exc:
            await db.rollback()
            logger.warning("centro_ia_revision_vectores_fallo", error=str(exc)[:200])
        for jid in job_ids:
            try:
                job = (await db.execute(select(JobPosting).where(JobPosting.id == jid))).scalar_one_or_none()
                if job is None:
                    continue
                mark = activity.cost_mark(db)
                checks = await moderation.checks_for(db, provider, job)
                await activity.log_activity(db, activity.KIND_MODERATION, job_id=job.id, company_id=job.company_id, detail={
                    "motivo": "talency", "disponible": checks.available, "duplicados": len(checks.duplicates),
                    "duplicados_ids": [d.job_id for d in checks.duplicates], "sector_dudoso": checks.sector is not None,
                    "sector_sugerido": checks.sector.suggested_industry_id if checks.sector else None,
                }, cost_usd=activity.cost_since(db, mark), alert=bool(checks.duplicates or checks.sector))
                await db.commit()
            except Exception as exc:
                await db.rollback()
                logger.warning("centro_ia_revision_fallo", job_id=str(jid), error=str(exc)[:200])


@router.post("/admin/ai/actions/review-pending", response_model=ActionResult)
async def action_review_pending(background: BackgroundTasks, _: User = Depends(admin_only),
                                db: AsyncSession = Depends(get_db)):
    await _require_ai(db)
    ids = list((await db.execute(
        select(JobPosting.id).where(JobPosting.deleted_at.is_(None),
                                    JobPosting.moderation_status == JobModerationStatus.pending_review)
        .order_by(JobPosting.created_at).limit(MAX_PENDING_REVIEW)
    )).scalars().all())
    if not ids:
        raise HTTPException(status_code=409, detail="No hay búsquedas pendientes de revisión.")
    await activity.log_activity(db, activity.KIND_MANUAL, detail={"accion": "revisar_pendientes", "busquedas": len(ids)})
    await db.commit()
    background.add_task(review_pending_jobs, ids)
    return ActionResult(queued=len(ids), message=(
        f"Revisando {len(ids)} búsquedas pendientes. En un par de minutos ves los avisos en Búsquedas y en Actividad."))


async def reread_cv(candidate_id: uuid.UUID) -> None:
    """Segundo plano, sesión propia: vuelve a leer y anonimizar el CV y fuerza el reindexado."""
    async with db_session.async_session_maker() as db:
        try:
            row = (await db.execute(
                select(CandidateProfile, User.email).join(User, User.id == CandidateProfile.user_id)
                .where(CandidateProfile.id == candidate_id, CandidateProfile.deleted_at.is_(None))
            )).one_or_none()
            if row is None:
                return
            profile, email = row
            # Borrar la marca de la última lectura es lo que obliga a `refresh_cv_text` a releer.
            await db.execute(CandidateCvText.__table__.delete().where(CandidateCvText.candidate_id == candidate_id))
            await pipeline.refresh_cv_text(db, profile, email, _fetch_cv)
            await db.execute(update(CandidateAiIndex).where(CandidateAiIndex.candidate_id == candidate_id)
                             .values(ficha_hash=""))
            await db.flush()
            provider = _provider()
            if provider is not None and await pipeline.budget_left(db):
                await pipeline.index_candidates(db, provider, [candidate_id])
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.warning("centro_ia_releer_cv_fallo", candidate_id=str(candidate_id), error=str(exc)[:200])


@router.post("/admin/ai/actions/reread-cv/{candidate_id}", response_model=ActionResult)
async def action_reread_cv(candidate_id: uuid.UUID, background: BackgroundTasks, _: User = Depends(admin_only),
                           db: AsyncSession = Depends(get_db)):
    profile = (await db.execute(select(CandidateProfile).where(
        CandidateProfile.id == candidate_id, CandidateProfile.deleted_at.is_(None)))).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Not Found")
    if not profile.cv_file_url:
        raise HTTPException(status_code=409, detail="Este candidato no tiene un CV cargado.")
    await _require_ai(db)
    await activity.log_activity(db, activity.KIND_MANUAL, candidate_id=candidate_id, detail={"accion": "releer_cv"})
    await db.commit()
    background.add_task(reread_cv, candidate_id)
    return ActionResult(queued=1, message="Releyendo el CV. En un minuto lo ves en Actividad (con el resultado de la anonimización).")


class MonthlyDraftResult(BaseModel):
    campaign_id: uuid.UUID
    name: str
    generated_by_ai: bool
    message: str


@router.post("/admin/ai/actions/monthly-draft", response_model=MonthlyDraftResult)
async def action_monthly_draft(_: User = Depends(admin_only), db: AsyncSession = Depends(get_db)):
    """Una sola llamada a la IA (acotada). El borrador **no sale solo**: queda en Campañas."""
    from app.services.email import monthly

    if not await pipeline.budget_left(db):
        raise HTTPException(
            status_code=409,
            detail=f"Hoy ya se llegó al tope de gasto de IA (USD {settings.AI_DAILY_BUDGET_USD:.2f}). Vuelve a estar disponible mañana.",
        )
    campaign = await monthly.prepare_monthly_draft(db, force=True, origin="talency")
    if campaign is None:
        raise HTTPException(status_code=409, detail="Ya existe el borrador de novedades de este mes. Lo encontrás en Campañas.")
    await activity.log_activity(db, activity.KIND_MANUAL, detail={"accion": "borrador_mensual", "campana": campaign.id})
    await db.commit()
    with_ai = bool(campaign.generated_by_ai)
    return MonthlyDraftResult(
        campaign_id=campaign.id, name=campaign.name, generated_by_ai=with_ai,
        message=("Borrador listo en Campañas. Revisalo y aprobalo: no sale solo." if with_ai else
                 "Borrador listo en Campañas, pero sin texto de la IA (no está disponible): trae sólo los datos del mes."),
    )


# ── 3. Registro de actividad ────────────────────────────────────────────────────────────

class ActivityItem(BaseModel):
    id: str
    at: datetime
    kind: str
    job_id: Optional[uuid.UUID] = None
    job_title: Optional[str] = None
    company_id: Optional[uuid.UUID] = None
    company_name: Optional[str] = None
    candidate_id: Optional[uuid.UUID] = None
    detail: dict
    cost_usd: float
    alert: bool


def _activity_union():
    """`ai_activity_log` + los dos derivados, con las mismas columnas."""
    nuuid = cast(null(), UUID(as_uuid=True))
    log_q = select(
        cast(AiActivityLog.id, String).label("id"), AiActivityLog.created_at.label("at"),
        AiActivityLog.kind.label("kind"), AiActivityLog.job_id.label("job_id"),
        AiActivityLog.candidate_id.label("candidate_id"), AiActivityLog.company_id.label("company_id"),
        AiActivityLog.detail.label("detail"), AiActivityLog.cost_usd.label("cost_usd"),
        AiActivityLog.alert.label("alert"),
    )
    # Búsquedas en lenguaje natural: sólo cuántas por día (las frases no se guardan en ningún lado).
    sday = func.date(func.timezone(AR_ZONE, AiUsageLog.created_at))
    search_q = select(
        func.concat("busqueda-", cast(sday, String)), func.max(AiUsageLog.created_at),
        literal(activity.KIND_SEARCH, String), nuuid, nuuid, nuuid,
        func.jsonb_build_object("consultas", func.count(), "agregado", "dia", type_=JSONB),
        cast(func.sum(AiUsageLog.cost_usd), Numeric(12, 6)), literal(False, Boolean),
    ).where(AiUsageLog.feature == "busqueda").group_by(sday)
    # Avisos a empresas de "candidatos nuevos que encajan": por búsqueda y día, cuántos candidatos.
    nday = func.date(func.timezone(AR_ZONE, JobRecommendation.notified_at))
    fit_q = select(
        func.concat("aviso-", cast(JobRecommendation.job_id, String), "-", cast(nday, String)),
        func.max(JobRecommendation.notified_at), literal(activity.KIND_NEW_FIT, String),
        JobRecommendation.job_id, nuuid, JobPosting.company_id,
        func.jsonb_build_object("candidatos", func.count(), type_=JSONB),
        cast(literal(0), Numeric(12, 6)), literal(False, Boolean),
    ).join(JobPosting, JobPosting.id == JobRecommendation.job_id).where(
        JobRecommendation.notified_at.is_not(None)
    ).group_by(JobRecommendation.job_id, JobPosting.company_id, nday)
    return union_all(log_q, search_q, fit_q).subquery("actividad")


def _local_bounds(desde: date | None, hasta: date | None) -> tuple[datetime | None, datetime | None]:
    start = datetime.combine(desde, time.min, tzinfo=AR_TZ).astimezone(timezone.utc) if desde else None
    end = datetime.combine(hasta + timedelta(days=1), time.min, tzinfo=AR_TZ).astimezone(timezone.utc) if hasta else None
    return start, end


@router.get("/admin/ai/activity", response_model=Paginated[ActivityItem])
async def admin_ai_activity(
    tipo: Optional[str] = Query(default=None, max_length=200, description="Uno o varios tipos separados por coma"),
    desde: Optional[date] = None, hasta: Optional[date] = None,
    solo_alertas: bool = False,
    job_id: Optional[uuid.UUID] = None, candidate_id: Optional[uuid.UUID] = None,
    page: int = PageQuery, page_size: int = PageSizeQuery,
    _: User = Depends(admin_only), db: AsyncSession = Depends(get_db),
):
    a = _activity_union()
    stmt = select(a)
    kinds = [k.strip() for k in (tipo or "").split(",") if k.strip()]
    if kinds:
        stmt = stmt.where(a.c.kind.in_(kinds))
    start, end = _local_bounds(desde, hasta)
    if start:
        stmt = stmt.where(a.c.at >= start)
    if end:
        stmt = stmt.where(a.c.at < end)
    if solo_alertas:
        stmt = stmt.where(a.c.alert.is_(True))
    if job_id:
        stmt = stmt.where(a.c.job_id == job_id)
    if candidate_id:
        stmt = stmt.where(a.c.candidate_id == candidate_id)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.order_by(a.c.at.desc(), a.c.id).offset((page - 1) * page_size).limit(page_size))).all()

    job_ids = {r.job_id for r in rows if r.job_id}
    company_ids = {r.company_id for r in rows if r.company_id}
    titles = dict((await db.execute(select(JobPosting.id, JobPosting.title).where(JobPosting.id.in_(job_ids))
                                    )).all()) if job_ids else {}
    names = dict((await db.execute(select(CompanyProfile.id, CompanyProfile.legal_name)
                                   .where(CompanyProfile.id.in_(company_ids)))).all()) if company_ids else {}
    items = [ActivityItem(
        id=r.id, at=r.at, kind=r.kind, job_id=r.job_id, job_title=titles.get(r.job_id),
        company_id=r.company_id, company_name=names.get(r.company_id), candidate_id=r.candidate_id,
        detail=dict(r.detail or {}), cost_usd=float(r.cost_usd or 0), alert=bool(r.alert),
    ) for r in rows]
    return Paginated[ActivityItem](items=items, total=total, page=page, page_size=page_size)


class ActivityTotals(BaseModel):
    cv_reads: int
    anonymization_alerts: int
    recomputes: int
    reranks: int
    summaries: int
    moderation_reviews: int
    moderation_flags: int
    skill_suggestions: int
    drafts: int
    searches: int
    company_notices: int
    alerts: int
    spend_usd: float


class ActivitySummary(BaseModel):
    today: ActivityTotals
    week: ActivityTotals
    daily_budget_usd: float
    budget_left: bool
    recs_switch_on: bool
    ai_configured: bool


async def _totals(db: AsyncSession, since: datetime) -> ActivityTotals:
    by_kind = dict((await db.execute(
        select(AiActivityLog.kind, func.count()).where(AiActivityLog.created_at >= since).group_by(AiActivityLog.kind)
    )).all())
    alerts_by_kind = dict((await db.execute(
        select(AiActivityLog.kind, func.count()).where(AiActivityLog.created_at >= since, AiActivityLog.alert.is_(True))
        .group_by(AiActivityLog.kind)
    )).all())
    reranks = (await db.execute(
        select(func.coalesce(func.sum(cast(AiActivityLog.detail["reranks"].astext, Numeric)), 0))
        .where(AiActivityLog.created_at >= since, AiActivityLog.kind == activity.KIND_RECOMPUTE)
    )).scalar_one()
    spend = (await db.execute(select(func.coalesce(func.sum(AiUsageLog.cost_usd), 0))
                              .where(AiUsageLog.created_at >= since))).scalar_one()
    searches = (await db.execute(select(func.count()).select_from(AiUsageLog)
                                 .where(AiUsageLog.created_at >= since, AiUsageLog.feature == "busqueda"))).scalar_one()
    notices = (await db.execute(select(func.count()).select_from(JobRecommendation)
                                .where(JobRecommendation.notified_at >= since))).scalar_one()
    return ActivityTotals(
        cv_reads=by_kind.get(activity.KIND_CV_READ, 0),
        anonymization_alerts=alerts_by_kind.get(activity.KIND_CV_READ, 0),
        recomputes=by_kind.get(activity.KIND_RECOMPUTE, 0), reranks=int(reranks),
        summaries=by_kind.get(activity.KIND_SUMMARY, 0),
        moderation_reviews=by_kind.get(activity.KIND_MODERATION, 0),
        moderation_flags=alerts_by_kind.get(activity.KIND_MODERATION, 0),
        skill_suggestions=by_kind.get(activity.KIND_SKILLS, 0),
        drafts=by_kind.get(activity.KIND_JOB_DRAFT, 0) + by_kind.get(activity.KIND_CAMPAIGN_DRAFT, 0),
        searches=searches, company_notices=notices, alerts=sum(alerts_by_kind.values()), spend_usd=float(spend),
    )


@router.get("/admin/ai/activity/summary", response_model=ActivitySummary)
async def admin_ai_activity_summary(_: User = Depends(admin_only), db: AsyncSession = Depends(get_db)):
    today = local_day_start(datetime.now(timezone.utc))
    return ActivitySummary(
        today=await _totals(db, today), week=await _totals(db, today - timedelta(days=6)),
        daily_budget_usd=settings.AI_DAILY_BUDGET_USD, budget_left=await pipeline.budget_left(db),
        recs_switch_on=bool(await get_setting(db, SettingKey.ia_recomendaciones_activas)),
        ai_configured=_provider() is not None,
    )
