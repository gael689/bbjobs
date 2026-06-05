from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import datetime
import uuid
from app.api.deps import get_db, require_role, require_verified_company
from app.models.core import UserRole
from app.models.company import CompanyProfile
from app.models.job import JobPosting, JobPostingStatus, JobPostingSkill
from app.schemas.job import JobPostingResponse, JobPostingCreate, JobPostingUpdate, JobPostingPublicResponse

router = APIRouter()

@router.post("/me/company/jobs", response_model=JobPostingResponse)
async def create_job_posting(
    payload: JobPostingCreate,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    job = JobPosting(
        company_id=company.id,
        company_legal_name_snapshot=company.legal_name,
        title=payload.title,
        description=payload.description,
        requirements=payload.requirements,
        industry_id=payload.industry_id,
        zone_id=payload.zone_id,
        contract_type_id=payload.contract_type_id,
        modality=payload.modality,
        min_experience_years=payload.min_experience_years,
        min_education_level=payload.min_education_level,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        salary_currency=payload.salary_currency,
        salary_visible=payload.salary_visible,
        benefits=payload.benefits,
        status=JobPostingStatus.active,
        published_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(job)
    await db.flush()
    
    # Add skills
    for skill in payload.skills:
        js = JobPostingSkill(job_posting_id=job.id, skill_id=skill.skill_id, is_required=skill.is_required)
        db.add(js)
        
    await db.commit()
    await db.refresh(job)
    return job

@router.get("/me/company/jobs", response_model=List[JobPostingResponse])
async def list_my_job_postings(
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(JobPosting).where(JobPosting.company_id == company.id))
    return result.scalars().all()

@router.get("/jobs", response_model=List[JobPostingPublicResponse])
async def list_public_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JobPosting).where(JobPosting.status == JobPostingStatus.active))
    return result.scalars().all()

@router.get("/jobs/{id}", response_model=JobPostingPublicResponse)
async def get_public_job(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(JobPosting).where(JobPosting.id == id, JobPosting.status == JobPostingStatus.active)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found")
    return job
