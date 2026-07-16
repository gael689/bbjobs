from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
import uuid
import datetime
from pydantic import BaseModel
from app.api.deps import get_db, require_role, require_verified_company, get_current_user
from app.models.core import UserRole, User
from app.models.candidate import (
    CandidateProfile, Experience, Education, CandidateSkill, Language, Gender, Availability,
)
from app.models.company import CompanyProfile
from app.models.job import JobPosting, Application, ApplicationStatus, JobModerationStatus
from app.models.catalogs import Skill
from app.models.history import ApplicationStatusHistory
from app.schemas.application import ApplicationCreate, ApplicationResponse, ApplicationStatusUpdate
from app.schemas.candidate import (
    CandidateFullProfile, ExperienceForCompany, EducationForCompany,
    SkillForCompany, LanguageForCompany, calculate_age,
)
from app.schemas.history import ApplicationStatusHistoryResponse
from app.services.notifications import create_notification
from app.services.profile_completion import (
    compute_profile_completion, compute_profile_completion_for_candidate,
    should_send_completion_reminder,
)
from app.services.applicant_stats import ApplicantStats, compute_applicant_stats
from app.services.history import log_application_status_change, log_candidate_activity

router = APIRouter()


def _birth_date_cutoff(years_ago: int) -> datetime.date:
    """Fecha de nacimiento límite para un filtro de edad — corrimiento de N años desde hoy,
    con fallback si el 29/feb no existe en el año resultante (no bisiesto)."""
    today = datetime.date.today()
    try:
        return today.replace(year=today.year - years_ago)
    except ValueError:
        return today.replace(month=2, day=28, year=today.year - years_ago)


# ── Inline schema for enriched application view ───────────────────────────────

