"""Aviso al candidato: "Hay una búsqueda que encaja con tu perfil" (PLAN-FINAL-IA-Y-MAILS §3.2).

Reemplaza a las alertas que armaba el candidato (rubro, zona, modalidad): ahora BBJobs elige qué
avisar según el perfil. Es una **regla en código**, no una decisión de la IA: la IA sólo pone el
puntaje; quién recibe el mail lo deciden los filtros de acá (la IA nunca manda mails sola).

Dos pasos:

1. **Juntar** (`collect_ai_matches` / `collect_simple_matches`): cuando termina el recálculo de una
   búsqueda recién aprobada (`realtime.process_queue`), se anotan en `candidate_job_matches` los
   candidatos que encajan. Sin IA prendida, se anota al aprobarla (`on_job_approved`) con el
   puntaje simple del resumen de los lunes (`digests.score_for_candidate`). Una fila por
   (candidato, búsqueda): la misma búsqueda nunca se avisa dos veces.
2. **Mandar** (`send_match_alerts`, lo llama el reloj de los resúmenes cada 15 min): un mail por
   candidato con todo lo que tiene pendiente, como mucho uno cada 24 h. Lo que aparece dentro de
   esas 24 h espera y sale junto en el próximo. Los topes generales (2 por día, franja 08–21) y
   la baja en un clic los aplica la política al despachar, como en cualquier otro mail.

A quién: puntaje ≥ 70 evaluado por la IA (`rerank_status == "done"`), que no se postuló a esa
búsqueda, que aceptó la privacidad 3.0 y no se opuso a la IA, y que entró a BBJobs en los últimos
30 días. "Búsquedas para vos" (lunes) no repite lo que ya salió acá (`sent_job_ids`).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import exists, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.legal import accepted_ai_terms
from app.models.alerts import CandidateJobMatch
from app.models.candidate import CandidateProfile, CandidateSkill
from app.models.catalogs import Zone
from app.models.core import User
from app.models.job import Application, JobModerationStatus, JobPosting, JobPostingSkill, JobPostingStatus

logger = structlog.get_logger("app.services.email.matches")

TEMPLATE_KEY = "aviso_busquedas"
# Quien no entra hace más de 30 días no recibe avisos ni el resumen de los lunes (Gael, 09/11).
ACTIVE_WITHIN = timedelta(days=30)
EVERY = timedelta(hours=24)
# Sólo búsquedas recién publicadas: el aviso es "salió una búsqueda", no un repaso de lo viejo.
FRESH_FOR = timedelta(days=7)
MAX_PER_MAIL = 10
# Sin IA: el puntaje simple (zona 2 + modalidad 1 + 2 por habilidad en común) equivalente a
# "encaja" (70 con la IA) es zona y modalidad más al menos una habilidad, o dos habilidades y la
# modalidad. Ojo: depende de la escala de `score_for_candidate`; si cambia, revisar este número.
SIMPLE_MATCH_MIN = 5


def _is_live(job: JobPosting | None, now: datetime) -> bool:
    return (job is not None and job.deleted_at is None and job.status == JobPostingStatus.active
            and job.moderation_status == JobModerationStatus.approved and job.published_at is not None
            and job.published_at >= now - FRESH_FOR)


def _eligible(job_id, now: datetime) -> list:
    """Condiciones SQL comunes sobre CandidateProfile/User para recibir el aviso de `job_id`."""
    return [
        CandidateProfile.deleted_at.is_(None), CandidateProfile.ai_opt_out_at.is_(None),
        accepted_ai_terms(CandidateProfile.user_id),
        User.deleted_at.is_(None), User.is_active.is_(True), User.last_seen_at >= now - ACTIVE_WITHIN,
        ~exists().where(Application.candidate_id == CandidateProfile.id, Application.job_posting_id == job_id),
    ]


async def _store(db: AsyncSession, job_id, scored: list[tuple[uuid.UUID, int]], via: str, now: datetime) -> int:
    for candidate_id, score in scored:
        await db.execute(pg_insert(CandidateJobMatch).values(
            id=uuid.uuid4(), candidate_id=candidate_id, job_id=job_id, score=int(score), via=via,
            status="pending", created_at=now,
        ).on_conflict_do_nothing(constraint="uq_candidate_job_matches_candidate_job"))
    return len(scored)


async def collect_ai_matches(db: AsyncSession, job: JobPosting, now: datetime | None = None) -> int:
    """Anota a los candidatos con recomendado ≥ 70 evaluado por la IA. No commitea."""
    from app.models.ai import JobRecommendation
    from app.services.ai.scoring import RECOMMENDED_THRESHOLD
    from app.services.email.outbox import emails_enabled

    now = now or datetime.now(timezone.utc)
    if not _is_live(job, now) or not await emails_enabled(db):
        return 0
    rows = (await db.execute(
        select(JobRecommendation.candidate_id, JobRecommendation.final_score)
        .join(CandidateProfile, CandidateProfile.id == JobRecommendation.candidate_id)
        .join(User, User.id == CandidateProfile.user_id)
        .where(JobRecommendation.job_id == job.id, JobRecommendation.final_score >= RECOMMENDED_THRESHOLD,
               JobRecommendation.rerank_status == "done", *_eligible(job.id, now))
    )).all()
    return await _store(db, job.id, [(cid, score) for cid, score in rows], "ia", now)


async def collect_simple_matches(db: AsyncSession, job: JobPosting, now: datetime | None = None) -> int:
    """Sin IA: el puntaje simple del resumen de los lunes, con el mismo umbral para todos. No commitea."""
    from app.services.email.digests import score_for_candidate
    from app.services.email.outbox import emails_enabled

    now = now or datetime.now(timezone.utc)
    if not _is_live(job, now) or not await emails_enabled(db):
        return 0
    job_skills = set((await db.execute(
        select(JobPostingSkill.skill_id).where(JobPostingSkill.job_posting_id == job.id)
    )).scalars().all())
    profiles = (await db.execute(
        select(CandidateProfile).join(User, User.id == CandidateProfile.user_id).where(*_eligible(job.id, now))
    )).scalars().all()
    if not profiles:
        return 0
    skills: dict = {}
    for cid, sid in (await db.execute(
        select(CandidateSkill.candidate_id, CandidateSkill.skill_id)
        .where(CandidateSkill.candidate_id.in_([p.id for p in profiles]))
    )).all():
        skills.setdefault(cid, set()).add(sid)
    scored = []
    for p in profiles:
        modalities = {m for m, f in (("onsite", p.accepts_onsite), ("hybrid", p.accepts_hybrid),
                                     ("remote", p.accepts_remote)) if f}
        score = score_for_candidate(job, job_skills, skills.get(p.id, set()), p.location_zone_id, modalities)
        if score >= SIMPLE_MATCH_MIN:
            scored.append((p.id, score))
    return await _store(db, job.id, scored, "simple", now)


async def on_job_approved(job_id: uuid.UUID) -> None:
    """Lo llama la aprobación DESPUÉS de su commit. Con la IA prendida no hace nada (lo hace el
    recálculo al terminar); sin IA, anota con el puntaje simple. Sesión propia; nunca levanta."""
    from app.core.features import new_modules_enabled

    if not new_modules_enabled():
        return
    from app.db.session import async_session_maker
    from app.integrations.gemini_client import AIUnavailable, get_provider
    from app.models.settings import SettingKey
    from app.services.settings import get_setting

    try:
        async with async_session_maker() as db:
            if await get_setting(db, SettingKey.ia_recomendaciones_activas):
                try:
                    get_provider()
                    return   # la IA está: el aviso sale cuando termina el recálculo (realtime.py)
                except AIUnavailable:
                    pass
            job = (await db.execute(select(JobPosting).where(JobPosting.id == job_id))).scalar_one_or_none()
            if await collect_simple_matches(db, job):
                await db.commit()
    except Exception as exc:  # el aviso es un extra: la aprobación ya se guardó
        logger.warning("aviso_busquedas_simple_fallo", job_id=str(job_id), error=str(exc)[:200])


# ── Envío ───────────────────────────────────────────────────────────────────────────────

def _detail(job: JobPosting, zone_name: str | None) -> str | None:
    modality = str(getattr(job.modality, "value", job.modality))
    if modality == "remoto":
        return "Remoto"
    return zone_name


async def send_match_alerts(db: AsyncSession, now: datetime) -> int:
    """Un mail por candidato con lo pendiente, como mucho uno cada 24 h. No commitea."""
    from app.services.email.digests import _job_url, _last_sent, _mark_sent, enqueue_digest
    from app.services.email.render import EmailItem

    rows = (await db.execute(
        select(CandidateJobMatch, JobPosting, Zone.name, CandidateProfile, User)
        .join(JobPosting, JobPosting.id == CandidateJobMatch.job_id)
        .outerjoin(Zone, Zone.id == JobPosting.zone_id)
        .join(CandidateProfile, CandidateProfile.id == CandidateJobMatch.candidate_id)
        .join(User, User.id == CandidateProfile.user_id)
        .where(CandidateJobMatch.status == "pending")
        .order_by(CandidateJobMatch.score.desc(), JobPosting.published_at.desc())
    )).all()
    by_user: dict = {}
    for match, job, zone_name, profile, user in rows:
        by_user.setdefault(user.id, (user, profile, []))[2].append((match, job, zone_name))

    count = 0
    for user, profile, found in by_user.values():
        last = await _last_sent(db, user.id, TEMPLATE_KEY)
        if last and last > now - EVERY:
            continue   # lo nuevo espera y sale junto en el próximo
        applied = set((await db.execute(
            select(Application.job_posting_id).where(Application.candidate_id == profile.id)
        )).scalars().all())
        person_ok = (profile.deleted_at is None and profile.ai_opt_out_at is None and user.deleted_at is None
                     and user.is_active and user.last_seen_at is not None
                     and user.last_seen_at >= now - ACTIVE_WITHIN)
        valid = []
        for match, job, zone_name in found:
            if person_ok and _is_live(job, now) and job.id not in applied:
                valid.append((match, job, zone_name))
            else:
                match.status = "skipped"
        valid = valid[:MAX_PER_MAIL]    # lo que sobra queda para el próximo
        if not valid:
            continue
        items = [EmailItem(title=job.title, detail=_detail(job, zone_name), url=_job_url(job))
                 for _, job, zone_name in valid]
        if await enqueue_digest(
            db, user=user, key=TEMPLATE_KEY, subject="Hay una búsqueda que encaja con tu perfil",
            heading="", intro="", items=items, cta_label="Ver más búsquedas", cta_url="/empleos", now=now,
        ):
            for match, _, _ in valid:
                match.status, match.sent_at = "sent", now
            await _mark_sent(db, user.id, TEMPLATE_KEY, now)
            count += 1
    return count


# ── Lo que usa "Búsquedas para vos" ─────────────────────────────────────────────────────

async def sent_job_ids(db: AsyncSession, candidate_id) -> set:
    """Búsquedas que ya le llegaron en el aviso inmediato: el resumen de los lunes no las repite."""
    return set((await db.execute(
        select(CandidateJobMatch.job_id).where(CandidateJobMatch.candidate_id == candidate_id,
                                               CandidateJobMatch.status == "sent")
    )).scalars().all())


async def mark_sent_in_digest(db: AsyncSession, candidate_id, job_ids: list, now: datetime) -> None:
    """Lo pendiente que salió en el resumen de los lunes ya no sale en el aviso."""
    if job_ids:
        await db.execute(update(CandidateJobMatch).where(
            CandidateJobMatch.candidate_id == candidate_id, CandidateJobMatch.job_id.in_(job_ids),
            CandidateJobMatch.status == "pending",
        ).values(status="sent", sent_at=now))
