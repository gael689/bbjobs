"""
Borrado de cuentas — una sola implementación para las cuatro puertas que lo usan:

- la admin, desde el panel (`DELETE /admin/users/{id}`),
- el propio usuario, desde "Mi cuenta" (`DELETE /me/account`, Ley 25.326),
- "me equivoqué de tipo de cuenta" (`POST /me/account/reset-role`), sólo con la cuenta vacía,
- el webhook `user.deleted` de Clerk, cuando alguien borra desde el dashboard de Clerk.

El objetivo que lo originó (pedido de Eugenia, 23/09/2026): que quien se registró por error
—típicamente como empresa buscando trabajo— **pueda volver a registrarse con el mismo mail**.
Ver MODIFICACIONES-EUGENIA-2026-09-23-PLAN.md, Bloque A.

Dos modos, que el servicio elige solo:

- **Borrado total** (`full`) — cuenta sin historia que le importe a otro. `DELETE FROM users` y
  la base cascadea.
- **Lápida** (`tombstone`) — la cuenta tiene algo que es de otro o es contable: pagos,
  postulaciones (recibidas o enviadas) o desbloqueos de la Base de Talento. Se borran los datos
  personales y el acceso, se libera el mail, y se conserva la fila para que lo demás siga
  apuntando a algo.

Por qué no alcanza con dejar cascadear siempre (lo que hacía `account.py` antes de esto):
- `payments.company_id` es RESTRICT → con un solo pago el DELETE explota.
- `company_profiles` → `job_postings` → `applications` es CASCADE → borrar una empresa se
  llevaba puestas las postulaciones de candidatos que no tienen nada que ver.
- Los créditos usados de la Base de Talento se **cuentan** desde `talent_unlocks`: borrar un
  candidato desbloqueado le devolvía el crédito a la empresa en silencio.
"""
from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

import structlog
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations import cloudinary_client
from app.integrations.clerk_client import delete_clerk_user, set_public_metadata
from app.models.alerts import AuditLog, JobAlert, Notification
from app.models.candidate import CandidateProfile, CandidateSkill, Education, Experience, Language
from app.models.company import CompanyProfile, CompanyVerificationDocument, VerificationStatus
from app.models.core import User, UserRole
from app.models.history import CandidateActivityLog
from app.models.job import Application, JobPosting
from app.models.payment import Payment, TalentCreditPack, TalentPackStatus, TalentUnlock
from app.models.tests import TestSubmission
from app.services.job_features import end_active_feature_for_job

logger = structlog.get_logger("app.services.account_deletion")

# `.invalid` es un TLD reservado (RFC 2606): nunca va a recibir un mail por error.
TOMBSTONE_EMAIL = "eliminado+{user_id}@bbjobs.invalid"


class DeletionMode(str, enum.Enum):
    full = "full"
    tombstone = "tombstone"


class AccountDeletionError(Exception):
    """Algo impide borrar. `status_code` es el que debería devolver el endpoint."""

    def __init__(self, message: str, status_code: int = 409):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class DeletionPreview:
    """Lo que la UI le muestra a quien va a borrar, ANTES de confirmar."""

    user_id: uuid.UUID
    role: str
    email: str
    display_name: str
    mode: DeletionMode
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def is_empty(self) -> bool:
        """Sin nada que le importe a otro: habilita "me equivoqué de tipo de cuenta"."""
        return self.mode == DeletionMode.full


def mask_email(email: str) -> str:
    """`juan.perez@gmail.com` → `j***@gmail.com`. Para el AuditLog: deja trazabilidad sin
    conservar el dato personal que justamente se pidió borrar."""
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


async def _count(db: AsyncSession, stmt) -> int:
    return int((await db.execute(stmt)).scalar() or 0)


async def preview_deletion(db: AsyncSession, user: User) -> DeletionPreview:
    if user.role == UserRole.company:
        company = (await db.execute(
            select(CompanyProfile).where(CompanyProfile.user_id == user.id)
        )).scalar_one_or_none()
        counts = {"busquedas": 0, "postulaciones_recibidas": 0, "pagos": 0, "desbloqueos": 0}
        name = company.legal_name if company else user.email
        if company:
            counts["busquedas"] = await _count(db, select(func.count()).select_from(JobPosting).where(
                JobPosting.company_id == company.id, JobPosting.deleted_at.is_(None)))
            counts["postulaciones_recibidas"] = await _count(db, select(func.count()).select_from(Application)
                .join(JobPosting, JobPosting.id == Application.job_posting_id)
                .where(JobPosting.company_id == company.id))
            counts["pagos"] = await _count(db, select(func.count()).select_from(Payment).where(
                Payment.company_id == company.id))
            counts["desbloqueos"] = await _count(db, select(func.count()).select_from(TalentUnlock).where(
                TalentUnlock.company_id == company.id))
        has_history = counts["postulaciones_recibidas"] or counts["pagos"] or counts["desbloqueos"]
    elif user.role == UserRole.candidate:
        profile = (await db.execute(
            select(CandidateProfile).where(CandidateProfile.user_id == user.id)
        )).scalar_one_or_none()
        counts = {"postulaciones": 0, "desbloqueos": 0}
        name = f"{profile.first_name} {profile.last_name}".strip() if profile else user.email
        if profile:
            counts["postulaciones"] = await _count(db, select(func.count()).select_from(Application).where(
                Application.candidate_id == profile.id))
            counts["desbloqueos"] = await _count(db, select(func.count()).select_from(TalentUnlock).where(
                TalentUnlock.candidate_id == profile.id))
        has_history = counts["postulaciones"] or counts["desbloqueos"]
    else:
        raise AccountDeletionError("Las cuentas de administrador no se eliminan por acá.", 403)

    return DeletionPreview(
        user_id=user.id,
        role=str(user.role.value if isinstance(user.role, UserRole) else user.role),
        email=user.email,
        display_name=name,
        mode=DeletionMode.tombstone if has_history else DeletionMode.full,
        counts=counts,
    )