class CandidateSummary(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    cv_file_url: Optional[str] = None
    completion_percent: int = 0
    age: Optional[int] = None
    gender: Optional[Gender] = None
    has_own_transport: Optional[bool] = None
    availability: Optional[Availability] = None
    immediate_availability: Optional[bool] = None

    class Config:
        from_attributes = True


class ApplicationWithCandidateResponse(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_posting_id: uuid.UUID
    cover_letter: Optional[str] = None
    status: ApplicationStatus
    seen_at: Optional[datetime.datetime] = None
    status_updated_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    candidate: Optional[CandidateSummary] = None

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/jobs/{id}/apply", response_model=ApplicationResponse)
async def apply_to_job(
    id: uuid.UUID,
    payload: ApplicationCreate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    # Retrieve CandidateProfile
    result_candidate = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    candidate = result_candidate.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    # Check job exists, is active and fue aprobada por un admin (barrera dura de moderación)
    result_job = await db.execute(
        select(JobPosting).where(
            JobPosting.id == id,
            JobPosting.status == "active",
            JobPosting.moderation_status == JobModerationStatus.approved,
        )
    )
    job = result_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not active or not found")

    # Check if already applied
    result_app = await db.execute(
        select(Application).where(Application.candidate_id == candidate.id, Application.job_posting_id == job.id)
    )
    if result_app.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already applied to this job")

    app = Application(
        candidate_id=candidate.id,
        job_posting_id=job.id,
        cover_letter=payload.cover_letter,
        status=ApplicationStatus.new
    )
    db.add(app)
    # Flush para tener app.id disponible como FK del registro de historial (mismo patrón que
    # jobs.py::create_job_posting con job.id antes de crear JobPostingSkill).
    await db.flush()

    await log_application_status_change(
        db, application_id=app.id, from_status=None, to_status=str(ApplicationStatus.new),
    )
    await log_candidate_activity(
        db, candidate_id=candidate.id, event_type="application",
        summary=f"Se postuló a '{job.title}'",
    )

    company_result = await db.execute(select(CompanyProfile).where(CompanyProfile.id == job.company_id))
    company = company_result.scalar_one_or_none()
    if company:
        await create_notification(
            db,
            user_id=company.user_id,
            type="application_new",
            title="Nueva postulación",
            body=f"Recibiste una nueva postulación en '{job.title}'.",
            link="/dashboard/company/postulaciones",
        )

    # Recordatorio de perfil incompleto — disparo contextual tras postularse, con throttle
    # para no repetir antes de REMINDER_MIN_INTERVAL_DAYS (ver services/profile_completion.py).
    completion = await compute_profile_completion_for_candidate(db, candidate)
    if should_send_completion_reminder(candidate, completion.percent):
        await create_notification(
            db,
            user_id=current_user.id,
            type="profile_incomplete",
            title="Tu perfil está incompleto",
            body=(
                f"Tu perfil está {completion.percent}% completo. Las empresas ven que te falta "
                "cargar datos — completalo para destacar frente a otros candidatos."
            ),
            link="/dashboard/candidate/perfil",
        )
        candidate.last_completion_reminder_at = datetime.datetime.now(datetime.timezone.utc)

    await db.commit()
    await db.refresh(app)
    return app

@router.get("/me/candidate/applications", response_model=List[ApplicationResponse])
async def my_applications(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    result_candidate = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    candidate = result_candidate.scalar_one_or_none()

    result = await db.execute(select(Application).where(Application.candidate_id == candidate.id))
    return result.scalars().all()


@router.get("/me/candidate/applications/{application_id}/history", response_model=List[ApplicationStatusHistoryResponse])
async def my_application_history(
    application_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    result_candidate = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    candidate = result_candidate.scalar_one_or_none()

    result_app = await db.execute(
        select(Application).where(Application.id == application_id, Application.candidate_id == candidate.id)
    )
    if not result_app.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Postulación no encontrada")

    result = await db.execute(
        select(ApplicationStatusHistory)
        .where(ApplicationStatusHistory.application_id == application_id)
        .order_by(ApplicationStatusHistory.created_at)
    )
    return result.scalars().all()


@router.get("/me/company/jobs/{id}/applications", response_model=List[ApplicationWithCandidateResponse])
async def list_job_applications(
    id: uuid.UUID,
    age_min: Optional[int] = Query(None, ge=0),
    age_max: Optional[int] = Query(None, ge=0),
    gender: Optional[Gender] = Query(None),
    has_own_transport: Optional[bool] = Query(None),
    availability: Optional[Availability] = Query(None),
    immediate_availability: Optional[bool] = Query(None),
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    result_job = await db.execute(select(JobPosting).where(JobPosting.id == id, JobPosting.company_id == company.id))
    job = result_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not owned by company")

    # Join con CandidateProfile en la query principal — antes hacía un SELECT extra por cada
    # postulación (N+1) sólo para traer el candidato; acá además habilita filtrar por los
    # campos demográficos sin fetch adicional.
    query = (
        select(Application, CandidateProfile)
        .join(CandidateProfile, Application.candidate_id == CandidateProfile.id)
        .where(Application.job_posting_id == job.id)
    )
    if gender is not None:
        query = query.where(CandidateProfile.gender == gender)
    if has_own_transport is not None:
        query = query.where(CandidateProfile.has_own_transport == has_own_transport)
    if availability is not None:
        query = query.where(CandidateProfile.availability == availability)
    if immediate_availability is not None:
        query = query.where(CandidateProfile.immediate_availability == immediate_availability)
    if age_min is not None:
        # edad >= age_min  <=>  nació en o antes de "hoy - age_min años"
        query = query.where(CandidateProfile.birth_date <= _birth_date_cutoff(age_min))
    if age_max is not None:
        # edad <= age_max  <=>  nació después de "hoy - (age_max+1) años"
        query = query.where(CandidateProfile.birth_date > _birth_date_cutoff(age_max + 1))

    result = await db.execute(query)
    rows = result.all()

    enriched = []
    for app, candidate in rows:
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


@router.get("/me/company/jobs/{id}/applications/stats", response_model=ApplicantStats)
async def job_applicant_stats(
    id: uuid.UUID,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    result_job = await db.execute(select(JobPosting).where(JobPosting.id == id, JobPosting.company_id == company.id))
    job = result_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not owned by company")

    candidate_ids = (
        await db.execute(select(Application.candidate_id).where(Application.job_posting_id == job.id))
    ).scalars().all()
    return await compute_applicant_stats(db, candidate_ids)


@router.get("/me/company/applications/stats", response_model=ApplicantStats)
async def company_applicant_stats(
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    candidate_ids = (
        await db.execute(
            select(Application.candidate_id)
            .join(JobPosting, Application.job_posting_id == JobPosting.id)
            .where(JobPosting.company_id == company.id)
        )
    ).scalars().all()
    return await compute_applicant_stats(db, candidate_ids)


async def build_candidate_full_profile(db: AsyncSession, candidate_id: uuid.UUID) -> CandidateFullProfile:
    """Arma el perfil completo de un candidato (experiencia, educación, skills, idiomas, %
    de perfil completo). Sin chequeo de acceso — cada llamador aplica el suyo (la empresa sólo
    si el candidato se postuló a una de sus búsquedas; el admin sin restricción)."""
    result_profile = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == candidate_id)
    )
    profile = result_profile.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")

    experiences_result = await db.execute(
        select(Experience).where(Experience.candidate_id == candidate_id)
    )
    experiences = [
        ExperienceForCompany(
            company_name=e.company_name,
            role_title=e.role_title,
            start_date=e.start_date,
            end_date=e.end_date,
            description=e.description,
        )
        for e in experiences_result.scalars().all()
    ]

    educations_result = await db.execute(
        select(Education).where(Education.candidate_id == candidate_id)
    )
    educations = [
        EducationForCompany(
            institution=e.institution,
            degree=e.degree,
            level=str(e.level),
            start_date=e.start_date,
            end_date=e.end_date,
            in_progress=e.in_progress,
        )
        for e in educations_result.scalars().all()
    ]

    skills_result = await db.execute(
        select(CandidateSkill, Skill)
        .join(Skill, CandidateSkill.skill_id == Skill.id)
        .where(CandidateSkill.candidate_id == candidate_id)
    )
    skills = [
        SkillForCompany(skill_name=skill.name, level=str(cs.level))
        for cs, skill in skills_result.all()
    ]

    languages_result = await db.execute(
        select(Language).where(Language.candidate_id == candidate_id)
    )
    languages = [
        LanguageForCompany(language_name=lang.language_name, level=str(lang.level))
        for lang in languages_result.scalars().all()
    ]

    completion = compute_profile_completion(
        profile,
        has_experience=len(experiences) > 0,
        has_education=len(educations) > 0,
        has_skills=len(skills) > 0,
        has_languages=len(languages) > 0,
    )

    return CandidateFullProfile(
        id=profile.id,
        first_name=profile.first_name,
        last_name=profile.last_name,
        phone=profile.phone,
        summary=profile.summary,
        cv_file_url=profile.cv_file_url,
        age=calculate_age(profile.birth_date),
        gender=profile.gender,
        has_own_transport=profile.has_own_transport,
        availability=profile.availability,
        immediate_availability=profile.immediate_availability,
        completion_percent=completion.percent,
        accepts_remote=profile.accepts_remote,
        accepts_hybrid=profile.accepts_hybrid,
        accepts_onsite=profile.accepts_onsite,
        experience=experiences,
        education=educations,
        skills=skills,
        languages=languages,
    )


@router.get("/me/company/candidates/{candidate_id}", response_model=CandidateFullProfile)
async def get_candidate_full_profile(
    candidate_id: uuid.UUID,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the full profile of a candidate only if they have applied
    to at least one of this company's job postings.
    """
    # Security check: candidate must have applied to one of company's jobs
    result = await db.execute(
        select(Application)
        .join(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(
            Application.candidate_id == candidate_id,
            JobPosting.company_id == company.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="No tenés acceso al perfil de este candidato")

    return await build_candidate_full_profile(db, candidate_id)


@router.patch("/me/company/applications/{app_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    app_id: uuid.UUID,
    payload: ApplicationStatusUpdate,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Application)
        .join(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(Application.id == app_id, JobPosting.company_id == company.id)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    previous_status = str(app.status)
    app.status = payload.status
    app.status_updated_at = datetime.datetime.now(datetime.timezone.utc)

    if payload.status != ApplicationStatus.new and not app.seen_at:
        app.seen_at = datetime.datetime.now(datetime.timezone.utc)

    await log_application_status_change(
        db, application_id=app.id, from_status=previous_status, to_status=str(payload.status),
        changed_by_user_id=company.user_id,
    )

    _CANDIDATE_NOTIF = {
        ApplicationStatus.in_process: (
            "application_in_process",
            "Avanzaste en una búsqueda",
            "Una empresa te puso en proceso de selección para '{job_title}'.",
        ),
        ApplicationStatus.contacted: (
            "application_contacted",
            "¡Una empresa quiere contactarte!",
            "Fuiste marcado como contactado en la búsqueda '{job_title}'.",
        ),
        ApplicationStatus.discarded: (
            "application_discarded",
            "Novedades en tu postulación",
            "Tu postulación a '{job_title}' no avanzó en esta oportunidad. ¡Seguí participando en otras búsquedas!",
        ),
    }
    notif = _CANDIDATE_NOTIF.get(payload.status)
    if notif:
        job_result = await db.execute(select(JobPosting).where(JobPosting.id == app.job_posting_id))
        job = job_result.scalar_one_or_none()
        candidate_result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.id == app.candidate_id)
        )
        candidate = candidate_result.scalar_one_or_none()
        if job and candidate:
            notif_type, notif_title, notif_body = notif
            await create_notification(
                db,
                user_id=candidate.user_id,
                type=notif_type,
                title=notif_title,
                body=notif_body.format(job_title=job.title),
                link="/dashboard/candidate/postulaciones",
            )

    await db.commit()
    await db.refresh(app)
    return app
