from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.deps import get_db, require_role, get_current_user
from app.models.core import User, UserRole
from app.models.company import CompanyProfile, VerificationStatus, CompanyVerificationDocument
from app.schemas.company import CompanyProfileResponse, CompanyProfileUpdate, VerificationRequestModel
from app.integrations.r2 import upload_file_to_r2
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
        
    if profile.verification_status != VerificationStatus.pending:
        raise HTTPException(status_code=400, detail="Cannot request verification from this status")
        
    profile.verification_notes = payload.notes
    await db.commit()
    await db.refresh(profile)
    return profile

@router.post("/me/company/logo", response_model=CompanyProfileResponse)
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.company])),
    db: AsyncSession = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only images are allowed")
        
    content = await file.read()
    if len(content) > 1 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 1MB")
        
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    
    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    object_name = f"logos/{profile.id}/{file_id}.{ext}"
    
    url = upload_file_to_r2(content, object_name, file.content_type)
    
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
        raise HTTPException(status_code=413, detail="File too large. Max 5MB")
        
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    
    file_id = str(uuid.uuid4())
    object_name = f"verification_docs/{profile.id}/{file_id}_{file.filename}"
    
    url = upload_file_to_r2(content, object_name, file.content_type)
    
    doc = CompanyVerificationDocument(
        company_id=profile.id,
        file_url=url,
        file_name=file.filename,
        mime_type=file.content_type
    )
    db.add(doc)
    await db.commit()
    
    return {"status": "ok", "url": url}