async def _collect_files(db: AsyncSession, user: User) -> list[str]:
    """URLs de Cloudinary a borrar después del commit."""
    urls: list[str] = []
    if user.role == UserRole.candidate:
        p = (await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id))).scalar_one_or_none()
        if p:
            urls += [u for u in (p.photo_url, p.cv_file_url) if u]
    elif user.role == UserRole.company:
        c = (await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == user.id))).scalar_one_or_none()
        if c:
            if c.logo_url:
                urls.append(c.logo_url)
            docs = await db.execute(
                select(CompanyVerificationDocument.file_url).where(CompanyVerificationDocument.company_id == c.id))
            urls += [u for (u,) in docs.all() if u]
    return urls


async def _tombstone_user(user: User, now: datetime) -> None:
    user.email = TOMBSTONE_EMAIL.format(user_id=user.id)
    user.clerk_user_id = None
    user.is_active = False
    user.deleted_at = now


async def _tombstone_candidate(db: AsyncSession, user: User, now: datetime) -> None:
    p = (await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id))).scalar_one_or_none()
    if p:
        # Se va todo lo que describe a la persona. Se queda la fila (y sus postulaciones y
        # desbloqueos) para que la empresa vea "Candidato eliminado" en su historial y no
        # recupere un crédito que ya usó.
        for model in (Experience, Education, Language, CandidateSkill, JobAlert, TestSubmission, CandidateActivityLog):
            await db.execute(delete(model).where(model.candidate_id == p.id))
        await db.execute(
            Application.__table__.update().where(Application.candidate_id == p.id).values(cover_letter=None))
        p.first_name = "Candidato"
        p.last_name = "eliminado"
        p.phone = ""
        p.photo_url = None
        p.cv_file_url = None
        p.cv_uploaded_at = None
        p.birth_date = None
        p.gender = None
        p.summary = None
        p.other_skill = None
        p.location_zone_id = None
        p.expected_salary_min = None
        p.expected_salary_max = None
        p.visible_in_talent_pool = False
        p.deleted_at = now
    await db.execute(delete(Notification).where(Notification.user_id == user.id))
    await _tombstone_user(user, now)


async def _tombstone_company(db: AsyncSession, user: User, now: datetime) -> None:
    c = (await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == user.id))).scalar_one_or_none()
    if c:
        # CUIT: se libera salvo que la empresa esté suspendida o rechazada — si no, borrar la
        # cuenta serviría para esquivar el bloqueo de onboarding.py (decisión D3).
        if str(c.verification_status) not in (str(VerificationStatus.suspended), str(VerificationStatus.rejected)):
            c.cuit = f"ELIM-{c.id.hex}"
        c.is_anonymized = True
        c.legal_name = "Empresa eliminada"
        c.responsible_full_name = ""
        c.responsible_phone = ""
        c.responsible_email = ""
        c.responsible_position = None
        c.logo_url = None
        c.website = None
        c.description = None
        c.deleted_at = now

        # Las búsquedas se dan de baja igual que DELETE /admin/jobs/{id}: soft-delete, así las
        # postulaciones siguen en el historial de cada candidato y JobFeature/Payment quedan
        # para la contabilidad.
        jobs = (await db.execute(
            select(JobPosting).where(JobPosting.company_id == c.id, JobPosting.deleted_at.is_(None))
        )).scalars().all()
        for job in jobs:
            job.deleted_at = now
            if job.is_featured:
                await end_active_feature_for_job(db, job)

        # Packs con créditos sin usar: se cancelan. No se reembolsa nada automáticamente.
        packs = (await db.execute(
            select(TalentCreditPack).where(
                TalentCreditPack.company_id == c.id,
                TalentCreditPack.status.in_([TalentPackStatus.active, TalentPackStatus.pending_payment]),
            )
        )).scalars().all()
        for pack in packs:
            pack.status = TalentPackStatus.canceled

        await db.execute(delete(CompanyVerificationDocument).where(CompanyVerificationDocument.company_id == c.id))
    await db.execute(delete(Notification).where(Notification.user_id == user.id))
    await _tombstone_user(user, now)


