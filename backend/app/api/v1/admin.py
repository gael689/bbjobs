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
from app.models.candidate import CandidateProfile
from app.models.job import JobPosting, Application, JobPostingStatus
from app.models.alerts import AuditLog
from app.models.catalogs import Skill, SkillStatus
from app.services.notifications import create_notification
from app.integrations.clerk_client import create_clerk_user
from pydantic import BaseModel

router = APIRouter()


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

    class Config:
        from_attributes = True


class JobAdminResponse(BaseModel):
    id: uuid.UUID
    title: str
    status: JobPostingStatus
    company_legal_name_snapshot: str
    published_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DashboardMetrics(BaseModel):
    total_companies: int
    pending_companies: int
    verified_companies: int
    total_candidates: int
    total_jobs: int
    total_applications: int


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
    total_applications = (await db.execute(select(func.count()).select_from(Application))).scalar()

    return DashboardMetrics(
        total_companies=total_companies or 0,
        pending_companies=pending_companies or 0,
        verified_companies=verified_companies or 0,
        total_candidates=total_candidates or 0,
        total_jobs=total_jobs or 0,
        total_applications=total_applications or 0,
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
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CandidateProfile))
    return result.scalars().all()


@router.get("/admin/jobs", response_model=List[JobAdminResponse])
async def list_jobs(
    status: Optional[JobPostingStatus] = Query(None),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    q = select(JobPosting)
    if status:
        q = q.where(JobPosting.status == status)
    q = q.order_by(desc(JobPosting.published_at))
    result = await db.execute(q)
    return result.scalars().all()


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
