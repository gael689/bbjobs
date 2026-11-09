"""Borrador mensual de novedades (v4 §4.5): el sistema prepara, Eugenia revisa y aprueba.

El día 1 de cada mes, desde las 09:00 de Argentina, se arma **un** borrador con los datos reales
del mes anterior (búsquedas, empresas y postulaciones). Si hay IA, la redactora propone el
texto; si no, el borrador trae sólo los datos para que Talency escriba. **Nunca sale solo**:
queda en borrador y se le avisa a la admin.
"""
from __future__ import annotations

import uuid
from datetime import datetime, time, timedelta, timezone

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.gemini_client import AIError, AIUnavailable, get_provider
from app.models.company import CompanyProfile, VerificationStatus
from app.models.email import CampaignStatus, EmailCampaign
from app.models.job import Application, JobModerationStatus, JobPosting, JobPostingStatus
from app.services.ai.pipeline import log_usage
from app.services.email import campaign_ai
from app.services.email.policy import AR_TZ
from app.services.notifications import notify_all_admins

logger = structlog.get_logger("app.services.email.monthly")

NAME_PREFIX = "Novedades de "
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
          "noviembre", "diciembre"]


def _month_bounds(now: datetime) -> tuple[datetime, datetime, str]:
    local = now.astimezone(AR_TZ)
    start_this = datetime(local.year, local.month, 1, tzinfo=AR_TZ)
    prev_year, prev_month = (local.year, local.month - 1) if local.month > 1 else (local.year - 1, 12)
    start_prev = datetime(prev_year, prev_month, 1, tzinfo=AR_TZ)
    return start_prev.astimezone(timezone.utc), start_this.astimezone(timezone.utc), MONTHS[prev_month - 1]


async def monthly_facts(db: AsyncSession, now: datetime) -> dict:
    start, end, month = _month_bounds(now)
    jobs = (await db.execute(select(func.count()).select_from(JobPosting).where(
        JobPosting.published_at >= start, JobPosting.published_at < end))).scalar_one()
    companies = (await db.execute(select(func.count()).select_from(CompanyProfile).where(
        CompanyProfile.verification_status == VerificationStatus.verified.value,
        CompanyProfile.created_at >= start, CompanyProfile.created_at < end))).scalar_one()
    apps = (await db.execute(select(func.count()).select_from(Application).where(
        Application.created_at >= start, Application.created_at < end))).scalar_one()
    return {"mes": month, "busquedas": jobs, "empresas_nuevas": companies, "postulaciones": apps}


async def prepare_monthly_draft(db: AsyncSession, now: datetime | None = None, *, force: bool = False,
                                origin: str = "programado") -> EmailCampaign | None:
    """Idempotente: un borrador por mes. No commitea.

    `force=True` lo arma aunque no sea el día 1 (botón del Centro de IA); sigue siendo uno por mes."""
    from app.services.ai import activity

    now = now or datetime.now(timezone.utc)
    local = now.astimezone(AR_TZ)
    if not force and (local.day != 1 or local.time() < time(9, 0)):
        return None
    facts = await monthly_facts(db, now)
    name = f"{NAME_PREFIX}{facts['mes']} {local.year if facts['mes'] != 'diciembre' else local.year - 1}"
    if (await db.execute(select(EmailCampaign.id).where(EmailCampaign.name == name))).first():
        return None

    data_line = (f"Datos de {facts['mes']}: {facts['busquedas']} búsquedas publicadas, "
                 f"{facts['empresas_nuevas']} empresas nuevas y {facts['postulaciones']} postulaciones.")
    campaign = EmailCampaign(id=uuid.uuid4(), name=name, target="users", audience_key="cand_todos", product="portal",
                             subject="", body=data_line, status=CampaignStatus.draft.value, recipients_total=0,
                             audience={}, follow_ups=[])
    mark = activity.cost_mark(db)
    try:
        provider = get_provider()
        draft, usage = await campaign_ai.draft_campaign(
            provider, brief=f"Novedades del mes para los postulantes. {data_line} Invitar a mirar las búsquedas.",
            target="users", audience_label="Postulantes que aceptaron novedades", product="portal")
        campaign.subject, campaign.preheader = draft.asuntos[0], draft.preheader
        campaign.body, campaign.cta_label, campaign.cta_url = draft.cuerpo, draft.boton, "/empleos"
        campaign.generated_by_ai = True
        await log_usage(db, "campana_borrador", usage)
    except (AIUnavailable, AIError) as exc:
        logger.info("borrador_mensual_sin_ia", motivo=str(exc)[:200])
    db.add(campaign)
    await activity.log_activity(db, activity.KIND_CAMPAIGN_DRAFT,
                                detail={"tipo": "mensual", "origen": origin, "con_ia": bool(campaign.generated_by_ai),
                                        "campana": campaign.id},
                                cost_usd=activity.cost_since(db, mark))
    await notify_all_admins(
        db, type="admin_campaign_draft_ready", title="Tu borrador de novedades está listo",
        body=f"Preparamos '{name}' con los datos del mes. Revisalo, editalo y aprobalo cuando quieras: no sale solo.",
        link="/dashboard/admin/campanas",
    )
    return campaign