async def delete_account(
    db: AsyncSession,
    user: User,
    *,
    actor: User | None,
    reason: str,
    delete_in_clerk: bool = True,
    require_empty: bool = False,
) -> DeletionPreview:
    """Borra (o deja en lápida) la cuenta y **commitea**. Devuelve el preview con el modo aplicado.

    Orden y por qué:
    1. Cambios locales + `flush()` (sin commit): si la base rechaza algo, se hace rollback y
       Clerk no se tocó.
    2. Clerk. 404 = ya no existía, se sigue. Otro error = rollback y nada cambió.
    3. `commit()`.
    4. Cloudinary, best-effort (sólo se loguea si falla).

    El caso malo que queda —Clerk borró y el commit falló— se autorrepara: el `user.deleted`
    que manda Clerk entra por el webhook, que llama a este mismo servicio con
    `delete_in_clerk=False`.

    `require_empty=True` es para "me equivoqué de tipo de cuenta": si la cuenta tiene historia,
    no se toca nada.
    """
    if user.role == UserRole.admin:
        raise AccountDeletionError("Las cuentas de administrador no se eliminan por acá.", 403)
    if user.deleted_at is not None:
        raise AccountDeletionError("Esta cuenta ya fue eliminada.", 404)

    preview = await preview_deletion(db, user)
    if require_empty and not preview.is_empty:
        raise AccountDeletionError(
            "Tu cuenta ya tiene actividad, así que no se puede cambiar de tipo. "
            "Podés eliminarla desde Mi cuenta y registrarte de nuevo.",
            409,
        )

    clerk_user_id = user.clerk_user_id
    files = await _collect_files(db, user)
    now = datetime.now(timezone.utc)

    db.add(AuditLog(
        admin_user_id=actor.id if actor and actor.role == UserRole.admin else None,
        action="account_delete",
        target_entity="users",
        target_id=user.id,
        notes=f"{preview.role} · {mask_email(user.email)} · modo {preview.mode.value} · {reason}",
    ))

    try:
        if preview.mode == DeletionMode.full:
            await db.delete(user)
        elif user.role == UserRole.candidate:
            await _tombstone_candidate(db, user, now)
        else:
            await _tombstone_company(db, user, now)
        await db.flush()
    except Exception as e:
        await db.rollback()
        logger.error("account_delete_db_error", user_id=str(preview.user_id), error=str(e))
        raise AccountDeletionError("No se pudo eliminar la cuenta: la base rechazó el cambio. No se modificó nada.", 409)

    if delete_in_clerk and clerk_user_id:
        try:
            delete_clerk_user(clerk_user_id)
        except Exception as e:
            # clerk_backend_api: ClerkBaseError trae `status_code`; por las dudas se mira también
            # la respuesta cruda.
            status = getattr(e, "status_code", None) or getattr(getattr(e, "raw_response", None), "status_code", None)
            if status == 404:
                # Ya no existía. Se loguea igual: si CLERK_SECRET_KEY fuera de otra instancia,
                # todo daría 404 y el login real quedaría vivo (ver riesgos del plan).
                logger.warning("account_delete_clerk_404", clerk_user_id=clerk_user_id)
            else:
                await db.rollback()
                logger.error("account_delete_clerk_error", clerk_user_id=clerk_user_id, error=str(e))
                raise AccountDeletionError(
                    "No se pudo eliminar el acceso de la cuenta. No se modificó nada; probá de nuevo en un rato.",
                    502,
                )

    await db.commit()
    logger.info("account_deleted", user_id=str(preview.user_id), mode=preview.mode.value, reason=reason)

    for url in files:
        try:
            cloudinary_client.delete_by_url(url)
        except Exception as e:  # pragma: no cover — delete_file ya atrapa, esto es por las dudas
            logger.error("account_delete_cloudinary_error", url=url, error=str(e))

    return preview


async def reset_role(db: AsyncSession, user: User) -> None:
    """"Me equivoqué de tipo de cuenta": borra el `User` local (sólo si está vacío) pero deja
    vivo el login de Clerk. La persona vuelve al onboarding y elige el otro rol sin registrarse
    de nuevo ni volver a verificar el mail."""
    clerk_user_id = user.clerk_user_id
    await delete_account(db, user, actor=user, reason="cambio de tipo de cuenta",
                         delete_in_clerk=False, require_empty=True)
    if clerk_user_id:
        try:
            # El rol viejo quedaría en publicMetadata hasta el próximo onboarding, y el frontend
            # lo usa para decidir qué botones mostrar.
            set_public_metadata(clerk_user_id, {"role": None})
        except Exception as e:
            logger.warning("reset_role_metadata_error", clerk_user_id=clerk_user_id, error=str(e))
