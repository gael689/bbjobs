"""Catálogo de avisos: la única fuente de verdad de qué notificación genera qué mail.

Cada `type` que pasa por `create_notification` tiene una regla. El texto del mail es el mismo de
la notificación de la web (título, cuerpo y link, que ya están escritos para la persona), así
un aviso nuevo no necesita una plantilla aparte. Talency puede pisar asunto y texto desde su
panel (`email_templates`), con las variables `{{titulo}}` y `{{mensaje}}`.

Modos:
- `instant`: se encola al crear la notificación (la política decide si sale ya o se difiere).
- `digest`: no genera mail suelto; lo junta el resumen correspondiente (tanda T3).
- `none`: sólo en la web.

Ver MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md §3 y la auditoría (R9, M18).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Awaitable, Callable, Literal

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email import ALWAYS_SENT, EmailCategory

logger = structlog.get_logger("app.services.email.catalog")

Mode = Literal["instant", "digest", "none"]
Validator = Callable[[AsyncSession, uuid.UUID], Awaitable[bool]]

# Orden en que el dispatcher atiende la cola cuando hay tope diario (regla R1). Menor = antes.
CATEGORY_PRIORITY: dict[EmailCategory, int] = {
    EmailCategory.cuenta: 0,
    EmailCategory.admin: 1,
    EmailCategory.postulaciones: 2,
    EmailCategory.busquedas: 3,
    EmailCategory.alertas: 4,
    EmailCategory.recordatorios: 5,
    EmailCategory.novedades: 6,
}


@dataclass(frozen=True)
class Rule:
    category: EmailCategory
    mode: Mode = "instant"
    # Demora antes del primer intento (R9: "No avanza" se difiere 24 h).
    delay: timedelta = timedelta(0)
    # Crítico = ignora la franja horaria y el tope por persona (R3). Pagos y estado de la cuenta.
    critical: bool = False
    # Revalidación al enviar (M18): recibe `ref_id` y dice si el aviso sigue teniendo sentido.
    still_valid: Validator | None = None
    cta_label: str = "Ver en BBJobs"
    # Los resúmenes ya agrupan varios avisos en uno: nunca los recorta el tope por persona (M21).
    exempt_daily_cap: bool = False
    # Como mucho un mail de este tipo por persona por día (el resto queda sólo en la web).
    once_per_day: bool = False

    @property
    def unsubscribable(self) -> bool:
        return self.category not in ALWAYS_SENT


# ── Revalidaciones ────────────────────────────────────────────────────────────────────

async def _application_still_discarded(db: AsyncSession, application_id: uuid.UUID) -> bool:
    from sqlalchemy import select

    from app.models.job import Application, ApplicationStatus

    status = (await db.execute(
        select(Application.status).where(
            Application.id == application_id, Application.deleted_at.is_(None)
        )
    )).scalar_one_or_none()
    return status == ApplicationStatus.discarded


async def _fewer_than_three_reminders(db: AsyncSession, candidate_id: uuid.UUID) -> bool:
    """v4 §3.1: el recordatorio de perfil incompleto se corta tras 3 mails sin que el perfil
    cambie. `ref_id` es el candidato."""
    from sqlalchemy import func, select

    from app.models.candidate import CandidateProfile
    from app.models.email import EmailOutbox, EmailStatus

    profile = (await db.execute(select(CandidateProfile).where(CandidateProfile.id == candidate_id))).scalar_one_or_none()
    if profile is None:
        return False
    sent = (await db.execute(select(func.count()).select_from(EmailOutbox).where(
        EmailOutbox.user_id == profile.user_id, EmailOutbox.template_key == "profile_incomplete",
        EmailOutbox.status == EmailStatus.sent.value, EmailOutbox.sent_at >= profile.updated_at,
    ))).scalar_one()
    return sent < 3


C = EmailCategory
_CUENTA = Rule(C.cuenta, critical=True)
_BUSQUEDAS = Rule(C.busquedas)
_POSTULACION = Rule(C.postulaciones)

RULES: dict[str, Rule] = {
    # ── Candidato ──
    "application_new_status": Rule(C.postulaciones, mode="none"),
    # "Vieron tu CV": la empresa abrió el perfil o el CV (o lo pasó a mano a Perfil revisado).
    # Si tres empresas lo ven el mismo día, sale un mail y el resto queda en la web.
    "application_seen": Rule(C.postulaciones, once_per_day=True),
    # Nota visible suelta de la empresa. La que va junto a un cambio de estado viaja dentro de
    # ese aviso y no genera éste. Las privadas no generan ningún aviso.
    "application_note": Rule(C.postulaciones, once_per_day=True),
    "application_contacted": _POSTULACION,
    "application_in_process": _POSTULACION,
    "application_finalist": _POSTULACION,
    "application_selected": _POSTULACION,
    "application_discarded": Rule(
        C.postulaciones, delay=timedelta(hours=24), still_valid=_application_still_discarded,
    ),
    "profile_incomplete": Rule(C.recordatorios, cta_label="Completar mi perfil",
                               still_valid=_fewer_than_three_reminders),
    "welcome_candidate": Rule(C.cuenta, cta_label="Completar mi perfil"),
    "application_sent": Rule(C.postulaciones, once_per_day=True),
    "talent_profile_unlocked": Rule(C.postulaciones, once_per_day=True),
    "candidate_reactivation": Rule(C.recordatorios, cta_label="Ver búsquedas"),

    # ── Empresa ──
    "welcome_company": Rule(C.cuenta),
    "company_onboarding_guide": Rule(C.recordatorios, cta_label="Publicar una búsqueda"),
    "job_no_applications": Rule(C.recordatorios, cta_label="Revisar la búsqueda"),
    "talent_pack_low": _CUENTA,
    "company_verified": _CUENTA,
    "company_rejected": _CUENTA,
    "company_suspended": _CUENTA,
    "company_reactivated": _CUENTA,
    "job_approved": _BUSQUEDAS,
    "job_rejected": _BUSQUEDAS,
    "job_takedown": _BUSQUEDAS,
    "job_reopened": _BUSQUEDAS,
    "job_deleted": _BUSQUEDAS,
    "job_expiring_soon": _BUSQUEDAS,
    "job_expired": _BUSQUEDAS,
    "job_feature_active": _CUENTA,
    "job_feature_rejected": _CUENTA,
    "job_feature_expired": _CUENTA,
    "talent_pack_active": _CUENTA,
    "talent_pack_rejected": _CUENTA,
    "application_new": Rule(C.postulaciones, mode="digest"),  # resumen diario de la empresa
    # Candidatos nuevos que encajan (IA, de noche): una por empresa por noche, ya agrupada.
    "recommended_candidates_new": _POSTULACION,

    # ── Revisión de CV (postulante; son de un pago: críticos) ──
    "cv_review_paid": _CUENTA,
    "cv_review_payment_rejected": _CUENTA,
    "cv_review_in_progress": _CUENTA,
    "cv_review_delivered": _CUENTA,

    # ── Admin ──
    "admin_payment_received": Rule(C.admin, critical=True),
    "admin_payment_refunded": Rule(C.admin, critical=True),
    # Hay una persona que pagó y espera: sale al instante, a cualquier hora.
    "admin_cv_review_new": Rule(C.admin, critical=True),
    "admin_cv_review_duplicate_payment": Rule(C.admin, critical=True),
    "admin_cv_review_overdue": Rule(C.admin),
    "admin_company_pending": Rule(C.admin, mode="digest"),
    "admin_company_reapplied": Rule(C.admin, mode="digest"),
    "job_pending_review": Rule(C.admin, mode="digest"),
    "contact_message_received": Rule(C.admin, mode="digest"),
    "admin_email_health": Rule(C.admin, critical=True),
    "admin_campaign_draft_ready": Rule(C.admin),

    # ── Resúmenes (T3): los arma services/email/digests.py y van directo a la cola ──
    "digest_alertas": Rule(C.alertas, mode="digest", exempt_daily_cap=True),
    "digest_para_vos": Rule(C.alertas, mode="digest", exempt_daily_cap=True),
    "digest_empresa": Rule(C.postulaciones, mode="digest", exempt_daily_cap=True),
    "digest_equipo": Rule(C.admin, mode="digest", exempt_daily_cap=True),
}

_NO_EMAIL = Rule(C.postulaciones, mode="none")


def rule_for(notification_type: str) -> Rule:
    """La regla del tipo. Un tipo sin regla no manda mail (y queda en el log para sumarlo)."""
    rule = RULES.get(notification_type)
    if rule is None:
        logger.warning("email_tipo_sin_regla", type=notification_type)
        return _NO_EMAIL
    return rule
