from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from app.api.deps import get_db, require_role, get_current_user
from app.models.core import User, UserRole
from app.models.company import CompanyProfile, VerificationStatus, CompanyVerificationDocument
from app.schemas.company import CompanyProfileResponse, CompanyProfileUpdate, VerificationRequestModel
from app.integrations.cloudinary_client import upload_image, upload_pdf
from app.services.notifications import notify_all_admins
import uuid

router = APIRouter()


class VerifiedCompanyResponse(BaseModel):
    id: uuid.UUID
    legal_name: str
    logo_url: Optional[str] = None
    website: Optional[str] = None

    class Config:
        from_attributes = True


class CompanyPublicProfileResponse(BaseModel):
    id: uuid.UUID
    legal_name: str
    logo_url: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    industry_id: uuid.UUID
    province: Optional[str] = None
    city: Optional[str] = None
    employee_count: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/companies/verified", response_model=List[VerifiedCompanyResponse])
async def list_verified_companies(
    with_logo_only: bool = Query(True, description="Sólo empresas con logo cargado"),
    limit: int = Query(24, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Público — usado en /empresas para mostrar 'empresas que confían en nosotros'.
    Sólo expone nombre/logo/sitio, nunca CUIT ni datos de contacto."""
    query = select(CompanyProfile).where(CompanyProfile.verification_status == VerificationStatus.verified)
    if with_logo_only:
        query = query.where(CompanyProfile.logo_url.is_not(None))
    query = query.order_by(CompanyProfile.verified_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/companies/{company_id}", response_model=CompanyPublicProfileResponse)
async def get_company_public_profile(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Perfil público de empresa (usado desde /empresas/{id} y desde los avisos publicados
    por esa empresa). Nunca expone CUIT ni datos del responsable — sólo lo que la propia
    empresa carga para presentarse (descripción, sitio, rubro, ubicación).
    Empresas no verificadas devuelven 404: no tiene sentido exponer un perfil que todavía
    no pasó la revisión de Talency (ni exhibir un rechazo/suspensión públicamente)."""
    result = await db.execute(
        select(CompanyProfile).where(
            CompanyProfile.id == company_id,
            CompanyProfile.verification_status == VerificationStatus.verified,
        )
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company

@router.get("/me/company/profile", response_model=CompanyProfileResponse)
async def get_my_company_profile(
    current_user: User = Depends(require_role([UserRole.company])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.patch("/me/company/profile", response_model=CompanyProfileResponse)
async def update_my_company_profile(
    payload: CompanyProfileUpdate,
    current_user: User = Depends(require_role([UserRole.company])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "website" in update_data and update_data["website"] is not None:
        update_data["website"] = str(update_data["website"])
    for key, value in update_data.items():
        if hasattr(profile, key):
            setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)
    return profile

@router.post("/me/company/verification/request", response_model=CompanyProfileResponse)
async def request_verification(
    payload: VerificationRequestModel,
    current_user: User = Depends(require_role([UserRole.company])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if profile.verification_status == VerificationStatus.verified:
        raise HTTPException(status_code=400, detail="Company is already verified")

    was_rejected = profile.verification_status == VerificationStatus.rejected
    profile.verification_status = VerificationStatus.pending
    profile.verification_notes = payload.notes

    if was_rejected:
        await notify_all_admins(
            db,
            type="admin_company_reapplied",
            title="Empresa volvió a solicitar verificación",
            body=f"'{profile.legal_name}' editó sus datos y reaplicó tras un rechazo.",
            link="/dashboard/admin/empresas",
        )

    await db.commit()
    await db.refresh(profile)
    return profile

@router.post("/me/company/logo", response_model=CompanyProfileResponse)
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.company])),
    db: AsyncSession = Depends(get_db)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo muy grande. Máximo 2MB")

    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        url = upload_image(
            content,
            folder="bbjobs/logos",
            public_id=str(profile.id),
            content_type=file.content_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    profile.logo_url = url
    await db.commit()
    await db.refresh(profile)
    return profile

@router.post("/me/company/verification/documents")
async def upload_verification_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.company])),
    db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo muy grande. Máximo 5MB")

    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    file_id = str(uuid.uuid4())
    is_pdf = file.content_type == "application/pdf"

    try:
        if is_pdf:
            url = upload_pdf(
                content,
                folder="bbjobs/verification_docs",
                public_id=f"{profile.id}/{file_id}",
                content_type=file.content_type,
            )
        else:
            url = upload_image(
                content,
                folder="bbjobs/verification_docs",
                public_id=f"{profile.id}/{file_id}",
                content_type=file.content_type,
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    doc = CompanyVerificationDocument(
        company_id=profile.id,
        file_url=url,
        file_name=file.filename,
        mime_type=file.content_type,
    )
    db.add(doc)
    await db.commit()

    return {"status": "ok", "url": url}
