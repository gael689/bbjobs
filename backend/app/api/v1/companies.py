from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.deps import get_db, require_role, get_current_user
from app.models.core import User, UserRole
from app.models.company import CompanyProfile, VerificationStatus, CompanyVerificationDocument
from app.schemas.company import CompanyProfileResponse, CompanyProfileUpdate, VerificationRequestModel
from app.integrations.cloudinary_client import upload_image, upload_pdf
from app.services.notifications import notify_all_admins
import uuid

router = APIRouter()

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
