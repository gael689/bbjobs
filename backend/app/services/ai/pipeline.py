"""Pipeline de recomendados: base de datos ↔ núcleo puro (chunks, scoring, requirements, rerank).

Flujo por búsqueda (auditoría §5-ter):
1. Perfil de la búsqueda: habilidades técnicas cargadas + requisitos extraídos del texto (IA,
   cacheado por `job_hash`) → un vector por requisito.
2. Universo: **todos** los postulantes + la Base de Talento (con consentimiento, no borrados,
   que no se postularon).
3. Puntaje híbrido para todos (gratis): criterios estructurados + semántica por requisito
   (máximo coseno entre los fragmentos del candidato, en percentil dentro del universo).
4. Rerank con IA sólo para el top-30 (y quien entra a ese top), de a una ficha por llamada,
   reutilizando lo ya evaluado si no cambió ni la ficha ni el aviso. Fichas con sospecha de
   inyección: sólo híbrido.
5. Todo queda en `job_recommendations`. **Nadie se descarta**: la empresa ve a todos.

Gasto: cada llamada se registra en `ai_usage_log` con su costo; si el día pasa
`AI_DAILY_BUDGET_USD`, la IA se apaga sola hasta mañana (regla R13) y se sigue con el híbrido.
"""
from __future__ import annotations

import asyncio
import hashlib
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import numpy as np
import structlog
from sqlalchemy import delete, func, select, true
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.gemini_client import AIError, AIProvider, AIUsage
from app.models.ai import (
    AiUsageLog, CandidateAiIndex, CandidateChunk, CandidateCvText, JobAiProfile, JobRecommendation,
    JobRequirementVector,
)
from app.models.candidate import CandidateProfile, CandidateSkill, Education, Experience, Language
from app.models.catalogs import Skill, Zone
from app.models.core import User
from app.models.job import Application, JobPosting, JobPostingSkill
from app.services.ai import requirements as reqs
from app.services.ai import rerank, scoring
from app.services.ai.chunks import CandidateData, Education as EduData, Experience as ExpData, build_ficha
from app.services.email.policy import local_day_start

logger = structlog.get_logger("app.services.ai.pipeline")

RERANK_TOP = 30
TALENT_POOL_CONSIDERED = 30
FRAGMENTS_PER_REQUIREMENT = 2
MAX_FRAGMENTS = 8

# USD por millón de tokens (verificado el 04/10/2026; revisar en la consola al crear la cuenta).
PRICES = {
    "gemini-3.5-flash-lite": (0.30, 2.50),
    "gemini-3.8-flash": (0.75, 3.75),
    "gemini-embedding-001": (0.15, 0.0),
    "gemini-embedding-2": (0.20, 0.0),
}


# ── Consumo y presupuesto ───────────────────────────────────────────────────────────────

def cost_usd(usage: AIUsage, *, flex: bool = False) -> Decimal:
    price_in, price_out = PRICES.get(usage.model, (0.30, 2.50))
    cost = (usage.input_tokens * price_in + (usage.output_tokens + usage.thought_tokens) * price_out) / 1_000_000
    return Decimal(str(round(cost / 2 if flex else cost, 6)))


async def log_usage(db: AsyncSession, feature: str, usage: AIUsage | None, *, company_id=None, job_id=None,
                    flex: bool = False) -> None:
    if usage is None:
        return
    cost = cost_usd(usage, flex=flex)
    db.add(AiUsageLog(
        id=uuid.uuid4(), feature=feature, company_id=company_id, job_id=job_id, model=usage.model,
        input_tokens=usage.input_tokens, output_tokens=usage.output_tokens, thought_tokens=usage.thought_tokens,
        cost_usd=cost,
    ))
    # Para el registro de actividad: cuánto gastó esta sesión (ver activity.cost_mark).
    db.info["ai_cost_usd"] = db.info.get("ai_cost_usd", Decimal(0)) + cost


async def spent_today(db: AsyncSession, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)
    total = (await db.execute(
        select(func.coalesce(func.sum(AiUsageLog.cost_usd), 0)).where(AiUsageLog.created_at >= local_day_start(now))
    )).scalar_one()
    return float(total)


