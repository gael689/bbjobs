"""Recomendados "al instante": al aprobarse una búsqueda y al entrar una postulación nueva.

Hasta acá se calculaban de noche (sólo híbrido) y a pedido de la empresa. Ahora los dos eventos
dejan la búsqueda **marcada** en `ai_recompute_queue` y la tarea de 10 minutos la recalcula:

- **No frena el pedido:** marcar es un INSERT con su propia sesión, después del commit del
  endpoint; si falla, se loguea y el pedido sigue (la noche lo cubre igual).
- **Debounce:** una fila por búsqueda. Diez postulaciones seguidas → un solo recálculo. La fila
  espera `DEBOUNCE` desde la primera marca, para juntar la ráfaga.
- **Gasto acotado:** el rerank reutiliza todo lo ya evaluado (sólo paga la ficha nueva) y la
  corrida entera tiene un tope de `AI_MAX_RERANKS_PER_RUN` llamadas, además del tope diario en
  USD que ya aplica el pipeline. Si el tope se agota, la búsqueda queda en la cola para la
  próxima vuelta.
- Si una postulación llega mientras se recalcula, `last_requested_at` cambia y la fila no se
  borra: se vuelve a procesar en la próxima vuelta (barato: todo lo demás está en caché).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.features import new_modules_enabled
from app.integrations.gemini_client import AIProvider
from app.models.ai import AiRecomputeQueue
from app.models.job import JobModerationStatus, JobPosting, JobPostingStatus
from app.models.settings import SettingKey
from app.services.ai import pipeline
from app.services.settings import get_setting

logger = structlog.get_logger("app.services.ai.realtime")

DEBOUNCE = timedelta(minutes=2)
MAX_JOBS_PER_RUN = 20


async def mark(db: AsyncSession, job_id: uuid.UUID, reason: str, now: datetime | None = None) -> bool:
    """Marca la búsqueda para recalcular. No commitea. Devuelve False si la IA está apagada."""
    if not new_modules_enabled() or not await get_setting(db, SettingKey.ia_recomendaciones_activas):
        return False
    now = now or datetime.now(timezone.utc)
    await db.execute(
        pg_insert(AiRecomputeQueue)
        .values(job_id=job_id, reason=reason[:30], requested_at=now, last_requested_at=now)
        .on_conflict_do_update(index_elements=["job_id"], set_={"last_requested_at": now})
    )
    return True


async def request_recompute(job_id: uuid.UUID, reason: str) -> None:
    """Lo llaman los endpoints DESPUÉS de su commit. Sesión propia; nunca levanta."""
    if not new_modules_enabled():
        return
    from app.db.session import async_session_maker

    try:
        async with async_session_maker() as db:
            if await mark(db, job_id, reason):
                await db.commit()
    except Exception as exc:  # marcar es un extra: el pedido de la persona ya se guardó
        logger.warning("ai_recompute_mark_fallo", job_id=str(job_id), error=str(exc)[:200])


async def process_queue(db: AsyncSession, provider: AIProvider | None, now: datetime | None = None) -> dict:
    """Recalcula las búsquedas marcadas hace más de `DEBOUNCE`. Commitea por búsqueda."""
    now = now or datetime.now(timezone.utc)
    stats = {"busquedas": 0, "rerank": 0, "pendientes": 0}
    rows = (await db.execute(
        select(AiRecomputeQueue.job_id, AiRecomputeQueue.last_requested_at)
        .where(AiRecomputeQueue.requested_at <= now - DEBOUNCE)
        .order_by(AiRecomputeQueue.requested_at)
        .limit(MAX_JOBS_PER_RUN)
    )).all()
    reranks_left = settings.AI_MAX_RERANKS_PER_RUN
    for job_id, seen_at in rows:
        if reranks_left <= 0:
            stats["pendientes"] += 1
            continue
        job = (await db.execute(select(JobPosting).where(JobPosting.id == job_id))).scalar_one_or_none()
        live = job is not None and job.deleted_at is None and job.status == JobPostingStatus.active \
            and job.moderation_status == JobModerationStatus.approved
        try:
            if live:
                result = await pipeline.compute_recommendations(
                    db, provider, job, rerank_enabled=True, max_reranks=reranks_left,
                )
                reranks_left -= result["rerank"] + result["fallidos"]
                stats["rerank"] += result["rerank"]
                stats["busquedas"] += 1
                if result.get("tope"):
                    # Quedaron fichas sin evaluar por el tope de la corrida: sigue en la cola.
                    await db.commit()
                    stats["pendientes"] += 1
                    continue
            await db.execute(delete(AiRecomputeQueue).where(
                AiRecomputeQueue.job_id == job_id, AiRecomputeQueue.last_requested_at == seen_at))
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("ai_recompute_queue_error", job_id=str(job_id), error=str(exc)[:200])
    if stats["busquedas"] or stats["pendientes"]:
        logger.info("ai_recompute_queue", **stats)
    return stats
