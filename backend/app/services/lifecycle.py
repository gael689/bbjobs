"""Avisos automáticos del ciclo de vida (v4 §3) que no existían en la plataforma.

Bienvenida, confirmación de postulación, "una empresa desbloqueó tu perfil", pack casi agotado,
guía de arranque para empresas sin búsquedas, búsqueda sin postulaciones y reactivación de
postulantes inactivos.

**Todos detrás de la compuerta** (`MODULOS_NUEVOS_ACTIVOS`): generan notificaciones nuevas que
la gente vería, y nada nuevo se muestra en producción antes del lanzamiento. Cada uno pasa por
`create_notification`, así que su mail lo decide el catálogo (`services/email/catalog.py`).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features import new_modules_enabled
from app.models.alerts import Notification
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile, VerificationStatus
from app.models.core import User
from app.models.email import EmailDigestState
from app.models.job import Application, JobModerationStatus, JobPosting, JobPostingStatus
from app.models.payment import TalentCreditPack, TalentUnlock
from app.services.notifications import create_notification

logger = structlog.get_logger("app.services.lifecycle")

GUIDE_DAYS = (2, 7)
NO_APPLICATIONS_AFTER = timedelta(days=7)
# "¿Seguís buscando trabajo?" (Eugenia, 08/10/2026): a la semana sin entrar. Como mucho uno cada
# 30 días y nunca más de 3 seguidos sin que vuelva a entrar: a quien no vuelve, se lo deja de
# molestar (R8).
REACTIVATION_INACTIVE = timedelta(days=7)
REACTIVATION_EVERY = timedelta(days=30)
REACTIVATION_MAX_UNANSWERED = 3
PACK_LOW_AT = 2


async def on_candidate_onboarded(db: AsyncSession, user: User) -> None:
    if not new_modules_enabled():
        return
    await create_notification(
        db, user_id=user.id, type="welcome_candidate", title="Bienvenido/a a BBJobs",
        body=("Completá tu perfil y cargá tu CV: es lo primero que miran las empresas. Después podés "
              "postularte con un clic y armar alertas para enterarte de las búsquedas nuevas."),
        link="/dashboard/candidate/perfil",
    )


async def on_company_onboarded(db: AsyncSession, user: User) -> None:
    if not new_modules_enabled():
        return
    await create_notification(
        db, user_id=user.id, type="welcome_company", title="Recibimos tu registro en BBJobs",
        body=("Talency va a verificar los datos de tu empresa. Te avisamos apenas esté lista para "
              "publicar búsquedas."),
        link="/dashboard/company",
    )


async def on_application_sent(db: AsyncSession, user_id, job: JobPosting) -> None:
    """Confirmación al postulante: un mail por postulación, con el puesto en el asunto."""
    if not new_modules_enabled():
        return
    await create_notification(
        db, user_id=user_id, type="application_sent", title="Postulación confirmada",
        body=f"Tu postulación a '{job.title}' quedó registrada.",
        link="/dashboard/candidate/postulaciones",
        email_vars={"puesto": job.title},
    )


async def on_talent_unlocked(db: AsyncSession, profile: CandidateProfile, company: CompanyProfile) -> None:
    """Transparencia de la Base de Talento: el postulante se entera de qué empresa vio sus
    datos (pedido de Talency, 08/10/2026: el mail nombra a la empresa)."""
    if not new_modules_enabled():
        return
    await create_notification(
        db, user_id=profile.user_id, type="talent_profile_unlocked",
        title="Una empresa vio tu perfil",
        body=f"{company.legal_name} consultó tu perfil en la base de candidatos de BBJobs.",
        link="/dashboard/candidate/perfil",
        email_vars={"empresa": company.legal_name},
    )


async def on_pack_consumed(db: AsyncSession, company: CompanyProfile) -> None:
    """Pack casi agotado: un aviso de servicio cuando quedan 2 contactos o menos (una vez por
    pack). No es una venta (v4 R15)."""
    if not new_modules_enabled():
        return
    packs = (await db.execute(select(TalentCreditPack).where(
        TalentCreditPack.company_id == company.id, TalentCreditPack.status.in_(["active", "exhausted"])
    ))).scalars().all()
    if not packs:
        return
    used = (await db.execute(select(func.count()).select_from(TalentUnlock).where(
        TalentUnlock.pack_id.in_([p.id for p in packs])))).scalar_one()
    remaining = sum(p.credits_total for p in packs) - used
    if remaining > PACK_LOW_AT:
        return
    since = max((p.activated_at or p.purchased_at) for p in packs)
    already = (await db.execute(select(exists().where(
        Notification.user_id == company.user_id, Notification.type == "talent_pack_low",
        Notification.created_at >= since)))).scalar()
    if already:
        return
    await create_notification(
        db, user_id=company.user_id, type="talent_pack_low", title="Te quedan pocos contactos",
        body=(f"Te {'queda' if remaining == 1 else 'quedan'} {max(remaining, 0)} "
              f"contacto{'' if remaining == 1 else 's'} de la Base de Talento."),
        link="/dashboard/company/talento",
    )


# ── Tarea diaria ────────────────────────────────────────────────────────────────────────

async def _state(db: AsyncSession, user_id, kind: str) -> datetime | None:
    return (await db.execute(select(EmailDigestState.last_sent_at).where(
        EmailDigestState.user_id == user_id, EmailDigestState.kind == kind))).scalar_one_or_none()


async def _mark(db: AsyncSession, user_id, kind: str, now: datetime) -> None:
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    import uuid

    await db.execute(pg_insert(EmailDigestState).values(id=uuid.uuid4(), user_id=user_id, kind=kind, last_sent_at=now)
                     .on_conflict_do_update(constraint="uq_email_digest_user_kind", set_={"last_sent_at": now}))


async def company_guides(db: AsyncSession, now: datetime) -> int:
    """Empresas verificadas que todavía no publicaron: una guía a los 2 días y otra a los 7.
    Nunca más de dos en toda su vida, y se corta apenas publican."""
    rows = (await db.execute(select(CompanyProfile, User).join(User, User.id == CompanyProfile.user_id).where(
        CompanyProfile.verification_status == VerificationStatus.verified.value,
        CompanyProfile.verified_at.is_not(None), User.deleted_at.is_(None),
        ~exists().where(JobPosting.company_id == CompanyProfile.id),
    ))).all()
    sent = 0
    for company, user in rows:
        for days in GUIDE_DAYS:
            kind = f"guia_{days}d"
            if company.verified_at <= now - timedelta(days=days) and await _state(db, user.id, kind) is None:
                await create_notification(
                    db, user_id=user.id, type="company_onboarding_guide",
                    title="Publicá tu primera búsqueda",
                    body=("Tu empresa ya está verificada. Publicar una búsqueda lleva unos minutos: "
                          "puesto, requisitos y zona. Te avisamos cuando lleguen postulaciones."),
                    link="/dashboard/company/publicar",
                )
                await _mark(db, user.id, kind, now)
                sent += 1
                break   # una por corrida
    return sent


async def jobs_without_applications(db: AsyncSession, now: datetime) -> int:
    """Una búsqueda activa hace 7 días sin ninguna postulación: un aviso con consejos, una vez."""
    jobs = (await db.execute(select(JobPosting, CompanyProfile.user_id).join(
        CompanyProfile, CompanyProfile.id == JobPosting.company_id).where(
        JobPosting.status == JobPostingStatus.active, JobPosting.deleted_at.is_(None),
        JobPosting.moderation_status == JobModerationStatus.approved,
        JobPosting.published_at <= now - NO_APPLICATIONS_AFTER,
        ~exists().where(Application.job_posting_id == JobPosting.id),
    ))).all()
    sent = 0
    for job, user_id in jobs:
        link = f"/dashboard/company/busquedas?id={job.id}"
        if (await db.execute(select(exists().where(Notification.user_id == user_id,
                                                   Notification.type == "job_no_applications",
                                                   Notification.link == link)))).scalar():
            continue
        await create_notification(
            db, user_id=user_id, type="job_no_applications",
            title="Tu búsqueda todavía no recibió postulaciones",
            body=(f"'{job.title}' lleva una semana publicada sin postulaciones. Revisá que el título sea "
                  "claro y que los requisitos excluyentes sean los indispensables."),
            link=link,
            email_vars={"puesto": job.title},
        )
        sent += 1
    return sent


async def reactivations(db: AsyncSession, now: datetime) -> int:
    """Postulantes que hace una semana no entran: "¿Seguís buscando trabajo?".

    "Entrar" = la última vez que usó su cuenta (`users.last_seen_at`); para las cuentas de antes
    de esa columna, la fecha de alta. Sin postulaciones en esa semana. Como mucho uno cada 30
    días, y se corta después de 3 sin que vuelva a entrar."""
    last_seen = func.coalesce(User.last_seen_at, User.created_at)
    recent_app = exists().where(Application.candidate_id == CandidateProfile.id,
                                Application.created_at >= now - REACTIVATION_INACTIVE)
    rows = (await db.execute(select(CandidateProfile, User).join(User, User.id == CandidateProfile.user_id).where(
        CandidateProfile.deleted_at.is_(None), User.deleted_at.is_(None), User.is_active.is_(True),
        last_seen < now - REACTIVATION_INACTIVE, ~recent_app,
    ).limit(500))).all()
    sent = 0
    for profile, user in rows:
        last = await _state(db, user.id, "reactivacion")
        if last and last >= now - REACTIVATION_EVERY:
            continue
        seen = user.last_seen_at or user.created_at
        unanswered = (await db.execute(select(func.count()).select_from(Notification).where(
            Notification.user_id == user.id, Notification.type == "candidate_reactivation",
            Notification.created_at > seen,
        ))).scalar_one()
        if unanswered >= REACTIVATION_MAX_UNANSWERED:
            continue
        await create_notification(
            db, user_id=user.id, type="candidate_reactivation", title="¿Seguís buscando trabajo?",
            body="Hay búsquedas nuevas en Bahía Blanca y la zona. Revisá las disponibles y postulate a las que te interesen.",
            link="/empleos",
        )
        await _mark(db, user.id, "reactivacion", now)
        sent += 1
    return sent


async def daily(db: AsyncSession, now: datetime | None = None) -> dict[str, int]:
    """Lo llama el scheduler una vez por día (sólo con la compuerta abierta). No commitea."""
    now = now or datetime.now(timezone.utc)
    if not new_modules_enabled():
        return {}
    return {
        "guias": await company_guides(db, now),
        "sin_postulaciones": await jobs_without_applications(db, now),
        "reactivaciones": await reactivations(db, now),
    }
