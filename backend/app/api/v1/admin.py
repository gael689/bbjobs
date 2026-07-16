from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from app.api.deps import get_db, require_role
from app.models.core import User, UserRole, AdminProfile
from app.models.company import CompanyProfile, VerificationStatus
from app.models.candidate import CandidateProfile, Education, Gender, Availability
from app.models.job import JobPosting, Application, JobPostingStatus, JobModerationStatus
from app.models.alerts import AuditLog
from app.models.catalogs import Skill, SkillStatus
from app.models.contact import ContactMessage
from app.models.history import ApplicationStatusHistory, CandidateActivityLog
from app.models.payment import Payment, PaymentType, JobFeature
from app.services.notifications import create_notification
from app.services.profile_completion import compute_profile_completion_for_candidate
from app.services.applicant_stats import get_highest_education_level
from app.services.job_features import end_active_feature_for_job
from app.integrations.clerk_client import create_clerk_user
from app.schemas.candidate import calculate_age, CandidateFullProfile
from app.schemas.contact import ContactMessageResponse
from app.schemas.history import ApplicationStatusHistoryResponse, CandidateActivityLogResponse
from app.schemas.payment import FeatureHistoryItem
from app.api.v1.applications import (
    ApplicationWithCandidateResponse, CandidateSummary, build_candidate_full_profile,
)
from pydantic import BaseModel

router = APIRouter()


def _birth_date_cutoff(years_ago: int):
    """Igual criterio que app/api/v1/applications.py::_birth_date_cutoff — se duplica (no se
    importa entre routers) para no acoplar admin/applications sólo por este helper."""
    import datetime
    today = datetime.date.today()
    try:
        return today.replace(year=today.year - years_ago)
    except ValueError:
        return today.replace(month=2, day=28, year=today.year - years_ago)


# ── Schemas ──────────────────────────────────────────────────────────────────

class CompanyAdminResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    legal_name: str
    cuit: str
    industry_id: uuid.UUID
    responsible_full_name: str
    responsible_phone: str
    responsible_email: str
    website: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    verification_status: VerificationStatus
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    is_anonymized: bool

    class Config:
        from_attributes = True


class VerifyCompanyPayload(BaseModel):
    action: str  # "approve" | "reject"
    notes: Optional[str] = None


class CandidateAdminResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    first_name: str
    last_name: str
    phone: str
    cv_file_url: Optional[str] = None
    cv_uploaded_at: Optional[datetime] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    has_own_transport: Optional[bool] = None
    availability: Optional[Availability] = None
    immediate_availability: Optional[bool] = None
    highest_education_level: Optional[str] = None
    completion_percent: int = 0

    class Config:
        from_attributes = True


class JobAdminResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: JobPostingStatus
    company_legal_name_snapshot: str
    published_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    moderation_status: JobModerationStatus
    moderation_notes: Optional[str] = None
    is_featured: bool = False

    class Config:
        from_attributes = True


class ModerateJobPayload(BaseModel):
    action: str  # "approve" | "reject"
    notes: Optional[str] = None


class DashboardMetrics(BaseModel):
    total_companies: int
    pending_companies: int
    verified_companies: int
    total_candidates: int
    total_jobs: int
    pending_jobs: int
    total_applications: int
    pending_contact_messages: int
    total_revenue_featured: float


class SkillAdminResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: SkillStatus
    created_at: datetime

    class Config:
        from_attributes = True


class SkillActionPayload(BaseModel):
    action: str  # "approve" | "reject"