async def budget_left(db: AsyncSession) -> bool:
    return await spent_today(db) < settings.AI_DAILY_BUDGET_USD


# ── Carga de fichas ─────────────────────────────────────────────────────────────────────

async def load_candidates(db: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, tuple[CandidateData, set, str | None, set]]:
    """{id: (ficha_data, ids de habilidades técnicas, zone_id, modalidades)} en pocas consultas."""
    if not ids:
        return {}
    profiles = (await db.execute(
        select(CandidateProfile, User.email, Zone.name)
        .join(User, User.id == CandidateProfile.user_id)
        .outerjoin(Zone, Zone.id == CandidateProfile.location_zone_id)
        .where(CandidateProfile.id.in_(ids), CandidateProfile.deleted_at.is_(None))
    )).all()
    skills = (await db.execute(
        select(CandidateSkill.candidate_id, Skill.id, Skill.name)
        .join(Skill, Skill.id == CandidateSkill.skill_id)
        .where(CandidateSkill.candidate_id.in_(ids), Skill.category == "technical")
    )).all()
    exps = (await db.execute(select(Experience).where(Experience.candidate_id.in_(ids)))).scalars().all()
    edus = (await db.execute(select(Education).where(Education.candidate_id.in_(ids)))).scalars().all()
    langs = (await db.execute(select(Language).where(Language.candidate_id.in_(ids)))).scalars().all()
    cvs = (await db.execute(select(CandidateCvText).where(CandidateCvText.candidate_id.in_(ids)))).scalars().all()
    cv_by = {c.candidate_id: c.text for c in cvs if c.status == "ok" and c.text}

    out = {}
    for p, email, zone_name in profiles:
        modalities = {m for m, flag in (("onsite", p.accepts_onsite), ("hybrid", p.accepts_hybrid),
                                        ("remote", p.accepts_remote)) if flag}
        data = CandidateData(
            id=str(p.id), first_name=p.first_name, last_name=p.last_name, phone=p.phone or "", email=email or "",
            zone_name=zone_name, availability=str(getattr(p.availability, "value", p.availability) or "") or None,
            modalities=sorted(modalities), own_transport=p.has_own_transport, immediate=p.immediate_availability,
            technical_skills=[n for cid, _, n in skills if cid == p.id], other_skill=p.other_skill,
            languages=[(l.language_name, str(getattr(l.level, "value", l.level))) for l in langs if l.candidate_id == p.id],
            summary=p.summary,
            experiences=[ExpData(e.role_title, e.start_date, e.end_date, e.description, e.company_name)
                         for e in exps if e.candidate_id == p.id],
            educations=[EduData(str(getattr(e.level, "value", e.level)), e.degree,
                                str(getattr(e.status, "value", e.status)), e.institution)
                        for e in edus if e.candidate_id == p.id],
            cv_text=cv_by.get(p.id),
        )
        out[p.id] = (data, {sid for cid, sid, _ in skills if cid == p.id}, p.location_zone_id, modalities)
    return out


# ── Indexación ──────────────────────────────────────────────────────────────────────────

