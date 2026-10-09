"""Resúmenes por mail (T3): alertas de empleo, "búsquedas para vos", empresa y equipo.

Van directo a la cola (`email_outbox`) y la política decide al enviar (franja, preferencias,
supresiones). Reglas de la v4 §2–§3 que se cumplen acá:

- **R7, nunca vacío:** un resumen sin ningún ítem real no se encola.
- **Una vez por período:** `EmailDigestState(user, kind)` dice cuándo salió el último; correr el
  reloj dos veces no duplica nada.
- **R8, ocaso:** a un candidato sin actividad en 90 días no se le manda "búsquedas para vos" (sus
  alertas sí: las pidió él).
- **R15:** dentro de un resumen no se vende nada.

Horarios (de Argentina): alertas `instant` cada hora; `daily` y los resúmenes diarios a las
08:00 (el del equipo 08:30); `weekly` y "búsquedas para vos", los lunes 08:00.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerts import JobAlert, JobAlertNotification
from app.models.candidate import CandidateProfile, CandidateSkill
from app.models.catalogs import Zone
from app.models.company import CompanyProfile, VerificationStatus
from app.models.contact import ContactMessage
from app.models.core import User, UserRole
from app.models.email import EmailDigestState, EmailOutbox, EmailStatus
from app.models.job import Application, JobModerationStatus, JobPosting, JobPostingSkill, JobPostingStatus
from app.services.email.catalog import rule_for
from app.services.email.copy import DIGESTS, greeting
from app.services.email.outbox import emails_enabled, manage_url_for, recipient_variables
from app.services.email.policy import AR_TZ
from app.services.email.render import EmailItem, render_email
from app.services.email.tokens import unsubscribe_page_url

logger = structlog.get_logger("app.services.email.digests")

INACTIVE_AFTER = timedelta(days=90)
MAX_ITEMS = 10
PARA_VOS_ITEMS = 5


def _at_local(now: datetime, hh: int, mm: int = 0) -> datetime:
    local = now.astimezone(AR_TZ)
    return datetime.combine(local.date(), time(hh, mm), AR_TZ).astimezone(timezone.utc)


def _this_monday_8(now: datetime) -> datetime:
    local = now.astimezone(AR_TZ)
    monday = local.date() - timedelta(days=local.weekday())
    return datetime.combine(monday, time(8, 0), AR_TZ).astimezone(timezone.utc)


async def _last_sent(db: AsyncSession, user_id, kind: str) -> datetime | None:
    return (await db.execute(
        select(EmailDigestState.last_sent_at).where(EmailDigestState.user_id == user_id, EmailDigestState.kind == kind)
    )).scalar_one_or_none()


async def _mark_sent(db: AsyncSession, user_id, kind: str, now: datetime) -> None:
    await db.execute(pg_insert(EmailDigestState).values(id=uuid.uuid4(), user_id=user_id, kind=kind, last_sent_at=now)
                     .on_conflict_do_update(constraint="uq_email_digest_user_kind", set_={"last_sent_at": now}))


async def enqueue_digest(
    db: AsyncSession, *, user: User, key: str, subject: str, heading: str, intro: str,
    items: list[EmailItem], cta_label: str, cta_url: str, now: datetime,
) -> bool:
    if not items:
        return False   # R7
    rule = rule_for(key)
    # El texto de los resúmenes de cara a la gente vive en copy.py (el semanal es de Eugenia).
    copy = DIGESTS.get(key)
    item_cta = None
    hello = None
    if copy is not None:
        subject, heading, intro, cta_label, item_cta = (
            copy.subject, copy.heading, copy.intro, copy.cta_label, copy.item_cta)
        hello = greeting((await recipient_variables(db, user)).get("nombre"))
    rendered = render_email(
        heading=heading, body=intro, items=items[:MAX_ITEMS], cta_label=cta_label, cta_url=cta_url,
        greeting=hello, item_cta=item_cta,
        manage_url=manage_url_for(user.role) if rule.unsubscribable else None,
        unsubscribe_url=unsubscribe_page_url(user.id, rule.category) if rule.unsubscribable else None,
    )
    db.add(EmailOutbox(
        id=uuid.uuid4(), user_id=user.id, to_email=user.email, category=rule.category.value, template_key=key,
        subject=subject[:500], html=rendered.html, text=rendered.text, status=EmailStatus.pending.value,
        attempts=0, scheduled_at=now,
    ))
    return True


def _job_detail(job: JobPosting, zone_name: str | None) -> str:
    modality = str(getattr(job.modality, "value", job.modality))
    return " · ".join(x for x in (zone_name, modality, job.company_legal_name_snapshot) if x)


def _job_url(job: JobPosting) -> str:
    # Ruta canónica con slug (/empleos/<slug>-<uuid>), igual que el frontend: ver core/urls.py.
    from app.core.urls import job_public_path
    return job_public_path(job)


async def _active_jobs_since(db: AsyncSession, since: datetime | None):
    q = (select(JobPosting, Zone.name).outerjoin(Zone, Zone.id == JobPosting.zone_id).where(
        JobPosting.status == JobPostingStatus.active, JobPosting.deleted_at.is_(None),
        JobPosting.moderation_status == JobModerationStatus.approved, JobPosting.published_at.is_not(None),
    ))
    if since is not None:
        q = q.where(JobPosting.published_at > since)
    return (await db.execute(q.order_by(JobPosting.published_at.desc()))).all()


# ── Alertas de empleo ───────────────────────────────────────────────────────────────────

def alert_matches(alert: JobAlert, job: JobPosting) -> bool:
    if alert.industry_id and alert.industry_id != job.industry_id:
        return False
    if alert.zone_id and alert.zone_id != job.zone_id:
        return False
    if alert.modality and str(getattr(alert.modality, "value", alert.modality)) != str(getattr(job.modality, "value", job.modality)):
        return False
    return True


async def send_alerts(db: AsyncSession, frequency: str, now: datetime) -> int:
    """Un solo mail por candidato con todas las búsquedas nuevas que coinciden con sus alertas
    de esa frecuencia. Cada (alerta, búsqueda) sale una sola vez (`job_alert_notifications`)."""
    alerts = (await db.execute(
        select(JobAlert, CandidateProfile, User)
        .join(CandidateProfile, CandidateProfile.id == JobAlert.candidate_id)
        .join(User, User.id == CandidateProfile.user_id)
        .where(JobAlert.is_active.is_(True), JobAlert.frequency == frequency,
               CandidateProfile.deleted_at.is_(None), User.deleted_at.is_(None))
    )).all()
    if not alerts:
        return 0
    jobs = await _active_jobs_since(db, now - timedelta(days=14))
    # Candado por alerta, en la base (sobrevive a un reinicio): instantánea como mucho una por
    # hora; diaria una vez después de las 08:00; semanal una vez desde el lunes 08:00.
    not_before = {"instant": now - timedelta(hours=1), "daily": _at_local(now, 8),
                  "weekly": _this_monday_8(now)}[frequency]
    by_user: dict = {}
    for alert, profile, user in alerts:
        if alert.last_sent_at and alert.last_sent_at >= not_before:
            continue
        applied = set((await db.execute(
            select(Application.job_posting_id).where(Application.candidate_id == profile.id)
        )).scalars().all())
        sent = set((await db.execute(
            select(JobAlertNotification.job_posting_id).where(JobAlertNotification.alert_id == alert.id)
        )).scalars().all())
        since = alert.last_sent_at or alert.created_at
        for job, zone_name in jobs:
            if job.id in applied or job.id in sent or (job.published_at and since and job.published_at <= since):
                continue
            if alert_matches(alert, job):
                entry = by_user.setdefault(user.id, {"user": user, "jobs": {}, "alerts": set()})
                entry["jobs"][job.id] = (job, zone_name, alert.id)
                entry["alerts"].add(alert.id)

    count = 0
    for entry in by_user.values():
        user, found = entry["user"], list(entry["jobs"].values())
        items = [EmailItem(title=j.title, detail=_job_detail(j, z), url=_job_url(j)) for j, z, _ in found]
        n = len(found)
        if await enqueue_digest(
            db, user=user, key="digest_alertas",
            subject=f"{n} búsqueda{'s' if n != 1 else ''} nueva{'s' if n != 1 else ''} para tu alerta",
            heading="Nuevas búsquedas que coinciden con tus alertas",
            intro="Estas búsquedas se publicaron en BBJobs y coinciden con lo que estás buscando.",
            items=items, cta_label="Ver todas las búsquedas", cta_url="/empleos", now=now,
        ):
            count += 1
            for job, _, alert_id in found:
                await db.execute(pg_insert(JobAlertNotification).values(id=uuid.uuid4(), alert_id=alert_id,
                                                                        job_posting_id=job.id)
                                 .on_conflict_do_nothing(constraint="uq_alert_job_posting"))
        for alert_id in entry["alerts"]:
            alert = next(a for a, _, _ in alerts if a.id == alert_id)
            alert.last_sent_at = now
    return count


# ── "Búsquedas para vos" (lunes) ────────────────────────────────────────────────────────

async def _is_active(db: AsyncSession, profile: CandidateProfile, now: datetime) -> bool:
    if profile.updated_at and profile.updated_at >= now - INACTIVE_AFTER:
        return True
    last_app = (await db.execute(
        select(func.max(Application.created_at)).where(Application.candidate_id == profile.id)
    )).scalar_one()
    return bool(last_app and last_app >= now - INACTIVE_AFTER)


def score_for_candidate(job: JobPosting, job_skills: set, cand_skills: set, cand_zone, modalities: set[str]) -> int:
    """Puntaje simple y explicable para el resumen semanal (sin IA): zona, modalidad y
    habilidades técnicas en común. Si existe un recomendado de la IA, manda ese."""
    score = 0
    modality = str(getattr(job.modality, "value", job.modality))
    if modality == "remoto" or (cand_zone and cand_zone == job.zone_id):
        score += 2
    needed = {"presencial": "onsite", "remoto": "remote", "híbrido": "hybrid"}.get(modality)
    if needed and (not modalities or needed in modalities):
        score += 1
    score += 2 * len(job_skills & cand_skills)
    return score


# Afinidad semántica (Frente 6.2): cuánto pesa, en puntos del puntaje de arriba. Con el
# percentil en 1 suma lo mismo que 1,5 habilidades en común; nunca alcanza para tapar zona +
# modalidad + habilidades juntas. Sin vectores, el orden es el de siempre.
PARA_VOS_SEM_WEIGHT = 3.0
PARA_VOS_SEM_NEUTRAL = 0.5


async def _requirement_matrices(db: AsyncSession, job_ids: list) -> dict:
    """{job_id: matriz (requisitos × dim)} con los vectores YA calculados por el pipeline de
    recomendados. Sin llamadas a Gemini."""
    import numpy as np

    from app.core.config import settings
    from app.models.ai import JobRequirementVector

    rows = (await db.execute(
        select(JobRequirementVector.job_id, JobRequirementVector.embedding)
        .where(JobRequirementVector.job_id.in_(job_ids),
               JobRequirementVector.model == settings.GEMINI_EMBEDDING_MODEL)
    )).all()
    out: dict = {}
    for job_id, emb in rows:
        out.setdefault(job_id, []).append(np.asarray(emb, dtype=np.float32))
    return {k: np.stack(v) for k, v in out.items()}


async def _semantic_affinity(db: AsyncSession, candidate_id, req_matrices: dict) -> dict:
    """{job_id: percentil 0..1} de la afinidad del candidato con cada búsqueda: promedio, sobre los
    requisitos, del mejor coseno entre sus fragmentos (como `pipeline._semantic`). El coseno crudo
    está apretado (auditoría R8): se usa el percentil entre las búsquedas de la semana. Las que no
    tienen vectores quedan neutras."""
    import numpy as np

    from app.core.config import settings
    from app.models.ai import CandidateChunk
    from app.services.ai.scoring import percentiles

    if not req_matrices:
        return {}
    chunks = (await db.execute(
        select(CandidateChunk.embedding).where(CandidateChunk.candidate_id == candidate_id,
                                               CandidateChunk.model == settings.GEMINI_EMBEDDING_MODEL)
    )).scalars().all()
    if not chunks:
        return {}
    matrix = np.stack([np.asarray(c, dtype=np.float32) for c in chunks])
    raw = {job_id: float((reqs @ matrix.T).max(axis=1).mean()) for job_id, reqs in req_matrices.items()}
    return percentiles(raw) if len(raw) > 1 else {}


async def send_para_vos(db: AsyncSession, now: datetime) -> int:
    jobs = await _active_jobs_since(db, now - timedelta(days=7))
    if not jobs:
        return 0
    from app.core.features import new_modules_enabled
    from app.models.settings import SettingKey
    from app.services.settings import get_setting

    req_matrices: dict = {}
    if new_modules_enabled() and await get_setting(db, SettingKey.ia_recomendaciones_activas):
        req_matrices = await _requirement_matrices(db, [j.id for j, _ in jobs])
    job_skills: dict = {}
    for job_id, skill_id in (await db.execute(
        select(JobPostingSkill.job_posting_id, JobPostingSkill.skill_id)
        .where(JobPostingSkill.job_posting_id.in_([j.id for j, _ in jobs]))
    )).all():
        job_skills.setdefault(job_id, set()).add(skill_id)

    with_alerts = select(JobAlert.candidate_id).where(JobAlert.is_active.is_(True))
    rows = (await db.execute(
        select(CandidateProfile, User).join(User, User.id == CandidateProfile.user_id)
        .where(CandidateProfile.deleted_at.is_(None), User.deleted_at.is_(None), User.is_active.is_(True),
               CandidateProfile.id.notin_(with_alerts))
    )).all()
    count = 0
    for profile, user in rows:
        last = await _last_sent(db, user.id, "para_vos")
        if last and last >= _this_monday_8(now):
            continue
        if not await _is_active(db, profile, now):
            continue
        applied = set((await db.execute(
            select(Application.job_posting_id).where(Application.candidate_id == profile.id)
        )).scalars().all())
        skills = set((await db.execute(
            select(CandidateSkill.skill_id).where(CandidateSkill.candidate_id == profile.id)
        )).scalars().all())
        modalities = {m for m, f in (("onsite", profile.accepts_onsite), ("hybrid", profile.accepts_hybrid),
                                     ("remote", profile.accepts_remote)) if f}
        affinity = await _semantic_affinity(db, profile.id, req_matrices)
        bonus = (lambda job_id: PARA_VOS_SEM_WEIGHT * affinity.get(job_id, PARA_VOS_SEM_NEUTRAL)) if affinity \
            else (lambda job_id: 0.0)
        ranked = sorted(
            ((score_for_candidate(j, job_skills.get(j.id, set()), skills, profile.location_zone_id, modalities)
              + bonus(j.id), j, z)
             for j, z in jobs if j.id not in applied),
            key=lambda x: -x[0],
        )
        # Primero lo que encaja con su perfil; si no alcanza, el resto de lo publicado en la
        # semana (el texto de Eugenia es "las búsquedas publicadas esta semana").
        good = [(j, z) for s, j, z in ranked if s >= 3][:PARA_VOS_ITEMS]
        if len(good) < PARA_VOS_ITEMS:
            good += [(j, z) for s, j, z in ranked if s < 3][:PARA_VOS_ITEMS - len(good)]
        if await enqueue_digest(
            db, user=user, key="digest_para_vos", subject="Búsquedas de esta semana que te pueden interesar",
            heading="Búsquedas para vos",
            intro="Se publicaron esta semana y encajan con tu perfil. Postularte lleva un clic.",
            items=[EmailItem(title=j.title, detail=_job_detail(j, z), url=_job_url(j)) for j, z in good],
            cta_label="Ver todas las búsquedas", cta_url="/empleos", now=now,
        ):
            await _mark_sent(db, user.id, "para_vos", now)
            count += 1
    return count


# ── Resumen diario de la empresa ────────────────────────────────────────────────────────

async def send_company_daily(db: AsyncSession, now: datetime) -> int:
    from app.models.ai import JobRecommendation

    companies = (await db.execute(
        select(CompanyProfile, User).join(User, User.id == CompanyProfile.user_id)
        .where(CompanyProfile.verification_status == VerificationStatus.verified.value, User.deleted_at.is_(None))
    )).all()
    count = 0
    for company, user in companies:
        last = await _last_sent(db, user.id, "empresa_diario")
        if last and last >= _at_local(now, 8):
            continue
        since = last or (now - timedelta(days=1))
        rows = (await db.execute(
            select(JobPosting, func.count(Application.id))
            .join(Application, Application.job_posting_id == JobPosting.id)
            .where(JobPosting.company_id == company.id, Application.created_at > since, Application.deleted_at.is_(None))
            .group_by(JobPosting.id)
        )).all()
        items = []
        for job, n in rows:
            top = (await db.execute(
                select(func.count()).select_from(JobRecommendation).where(
                    JobRecommendation.job_id == job.id, JobRecommendation.source == "applicant",
                    JobRecommendation.final_score >= 70)
            )).scalar_one()
            detail = "1 postulación nueva" if n == 1 else f"{n} postulaciones nuevas"
            if top:
                detail += f" · {top} con buen encaje"
            items.append(EmailItem(title=job.title, detail=detail, url="/dashboard/company/postulaciones"))
        if await enqueue_digest(
            db, user=user, key="digest_empresa", subject="Postulaciones nuevas en tus búsquedas",
            heading="Tu resumen de hoy", intro="Esto llegó desde el último resumen.",
            items=items, cta_label="Ver postulaciones", cta_url="/dashboard/company/postulaciones", now=now,
        ):
            await _mark_sent(db, user.id, "empresa_diario", now)
            count += 1
    return count


# ── Resumen del equipo (08:30) ──────────────────────────────────────────────────────────

async def team_items(db: AsyncSession, now: datetime) -> list[EmailItem]:
    from app.models.payment import CvReviewOrder, CvReviewStatus
    from app.services.ai.pipeline import spent_today

    items = []
    pending_companies = (await db.execute(select(func.count()).select_from(CompanyProfile).where(
        CompanyProfile.verification_status == VerificationStatus.pending.value))).scalar_one()
    if pending_companies:
        items.append(EmailItem("1 empresa para verificar" if pending_companies == 1
                               else f"{pending_companies} empresas para verificar", None, "/dashboard/admin/empresas"))
    pending_jobs = (await db.execute(select(func.count()).select_from(JobPosting).where(
        JobPosting.moderation_status == JobModerationStatus.pending_review, JobPosting.deleted_at.is_(None)))).scalar_one()
    if pending_jobs:
        items.append(EmailItem("1 búsqueda para revisar" if pending_jobs == 1
                               else f"{pending_jobs} búsquedas para revisar", None, "/dashboard/admin/busquedas"))
    open_msgs = (await db.execute(select(func.count()).select_from(ContactMessage).where(
        ContactMessage.resolved.is_(False)))).scalar_one()
    if open_msgs:
        items.append(EmailItem("1 mensaje de contacto sin resolver" if open_msgs == 1
                               else f"{open_msgs} mensajes de contacto sin resolver", None, "/dashboard/admin/mensajes"))
    open_reviews = (await db.execute(select(func.count()).select_from(CvReviewOrder).where(
        CvReviewOrder.status.in_([CvReviewStatus.paid.value, CvReviewStatus.in_progress.value])))).scalar_one()
    if open_reviews:
        items.append(EmailItem("1 revisión de CV abierta" if open_reviews == 1
                               else f"{open_reviews} revisiones de CV abiertas", None, "/dashboard/admin/revisiones-cv"))
    health = await email_health(db, now)
    if health["sent"]:
        items.append(EmailItem(
            "Salud de los mails (7 días)",
            f"{health['sent']} enviados · rebotes {health['bounce_pct']:.1f} % · quejas {health['complaint_pct']:.2f} %",
            None,
        ))
    spent = await spent_today(db, now)
    if spent:
        items.append(EmailItem("Gasto de IA de hoy", f"USD {spent:.2f}", None))
    return items


async def send_team_daily(db: AsyncSession, now: datetime) -> int:
    if now < _at_local(now, 8, 30):
        return 0
    admins = (await db.execute(select(User).where(User.role == UserRole.admin, User.is_active.is_(True),
                                                  User.deleted_at.is_(None)))).scalars().all()
    items = await team_items(db, now)
    count = 0
    for admin in admins:
        last = await _last_sent(db, admin.id, "equipo_diario")
        if last and last >= _at_local(now, 8, 30):
            continue
        if await enqueue_digest(
            db, user=admin, key="digest_equipo", subject="BBJobs: lo pendiente de hoy", heading="Pendientes del equipo",
            intro="Lo que espera una acción de Talency.", items=items, cta_label="Abrir el panel",
            cta_url="/dashboard/admin", now=now,
        ):
            await _mark_sent(db, admin.id, "equipo_diario", now)
            count += 1
    return count


# ── Salud de los mails (R12) ────────────────────────────────────────────────────────────

BOUNCE_LIMIT_PCT = 4.0
COMPLAINT_LIMIT_PCT = 0.08
MIN_SAMPLE = 100


async def email_health(db: AsyncSession, now: datetime) -> dict:
    since = now - timedelta(days=7)
    sent, bounced, complained = (await db.execute(
        select(func.count(), func.count(EmailOutbox.bounced_at), func.count(EmailOutbox.complained_at))
        .where(EmailOutbox.sent_at >= since, EmailOutbox.status == EmailStatus.sent.value)
    )).one()
    bounce = 100 * bounced / sent if sent else 0.0
    complaint = 100 * complained / sent if sent else 0.0
    return {"sent": sent, "bounce_pct": bounce, "complaint_pct": complaint,
            "unhealthy": sent >= MIN_SAMPLE and (bounce > BOUNCE_LIMIT_PCT or complaint > COMPLAINT_LIMIT_PCT)}


# ── Reloj ───────────────────────────────────────────────────────────────────────────────

@dataclass
class TickResult:
    alertas_instant: int = 0
    alertas_daily: int = 0
    alertas_weekly: int = 0
    para_vos: int = 0
    empresas: int = 0
    equipo: int = 0


async def tick(db: AsyncSession, now: datetime | None = None) -> TickResult:
    """Lo llama el scheduler cada 15 min. Decide qué resumen toca; no commitea."""
    now = now or datetime.now(timezone.utc)
    result = TickResult()
    if not await emails_enabled(db):
        return result
    local = now.astimezone(AR_TZ)
    result.alertas_instant = await send_alerts(db, "instant", now)
    if local.time() >= time(8, 0):
        result.alertas_daily = await send_alerts(db, "daily", now)
        result.empresas = await send_company_daily(db, now)
        if local.weekday() == 0:
            result.alertas_weekly = await send_alerts(db, "weekly", now)
            result.para_vos = await send_para_vos(db, now)
    result.equipo = await send_team_daily(db, now)
    return result

