"""Ayuda a Talency al moderar: avisos duplicados y sector probablemente equivocado (Frente 6.7).

Sólo con embeddings (sin LLM): un vector por aviso (título + descripción) con
`gemini-embedding-001` a 768 dimensiones y `task_type=SEMANTIC_SIMILARITY` (el que Google
recomienda para detectar duplicados), cacheado en `job_posting_vectors` por hash del texto.

- **Posible duplicado:** coseno ≥ `DUP_THRESHOLD` contra las búsquedas activas o por revisar, de
  la misma empresa o de otra. Se muestran hasta 3, con la similitud.
- **¿Sector correcto?:** el aviso contra el centroide de los avisos **aprobados** de cada sector.
  Sólo opina si su sector y el sugerido tienen al menos `MIN_SECTOR_JOBS` avisos, si hay al menos
  `MIN_SECTORS` sectores con datos, y si el sugerido le gana al propio por `SECTOR_MARGIN`.
  Con pocos datos, no dice nada.

**Nunca rechaza ni cambia nada:** devuelve señales para que Talency mire. Gasto: feature
`moderacion` en `ai_usage_log` (embeddings, ~USD 0,00008 por aviso).

Umbrales: los cosenos de SEMANTIC_SIMILARITY entre avisos del mismo rubro en la zona caen
apretados (auditoría R8: 0,55–0,80 entre fichas del mismo dominio); un duplicado real (mismo
texto con retoques) queda por encima de 0,95. 0,92 deja margen para "mismo puesto reescrito" sin
marcar dos búsquedas distintas del mismo rubro. Están acá como constantes para ajustarlos con
datos reales (no hay vectores de producción todavía: la cuenta de Gemini no está creada).
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import numpy as np
import structlog
from sqlalchemy import and_, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.gemini_client import AIError, AIProvider, AIUsage
from app.models.ai import JobPostingVector
from app.models.catalogs import Industry
from app.models.job import JobModerationStatus, JobPosting, JobPostingStatus
from app.services.ai.pipeline import budget_left, log_usage

logger = structlog.get_logger("app.services.ai.moderation")

DUP_THRESHOLD = 0.92
MAX_DUPLICATES = 3
MIN_SECTOR_JOBS = 5
MIN_SECTORS = 3
SECTOR_MARGIN = 0.04
MAX_TEXT_CHARS = 4000
EMBED_PER_RUN = 200
LOOKBACK = timedelta(days=365)


def job_text(title: str, description: str | None) -> str:
    return f"{(title or '').strip()}\n{(description or '').strip()}"[:MAX_TEXT_CHARS]


def text_hash(text: str) -> str:
    return hashlib.sha256(f"{settings.GEMINI_EMBEDDING_MODEL}:{text}".encode()).hexdigest()


def _relevant_jobs():
    """Lo que puede servir de comparación: activas, por revisar y aprobadas del último año."""
    since = datetime.now(timezone.utc) - LOOKBACK
    return select(JobPosting.id, JobPosting.title, JobPosting.description).where(
        JobPosting.deleted_at.is_(None),
        or_(
            JobPosting.moderation_status == JobModerationStatus.pending_review,
            JobPosting.status == JobPostingStatus.active,
            and_(JobPosting.moderation_status == JobModerationStatus.approved, JobPosting.created_at >= since),
        ),
    )


async def _store(db: AsyncSession, provider: AIProvider, items: list[tuple[uuid.UUID, str]], *,
                 company_id=None, job_id=None) -> int:
    if not items:
        return 0
    vectors = await provider.embed([t for _, t in items], task="similarity")
    model = settings.GEMINI_EMBEDDING_MODEL
    await log_usage(db, "moderacion", AIUsage(model=model, input_tokens=sum(len(t) // 4 for _, t in items)),
                    company_id=company_id, job_id=job_id)
    now = datetime.now(timezone.utc)
    for (jid, text), vec in zip(items, vectors):
        values = dict(text_hash=text_hash(text), embedding=vec, model=model, computed_at=now)
        await db.execute(pg_insert(JobPostingVector).values(job_id=jid, **values)
                         .on_conflict_do_update(index_elements=["job_id"], set_=values))
    return len(items)


async def embed_missing(db: AsyncSession, provider: AIProvider, limit: int = EMBED_PER_RUN) -> int:
    """Vectores de los avisos que no tienen o cuyo texto cambió. No commitea."""
    if not await budget_left(db):
        return 0
    current = dict((await db.execute(select(JobPostingVector.job_id, JobPostingVector.text_hash))).all())
    pending = []
    for jid, title, desc in (await db.execute(_relevant_jobs())).all():
        text = job_text(title, desc)
        if current.get(jid) != text_hash(text):
            pending.append((jid, text))
    return await _store(db, provider, pending[:limit])


async def ensure_vector(db: AsyncSession, provider: AIProvider | None, job: JobPosting) -> np.ndarray | None:
    text = job_text(job.title, job.description)
    row = (await db.execute(select(JobPostingVector).where(JobPostingVector.job_id == job.id))).scalar_one_or_none()
    if row is not None and row.text_hash == text_hash(text):
        return np.asarray(row.embedding, dtype=np.float32)
    if provider is None or not await budget_left(db):
        return None
    try:
        await _store(db, provider, [(job.id, text)], company_id=job.company_id, job_id=job.id)
        await db.flush()
    except AIError as exc:
        logger.warning("ai_moderacion_vector_fallo", job_id=str(job.id), error=str(exc)[:200])
        return None
    row = (await db.execute(select(JobPostingVector).where(JobPostingVector.job_id == job.id))).scalar_one()
    return np.asarray(row.embedding, dtype=np.float32)


@dataclass
class Duplicate:
    job_id: uuid.UUID
    title: str
    company: str
    same_company: bool
    similarity: float


@dataclass
class SectorHint:
    current_industry_id: uuid.UUID | None
    current_industry: str | None
    suggested_industry_id: uuid.UUID
    suggested_industry: str
    current_similarity: float
    suggested_similarity: float


@dataclass
class Checks:
    available: bool
    duplicates: list[Duplicate] = field(default_factory=list)
    sector: SectorHint | None = None
    note: str | None = None


def _unit(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v))
    return v / n if n else v


async def checks_for(db: AsyncSession, provider: AIProvider | None, job: JobPosting) -> Checks:
    """Señales para la ficha de moderación. Puede calcular el vector del aviso (no commitea)."""
    vec = await ensure_vector(db, provider, job)
    if vec is None:
        return Checks(available=False, note="Todavía no hay vector de este aviso.")
    model = settings.GEMINI_EMBEDDING_MODEL
    rows = (await db.execute(
        select(JobPostingVector.embedding, JobPosting.id, JobPosting.title, JobPosting.company_id,
               JobPosting.company_legal_name_snapshot, JobPosting.industry_id, JobPosting.status,
               JobPosting.moderation_status)
        .join(JobPosting, JobPosting.id == JobPostingVector.job_id)
        .where(JobPostingVector.model == model, JobPosting.deleted_at.is_(None), JobPosting.id != job.id)
    )).all()

    out = Checks(available=True)
    if not rows:
        return out
    matrix = np.stack([np.asarray(r[0], dtype=np.float32) for r in rows])
    sims = matrix @ vec

    dups = []
    for r, s in zip(rows, sims):
        _, jid, title, company_id, company_name, _, status, moderation = r
        open_ = moderation == JobModerationStatus.pending_review or (
            status == JobPostingStatus.active and moderation == JobModerationStatus.approved)
        if open_ and s >= DUP_THRESHOLD:
            dups.append(Duplicate(job_id=jid, title=title, company=company_name or "",
                                  same_company=company_id == job.company_id, similarity=round(float(s), 3)))
    out.duplicates = sorted(dups, key=lambda d: -d.similarity)[:MAX_DUPLICATES]

    by_sector: dict = {}
    for r, v in zip(rows, matrix):
        if r[7] == JobModerationStatus.approved and r[5] is not None:
            by_sector.setdefault(r[5], []).append(v)
    centroids = {k: _unit(np.mean(v, axis=0)) for k, v in by_sector.items() if len(v) >= MIN_SECTOR_JOBS}
    if len(centroids) >= MIN_SECTORS and job.industry_id in centroids:
        scores = {k: float(c @ vec) for k, c in centroids.items()}
        own = scores[job.industry_id]
        best_id, best = max(((k, s) for k, s in scores.items() if k != job.industry_id), key=lambda x: x[1])
        if best - own >= SECTOR_MARGIN:
            names = dict((await db.execute(
                select(Industry.id, Industry.name).where(Industry.id.in_([job.industry_id, best_id]))
            )).all())
            out.sector = SectorHint(
                current_industry_id=job.industry_id, current_industry=names.get(job.industry_id),
                suggested_industry_id=best_id, suggested_industry=names.get(best_id, ""),
                current_similarity=round(own, 3), suggested_similarity=round(best, 3),
            )
    elif job.industry_id not in centroids:
        out.note = "Pocos avisos aprobados en este sector para opinar sobre el sector."
    return out
