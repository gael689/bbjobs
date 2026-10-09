"""Tareas programadas de la IA (las agrega el scheduler sólo con la compuerta abierta).

- **Cada 10 minutos:** extrae y redacta los CV nuevos o cambiados y reindexa las fichas que
  cambiaron (auditoría R19: alguien que se registra y se postula el mismo día no espera a la
  noche). Si un CV recién leído muestra habilidades del catálogo, aviso sólo en la web al
  candidato (`automations.notify_skill_suggestions`, interruptor `asistente_ia_activo`).
- **De noche (03:00 de Argentina):** recalcula los recomendados de las búsquedas activas **sólo
  con el puntaje híbrido** (decisión P2: así el costo queda en lo prometido a Eugenia), avisa a
  cada empresa de los candidatos nuevos que encajan (v4 §4.4) y deja listos los resúmenes de 3
  líneas de los mejores recomendados (`automations.nightly_summaries`).

Las dos se apagan solas si el interruptor `ia_recomendaciones_activas` está apagado o no hay
cuenta de Gemini.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

import httpx
import structlog
from sqlalchemy import func, select

from app.db.session import async_session_maker
from app.integrations import cloudinary_client
from app.integrations.gemini_client import AIError, AIUnavailable, get_provider
from app.models.ai import CandidateCvText, JobRecommendation
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile
from app.models.core import User
from app.models.job import JobModerationStatus, JobPosting, JobPostingStatus
from app.models.settings import SettingKey
from app.services.ai import pipeline, scoring
from app.services.ai.ingest import MAX_PDF_BYTES
from app.services.notifications import create_notification
from app.services.settings import get_setting

logger = structlog.get_logger("app.services.ai.jobs")

INDEX_BATCH = 200
NEW_FIT_PER_JOB_PER_WEEK = 3
JOB_MIN_AGE = timedelta(days=3)


async def fetch_cv(stored_url: str) -> bytes:
    """Descarga el PDF privado con un link firmado de vida corta, con tope de tamaño."""
    url = cloudinary_client.signed_document_url(stored_url)
    if not url:
        raise ValueError("URL de CV no reconocida")
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            data = bytearray()
            async for chunk in resp.aiter_bytes():
                data += chunk
                if len(data) > MAX_PDF_BYTES:
                    raise ValueError("CV demasiado grande")
            return bytes(data)


async def _ready(db):
    if not await get_setting(db, SettingKey.ia_recomendaciones_activas):
        return None
    try:
        return get_provider()
    except AIUnavailable:
        return None


async def index_tick() -> dict:
    """Indexa lo que cambió y después recalcula las búsquedas marcadas "al instante" (aprobadas o
    con postulaciones nuevas, ver `realtime.py`): primero el índice, así la ficha de quien se
    acaba de postular ya tiene vectores cuando se recalcula. Al final, vectores de los avisos para
    la moderación (baratos: sólo los que faltan o cambiaron)."""
    from app.services.ai import moderation, realtime

    async with async_session_maker() as db:
        provider = await _ready(db)
        if provider is None:
            return {}
        stats = await _index_changed(db, provider)
        stats["cola"] = await realtime.process_queue(db, provider)
        try:
            stats["avisos"] = await moderation.embed_missing(db, provider)
            await db.commit()
        except AIError as exc:
            await db.rollback()
            logger.warning("ai_job_vectors_fallo", error=str(exc)[:200])
        return stats


async def _index_changed(db, provider) -> dict:
    ids = await pipeline.candidates_needing_index(db, INDEX_BATCH)
    if not ids:
        return {}
    rows = (await db.execute(
        select(CandidateProfile, User.email).join(User, User.id == CandidateProfile.user_id)
        .where(CandidateProfile.id.in_(ids))
    )).all()
    prev_cv = dict((await db.execute(
        select(CandidateCvText.candidate_id, CandidateCvText.source_hash).where(CandidateCvText.candidate_id.in_(ids))
    )).all())
    fresh_cvs = []   # CV leídos recién en esta vuelta (para las habilidades sugeridas)
    for profile, email in rows:
        status = await pipeline.refresh_cv_text(db, profile, email, fetch_cv)
        if status == "ok" and profile.cv_file_url and \
                prev_cv.get(profile.id) != hashlib.sha256(profile.cv_file_url.encode()).hexdigest():
            fresh_cvs.append(profile.id)
    await db.flush()
    try:
        stats = await pipeline.index_candidates(db, provider, ids)
    except AIError as exc:
        await db.rollback()
        logger.warning("ai_index_tick_fallo", error=str(exc)[:200])
        return {}
    await db.commit()
    if stats.get("reindexados"):
        logger.info("ai_index_tick", **stats)
    if fresh_cvs:
        # Habilidades del catálogo que muestra el CV: aviso sólo en la web (automations.py).
        from app.services.ai.automations import notify_skill_suggestions

        stats["avisos_habilidades"] = await notify_skill_suggestions(db, provider, fresh_cvs)
    return stats


async def nightly(now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    async with async_session_maker() as db:
        provider = await _ready(db)
        if provider is None:
            return {}
        # Se recorren ids y cada búsqueda se vuelve a leer: después de un rollback (una búsqueda
        # que falló) los objetos cargados quedan vencidos y leerlos en async rompe la vuelta.
        job_ids = (await db.execute(
            select(JobPosting.id).where(
                JobPosting.status == JobPostingStatus.active, JobPosting.deleted_at.is_(None),
                JobPosting.moderation_status == JobModerationStatus.approved,
            )
        )).scalars().all()
        total = {"busquedas": 0, "avisos": 0}
        for job_id in job_ids:
            try:
                job = await db.get(JobPosting, job_id)
                if job is None:
                    continue
                await pipeline.compute_recommendations(db, provider, job, rerank_enabled=False, reason="noche")
                await db.commit()
                total["busquedas"] += 1
            except Exception as exc:
                await db.rollback()
                logger.error("ai_nightly_job_error", job_id=str(job_id), error=str(exc)[:200])
        total["avisos"] = await notify_new_fits(db, now)
        await db.commit()
        # Resúmenes de 3 líneas de los mejores recomendados, listos para la mañana (con caché y
        # dentro del tope de llamadas y del tope diario en USD).
        from app.services.ai.automations import nightly_summaries

        try:
            total["resumenes"] = (await nightly_summaries(db, provider, now))["generados"]
        except Exception as exc:
            await db.rollback()
            logger.error("ai_nightly_summaries_error", error=str(exc)[:200])
        logger.info("ai_nightly", **total)
        return total


async def notify_new_fits(db, now: datetime) -> int:
    """Una notificación por empresa por noche con los candidatos nuevos que encajan:
    puntaje ≥ 80 y cobertura ≥ 50 %, búsqueda activa con 3 días o más, como mucho 3 por
    búsqueda por semana, y nunca dos veces el mismo candidato para la misma búsqueda."""
    week_ago = now - timedelta(days=7)
    candidates = (await db.execute(
        select(JobRecommendation, JobPosting)
        .join(JobPosting, JobPosting.id == JobRecommendation.job_id)
        .where(
            JobRecommendation.notified_at.is_(None),
            JobRecommendation.final_score >= scoring.NEW_FIT_THRESHOLD,
            JobRecommendation.coverage >= scoring.NEW_FIT_MIN_COVERAGE,
            JobPosting.status == JobPostingStatus.active,
            JobPosting.published_at.is_not(None),
            JobPosting.published_at <= now - JOB_MIN_AGE,
        )
        .order_by(JobRecommendation.final_score.desc())
    )).all()
    by_company: dict = {}
    for rec, job in candidates:
        already = (await db.execute(
            select(func.count()).select_from(JobRecommendation).where(
                JobRecommendation.job_id == job.id, JobRecommendation.notified_at >= week_ago)
        )).scalar_one()
        bucket = by_company.setdefault(job.company_id, {"jobs": {}, "count": 0})
        per_job = bucket["jobs"].setdefault(job.id, {"title": job.title, "n": already})
        if per_job["n"] >= NEW_FIT_PER_JOB_PER_WEEK:
            continue
        per_job["n"] += 1
        rec.notified_at = now
        bucket["count"] += 1

    sent = 0
    for company_id, bucket in by_company.items():
        if not bucket["count"]:
            continue
        user_id = (await db.execute(select(CompanyProfile.user_id).where(CompanyProfile.id == company_id))).scalar_one_or_none()
        if user_id is None:
            continue
        titles = ", ".join(f"'{j['title']}'" for j in bucket["jobs"].values())
        await create_notification(
            db, user_id=user_id, type="recommended_candidates_new",
            title="Hay candidatos nuevos que encajan con tus búsquedas",
            body=(f"Encontramos {'1 perfil que encaja' if bucket['count'] == 1 else str(bucket['count']) + ' perfiles que encajan'}"
                  f" con {titles}. Miralos en Recomendados."),
            link="/dashboard/company/postulaciones",
        )
        sent += 1
    return sent