class CreateAdminPayload(BaseModel):
    email: str
    password: str
    full_name: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/admin/dashboard", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    total_companies = (await db.execute(select(func.count()).select_from(CompanyProfile))).scalar()
    pending_companies = (await db.execute(
        select(func.count()).select_from(CompanyProfile)
        .where(CompanyProfile.verification_status == VerificationStatus.pending)
    )).scalar()
    verified_companies = (await db.execute(
        select(func.count()).select_from(CompanyProfile)
        .where(CompanyProfile.verification_status == VerificationStatus.verified)
    )).scalar()
    total_candidates = (await db.execute(select(func.count()).select_from(CandidateProfile))).scalar()
    total_jobs = (await db.execute(select(func.count()).select_from(JobPosting))).scalar()
    pending_jobs = (await db.execute(
        select(func.count()).select_from(JobPosting)
        .where(JobPosting.moderation_status == JobModerationStatus.pending_review)
    )).scalar()
    total_applications = (await db.execute(select(func.count()).select_from(Application))).scalar()
    pending_contact_messages = (await db.execute(
        select(func.count()).select_from(ContactMessage).where(ContactMessage.resolved == False)
    )).scalar()
    total_revenue_featured = (await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.type == PaymentType.job_feature, Payment.mp_status == "approved")
    )).scalar()

    return DashboardMetrics(
        total_companies=total_companies or 0,
        pending_companies=pending_companies or 0,
        verified_companies=verified_companies or 0,
        total_candidates=total_candidates or 0,
        total_jobs=total_jobs or 0,
        pending_jobs=pending_jobs or 0,
        total_applications=total_applications or 0,
        pending_contact_messages=pending_contact_messages or 0,
        total_revenue_featured=float(total_revenue_featured or 0),
    )


