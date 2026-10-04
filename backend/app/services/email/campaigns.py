"""Campañas (T4): ofertas a usuarios de BBJobs y campañas a empresas prospecto.

Reglas que se cumplen acá (v4 §2, plan de prospección §5–§6):
- **Nada sale sin aprobación** de un admin (`approve`), que ve antes cuántos la van a recibir.
- **Consentimiento:** a un postulante sólo si **aceptó** novedades (preferencia `novedades`
  explícitamente en `True`, D10). A una empresa, salvo que se haya dado de baja (B2B).
- **R5:** nadie recibe más de una campaña por semana.
- Cada campaña tiene un **producto** y se mide la **conversión real** a 14 días (compra,
  publicación o avance del prospecto), no sólo clics.
- Las campañas a prospectos salen por su canal propio (`prospect_dispatch.py`).
- El texto lo escribe Talency (o lo propone la redactora con IA y Talency lo aprueba): este
  módulo no redacta nada.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

import structlog
from sqlalchemy import and_, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile, VerificationStatus
from app.models.core import User, UserRole
from app.models.email import (
    CampaignStatus, EmailCampaign, EmailCategory, EmailOutbox, EmailPreference, EmailStatus, EmailSuppression,
)
from app.models.job import Application, JobPosting, JobPostingStatus
from app.models.payment import CvReviewOrder, CvReviewStatus, JobFeature, JobFeatureStatus, TalentCreditPack, TalentPackStatus
from app.models.prospect import Prospect, ProspectEmail, ProspectStage
from app.services.email.render import render_email, substitute
from app.services.email.tokens import unsubscribe_page_url

logger = structlog.get_logger("app.services.email.campaigns")

CONVERSION_WINDOW = timedelta(days=14)
MARKETING_EVERY = timedelta(days=7)
BATCH = 500


class CampaignError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# ── Audiencias predefinidas (usuarios) ──────────────────────────────────────────────────

@dataclass(frozen=True)
class Audience:
    key: str
    label: str
    role: str                  # candidate | company
    product: str
    where: Callable[[], list]  # cláusulas extra sobre CandidateProfile / CompanyProfile


def _active_job_where(extra=None):
    conds = [JobPosting.company_id == CompanyProfile.id, JobPosting.status == JobPostingStatus.active,
             JobPosting.deleted_at.is_(None)]
    if extra is not None:
        conds.append(extra)
    return exists().where(*conds)


def _many_applicants():
    counts = (select(Application.job_posting_id).group_by(Application.job_posting_id)
              .having(func.count() > 50))
    return _active_job_where(JobPosting.id.in_(counts))


AUDIENCES: dict[str, Audience] = {a.key: a for a in [
    Audience("cand_cv_sin_revision", "Postulantes con CV que nunca compraron la revisión", "candidate", "cv_review",
             lambda: [CandidateProfile.cv_file_url.is_not(None),
                      ~exists().where(CvReviewOrder.candidate_id == CandidateProfile.id,
                                      CvReviewOrder.paid_at.is_not(None))]),
    Audience("cand_todos", "Todos los postulantes que aceptaron novedades", "candidate", "portal", lambda: []),
    Audience("emp_busqueda_sin_destacar", "Empresas con una búsqueda activa sin destacar", "company", "destacar",
             lambda: [_active_job_where(JobPosting.is_featured.is_(False))]),
    Audience("emp_muchos_postulantes", "Empresas con una búsqueda de más de 50 postulantes", "company",
             "seleccion_personal", lambda: [_many_applicants()]),
    Audience("emp_sin_pack", "Empresas que nunca compraron un pack de la Base de Talento", "company", "pack_talento",
             lambda: [~exists().where(TalentCreditPack.company_id == CompanyProfile.id,
                                      TalentCreditPack.status.in_([TalentPackStatus.active.value, TalentPackStatus.exhausted.value]))]),
    Audience("emp_nunca_publicaron", "Empresas verificadas que nunca publicaron", "company", "publicar",
             lambda: [~exists().where(JobPosting.company_id == CompanyProfile.id)]),
    Audience("emp_sin_busquedas_90", "Empresas sin búsquedas en los últimos 90 días", "company", "seleccion_personal",
             lambda: [exists().where(JobPosting.company_id == CompanyProfile.id),
                      ~exists().where(JobPosting.company_id == CompanyProfile.id,
                                      JobPosting.created_at >= func.now() - timedelta(days=90))]),
    Audience("emp_todas", "Todas las empresas verificadas", "company", "portal", lambda: []),
]}

PRODUCTS = {"cv_review", "destacar", "pack_talento", "seleccion_personal", "publicar", "portal"}


def _recently_marketed():
    return exists().where(EmailOutbox.user_id == User.id, EmailOutbox.category == EmailCategory.novedades.value,
                          EmailOutbox.created_at >= func.now() - MARKETING_EVERY)


def _suppressed_user():
    return exists().where(EmailSuppression.email == func.lower(User.email))


def audience_query(audience: Audience, zone_id: uuid.UUID | None = None, industry_id: uuid.UUID | None = None):
    """(User, nombre) de quienes reciben. Consentimiento, bajas, supresiones y R5 incluidos."""
    pref = select(EmailPreference.enabled).where(
        EmailPreference.user_id == User.id, EmailPreference.category == EmailCategory.novedades.value
    ).scalar_subquery()
    base = [User.deleted_at.is_(None), User.is_active.is_(True), ~_suppressed_user(), ~_recently_marketed(),
            ~User.email.like("%.invalid")]
    if audience.role == "candidate":
        q = (select(User, CandidateProfile.first_name).join(CandidateProfile, CandidateProfile.user_id == User.id)
             .where(*base, CandidateProfile.deleted_at.is_(None), pref.is_(True), *audience.where()))
        if zone_id:
            q = q.where(CandidateProfile.location_zone_id == zone_id)
    else:
        q = (select(User, CompanyProfile.legal_name).join(CompanyProfile, CompanyProfile.user_id == User.id)
             .where(*base, CompanyProfile.verification_status == VerificationStatus.verified.value,
                    func.coalesce(pref, True).is_(True), *audience.where()))
        if industry_id:
            q = q.where(CompanyProfile.industry_id == industry_id)
    return q


async def audience_count(db: AsyncSession, key: str, zone_id=None, industry_id=None) -> int:
    audience = AUDIENCES[key]
    sub = audience_query(audience, zone_id, industry_id).subquery()
    return (await db.execute(select(func.count()).select_from(sub))).scalar_one()


# ── Prospectos ──────────────────────────────────────────────────────────────────────────

def prospect_recipients_query(selection: dict):
    from app.services import prospects as prospect_service

    clauses = [Prospect.do_not_contact.is_(False),
               Prospect.stage.notin_([ProspectStage.registrada.value, ProspectStage.descartada.value])]
    if selection.get("ids"):
        clauses.append(Prospect.id.in_([uuid.UUID(str(i)) for i in selection["ids"]]))
    else:
        clauses += prospect_service.filter_clauses(selection.get("filter") or {})
    email = (select(ProspectEmail.email).where(
        ProspectEmail.prospect_id == Prospect.id,
        ~exists().where(EmailSuppression.email == ProspectEmail.email),
    ).order_by(ProspectEmail.is_primary.desc()).limit(1).scalar_subquery())
    return select(Prospect, email.label("email")).where(*clauses, email.is_not(None))


async def prospect_count(db: AsyncSession, selection: dict) -> int:
    sub = prospect_recipients_query(selection).subquery()
    return (await db.execute(select(func.count()).select_from(sub))).scalar_one()


# ── Ciclo de vida ───────────────────────────────────────────────────────────────────────

async def recipients_count(db: AsyncSession, campaign: EmailCampaign) -> int:
    if campaign.target == "prospects":
        return await prospect_count(db, campaign.audience or {})
    key = campaign.audience_key
    if key not in AUDIENCES:
        raise CampaignError("Elegí una audiencia")
    aud = campaign.audience or {}
    return await audience_count(db, key, aud.get("zone_id"), aud.get("industry_id"))


def validate_ready(campaign: EmailCampaign) -> None:
    if not (campaign.subject or "").strip() or not (campaign.body or "").strip():
        raise CampaignError("Falta el asunto o el texto")
    if campaign.target == "users" and campaign.audience_key not in AUDIENCES:
        raise CampaignError("Elegí una audiencia")
    if campaign.product and campaign.product not in PRODUCTS:
        raise CampaignError("Producto desconocido")
    if len(campaign.follow_ups or []) > 2:
        raise CampaignError("Como máximo dos seguimientos")
    if campaign.target == "users" and campaign.follow_ups:
        raise CampaignError("Los seguimientos son sólo para prospectos")


async def approve(db: AsyncSession, campaign: EmailCampaign, admin: User, scheduled_at: datetime | None) -> int:
    """Aprobar es la única forma de que una campaña salga (P4). Devuelve a cuántos llegará."""
    if campaign.status != CampaignStatus.draft.value:
        raise CampaignError("Sólo se aprueba un borrador", 409)
    validate_ready(campaign)
    n = await recipients_count(db, campaign)
    if n == 0:
        raise CampaignError("La audiencia está vacía")
    campaign.status = CampaignStatus.scheduled.value
    campaign.approved_by_admin_id = admin.id
    campaign.approved_at = datetime.now(timezone.utc)
    campaign.scheduled_at = scheduled_at or campaign.approved_at
    campaign.recipients_total = n
    return n


async def materialize_due(db: AsyncSession, now: datetime | None = None) -> int:
    """Pasa a la cola las campañas aprobadas cuya hora llegó. No commitea."""
    now = now or datetime.now(timezone.utc)
    campaigns = (await db.execute(select(EmailCampaign).where(
        EmailCampaign.status == CampaignStatus.scheduled.value, EmailCampaign.scheduled_at <= now,
        EmailCampaign.approved_at.is_not(None),
    ).with_for_update(skip_locked=True))).scalars().all()
    total = 0
    for c in campaigns:
        c.status = CampaignStatus.sending.value
        queued = await (_materialize_prospects(db, c, now) if c.target == "prospects" else _materialize_users(db, c, now))
        c.recipients_total = queued
        c.status = CampaignStatus.sent.value
        c.sent_at = now
        total += queued
        logger.info("campana_encolada", campaign_id=str(c.id), destinatarios=queued)
    return total


async def _materialize_users(db: AsyncSession, c: EmailCampaign, now: datetime) -> int:
    aud = c.audience or {}
    rows = (await db.execute(audience_query(AUDIENCES[c.audience_key], aud.get("zone_id"), aud.get("industry_id")))).all()
    for user, name in rows:
        variables = {"nombre": (name or "").split(" ")[0] if AUDIENCES[c.audience_key].role == "candidate" else (name or ""),
                     "empresa": name or ""}
        rendered = render_email(
            heading=substitute(c.subject, variables), body=substitute(c.body, variables),
            preheader=c.preheader, cta_label=c.cta_label, cta_url=c.cta_url, image_url=c.image_url,
            unsubscribe_url=unsubscribe_page_url(user.id, EmailCategory.novedades),
        )
        db.add(EmailOutbox(
            id=uuid.uuid4(), user_id=user.id, to_email=user.email, category=EmailCategory.novedades.value,
            template_key=f"campana:{c.product or 'portal'}", subject=substitute(c.subject, variables)[:500],
            html=rendered.html, text=rendered.text, status=EmailStatus.pending.value, attempts=0,
            campaign_id=c.id, dedupe_key=f"campaign:{c.id}:{user.id}", scheduled_at=now,
        ))
    return len(rows)


async def _materialize_prospects(db: AsyncSession, c: EmailCampaign, now: datetime) -> int:
    from app.services.email.prospect_dispatch import render_for_prospect

    rows = (await db.execute(prospect_recipients_query(c.audience or {}))).all()
    for prospect, email in rows:
        subject, rendered = render_for_prospect(prospect, subject=c.subject, body=c.body,
                                                cta_label=c.cta_label, cta_url=c.cta_url)
        db.add(EmailOutbox(
            id=uuid.uuid4(), user_id=None, prospect_id=prospect.id, to_email=email,
            category=EmailCategory.prospeccion.value, template_key="prospeccion", subject=subject,
            html=rendered.html, text=rendered.text, status=EmailStatus.pending.value, attempts=0,
            campaign_id=c.id, touch=1, dedupe_key=f"campaign:{c.id}:{prospect.id}", scheduled_at=now,
        ))
    return len(rows)


# ── Conversión real ─────────────────────────────────────────────────────────────────────

async def measure_conversions(db: AsyncSession, c: EmailCampaign) -> int:
    """Quienes recibieron la campaña e hicieron lo ofrecido en los 14 días siguientes."""
    if not c.sent_at:
        return 0
    start, end = c.sent_at, c.sent_at + CONVERSION_WINDOW
    sent = select(EmailOutbox.user_id).where(EmailOutbox.campaign_id == c.id, EmailOutbox.status == EmailStatus.sent.value)
    if c.target == "prospects":
        n = (await db.execute(select(func.count()).select_from(Prospect).where(
            Prospect.id.in_(select(EmailOutbox.prospect_id).where(EmailOutbox.campaign_id == c.id,
                                                                  EmailOutbox.status == EmailStatus.sent.value)),
            Prospect.stage.in_([ProspectStage.respondio.value, ProspectStage.reunion.value,
                                ProspectStage.cliente.value, ProspectStage.registrada.value]),
        ))).scalar_one()
    elif c.product == "cv_review":
        n = (await db.execute(select(func.count(func.distinct(CvReviewOrder.candidate_id))).join(
            CandidateProfile, CandidateProfile.id == CvReviewOrder.candidate_id).where(
            CandidateProfile.user_id.in_(sent), CvReviewOrder.paid_at.between(start, end)))).scalar_one()
    elif c.product == "destacar":
        n = (await db.execute(select(func.count(func.distinct(JobPosting.company_id))).join(
            JobFeature, JobFeature.job_posting_id == JobPosting.id).join(
            CompanyProfile, CompanyProfile.id == JobPosting.company_id).where(
            CompanyProfile.user_id.in_(sent), JobFeature.starts_at.between(start, end)))).scalar_one()
    elif c.product == "pack_talento":
        n = (await db.execute(select(func.count(func.distinct(TalentCreditPack.company_id))).join(
            CompanyProfile, CompanyProfile.id == TalentCreditPack.company_id).where(
            CompanyProfile.user_id.in_(sent), TalentCreditPack.activated_at.between(start, end)))).scalar_one()
    elif c.product in ("publicar", "seleccion_personal", "portal"):
        n = (await db.execute(select(func.count(func.distinct(JobPosting.company_id))).join(
            CompanyProfile, CompanyProfile.id == JobPosting.company_id).where(
            CompanyProfile.user_id.in_(sent), JobPosting.created_at.between(start, end)))).scalar_one()
    else:
        n = 0
    c.conversions = n
    c.conversions_measured_at = datetime.now(timezone.utc)
    return n


async def stats(db: AsyncSession, c: EmailCampaign) -> dict:
    row = (await db.execute(select(
        func.count(), func.count(EmailOutbox.sent_at), func.count(EmailOutbox.delivered_at),
        func.count(EmailOutbox.opened_at), func.count(EmailOutbox.clicked_at), func.count(EmailOutbox.bounced_at),
        func.count(EmailOutbox.complained_at),
    ).where(EmailOutbox.campaign_id == c.id))).one()
    keys = ("encolados", "enviados", "entregados", "abiertos", "clics", "rebotes", "quejas")
    return {**dict(zip(keys, row)), "conversiones": c.conversions}
