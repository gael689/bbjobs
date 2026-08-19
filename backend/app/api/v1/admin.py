from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

from app.api.deps import get_db, require_role
from app.models.core import User, UserRole, AdminProfile
from app.models.company import CompanyProfile, VerificationStatus
from app.models.candidate import CandidateProfile, Education, Gender, Availability
from app.models.catalogs import Industry
from app.models.job import JobPosting, Application, JobPostingStatus, JobModerationStatus
from app.models.alerts import AuditLog
from app.models.contact import ContactMessage
from app.models.history import ApplicationStatusHistory, CandidateActivityLog
from app.models.payment import Payment, PaymentType, JobFeature, JobFeatureStatus
from app.services.notifications import create_notification
from app.services.profile_completion import compute_profile_completion_for_candidate
from app.services.applicant_stats import (
    ApplicantStats, compute_applicant_stats, get_highest_education_level,
)
from app.services.job_features import end_active_feature_for_job
from app.services.job_status import can_admin_reopen
from app.services.settings import get_all_settings, set_setting
from app.models.settings import SettingKey
from app.integrations.clerk_client import create_clerk_user
from app.integrations.cloudinary_client import signed_document_url
from app.schemas.candidate import calculate_age, CandidateFullProfile
from app.schemas.documents import SignedDocumentLink
from app.schemas.contact import ContactMessageResponse
from app.schemas.history import ApplicationStatusHistoryResponse, CandidateActivityLogResponse
from app.schemas.payment import FeatureHistoryItem
from app.schemas.job import JobPostingUpdate
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
    industry_name: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    employee_count: Optional[str] = None
    responsible_full_name: str
    responsible_phone: str
    responsible_email: str
    responsible_position: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    verification_status: VerificationStatus
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    is_anonymized: bool
    created_at: datetime

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
    company_id: Optional[uuid.UUID] = None
    title: str
    description: str
    modality: str
    status: JobPostingStatus
    company_legal_name_snapshot: str
    company_verification_status: Optional[VerificationStatus] = None
    published_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    duration_days: int
    moderation_status: JobModerationStatus
    moderation_notes: Optional[str] = None
    is_featured: bool = False
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: Optional[str] = None
    salary_visible: bool = False
    benefits: Optional[str] = None

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




class CreateAdminPayload(BaseModel):
    email: str
    password: str
    full_name: str


class TrendPoint(BaseModel):
    date: str  # YYYY-MM-DD
    jobs_created: int
    applications: int


