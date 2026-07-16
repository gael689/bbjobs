from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func
from typing import List, Optional
import datetime
import uuid
from app.api.deps import get_db, require_role, require_verified_company
from app.models.core import UserRole
from app.models.company import CompanyProfile
from app.models.candidate import EducationLevel
from app.models.job import JobPosting, JobPostingStatus, JobPostingSkill, JobModerationStatus
from app.schemas.job import (
    JobPostingResponse, JobPostingCompanyResponse, JobPostingCreate, JobPostingUpdate,
    JobPostingPublicResponse, PaginatedJobsResponse, JobSuggestion,
)
from app.services.notifications import notify_all_admins
from app.services.job_features import end_active_feature_for_job
from app.services.job_status import can_transition

router = APIRouter()

# Menor a mayor — usado para el filtro "nivel educativo mínimo" del listado público:
# un job sin requisito (None) es el más permisivo (rank -1, matchea cualquier filtro).
_EDUCATION_RANK = {
    EducationLevel.secundario: 0,
    EducationLevel.terciario: 1,
    EducationLevel.universitario: 2,
    EducationLevel.posgrado: 3,
}

@router.post("/me/company/jobs", response_model=JobPostingCompanyResponse)
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
        published_at=datetime.datetime.now(datetime.timezone.utc),
        duration_days=payload.duration_days,
        # Barrera dura: toda búsqueda nueva nace pendiente y no es visible en el portal
        # público hasta que un admin la apruebe (ver list_public_jobs/get_public_job/suggest_jobs).
        moderation_status=JobModerationStatus.pending_review,
    )
    job.expires_at = job.published_at + datetime.timedelta(days=job.duration_days)
    db.add(job)
    await db.flush()

    # Add skills
    for skill in payload.skills:
        js = JobPostingSkill(job_posting_id=job.id, skill_id=skill.skill_id, is_required=skill.is_required)
        db.add(js)

    await notify_all_admins(
        db,
        type="job_pending_review",
        title="Nueva búsqueda para revisar",
        body=f"'{job.title}' de {job.company_legal_name_snapshot} está esperando aprobación.",
        link="/dashboard/admin/busquedas",
    )

    await db.commit()
    await db.refresh(job)
    return job

@router.get("/me/company/jobs", response_model=List[JobPostingCompanyResponse])
async def list_my_job_postings(
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(JobPosting).where(JobPosting.company_id == company.id, JobPosting.deleted_at.is_(None))
    )
    return result.scalars().all()

