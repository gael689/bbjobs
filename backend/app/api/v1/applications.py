from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
import uuid
import datetime
from pydantic import BaseModel
from app.api.deps import get_db, require_role, require_verified_company, get_current_user
from app.models.core import UserRole, User
from app.models.candidate import CandidateProfile, Experience, Education, CandidateSkill, Language
from app.models.company import CompanyProfile
from app.models.job import JobPosting, Application, ApplicationStatus
from app.models.catalogs import Skill
from app.schemas.application import ApplicationCreate, ApplicationResponse, ApplicationStatusUpdate
from app.schemas.candidate import (
    CandidateFullProfile, ExperienceForCompany, EducationForCompany,
    SkillForCompany, LanguageForCompany,
)
from app.services.notifications import create_notification

router = APIRouter()


# ── Inline schema for enriched application view ───────────────────────────────

class CandidateSummary(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    cv_file_url: Optional[str] = None

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

    # Check job exists and is active
    result_job = await db.execute(select(JobPosting).where(JobPosting.id == id, JobPosting.status == "active"))
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

@router.get("/me/company/jobs/{id}/applications", response_model=List[ApplicationWithCandidateResponse])
async def list_job_applications(
    id: uuid.UUID,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    result_job = await db.execute(select(JobPosting).where(JobPosting.id == id, JobPosting.company_id == company.id))
    job = result_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not owned by company")

    result = await db.execute(select(Application).where(Application.job_posting_id == job.id))
    applications = result.scalars().all()

    # Enrich with candidate profile data
    enriched = []
    for app in applications:
        candidate_result = await db.execute(
            select(CandidateProfile).where(CandidateProfile.id == app.candidate_id)
        )
        candidate = candidate_result.scalar_one_or_none()

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
                ) if candidate else None,
            )
        )

    return enriched

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

    return CandidateFullProfile(
        id=profile.id,
        first_name=profile.first_name,
        last_name=profile.last_name,
        phone=profile.phone,
        summary=profile.summary,
        cv_file_url=profile.cv_file_url,
        accepts_remote=profile.accepts_remote,
        accepts_hybrid=profile.accepts_hybrid,
        accepts_onsite=profile.accepts_onsite,
        experience=experiences,
        education=educations,
        skills=skills,
        languages=languages,
    )


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

    app.status = payload.status
    app.status_updated_at = datetime.datetime.now(datetime.timezone.utc)

    if payload.status != ApplicationStatus.new and not app.seen_at:
        app.seen_at = datetime.datetime.now(datetime.timezone.utc)

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
