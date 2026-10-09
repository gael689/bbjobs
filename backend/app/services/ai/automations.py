"""Automatizaciones de la IA que corren solas (pedido de Gael, 09/10/2026: "automatizar todo lo
posible, respetando las reglas").

Qué hay acá y cuándo corre:

- **Resúmenes nocturnos** (`nightly_summaries`, dentro del barrido de las 03:00): el resumen de 3
  líneas de los mejores `SUMMARY_TOP` recomendados de cada búsqueda activa, así Talency y la
  empresa lo encuentran listo. Reusa la caché por hash de `summary.py` (si la entrada no cambió,
  no se paga de nuevo). Primero las búsquedas con postulaciones nuevas en las últimas 24 h. Tope:
  `AI_MAX_RERANKS_PER_RUN` llamadas por noche y el tope diario en USD.
- **Habilidades sugeridas al candidato** (`notify_skill_suggestions`, en la tarea de 10 minutos,
  cuando se lee un CV nuevo): si del CV salen al menos `SKILL_NOTICE_MIN` habilidades del catálogo
  que todavía no tiene, una notificación **sólo en la web** (`skill_suggestions_ready`, regla
  `mode="none"`: nunca mail) con link a su perfil. Como mucho una cada `SKILL_NOTICE_EVERY` por
  candidato. Usa la caché de `skill_suggest` (no se paga dos veces el mismo CV).
- **Ítems de IA del resumen diario del equipo** (`team_ai_items`, los suma `digests.team_items`):
  sólo lo accionable y sólo si hay algo (R7).

Reglas duras que se cumplen en todas: detrás de `new_modules_enabled()` y de su interruptor
(`ia_recomendaciones_activas` para resúmenes y moderación, `asistente_ia_activo` para
habilidades); **ninguna encola un mail** ni cambia el estado de nada ni descarta a nadie; lo que
se genera para un candidato queda en la web; a Gemini sólo llega texto anonimizado (lo garantizan
`summary.py` y `skill_suggest.py`, que son los que llaman).
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.features import new_modules_enabled
from app.integrations.gemini_client import AIProvider
from app.models.ai import AiActivityLog, JobAiProfile, JobRecommendation
from app.models.alerts import Notification
from app.models.candidate import CandidateProfile
from app.models.core import User
from app.models.job import Application, ApplicationStatus, JobModerationStatus, JobPosting, JobPostingStatus
from app.models.settings import SettingKey
from app.services.ai import activity
from app.services.ai.pipeline import budget_left, spent_today
from app.services.notifications import create_notification
from app.services.settings import get_setting

logger = structlog.get_logger("app.services.ai.automations")

SUMMARY_TOP = 5
SUMMARY_FRESH_APPS = timedelta(hours=24)

SKILL_NOTICE_TYPE = "skill_suggestions_ready"
SKILL_NOTICE_EVERY = timedelta(days=30)
SKILL_NOTICE_MIN = 2
SKILL_NOTICE_PER_RUN = 20

UNSEEN_FIT_SCORE = 80
BUDGET_WARN_RATIO = 0.8


class _CountingProvider:
    """Envuelve al proveedor para contar las llamadas al modelo de texto de esta corrida (el tope
    por corrida es de llamadas, no de resultados: una salida que el validador tira igual se pagó)."""

    def __init__(self, inner: AIProvider):
        self.inner = inner
        self.calls = 0

    async def generate_json(self, **kw):
        self.calls += 1
        return await self.inner.generate_json(**kw)

    def __getattr__(self, name):
        return getattr(self.inner, name)


def summary_ref(job_id: uuid.UUID, candidate_id: uuid.UUID) -> str:
    """La misma referencia opaca que usa el endpoint del resumen (no entra al hash de la caché)."""
    return "#" + hashlib.sha256(f"{job_id}:{candidate_id}".encode()).hexdigest()[:6].upper()


# ── 1. Resúmenes nocturnos ──────────────────────────────────────────────────────────────

async def nightly_summaries(db: AsyncSession, provider: AIProvider | None, now: datetime | None = None,
                            *, top: int = SUMMARY_TOP, max_calls: int | None = None) -> dict:
    """Resumen de los mejores `top` recomendados de cada búsqueda activa. Commitea por búsqueda.

    No paga lo que ya está en caché (misma entrada → mismo hash). Corta al llegar a `max_calls`
    llamadas (por defecto `AI_MAX_RERANKS_PER_RUN`) o al tope diario en USD: lo que no entra queda
    para la noche siguiente o para cuando la empresa lo abra."""
    from app.services.ai import summary as summary_svc

    stats = {"busquedas": 0, "generados": 0, "reusados": 0, "sin_ia": 0, "tope": 0}
    if provider is None or not new_modules_enabled() or not await get_setting(db, SettingKey.ia_recomendaciones_activas):
        return stats
    now = now or datetime.now(timezone.utc)
    max_calls = settings.AI_MAX_RERANKS_PER_RUN if max_calls is None else max_calls

    fresh = dict((await db.execute(
        select(Application.job_posting_id, func.count())
        .where(Application.created_at >= now - SUMMARY_FRESH_APPS, Application.deleted_at.is_(None))
        .group_by(Application.job_posting_id)
    )).all())
    # Tuplas y no objetos: un rollback de una búsqueda no puede dejar a las demás expiradas.
    jobs = (await db.execute(
        select(JobPosting.id, JobPosting.company_id, JobPosting.published_at).where(
            JobPosting.status == JobPostingStatus.active, JobPosting.deleted_at.is_(None),
            JobPosting.moderation_status == JobModerationStatus.approved,
        )
    )).all()
    # Prioridad: más postulaciones nuevas primero; entre iguales, la publicada más recientemente.
    jobs = sorted(jobs, key=lambda j: (-fresh.get(j[0], 0), -(j[2] or now).timestamp()))

    counting = _CountingProvider(provider)
    for job_id, company_id, _published in jobs:
        if counting.calls >= max_calls or not await budget_left(db):
            stats["tope"] = 1
            break
        recs = (await db.execute(
            select(JobRecommendation).where(JobRecommendation.job_id == job_id)
            .order_by(JobRecommendation.final_score.desc(), JobRecommendation.computed_at).limit(top)
        )).scalars().all()
        if not recs:
            continue
        profile = (await db.execute(select(JobAiProfile).where(JobAiProfile.job_id == job_id))).scalar_one_or_none()
        requirements = list(profile.requirements) if profile else []
        mark = activity.cost_mark(db)
        done = {"generados": 0, "reusados": 0, "sin_ia": 0}
        try:
            for rec in recs:
                if counting.calls >= max_calls:
                    stats["tope"] = 1
                    break
                before = counting.calls
                result = await summary_svc.summarize(
                    db, counting, rec, requirements=requirements, ref=summary_ref(job_id, rec.candidate_id),
                    company_id=company_id, origin="noche",
                )
                if result.cached:
                    done["reusados"] += 1
                elif counting.calls > before and result.generated_with_ai:
                    done["generados"] += 1
                else:
                    done["sin_ia"] += 1
            if done["generados"]:
                await activity.log_activity(
                    db, activity.KIND_SUMMARY, job_id=job_id, company_id=company_id,
                    detail={"motivo": "noche", **done}, cost_usd=activity.cost_since(db, mark),
                )
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("ai_resumenes_noche_error", job_id=str(job_id), error=str(exc)[:200])
            continue
        stats["busquedas"] += 1
        for k, v in done.items():
            stats[k] += v
    if stats["generados"] or stats["tope"]:
        logger.info("ai_resumenes_noche", **stats)
    return stats


# ── 2. Habilidades sugeridas (sólo en la web) ───────────────────────────────────────────

async def notify_skill_suggestions(db: AsyncSession, provider: AIProvider | None,
                                   candidate_ids: list[uuid.UUID], now: datetime | None = None) -> int:
    """Para cada CV recién leído: si hay ≥ `SKILL_NOTICE_MIN` sugerencias del catálogo, una
    notificación web. Una cada 30 días por candidato como mucho, y hasta `SKILL_NOTICE_PER_RUN`
    candidatos por vuelta. Commitea por candidato. Devuelve cuántas notificaciones creó."""
    from app.services.ai import skill_suggest

    if provider is None or not candidate_ids or not new_modules_enabled() \
            or not await get_setting(db, SettingKey.asistente_ia_activo):
        return 0
    now = now or datetime.now(timezone.utc)
    sent = 0
    for candidate_id in candidate_ids[:SKILL_NOTICE_PER_RUN]:
        # Se recarga cada vez: `suggest` commitea y un rollback anterior deja todo expirado.
        row = (await db.execute(
            select(CandidateProfile, User.email).join(User, User.id == CandidateProfile.user_id)
            .where(CandidateProfile.id == candidate_id, CandidateProfile.deleted_at.is_(None))
        )).first()
        if row is None:
            continue
        profile, email = row
        user_id = profile.user_id
        recent = (await db.execute(select(Notification.id).where(
            Notification.user_id == user_id, Notification.type == SKILL_NOTICE_TYPE,
            Notification.created_at >= now - SKILL_NOTICE_EVERY,
        ).limit(1))).first()
        if recent:
            continue   # se chequea ANTES de llamar: el tope de frecuencia también ahorra plata
        try:
            mark = activity.cost_mark(db)
            res = await skill_suggest.suggest(db, profile, email, provider=provider)
            if not res.available or len(res.suggestions) < SKILL_NOTICE_MIN:
                continue
            names = [s.skill_name for s in res.suggestions[:3]]
            example = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " y " + names[-1]
            n = len(res.suggestions)
            await create_notification(
                db, user_id=user_id, type=SKILL_NOTICE_TYPE,
                title="Tu CV muestra habilidades que podés sumar a tu perfil",
                body=(f"Leímos tu CV y encontramos {n} habilidades que todavía no tenés cargadas "
                      f"(por ejemplo, {example}). Revisalas en tu perfil y sumá sólo las que correspondan."),
                link="/dashboard/candidate/perfil",
            )
            await activity.log_activity(db, activity.KIND_SKILLS, candidate_id=candidate_id,
                                        detail={"motivo": "cv_nuevo", "sugerencias": n, "aviso_web": True},
                                        cost_usd=activity.cost_since(db, mark))
            await db.commit()
            sent += 1
        except Exception as exc:
            await db.rollback()
            logger.warning("ai_habilidades_aviso_fallo", candidate_id=str(candidate_id), error=str(exc)[:200])
    if sent:
        logger.info("ai_habilidades_avisos", enviados=sent)
    return sent


# ── 3. Ítems de IA para el resumen diario del equipo ────────────────────────────────────

async def team_ai_items(db: AsyncSession, now: datetime) -> list[tuple[str, str | None, str | None]]:
    """(título, detalle, link) de lo que la IA encontró y espera una acción de Talency. Lista vacía
    si no hay nada (R7) o si la IA está apagada. No llama a Gemini: sólo lee lo ya calculado."""
    if not new_modules_enabled():
        return []
    out: list[tuple[str, str | None, str | None]] = []
    ia_on = await get_setting(db, SettingKey.ia_recomendaciones_activas)

    if ia_on:
        # Postulantes que encajan (puntaje ≥ 80) y que nadie miró: la postulación sigue en "Nueva".
        jobs_unseen = (await db.execute(
            select(func.count(func.distinct(JobRecommendation.job_id)))
            .join(JobPosting, JobPosting.id == JobRecommendation.job_id)
            .join(Application, (Application.job_posting_id == JobRecommendation.job_id)
                  & (Application.candidate_id == JobRecommendation.candidate_id))
            .where(
                JobRecommendation.source == "applicant", JobRecommendation.final_score >= UNSEEN_FIT_SCORE,
                Application.status == ApplicationStatus.new.value, Application.deleted_at.is_(None),
                JobPosting.status == JobPostingStatus.active, JobPosting.deleted_at.is_(None),
            )
        )).scalar_one()
        if jobs_unseen:
            out.append((
                "1 búsqueda con candidatos que encajan y nadie miró todavía" if jobs_unseen == 1
                else f"{jobs_unseen} búsquedas con candidatos que encajan y nadie miró todavía",
                "Postulantes con puntaje de 80 o más que siguen en Nueva.", "/dashboard/admin/busquedas",
            ))

        # Avisos pendientes marcados como posible duplicado (con los vectores ya calculados).
        from app.services.ai import moderation

        pending = (await db.execute(select(JobPosting).where(
            JobPosting.moderation_status == JobModerationStatus.pending_review, JobPosting.deleted_at.is_(None),
        ))).scalars().all()
        dups = sum(1 for c in (await moderation.cached_checks(db, list(pending))).values() if c.duplicates)
        if dups:
            out.append((
                "1 aviso pendiente marcado como posible duplicado" if dups == 1
                else f"{dups} avisos pendientes marcados como posibles duplicados",
                "Señal orientativa: la IA no aprueba ni rechaza nada.", "/dashboard/admin/busquedas",
            ))

    # Lecturas de CV en las que quedó un dato personal después de anonimizar (últimas 24 h).
    leaked = (await db.execute(
        select(func.count(func.distinct(AiActivityLog.candidate_id))).where(
            AiActivityLog.kind == activity.KIND_CV_READ, AiActivityLog.created_at >= now - timedelta(hours=24),
            AiActivityLog.detail["fugas"].as_integer() > 0,
        )
    )).scalar_one()
    if leaked:
        out.append((
            "Alerta de anonimización de CVs",
            f"En {'1 CV' if leaked == 1 else f'{leaked} CVs'} leído{'s' if leaked != 1 else ''} ayer quedó un dato "
            "personal después de anonimizar. Revisalo en el Centro de IA.",
            "/dashboard/admin/ia",
        ))

    # Gasto del día cerca del tope (≥ 80 %): a partir del 100 % la IA se apaga sola (R13).
    budget = float(settings.AI_DAILY_BUDGET_USD or 0)
    spent = await spent_today(db, now)
    if budget > 0 and spent >= BUDGET_WARN_RATIO * budget:
        out.append((
            "Gasto de IA cerca del tope" if spent < budget else "Gasto de IA: se llegó al tope de hoy",
            f"USD {spent:.2f} de USD {budget:.2f} ({100 * spent / budget:.0f} %).", "/dashboard/admin/ia",
        ))
    return out


async def weekly_draft_pending(db: AsyncSession, name_prefix: str) -> bool:
    """¿Hay un borrador semanal sin revisar? (para recordarlo en el resumen del equipo)."""
    from app.models.email import CampaignStatus, EmailCampaign

    return bool((await db.execute(select(EmailCampaign.id).where(
        EmailCampaign.name.startswith(name_prefix), EmailCampaign.status == CampaignStatus.draft.value,
    ).limit(1))).first())