@router.get("/admin/companies", response_model=List[CompanyAdminResponse])
async def list_companies(
    status: Optional[VerificationStatus] = Query(None),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    q = select(CompanyProfile)
    if status:
        q = q.where(CompanyProfile.verification_status == status)
    # pending first, then by creation order
    q = q.order_by(
        (CompanyProfile.verification_status == VerificationStatus.pending).desc(),
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.patch("/admin/companies/{company_id}/verify")
async def verify_company(
    company_id: uuid.UUID,
    payload: VerifyCompanyPayload,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    if payload.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action debe ser 'approve' o 'reject'")

    result = await db.execute(select(CompanyProfile).where(CompanyProfile.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if payload.action == "approve":
        company.verification_status = VerificationStatus.verified
        company.verified_at = datetime.now(timezone.utc)
        notif_type = "company_verified"
        notif_title = "¡Tu empresa fue verificada!"
        notif_body = "Tu empresa fue verificada exitosamente. Ya podés publicar búsquedas laborales en BBJobs."
    else:
        company.verification_status = VerificationStatus.rejected
        notif_type = "company_rejected"
        notif_title = "Verificación rechazada"
        notif_body = (
            f"Tu solicitud de verificación fue rechazada. "
            f"{('Motivo: ' + payload.notes) if payload.notes else 'Contactá al administrador para más información.'}"
        )

    if payload.notes:
        company.verification_notes = payload.notes

    await create_notification(
        db,
        user_id=company.user_id,
        type=notif_type,
        title=notif_title,
        body=notif_body,
        link="/dashboard/company",
    )

    # Audit trail
    audit = AuditLog(
        admin_user_id=admin.id,
        action=f"company_{payload.action}",
        target_entity="company_profiles",
        target_id=company.id,
        notes=payload.notes,
    )
    db.add(audit)

    await db.commit()
    return {"status": "ok", "verification_status": company.verification_status}


@router.patch("/admin/companies/{company_id}/suspend")
async def suspend_company(
    company_id: uuid.UUID,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if str(company.verification_status) == str(VerificationStatus.suspended):
        raise HTTPException(status_code=400, detail="La empresa ya está suspendida")

    company.verification_status = VerificationStatus.suspended

    # Pause all active job postings
    active_jobs_result = await db.execute(
        select(JobPosting).where(
            JobPosting.company_id == company_id,
            JobPosting.status == JobPostingStatus.active
        )
    )
    active_jobs = active_jobs_result.scalars().all()
    for job in active_jobs:
        job.status = JobPostingStatus.paused

    await create_notification(
        db,
        user_id=company.user_id,
        type="company_suspended",
        title="Tu empresa fue suspendida",
        body="Tu empresa ha sido suspendida por el equipo de BBJobs. Contactanos para más información.",
        link="/dashboard/company",
    )

    # Audit trail
    audit = AuditLog(
        admin_user_id=admin.id,
        action="company_suspend",
        target_entity="company_profiles",
        target_id=company.id,
        notes=f"Suspended. {len(active_jobs)} active job(s) paused.",
    )
    db.add(audit)

    await db.commit()
    return {"status": "ok", "verification_status": VerificationStatus.suspended, "jobs_paused": len(active_jobs)}


@router.patch("/admin/companies/{company_id}/reactivate")
async def reactivate_company(
    company_id: uuid.UUID,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if str(company.verification_status) != str(VerificationStatus.suspended):
        raise HTTPException(status_code=400, detail="La empresa no está suspendida")

    company.verification_status = VerificationStatus.verified
    company.verified_at = datetime.now(timezone.utc)

    await create_notification(
        db,
        user_id=company.user_id,
        type="company_reactivated",
        title="Tu empresa fue reactivada",
        body="Tu empresa ha sido reactivada. Ya podés volver a gestionar tus búsquedas laborales en BBJobs.",
        link="/dashboard/company",
    )

    # Audit trail
    audit = AuditLog(
        admin_user_id=admin.id,
        action="company_reactivate",
        target_entity="company_profiles",
        target_id=company.id,
        notes=None,
    )
    db.add(audit)

    await db.commit()
    return {"status": "ok", "verification_status": VerificationStatus.verified}


@router.patch("/admin/jobs/{job_id}/takedown")
async def takedown_job(
    job_id: uuid.UUID,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada")

    if str(job.status) == str(JobPostingStatus.closed):
        raise HTTPException(status_code=400, detail="La búsqueda ya está cerrada")

    job.status = JobPostingStatus.closed
    job.closed_at = datetime.now(timezone.utc)
    if job.is_featured:
        await end_active_feature_for_job(db, job)

    # Notify the company's user — need to get user_id via company
    company_result = await db.execute(
        select(CompanyProfile).where(CompanyProfile.id == job.company_id)
    )
    company = company_result.scalar_one_or_none()

    if company:
        await create_notification(
            db,
            user_id=company.user_id,
            type="job_takedown",
            title="Búsqueda dada de baja",
            body=f"La búsqueda '{job.title}' fue dada de baja por incumplimiento de las políticas de BBJobs.",
            link="/dashboard/company/estadisticas",
        )

    # Audit trail
    audit = AuditLog(
        admin_user_id=admin.id,
        action="job_takedown",
        target_entity="job_postings",
        target_id=job.id,
        notes="Taken down for policy violation",
    )
    db.add(audit)

    await db.commit()
    return {"status": "ok", "job_id": job_id}


@router.get("/admin/candidates", response_model=List[CandidateAdminResponse])
async def list_candidates(
    q: Optional[str] = Query(None, description="Buscar por nombre o apellido"),
    age_min: Optional[int] = Query(None, ge=0),
    age_max: Optional[int] = Query(None, ge=0),
    gender: Optional[Gender] = Query(None),
    has_own_transport: Optional[bool] = Query(None),
    availability: Optional[Availability] = Query(None),
    immediate_availability: Optional[bool] = Query(None),
    zone_id: Optional[uuid.UUID] = Query(None),
    has_cv: Optional[bool] = Query(None),
    education_level: Optional[str] = Query(None, description="Título alcanzado (derivado de educations)"),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    query = select(CandidateProfile)
    if q:
        search_term = f"%{q}%"
        query = query.where(
            (CandidateProfile.first_name.ilike(search_term)) | (CandidateProfile.last_name.ilike(search_term))
        )
    if gender is not None:
        query = query.where(CandidateProfile.gender == gender)
    if has_own_transport is not None:
        query = query.where(CandidateProfile.has_own_transport == has_own_transport)
    if availability is not None:
        query = query.where(CandidateProfile.availability == availability)
    if immediate_availability is not None:
        query = query.where(CandidateProfile.immediate_availability == immediate_availability)
    if zone_id is not None:
        query = query.where(CandidateProfile.location_zone_id == zone_id)
    if has_cv is not None:
        query = query.where(CandidateProfile.cv_file_url.is_not(None) if has_cv else CandidateProfile.cv_file_url.is_(None))
    if age_min is not None:
        query = query.where(CandidateProfile.birth_date <= _birth_date_cutoff(age_min))
    if age_max is not None:
        query = query.where(CandidateProfile.birth_date > _birth_date_cutoff(age_max + 1))

    profiles = (await db.execute(query)).scalars().all()

    enriched = []
    for profile in profiles:
        educations = (
            await db.execute(select(Education).where(Education.candidate_id == profile.id))
        ).scalars().all()
        level = get_highest_education_level(educations)

        # education_level es derivado (no está en la tabla) — se filtra después de calcularlo.
        if education_level is not None and level != education_level:
            continue

        completion = await compute_profile_completion_for_candidate(db, profile)
        enriched.append(
            CandidateAdminResponse(
                id=profile.id,
                user_id=profile.user_id,
                first_name=profile.first_name,
                last_name=profile.last_name,
                phone=profile.phone,
                cv_file_url=profile.cv_file_url,
                cv_uploaded_at=profile.cv_uploaded_at,
                age=calculate_age(profile.birth_date),
                gender=profile.gender,
                has_own_transport=profile.has_own_transport,
                availability=profile.availability,
                immediate_availability=profile.immediate_availability,
                highest_education_level=level,
                completion_percent=completion.percent,
            )
        )

    return enriched


@router.get("/admin/jobs", response_model=List[JobAdminResponse])
async def list_jobs(
    status: Optional[JobPostingStatus] = Query(None),
    moderation_status: Optional[JobModerationStatus] = Query(None),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    q = select(JobPosting)
    if status:
        q = q.where(JobPosting.status == status)
    if moderation_status:
        q = q.where(JobPosting.moderation_status == moderation_status)
    # Prioridad: las búsquedas con destacado pago (is_featured) se revisan primero — protegen
    # los días de exposición que la empresa ya compró, ya que expires_at corre desde que se
    # publica, no desde que se aprueba. Entre el resto, orden justo: las más viejas primero.
    q = q.order_by(JobPosting.is_featured.desc(), JobPosting.published_at.asc())
    result = await db.execute(q)
    return result.scalars().all()


# ── Drill-down: empresa → búsquedas → postulaciones, y candidato → perfil completo ────────────

@router.get("/admin/companies/{company_id}/jobs", response_model=List[JobAdminResponse])
async def list_company_jobs(
    company_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobPosting).where(JobPosting.company_id == company_id).order_by(desc(JobPosting.published_at))
    )
    return result.scalars().all()


@router.get("/admin/jobs/{job_id}/applications", response_model=List[ApplicationWithCandidateResponse])
async def list_job_applications_admin(
    job_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Application, CandidateProfile)
        .join(CandidateProfile, Application.candidate_id == CandidateProfile.id)
        .where(Application.job_posting_id == job_id)
    )
    enriched = []
    for app, candidate in result.all():
        completion_percent = (await compute_profile_completion_for_candidate(db, candidate)).percent
        enriched.append(
            ApplicationWithCandidateResponse(
                id=app.id,
                candidate_id=app.candidate_id,
                job_posting_id=app.job_posting_id,
                cover_letter=app.cover_letter,
                status=app.status,
                seen_at=app.seen_at,
                created_at=app.created_at,
                updated_at=app.updated_at,
                candidate=CandidateSummary(
                    id=candidate.id,
                    first_name=candidate.first_name,
                    last_name=candidate.last_name,
                    cv_file_url=candidate.cv_file_url,
                    completion_percent=completion_percent,
                    age=calculate_age(candidate.birth_date),
                    gender=candidate.gender,
                    has_own_transport=candidate.has_own_transport,
                    availability=candidate.availability,
                    immediate_availability=candidate.immediate_availability,
                ),
            )
        )
    return enriched


@router.get("/admin/candidates/{candidate_id}", response_model=CandidateFullProfile)
async def get_candidate_full_profile_admin(
    candidate_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """A diferencia de /me/company/candidates/{id}, el admin ve el perfil completo de
    cualquier candidato sin necesidad de que se haya postulado a nada."""
    return await build_candidate_full_profile(db, candidate_id)


@router.get("/admin/candidates/{candidate_id}/activity", response_model=List[CandidateActivityLogResponse])
async def get_candidate_activity_admin(
    candidate_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateActivityLog)
        .where(CandidateActivityLog.candidate_id == candidate_id)
        .order_by(desc(CandidateActivityLog.created_at))
    )
    return result.scalars().all()


@router.get("/admin/applications/{application_id}/history", response_model=List[ApplicationStatusHistoryResponse])
async def get_application_history_admin(
    application_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApplicationStatusHistory)
        .where(ApplicationStatusHistory.application_id == application_id)
        .order_by(ApplicationStatusHistory.created_at)
    )
    return result.scalars().all()


@router.get("/admin/features", response_model=List[FeatureHistoryItem])
async def list_all_feature_history(
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Igual que GET /me/company/features pero sin scope de empresa — todo lo que se cobró en
    la plataforma, con el nombre de la empresa en cada fila."""
    result = await db.execute(
        select(Payment, JobFeature, JobPosting.title, CompanyProfile.legal_name)
        .join(JobFeature, JobFeature.payment_id == Payment.id)
        .join(JobPosting, JobPosting.id == JobFeature.job_posting_id)
        .join(CompanyProfile, CompanyProfile.id == Payment.company_id)
        .where(Payment.type == PaymentType.job_feature)
        .order_by(Payment.created_at.desc())
    )
    return [
        FeatureHistoryItem(
            payment_id=payment.id,
            job_posting_id=feature.job_posting_id,
            job_title=job_title,
            company_name=company_name,
            amount=payment.amount,
            currency=payment.currency,
            payment_status=payment.mp_status,
            feature_status=feature.status,
            purchased_at=payment.created_at,
            starts_at=feature.starts_at,
            ends_at=feature.ends_at,
        )
        for payment, feature, job_title, company_name in result.all()
    ]


@router.patch("/admin/jobs/{job_id}/moderate")
async def moderate_job(
    job_id: uuid.UUID,
    payload: ModerateJobPayload,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    if payload.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action debe ser 'approve' o 'reject'")

    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada")

    if str(job.moderation_status) != str(JobModerationStatus.pending_review):
        raise HTTPException(status_code=400, detail="La búsqueda ya fue revisada")

    if payload.action == "approve":
        job.moderation_status = JobModerationStatus.approved
        notif_type, notif_title, notif_body = (
            "job_approved",
            "¡Tu búsqueda ya está publicada!",
            f"'{job.title}' fue aprobada por el equipo de BBJobs y ya es visible en el portal.",
        )
    else:
        job.moderation_status = JobModerationStatus.rejected
        notif_type, notif_title, notif_body = (
            "job_rejected",
            "Tu búsqueda no fue aprobada",
            f"'{job.title}' no fue aprobada. "
            f"{('Motivo: ' + payload.notes) if payload.notes else 'Contactá al administrador para más información.'}",
        )

    job.moderation_notes = payload.notes
    job.moderated_by_admin_id = admin.id
    job.moderated_at = datetime.now(timezone.utc)

    company_result = await db.execute(select(CompanyProfile).where(CompanyProfile.id == job.company_id))
    company = company_result.scalar_one_or_none()
    if company:
        await create_notification(
            db,
            user_id=company.user_id,
            type=notif_type,
            title=notif_title,
            body=notif_body,
            link="/dashboard/company/estadisticas",
        )

    audit = AuditLog(
        admin_user_id=admin.id,
        action=f"job_{payload.action}",
        target_entity="job_postings",
        target_id=job.id,
        notes=payload.notes,
    )
    db.add(audit)

    await db.commit()
    return {"status": "ok", "moderation_status": job.moderation_status}


@router.get("/admin/skills/pending", response_model=List[SkillAdminResponse])
async def list_pending_skills(
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Skill).where(Skill.status == SkillStatus.pending).order_by(Skill.created_at)
    )
    return result.scalars().all()


@router.patch("/admin/skills/{skill_id}")
async def update_skill_status(
    skill_id: uuid.UUID,
    payload: SkillActionPayload,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    if payload.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action debe ser 'approve' o 'reject'")

    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(status_code=404, detail="Skill no encontrado")

    if payload.action == "approve":
        skill.status = SkillStatus.active
        skill.approved_by_admin_id = admin.id
        notif_type, notif_title, notif_body = (
            "skill_approved",
            "Habilidad aprobada",
            f"Tu sugerencia '{skill.name}' fue aprobada y agregada al catálogo.",
        )
    else:
        skill.status = SkillStatus.rejected
        notif_type, notif_title, notif_body = (
            "skill_rejected",
            "Habilidad no aprobada",
            f"Tu sugerencia '{skill.name}' no fue incorporada al catálogo.",
        )

    if skill.created_by_user_id:
        suggester_result = await db.execute(select(User).where(User.id == skill.created_by_user_id))
        suggester = suggester_result.scalar_one_or_none()
        if suggester:
            link = (
                "/dashboard/candidate/perfil"
                if str(suggester.role) == str(UserRole.candidate)
                else "/dashboard/company/perfil"
            )
            await create_notification(
                db,
                user_id=suggester.id,
                type=notif_type,
                title=notif_title,
                body=notif_body,
                link=link,
            )

    await db.commit()
    return {"status": "ok", "skill_id": skill_id, "skill_status": skill.status}


@router.post("/admin/users")
async def create_admin_user(
    payload: CreateAdminPayload,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El email ya está en uso")

    # El alta de admin es exclusivamente server-side — nunca se acepta un rol "admin"
    # propuesto por el cliente (unsafeMetadata en signup no puede otorgar este rol).
    try:
        clerk_user_id = create_clerk_user(
            email=payload.email,
            password=payload.password,
            first_name=payload.full_name.split(" ")[0] if payload.full_name else None,
            public_metadata={"role": "admin"},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo crear el usuario en Clerk: {e}")

    new_user = User(
        email=payload.email,
        clerk_user_id=clerk_user_id,
        role=UserRole.admin,
        is_active=True,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(new_user)
    await db.flush()

    admin_profile = AdminProfile(
        user_id=new_user.id,
        full_name=payload.full_name,
        created_by_admin_id=admin.id,
    )
    db.add(admin_profile)

    await db.commit()
    await db.refresh(new_user)

    return {"status": "ok", "user_id": new_user.id, "email": new_user.email}


@router.get("/admin/contact-messages", response_model=List[ContactMessageResponse])
async def list_contact_messages(
    resolved: Optional[bool] = Query(None),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    query = select(ContactMessage).order_by(ContactMessage.created_at.desc())
    if resolved is not None:
        query = query.where(ContactMessage.resolved == resolved)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/admin/contact-messages/{message_id}/resolve")
async def resolve_contact_message(
    message_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ContactMessage).where(ContactMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    msg.resolved = True
    await db.commit()
    return {"status": "ok"}
