from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid
import datetime
from app.api.deps import get_db, require_role, require_verified_company, get_current_user
from app.models.core import UserRole, User
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile
from app.models.job import JobPosting, Application, ApplicationStatus
from app.schemas.application import ApplicationCreate, ApplicationResponse, ApplicationStatusUpdate

router = APIRouter()

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

@router.get("/me/company/jobs/{id}/applications", response_model=List[ApplicationResponse])
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
    return result.scalars().all()

@router.patch("/me/company/applications/{app_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    app_id: uuid.UUID,
    payload: ApplicationStatusUpdate,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    # Verify the application belongs to a job owned by the company
    # In a real app with proper RLS, the DB query might automatically filter this, 
    # but doing it explicitly here is safer.
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
        
    await db.commit()
    await db.refresh(app)
    return app