async def index_candidates(db: AsyncSession, provider: AIProvider, ids: list[uuid.UUID]) -> dict[str, int]:
    """Recalcula fragmentos y vectores de los que cambiaron (por hash de la ficha). No commitea."""
    stats = {"revisados": 0, "reindexados": 0, "fragmentos": 0}
    data = await load_candidates(db, ids)
    current = {r.candidate_id: r for r in (await db.execute(
        select(CandidateAiIndex).where(CandidateAiIndex.candidate_id.in_(list(data)))
    )).scalars().all()}
    model = settings.GEMINI_EMBEDDING_MODEL
    pending: list[tuple[uuid.UUID, object]] = []
    for cid, (cdata, *_rest) in data.items():
        stats["revisados"] += 1
        ficha = build_ficha(cdata)
        prev = current.get(cid)
        if prev and prev.ficha_hash == ficha.ficha_hash and prev.model == model:
            continue
        pending.append((cid, ficha))

    budget = settings.AI_MAX_EMBEDDINGS_PER_RUN
    for cid, ficha in pending:
        if not ficha.chunks or budget < len(ficha.chunks):
            if not ficha.chunks:
                await db.execute(delete(CandidateChunk).where(CandidateChunk.candidate_id == cid))
            continue
        vectors = await provider.embed([c.text for c in ficha.chunks], task="document")
        budget -= len(ficha.chunks)
        await log_usage(db, "embeddings", AIUsage(model=model, input_tokens=sum(len(c.text) // 4 for c in ficha.chunks)))
        await db.execute(delete(CandidateChunk).where(CandidateChunk.candidate_id == cid))
        for chunk, vec in zip(ficha.chunks, vectors):
            db.add(CandidateChunk(id=uuid.uuid4(), candidate_id=cid, kind=chunk.kind, ordinal=chunk.ordinal,
                                  text=chunk.text, embedding=vec, model=model))
        stmt = pg_insert(CandidateAiIndex).values(
            candidate_id=cid, ficha_hash=ficha.ficha_hash, model=model, chunks=len(ficha.chunks),
            injection_flags=ficha.injection_flags, indexed_at=datetime.now(timezone.utc),
        ).on_conflict_do_update(index_elements=["candidate_id"], set_={
            "ficha_hash": ficha.ficha_hash, "model": model, "chunks": len(ficha.chunks),
            "injection_flags": ficha.injection_flags, "indexed_at": datetime.now(timezone.utc),
        })
        await db.execute(stmt)
        stats["reindexados"] += 1
        stats["fragmentos"] += len(ficha.chunks)
    return stats


# ── Perfil de la búsqueda ───────────────────────────────────────────────────────────────

@dataclass
class JobContext:
    job: JobPosting
    requirements: list[reqs.Requirement]
    job_hash: str
    req_vectors: dict[str, np.ndarray]
    required_skill_ids: set
    optional_skill_ids: set
    # Requisitos que salen del catálogo de habilidades (r1..rk, en el orden de `from_structured`):
    # si el candidato tiene la habilidad cargada, ese requisito es "sí" sin depender de la IA.
    skill_reqs: dict


async def job_context(db: AsyncSession, provider: AIProvider | None, job: JobPosting) -> JobContext:
    skill_rows = (await db.execute(
        select(Skill.id, Skill.name, JobPostingSkill.is_required)
        .join(JobPostingSkill, JobPostingSkill.skill_id == Skill.id)
        .where(JobPostingSkill.job_posting_id == job.id, Skill.category == "technical")
    )).all()
    technical = [(name, bool(req)) for _, name, req in skill_rows]
    h = reqs.job_hash(job.title, job.description or "", technical)
    profile = (await db.execute(select(JobAiProfile).where(JobAiProfile.job_id == job.id))).scalar_one_or_none()

    if profile is None or profile.job_hash != h or (provider is not None and not profile.extracted_with_ai):
        requirement_list, discarded, flags, with_ai, model = reqs.from_structured(technical), [], [], False, None
        if provider is not None and await budget_left(db):
            try:
                extracted = await reqs.extract(provider, title=job.title, description=job.description or "",
                                               technical_skills=technical, company_id=str(job.company_id))
                requirement_list, discarded, flags = extracted.requirements, extracted.discarded, extracted.injection_flags
                with_ai, model = True, settings.GEMINI_GENERATION_MODEL
                await log_usage(db, "requisitos", extracted.usage, company_id=job.company_id, job_id=job.id)
            except AIError as exc:
                logger.warning("ai_requisitos_fallo", job_id=str(job.id), error=str(exc)[:200])
        values = dict(job_hash=h, requirements=[r.__dict__ for r in requirement_list], discarded=discarded,
                      injection_flags=flags, extracted_with_ai=with_ai, model=model,
                      prompt_version=reqs.PROMPT_VERSION, extracted_at=datetime.now(timezone.utc))
        await db.execute(pg_insert(JobAiProfile).values(job_id=job.id, **values)
                         .on_conflict_do_update(index_elements=["job_id"], set_=values))
        await db.execute(delete(JobRequirementVector).where(JobRequirementVector.job_id == job.id))
        if provider is not None and requirement_list:
            try:
                vecs = await provider.embed([r.texto for r in requirement_list], task="query")
                for r, v in zip(requirement_list, vecs):
                    db.add(JobRequirementVector(id=uuid.uuid4(), job_id=job.id, req_id=r.id, text=r.texto,
                                                embedding=v, model=settings.GEMINI_EMBEDDING_MODEL))
            except AIError as exc:
                logger.warning("ai_vectores_requisitos_fallo", job_id=str(job.id), error=str(exc)[:200])
        await db.flush()
        stored = requirement_list
    else:
        stored = [reqs.Requirement(**r) for r in profile.requirements]

    vec_rows = (await db.execute(
        select(JobRequirementVector.req_id, JobRequirementVector.embedding)
        .where(JobRequirementVector.job_id == job.id, JobRequirementVector.model == settings.GEMINI_EMBEDDING_MODEL)
    )).all()
    return JobContext(
        job=job, requirements=stored, job_hash=h,
        req_vectors={rid: np.asarray(v, dtype=np.float32) for rid, v in vec_rows},
        required_skill_ids={sid for sid, _, r in skill_rows if r},
        optional_skill_ids={sid for sid, _, r in skill_rows if not r},
        skill_reqs={f"r{i}": sid for i, (sid, _, _) in enumerate(skill_rows, start=1)},
    )


# ── Recomendados ────────────────────────────────────────────────────────────────────────

async def _universe(db: AsyncSession, job: JobPosting) -> tuple[list[uuid.UUID], list[uuid.UUID]]:
    applicants = list((await db.execute(
        select(Application.candidate_id).where(Application.job_posting_id == job.id, Application.deleted_at.is_(None))
    )).scalars().all())
    talent = list((await db.execute(
        select(CandidateProfile.id).where(
            CandidateProfile.visible_in_talent_pool.is_(True), CandidateProfile.deleted_at.is_(None),
            CandidateProfile.id.notin_(applicants) if applicants else true(),
        )
    )).scalars().all())
    return applicants, talent


async def _chunks_for(db: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, list[tuple[str, str, np.ndarray]]]:
    rows = (await db.execute(
        select(CandidateChunk.candidate_id, CandidateChunk.kind, CandidateChunk.ordinal, CandidateChunk.text,
               CandidateChunk.embedding)
        .where(CandidateChunk.candidate_id.in_(ids), CandidateChunk.model == settings.GEMINI_EMBEDDING_MODEL)
    )).all()
    out: dict = {}
    for cid, kind, ordinal, text, emb in rows:
        out.setdefault(cid, []).append((f"{kind}{ordinal}", text, np.asarray(emb, dtype=np.float32)))
    return out


def _semantic(ctx: JobContext, chunks: list[tuple[str, str, np.ndarray]]) -> tuple[float | None, dict[str, list[int]]]:
    """Promedio, sobre los requisitos, del mejor coseno entre los fragmentos (vectores de norma 1)."""
    if not ctx.req_vectors or not chunks:
        return None, {}
    matrix = np.stack([c[2] for c in chunks])
    best, top = [], {}
    for rid, vec in ctx.req_vectors.items():
        sims = matrix @ vec
        best.append(float(sims.max()))
        top[rid] = list(np.argsort(-sims)[:FRAGMENTS_PER_REQUIREMENT])
    return float(np.mean(best)), top


async def compute_recommendations(
    db: AsyncSession, provider: AIProvider | None, job: JobPosting, *, rerank_enabled: bool,
    service_tier: str = "standard", max_reranks: int | None = None, reason: str | None = None,
) -> dict[str, int]:
    """Recalcula los recomendados de una búsqueda. No commitea.

    `max_reranks`: tope de llamadas de rerank de esta corrida (por defecto
    `AI_MAX_RERANKS_PER_RUN`). Lo que no entra queda `skipped_limit` y `stats["tope"] = 1`.
    `reason`: para el registro de actividad (noche, aprobada, postulacion, manual, empresa). Sin
    motivo, la corrida sin rerank se anota como "noche"."""
    from app.services.ai import activity

    if max_reranks is None:
        max_reranks = settings.AI_MAX_RERANKS_PER_RUN
    mark = activity.cost_mark(db)
    stats = await _compute_recommendations(db, provider, job, rerank_enabled=rerank_enabled,
                                           service_tier=service_tier, max_reranks=max_reranks)
    await activity.log_activity(
        db, activity.KIND_RECOMPUTE, job_id=job.id, company_id=job.company_id,
        detail={"motivo": reason or ("noche" if not rerank_enabled else "otro"), "candidatos": stats["universo"],
                "guardados": stats["guardados"], "reranks": stats["rerank"], "reutilizados": stats["reutilizados"],
                "fallidos": stats["fallidos"], "tope": stats["tope"]},
        cost_usd=activity.cost_since(db, mark), alert=bool(stats["fallidos"]),
    )
    return stats


async def _compute_recommendations(
    db: AsyncSession, provider: AIProvider | None, job: JobPosting, *, rerank_enabled: bool,
    service_tier: str, max_reranks: int,
) -> dict[str, int]:
    ctx = await job_context(db, provider, job)
    applicants, talent = await _universe(db, job)
    universe = applicants + talent
    data = await load_candidates(db, universe)
    chunks = await _chunks_for(db, list(data))
    index = {r.candidate_id: r for r in (await db.execute(
        select(CandidateAiIndex).where(CandidateAiIndex.candidate_id.in_(list(data)))
    )).scalars().all()}
    existing = {r.candidate_id: r for r in (await db.execute(
        select(JobRecommendation).where(JobRecommendation.job_id == job.id)
    )).scalars().all()}

    modality = str(getattr(job.modality, "value", job.modality))
    min_level = str(getattr(job.min_education_level, "value", job.min_education_level)) if job.min_education_level else None
    rows: dict[uuid.UUID, dict] = {}
    raw_sem: dict[uuid.UUID, float] = {}
    tops: dict[uuid.UUID, dict] = {}
    for cid, (cdata, skill_ids, zone_id, modalities) in data.items():
        months = scoring.experience_months([(e.start, e.end) for e in cdata.experiences])
        criteria = {
            "skills_required": scoring.skills_value(skill_ids, ctx.required_skill_ids),
            "skills_optional": scoring.skills_value(skill_ids, ctx.optional_skill_ids),
            "experience": scoring.experience_value(months, job.min_experience_years),
            "education": scoring.education_value([(e.level, e.status) for e in cdata.educations], min_level),
            "zone": scoring.zone_value(zone_id, job.zone_id, modality),
            "modality": scoring.modality_value(modalities, modality),
        }
        h = scoring.hybrid_score(criteria)
        sem, top = _semantic(ctx, chunks.get(cid, []))
        if sem is not None:
            raw_sem[cid] = sem
        tops[cid] = top
        rows[cid] = {"hybrid": h, "source": "applicant" if cid in applicants else "talent"}

    pct = scoring.percentiles(raw_sem)
    for cid, row in rows.items():
        row["semantic_pct"] = pct.get(cid)
        row["score"] = scoring.final_score(row["hybrid"], row["semantic_pct"], None, False)

    # Base de Talento: sólo los mejores por híbrido pasan a recomendados (no se guarda a toda la base).
    talent_ranked = sorted((c for c in rows if rows[c]["source"] == "talent"), key=lambda c: -rows[c]["score"])
    keep = set(applicants) | set(talent_ranked[:TALENT_POOL_CONSIDERED])
    rerank_pool = sorted(keep, key=lambda c: -rows[c]["score"])[:RERANK_TOP]

    stats = {"universo": len(universe), "guardados": 0, "rerank": 0, "reutilizados": 0, "fallidos": 0, "tope": 0}
    can_rerank = rerank_enabled and provider is not None and bool(ctx.requirements)
    for cid in keep:
        row, prev, idx = rows[cid], existing.get(cid), index.get(cid)
        cdata = data[cid][0]
        ficha_hash = idx.ficha_hash if idx else None
        req_evals, evidence, reasons, status = [], {}, [], "none"
        code_reasons = False

        same_inputs = prev is not None and prev.rerank_status == "done" and prev.job_hash == ctx.job_hash \
            and prev.ficha_hash == ficha_hash and prev.prompt_version == rerank.PROMPT_VERSION
        if same_inputs:
            req_evals, evidence, reasons, status = prev.req_evals, prev.evidence, prev.reasons, "done"
            stats["reutilizados"] += 1
        elif can_rerank and cid in rerank_pool:
            if idx is not None and idx.injection_flags:
                status = "skipped_injection"
            elif stats["rerank"] + stats["fallidos"] >= max_reranks:
                status = "skipped_limit"
                stats["tope"] = 1
            elif not await budget_left(db):
                status = "skipped_budget"
            elif not chunks.get(cid):
                status = "no_index"
            else:
                cand_chunks = chunks[cid]
                chosen = []
                for rid in [r.id for r in ctx.requirements]:
                    for i in tops[cid].get(rid, []):
                        if i not in chosen:
                            chosen.append(i)
                chosen = (chosen or list(range(len(cand_chunks))))[:MAX_FRAGMENTS]
                fragments = [rerank.Fragment(f"f{n + 1}", cand_chunks[i][1]) for n, i in enumerate(chosen)]
                ref = "#" + hashlib.sha256(f"{job.id}:{cid}".encode()).hexdigest()[:6].upper()
                try:
                    res = await rerank.rerank_one(
                        provider, ref=ref, requirements=ctx.requirements, fragments=fragments,
                        forbidden_names=[*(e.company_name or "" for e in cdata.experiences),
                                         *(e.institution or "" for e in cdata.educations)],
                        blind=row["source"] == "talent", company_id=str(job.company_id),
                        service_tier=service_tier,
                    )
                    await log_usage(db, "rerank", res.usage, company_id=job.company_id, job_id=job.id,
                                    flex=service_tier == "flex")
                    req_evals = [e.__dict__ for e in res.evals]
                    evidence, reasons, status = res.evidence, res.reasons, "done"
                    code_reasons = res.degraded > 0
                    stats["rerank"] += 1
                except (AIError, ValueError) as exc:
                    status = "failed"
                    stats["fallidos"] += 1
                    logger.warning("ai_rerank_fallo", job_id=str(job.id), error=str(exc)[:200])

        if req_evals:
            skill_ids = data[cid][1]
            req_evals = [
                {**e, "verdict": "si"} if ctx.skill_reqs.get(e["req_id"]) in skill_ids else e
                for e in req_evals
            ]
            evals = [scoring.RequirementEval(**e) for e in req_evals]
            if code_reasons:
                # Los motivos salieron de las evaluaciones: que reflejen la habilidad cargada.
                reasons = rerank.reasons_from_evals(evals, {r.id: r for r in ctx.requirements})
            req_score, failed = scoring.requirements_score(evals)
        else:
            req_score, failed = None, False
        final = scoring.final_score(row["hybrid"], row["semantic_pct"], req_score, failed)
        values = dict(
            source=row["source"], hybrid_fit=row["hybrid"].fit, coverage=row["hybrid"].coverage,
            semantic_pct=row["semantic_pct"], criteria=row["hybrid"].criteria, req_evals=req_evals,
            evidence=evidence, reasons=reasons, final_score=final, rerank_status=status, job_hash=ctx.job_hash,
            ficha_hash=ficha_hash, prompt_version=rerank.PROMPT_VERSION if status == "done" else None,
            weights_version=scoring.WEIGHTS_VERSION, model=settings.GEMINI_GENERATION_MODEL if status == "done" else None,
            computed_at=datetime.now(timezone.utc),
        )
        await db.execute(pg_insert(JobRecommendation).values(id=uuid.uuid4(), job_id=job.id, candidate_id=cid, **values)
                         .on_conflict_do_update(constraint="uq_job_recommendations_job_candidate", set_=values))
        stats["guardados"] += 1

    # Los de la Base de Talento que ya no están entre los mejores salen de la lista.
    stale = [c for c, r in existing.items() if r.source == "talent" and c not in keep]
    if stale:
        await db.execute(delete(JobRecommendation).where(JobRecommendation.job_id == job.id,
                                                         JobRecommendation.candidate_id.in_(stale)))
    return stats


# ── CV ──────────────────────────────────────────────────────────────────────────────────

EXTRACT_TIMEOUT_SECONDS = 10


async def refresh_cv_text(db: AsyncSession, candidate: CandidateProfile, email: str | None, fetch) -> str:
    """Extrae y redacta el CV si cambió la URL. `fetch(url) -> bytes` lo inyecta el que llama
    (Cloudinary firmado en producción, un doble en los tests). No commitea. Devuelve el estado."""
    from app.services.ai import activity
    from app.services.ai.ingest import extract_cv_text
    from app.services.ai.redact import leaks, redact

    if not candidate.cv_file_url:
        await db.execute(delete(CandidateCvText).where(CandidateCvText.candidate_id == candidate.id))
        return "sin_cv"
    source_hash = hashlib.sha256(candidate.cv_file_url.encode()).hexdigest()
    prev = (await db.execute(select(CandidateCvText).where(CandidateCvText.candidate_id == candidate.id))).scalar_one_or_none()
    if prev is not None and prev.source_hash == source_hash:
        return prev.status
    try:
        data = await fetch(candidate.cv_file_url)
        extraction = await asyncio.wait_for(asyncio.to_thread(extract_cv_text, data), EXTRACT_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        status, text, stats, notes = "failed", None, {}, ["la extracción tardó demasiado"]
    except Exception as exc:
        status, text, stats, notes = "failed", None, {}, [f"no se pudo descargar: {type(exc).__name__}"]
    else:
        status, notes = extraction.status, extraction.notes
        if status == "ok":
            known = dict(known_names=[candidate.first_name, candidate.last_name,
                                      f"{candidate.first_name} {candidate.last_name}"],
                         known_phones=[candidate.phone or ""], known_emails=[email or ""])
            r = redact(extraction.text, **known)
            text, stats = r.text, r.stats
        else:
            text, stats = None, {}
    values = dict(source_hash=source_hash, status=status, text=text, redaction_stats=stats, notes=notes,
                  extracted_at=datetime.now(timezone.utc))
    await db.execute(pg_insert(CandidateCvText).values(candidate_id=candidate.id, **values)
                     .on_conflict_do_update(index_elements=["candidate_id"], set_=values))
    # Registro para Talency: sólo el estado y conteos. Si después de anonimizar sigue apareciendo
    # un dato de la persona, es una alerta (se guarda cuántos, nunca cuáles).
    leaked = len(leaks(text, **known)) if text else 0
    await activity.log_activity(
        db, activity.KIND_CV_READ, candidate_id=candidate.id,
        detail={"estado": status, "datos_tapados": sum(v for v in (stats or {}).values() if isinstance(v, int)),
                "fugas": leaked},
        alert=leaked > 0 or status == "failed",
    )
    return status


# ── Utilidades para las tareas programadas ──────────────────────────────────────────────

async def candidates_needing_index(db: AsyncSession, limit: int) -> list[uuid.UUID]:
    """Sin índice, o con el perfil o el CV cambiados después de indexar."""
    rows = (await db.execute(
        select(CandidateProfile.id)
        .outerjoin(CandidateAiIndex, CandidateAiIndex.candidate_id == CandidateProfile.id)
        .where(
            CandidateProfile.deleted_at.is_(None),
            (CandidateAiIndex.candidate_id.is_(None))
            | (CandidateProfile.updated_at > CandidateAiIndex.indexed_at)
            | (CandidateProfile.cv_uploaded_at > CandidateAiIndex.indexed_at),
        )
        .order_by(CandidateProfile.updated_at.desc())
        .limit(limit)
    )).scalars().all()
    return list(rows)


def week_ago(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) - timedelta(days=7)