# ── Borrador semanal "Búsquedas de la semana" ──────────────────────────────────────────
# Mismo criterio que el mensual: el sistema prepara, Talency revisa y aprueba. **Nunca sale
# solo** (queda en borrador) y se avisa sólo en la web (`admin_campaign_weekly_ready`, sin mail);
# el resumen diario del equipo lo recuerda mientras siga en borrador.

WEEKLY_PREFIX = "Búsquedas de la semana del "
WEEKLY_MAX_JOBS = 8


def _week_monday(now: datetime):
    local = now.astimezone(AR_TZ)
    return local.date() - timedelta(days=local.weekday())


async def prepare_weekly_draft(db: AsyncSession, now: datetime | None = None, *, force: bool = False,
                               origin: str = "programado") -> EmailCampaign | None:
    """Los lunes desde las 09:00 de Argentina: un borrador con las búsquedas aprobadas y activas
    publicadas en los últimos 7 días. Idempotente (uno por semana, por nombre). Sin búsquedas
    nuevas no arma nada (nunca un borrador vacío). No commitea.

    Compuerta de módulos nuevos + interruptor `emails_automaticos_activos`. La IA (si hay cuenta
    y presupuesto) sólo propone el texto; sin IA, el borrador trae la lista para que Talency
    escriba."""
    from app.core.features import new_modules_enabled
    from app.models.settings import SettingKey
    from app.services.ai import activity
    from app.services.ai.pipeline import budget_left
    from app.services.settings import get_setting

    if not new_modules_enabled() or not await get_setting(db, SettingKey.emails_automaticos_activos):
        return None
    now = now or datetime.now(timezone.utc)
    local = now.astimezone(AR_TZ)
    if not force and (local.weekday() != 0 or local.time() < time(9, 0)):
        return None
    name = f"{WEEKLY_PREFIX}{_week_monday(now):%d/%m/%Y}"
    if (await db.execute(select(EmailCampaign.id).where(EmailCampaign.name == name))).first():
        return None

    jobs = (await db.execute(
        select(JobPosting.title, JobPosting.company_legal_name_snapshot).where(
            JobPosting.status == JobPostingStatus.active, JobPosting.deleted_at.is_(None),
            JobPosting.moderation_status == JobModerationStatus.approved,
            JobPosting.published_at >= now - timedelta(days=7), JobPosting.published_at <= now,
        ).order_by(JobPosting.published_at.desc()).limit(WEEKLY_MAX_JOBS)
    )).all()
    if not jobs:
        return None

    listing = "\n".join(f"- {title} ({company})" if company else f"- {title}" for title, company in jobs)
    body = f"Búsquedas nuevas de esta semana en BBJobs:\n{listing}"
    campaign = EmailCampaign(id=uuid.uuid4(), name=name, target="users", audience_key="cand_todos", product="portal",
                             subject="Búsquedas nuevas de la semana en BBJobs", body=body,
                             cta_label="Ver búsquedas", cta_url="/empleos", status=CampaignStatus.draft.value,
                             recipients_total=0, audience={}, follow_ups=[])
    mark = activity.cost_mark(db)
    if await budget_left(db):
        try:
            provider = get_provider()
            draft, usage = await campaign_ai.draft_campaign(
                provider, target="users", audience_label="Postulantes que aceptaron novedades", product="portal",
                brief=("Búsquedas nuevas de la semana para los postulantes. Nombrá estas búsquedas tal cual, sin "
                       f"agregar requisitos ni condiciones que no estén acá:\n{listing}\nInvitar a mirarlas en el portal."),
            )
            campaign.subject, campaign.preheader = draft.asuntos[0], draft.preheader
            campaign.body, campaign.cta_label = draft.cuerpo, draft.boton
            campaign.generated_by_ai = True
            await log_usage(db, "campana_borrador", usage)
        except (AIUnavailable, AIError) as exc:
            logger.info("borrador_semanal_sin_ia", motivo=str(exc)[:200])
    db.add(campaign)
    await activity.log_activity(db, activity.KIND_CAMPAIGN_DRAFT,
                                detail={"tipo": "semanal", "origen": origin, "con_ia": bool(campaign.generated_by_ai),
                                        "busquedas": len(jobs), "campana": campaign.id},
                                cost_usd=activity.cost_since(db, mark))
    await notify_all_admins(
        db, type="admin_campaign_weekly_ready", title="Borrador de \"Búsquedas de la semana\" listo",
        body=f"Preparamos '{name}' con {len(jobs)} búsqueda{'s' if len(jobs) != 1 else ''} nueva"
             f"{'s' if len(jobs) != 1 else ''}. Revisalo y aprobalo si querés mandarlo: no sale solo.",
        link="/dashboard/admin/campanas",
    )
    return campaign