@router.patch("/me/company/jobs/{id}", response_model=JobPostingCompanyResponse)
async def update_job_posting(
    id: uuid.UUID,
    payload: JobPostingUpdate,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(JobPosting).where(JobPosting.id == id, JobPosting.company_id == company.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found or not owned by company")

    # Handle status transitions
    if payload.status is not None:
        current_status = job.status
        new_status = payload.status

        # closed/expired son terminales
        if current_status in (JobPostingStatus.closed, JobPostingStatus.expired):
            raise HTTPException(status_code=400, detail="Job posting is closed or expired and cannot be changed")

        if not can_transition(current_status, new_status):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{current_status}' to '{new_status}'"
            )

        job.status = new_status
        if new_status == JobPostingStatus.closed:
            job.closed_at = datetime.datetime.now(datetime.timezone.utc)
            if job.is_featured:
                await end_active_feature_for_job(db, job)

    # Update basic fields
    update_data = payload.model_dump(exclude_unset=True, exclude={"status"})
    for key, value in update_data.items():
        if hasattr(job, key):
            setattr(job, key, value)

    # La empresa puede achicar (o volver a ampliar, dentro del máximo) el plazo de vencimiento —
    # se recalcula expires_at contra la fecha real de publicación, no contra "hoy".
    if "duration_days" in update_data and job.published_at:
        job.expires_at = job.published_at + datetime.timedelta(days=job.duration_days)

    await db.commit()
    await db.refresh(job)
    return job

@router.get("/jobs", response_model=PaginatedJobsResponse)
async def list_public_jobs(
    industry_id: Optional[uuid.UUID] = Query(None),
    zone_id: Optional[uuid.UUID] = Query(None),
    modality: Optional[str] = Query(None),
    contract_type_id: Optional[uuid.UUID] = Query(None),
    company_id: Optional[uuid.UUID] = Query(None, description="Búsquedas activas de una empresa (perfil público)"),
    min_education_level: Optional[EducationLevel] = Query(None),
    salary_min: Optional[float] = Query(None),
    salary_max: Optional[float] = Query(None),
    q: Optional[str] = Query(None, description="Buscar en título y descripción"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    query = select(JobPosting).where(
        JobPosting.status == JobPostingStatus.active,
        JobPosting.moderation_status == JobModerationStatus.approved,
        JobPosting.deleted_at.is_(None),
    )

    if industry_id:
        query = query.where(JobPosting.industry_id == industry_id)
    if zone_id:
        query = query.where(JobPosting.zone_id == zone_id)
    if modality:
        query = query.where(JobPosting.modality == modality)
    if contract_type_id:
        query = query.where(JobPosting.contract_type_id == contract_type_id)
    if company_id:
        query = query.where(JobPosting.company_id == company_id)
    if q:
        search_term = f"%{q}%"
        query = query.where(
            or_(
                JobPosting.title.ilike(search_term),
                JobPosting.description.ilike(search_term)
            )
        )
    # Solapamiento de rango: el job matchea si su rango de salario cruza el pedido.
    # Se filtra sobre el valor real aunque salary_visible sea False — buscar por rango
    # no es lo mismo que mostrar el número (ver JobPostingPublicResponse).
    if salary_min is not None:
        query = query.where(
            or_(JobPosting.salary_max.is_(None), JobPosting.salary_max >= salary_min)
        )
    if salary_max is not None:
        query = query.where(
            or_(JobPosting.salary_min.is_(None), JobPosting.salary_min <= salary_max)
        )

    if min_education_level is not None:
        # Igual criterio que salary_min: "empleos que pidan COMO MÍNIMO este nivel"
        # (filtra fuera los de menor exigencia), no "empleos que yo pueda cumplir".
        wanted_rank = _EDUCATION_RANK[min_education_level]
        matching_levels = [
            level for level, rank in _EDUCATION_RANK.items() if rank >= wanted_rank
        ]
        query = query.where(JobPosting.min_education_level.in_(matching_levels))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(JobPosting.is_featured.desc(), JobPosting.published_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = result.scalars().all()

    company_ids = {item.company_id for item in items if item.company_id}
    logo_map = {}
    if company_ids:
        logo_result = await db.execute(
            select(CompanyProfile.id, CompanyProfile.logo_url).where(CompanyProfile.id.in_(company_ids))
        )
        logo_map = dict(logo_result.all())
    for item in items:
        item.logo_url = logo_map.get(item.company_id)

    return PaginatedJobsResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/jobs/suggest", response_model=List[JobSuggestion])
async def suggest_jobs(
    q: str = Query(..., min_length=1),
    limit: int = Query(8, le=20),
    db: AsyncSession = Depends(get_db),
):
    search_term = f"%{q}%"

    title_result = await db.execute(
        select(JobPosting.title)
        .where(
            JobPosting.status == JobPostingStatus.active,
            JobPosting.moderation_status == JobModerationStatus.approved,
            JobPosting.deleted_at.is_(None),
            JobPosting.title.ilike(search_term),
        )
        .distinct()
        .limit(limit)
    )
    company_result = await db.execute(
        select(JobPosting.company_legal_name_snapshot)
        .where(
            JobPosting.status == JobPostingStatus.active,
            JobPosting.moderation_status == JobModerationStatus.approved,
            JobPosting.deleted_at.is_(None),
            JobPosting.company_legal_name_snapshot.ilike(search_term),
        )
        .distinct()
        .limit(limit)
    )

    suggestions = [JobSuggestion(label=t, type="title") for t in title_result.scalars().all()]
    suggestions += [JobSuggestion(label=c, type="company") for c in company_result.scalars().all()]
    return suggestions[:limit]


@router.get("/jobs/{id}", response_model=JobPostingPublicResponse)
async def get_public_job(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(JobPosting).where(
            JobPosting.id == id,
            JobPosting.status == JobPostingStatus.active,
            JobPosting.moderation_status == JobModerationStatus.approved,
            JobPosting.deleted_at.is_(None),
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found")

    job.logo_url = None
    if job.company_id:
        logo_result = await db.execute(
            select(CompanyProfile.logo_url).where(CompanyProfile.id == job.company_id)
        )
        job.logo_url = logo_result.scalar_one_or_none()

    return job