class DashboardTrends(BaseModel):
    points: List[TrendPoint]  # 7 puntos, del más viejo al más nuevo


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
    total_jobs = (await db.execute(
        select(func.count()).select_from(JobPosting).where(JobPosting.deleted_at.is_(None))
    )).scalar()
    pending_jobs = (await db.execute(
        select(func.count()).select_from(JobPosting)
        .where(
            JobPosting.moderation_status == JobModerationStatus.pending_review,
            JobPosting.deleted_at.is_(None),
        )
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


@router.get("/admin/dashboard/trends", response_model=DashboardTrends)
async def get_dashboard_trends(
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Serie de los últimos 7 días (hoy incluido) para los sparklines del panel — agregado por
    día en SQL, no traído fila por fila. Días sin actividad no tienen fila en el resultado del
    GROUP BY; se completan en 0 acá para que el frontend siempre reciba 7 puntos seguidos."""
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=6)
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)

    jobs_result = await db.execute(
        select(func.date(JobPosting.created_at).label("d"), func.count())
        .where(JobPosting.created_at >= start_dt, JobPosting.deleted_at.is_(None))
        .group_by("d")
    )
    jobs_by_day = {row[0].isoformat(): row[1] for row in jobs_result.all()}

    apps_result = await db.execute(
        select(func.date(Application.created_at).label("d"), func.count())
        .where(Application.created_at >= start_dt)
        .group_by("d")
    )
    apps_by_day = {row[0].isoformat(): row[1] for row in apps_result.all()}

    points = []
    for i in range(7):
        day = (start_date + timedelta(days=i)).isoformat()
        points.append(TrendPoint(
            date=day,
            jobs_created=jobs_by_day.get(day, 0),
            applications=apps_by_day.get(day, 0),
        ))

    return DashboardTrends(points=points)


@router.get("/admin/companies", response_model=List[CompanyAdminResponse])
async def list_companies(
    status: Optional[VerificationStatus] = Query(None),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    # JOIN con Industry para resolver el nombre del rubro — CompanyProfile sólo guarda el
    # UUID y no tiene relationship cargada, así que antes de esto el admin nunca veía el
    # rubro (ver MODIFICACIONES-EUGENIA-2026-08-14-PLAN.md, B1).
    q = select(CompanyProfile, Industry.name).join(
        Industry, CompanyProfile.industry_id == Industry.id
    )
    if status:
        q = q.where(CompanyProfile.verification_status == status)
    # pending first, then by creation order
    q = q.order_by(
        (CompanyProfile.verification_status == VerificationStatus.pending).desc(),
    )
    result = await db.execute(q)
    return [
        CompanyAdminResponse.model_validate(company, from_attributes=True).model_copy(
            update={"industry_name": industry_name}
        )
        for company, industry_name in result.all()
    ]


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

    if company.verification_status == VerificationStatus.suspended:
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

    if company.verification_status != VerificationStatus.suspended:
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

    if job.status == JobPostingStatus.closed:
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
    # LEFT JOIN (no join simple): una búsqueda cuya empresa se borró (company_id nullable,
    # ver JobPosting) igual tiene que listarse — sólo se queda sin verification_status.
    q = (
        select(JobPosting, CompanyProfile.verification_status)
        .outerjoin(CompanyProfile, JobPosting.company_id == CompanyProfile.id)
        .where(JobPosting.deleted_at.is_(None))
    )
    if status:
        q = q.where(JobPosting.status == status)
    if moderation_status:
        q = q.where(JobPosting.moderation_status == moderation_status)
    # Prioridad: las búsquedas con destacado pago (is_featured) se revisan primero — protegen
    # los días de exposición que la empresa ya compró, ya que expires_at corre desde que se
    # publica, no desde que se aprueba. Entre el resto, orden justo: las más viejas primero.
    q = q.order_by(JobPosting.is_featured.desc(), JobPosting.published_at.asc())
    result = await db.execute(q)
    return [
        JobAdminResponse.model_validate(job, from_attributes=True).model_copy(
            update={"company_verification_status": verification_status}
        )
        for job, verification_status in result.all()
    ]


# ── Drill-down: empresa → búsquedas → postulaciones, y candidato → perfil completo ────────────

@router.get("/admin/companies/{company_id}/jobs", response_model=List[JobAdminResponse])
async def list_company_jobs(
    company_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JobPosting)
        .where(JobPosting.company_id == company_id, JobPosting.deleted_at.is_(None))
        .order_by(desc(JobPosting.published_at))
    )
    return result.scalars().all()


@router.get("/admin/applications/stats", response_model=ApplicantStats)
async def applicant_stats_admin(
    job_id: Optional[uuid.UUID] = Query(None, description="Acotar a una búsqueda"),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Los indicadores de los postulantes, de todo el sistema o de una búsqueda.

    Sin `job_id` toma a todos los que se postularon a algo — que es el panel que
    la administradora necesita para mirar el conjunto: cuánta gente se postula,
    qué pretensión declara, qué nivel educativo predomina, cómo se reparten edad
    y experiencia, qué habilidades aparecen más.

    Se cuenta cada candidato UNA vez aunque tenga varias postulaciones: sin el
    distinct, alguien que se postuló a seis búsquedas pesaba seis veces en el
    promedio de sueldo y en cada gráfico.
    """
    consulta = select(Application.candidate_id).distinct()
    if job_id is not None:
        consulta = consulta.where(Application.job_posting_id == job_id)
    candidate_ids = (await db.execute(consulta)).scalars().all()
    return await compute_applicant_stats(db, candidate_ids)


@router.get("/admin/jobs/{job_id}/applications/stats", response_model=ApplicantStats)
async def job_applicant_stats_admin(
    job_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Las mismas estadísticas del aviso que ve la empresa, para el admin.

    Existía sólo bajo `/me/company/...` con `require_verified_company`, así que
    el admin podía decidir si estas estadísticas se publican —el interruptor de
    Indicadores— pero no ver lo que estaba publicando. Es el mismo cálculo, sin
    duplicarlo: cambia únicamente quién puede pedirlo y que no se exige ser el
    dueño del aviso.
    """
    job = (await db.execute(select(JobPosting).where(JobPosting.id == job_id))).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate_ids = (
        await db.execute(select(Application.candidate_id).where(Application.job_posting_id == job.id))
    ).scalars().all()
    return await compute_applicant_stats(db, candidate_ids)


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
                    photo_url=candidate.photo_url,
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


@router.get("/admin/candidates/{candidate_id}/cv/link", response_model=SignedDocumentLink)
async def get_candidate_cv_link_admin(
    candidate_id: uuid.UUID,
    attachment: bool = False,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Link firmado al CV de cualquier candidato. La URL de Cloudinary guardada no se puede
    abrir directo: la cuenta tiene restringida la entrega de PDF y devuelve 401 (era el
    "no se pudo cargar el documento PDF" que reportó Eugenia desde su panel)."""
    profile = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == candidate_id)
    )).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    if not profile.cv_file_url:
        raise HTTPException(status_code=404, detail="El candidato no tiene CV cargado")

    url = signed_document_url(profile.cv_file_url, attachment=attachment)
    if not url:
        raise HTTPException(status_code=502, detail="No se pudo generar el link al CV")
    return SignedDocumentLink(url=url)


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

    # Antes esto exigía moderation_status == pending_review, así que una vez aprobada o
    # rechazada, la decisión era para siempre — ni siquiera el propio admin podía corregir un
    # click de más. Ahora se puede volver a moderar en cualquier momento (aprobar algo que se
    # había rechazado por error, o al revés) — es la misma acción, sólo que ya no es de una
    # sola vez. Ver MODIFICACIONES-EUGENIA-2026-08-14-PLAN.md, A1.
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


@router.patch("/admin/jobs/{job_id}/reopen")
async def reopen_job(
    job_id: uuid.UUID,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Saca una búsqueda de `closed` — el único camino de vuelta, y sólo el admin lo tiene
    (ver can_admin_reopen: la empresa no puede reabrir lo que cerró ni lo que Talency dio de
    baja). Cubre el caso real: se da de baja por error, o la empresa la cierra y se
    arrepiente. Si ya venció el plazo, se recalcula `expires_at` desde hoy en vez de reabrir
    una búsqueda que nace vencida — reabrir para que expire en el mismo segundo no sirve."""
    result = await db.execute(select(JobPosting).where(JobPosting.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada")

    if not can_admin_reopen(job.status):
        raise HTTPException(
            status_code=400,
            detail="Sólo se puede reabrir una búsqueda dada de baja",
        )

    job.status = JobPostingStatus.active
    job.closed_at = None
    now = datetime.now(timezone.utc)
    if not job.expires_at or job.expires_at <= now:
        job.published_at = now
        job.expires_at = now + timedelta(days=job.duration_days)

    company_result = await db.execute(select(CompanyProfile).where(CompanyProfile.id == job.company_id))
    company = company_result.scalar_one_or_none()
    if company:
        await create_notification(
            db,
            user_id=company.user_id,
            type="job_reopened",
            title="Tu búsqueda volvió a estar activa",
            body=f"'{job.title}' fue reactivada por el equipo de BBJobs.",
            link="/dashboard/company/estadisticas",
        )

    audit = AuditLog(
        admin_user_id=admin.id,
        action="job_reopen",
        target_entity="job_postings",
        target_id=job.id,
        notes=None,
    )
    db.add(audit)

    await db.commit()
    await db.refresh(job)
    return {"status": "ok", "job_status": job.status, "expires_at": job.expires_at}


@router.patch("/admin/jobs/{job_id}", response_model=JobAdminResponse)
async def update_job_admin(
    job_id: uuid.UUID,
    payload: JobPostingUpdate,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Edición de contenido desde el admin — título/descripción/requisitos/modalidad/plazo.
    No cambia `status` ni `moderation_status` acá: para eso ya existen `moderate` (aprobar/
    rechazar) y `takedown` (dar de baja), que además notifican a la empresa y dejan auditoría
    con el motivo — permitir el cambio de estado por esta vía los pisaría en silencio."""
    result = await db.execute(
        select(JobPosting).where(JobPosting.id == job_id, JobPosting.deleted_at.is_(None))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada")

    if payload.status is not None:
        raise HTTPException(
            status_code=400,
            detail="No se puede cambiar el estado desde acá — usá aprobar/rechazar o dar de baja",
        )

    update_data = payload.model_dump(exclude_unset=True, exclude={"status"})
    duration_changed = "duration_days" in update_data
    for key, value in update_data.items():
        setattr(job, key, value)

    # Mismo criterio que el auto-gestionado de la empresa (jobs.py::update_job_posting): el
    # plazo se recalcula contra published_at, no contra "hoy" — permite acortar o volver a
    # ampliar (dentro del máximo) sin premiar ni castigar por el momento en que se edita.
    if duration_changed and job.published_at:
        job.expires_at = job.published_at + timedelta(days=job.duration_days)

    audit = AuditLog(
        admin_user_id=admin.id,
        action="job_edit",
        target_entity="job_postings",
        target_id=job.id,
        notes=None,
    )
    db.add(audit)

    await db.commit()
    await db.refresh(job)
    return job


@router.delete("/admin/jobs/{job_id}")
async def delete_job_admin(
    job_id: uuid.UUID,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete — el modelo ya tenía `deleted_at` sin usar. Un DELETE real en SQL arrastraría
    en cascada `job_features` (`ondelete=CASCADE`, ver models/payment.py), borrando el historial
    de pagos de una búsqueda destacada. Con soft-delete, la búsqueda desaparece de todos los
    listados (público, del admin y de la empresa — ver deleted_at.is_(None) en jobs.py) pero
    Payment/JobFeature quedan intactos para contabilidad."""
    result = await db.execute(
        select(JobPosting).where(JobPosting.id == job_id, JobPosting.deleted_at.is_(None))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada")

    job.deleted_at = datetime.now(timezone.utc)
    if job.is_featured:
        await end_active_feature_for_job(db, job)

    company_result = await db.execute(select(CompanyProfile).where(CompanyProfile.id == job.company_id))
    company = company_result.scalar_one_or_none()
    if company:
        await create_notification(
            db,
            user_id=company.user_id,
            type="job_deleted",
            title="Tu búsqueda fue eliminada",
            body=f"'{job.title}' fue eliminada por el equipo de BBJobs.",
            link="/dashboard/company/estadisticas",
        )

    audit = AuditLog(
        admin_user_id=admin.id,
        action="job_delete",
        target_entity="job_postings",
        target_id=job.id,
        notes=None,
    )
    db.add(audit)

    await db.commit()
    return {"status": "ok"}


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


@router.delete("/admin/contact-messages/{message_id}")
async def delete_contact_message(
    message_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Borrado real, no lógico — antes no existía ningún camino para sacar un mensaje de acá,
    ni siquiera spam o los de prueba que quedaron de una carga vieja (ver A3 del plan del
    14/08). Un mensaje de contacto resuelto no tiene valor de archivo que justifique guardarlo
    para siempre."""
    result = await db.execute(select(ContactMessage).where(ContactMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    await db.delete(msg)
    await db.commit()
    return {"status": "ok"}


# ── Interruptores del sitio ──────────────────────────────────────────────────

class SiteSettingsResponse(BaseModel):
    """Qué estadísticas están publicadas hoy.

    Talency las ve **siempre** desde su panel; estos interruptores sólo controlan si además
    salen al portal. La idea es no publicar gráficos con 3 postulantes y prenderlos cuando el
    volumen los haga significativos, sin tocar código."""
    stats_visibles_para_candidatos: bool
    stats_visibles_en_landing: bool


class SiteSettingsUpdate(BaseModel):
    stats_visibles_para_candidatos: Optional[bool] = None
    stats_visibles_en_landing: Optional[bool] = None


@router.get("/admin/settings", response_model=SiteSettingsResponse)
async def get_site_settings(
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    return SiteSettingsResponse(**await get_all_settings(db))


@router.patch("/admin/settings", response_model=SiteSettingsResponse)
async def update_site_settings(
    payload: SiteSettingsUpdate,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    for clave, valor in payload.model_dump(exclude_unset=True).items():
        if valor is not None:
            await set_setting(db, SettingKey(clave), valor)
    await db.commit()
    return SiteSettingsResponse(**await get_all_settings(db))


# ── Destacado manual ─────────────────────────────────────────────────────────

class FeatureJobPayload(BaseModel):
    featured: bool
    # Por qué se destacó sin cobrar: canje, cortesía, error de un pago. Queda en el registro
    # de auditoría — un destacado gratis tiene que poder explicarse después.
    notes: Optional[str] = None


@router.patch("/admin/jobs/{job_id}/feature")
async def set_job_featured_admin(
    job_id: uuid.UUID,
    payload: FeatureJobPayload,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Destaca o quita el destacado de una búsqueda **sin pago asociado** (canje, cortesía).

    Es un camino paralelo al de Mercado Pago, no un reemplazo: no crea `Payment` ni
    `JobFeature`, porque no hubo plata de por medio y meter filas falsas en la tabla de pagos
    ensuciaría el reporte de facturación. Sólo mueve el flag de la búsqueda.

    Si la búsqueda ya tenía un destacado pago activo, se respeta: quitarlo desde acá apagaría
    algo por lo que la empresa pagó. Para ese caso hay que ir por el flujo de pagos.
    """
    result = await db.execute(
        select(JobPosting).where(JobPosting.id == job_id, JobPosting.deleted_at.is_(None))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada")

    if job.status in (JobPostingStatus.closed, JobPostingStatus.expired):
        raise HTTPException(status_code=400, detail="No se puede destacar una búsqueda cerrada o vencida")

    feature_pago = (await db.execute(
        select(JobFeature).where(
            JobFeature.job_posting_id == job.id,
            JobFeature.status == JobFeatureStatus.active,
        )
    )).scalar_one_or_none()

    if not payload.featured and feature_pago:
        raise HTTPException(
            status_code=400,
            detail="Esta búsqueda tiene un destacado pago activo — no se puede quitar a mano.",
        )

    job.is_featured = payload.featured
    # El destacado dura lo que dure la búsqueda, igual que el pago (ver webhooks.py).
    job.featured_until = job.expires_at if payload.featured else None

    db.add(AuditLog(
        admin_user_id=admin.id,
        action="job_featured_manual" if payload.featured else "job_unfeatured_manual",
        target_entity="job_posting",
        target_id=job.id,
        notes=payload.notes,
    ))

    company = (await db.execute(
        select(CompanyProfile).where(CompanyProfile.id == job.company_id)
    )).scalar_one_or_none()
    if company:
        await create_notification(
            db,
            user_id=company.user_id,
            type="job_feature_active" if payload.featured else "job_feature_expired",
            title="Destacado activado" if payload.featured else "Destacado desactivado",
            body=(
                f"Talency destacó '{job.title}' en el portal, sin cargo."
                if payload.featured
                else f"'{job.title}' ya no aparece destacada."
            ),
            link="/dashboard/company/busquedas",
        )

    await db.commit()
    return {"status": "ok", "job_id": job_id, "is_featured": job.is_featured}
