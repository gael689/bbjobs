from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.deps import get_db, require_role
from app.models.core import User, UserRole
from app.models.candidate import CandidateProfile
from app.schemas.candidate import CandidateProfileResponse, CandidateProfileUpdate
from app.integrations.r2 import upload_file_to_r2
import uuid
import datetime

router = APIRouter()

@router.get("/me/candidate/profile", response_model=CandidateProfileResponse)
async def get_my_candidate_profile(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.patch("/me/candidate/profile", response_model=CandidateProfileResponse)
async def update_my_candidate_profile(
    payload: CandidateProfileUpdate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
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

@router.post("/me/candidate/cv", response_model=CandidateProfileResponse)
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
        
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 5MB")
        
    result = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    profile = result.scalar_one_or_none()
    
    file_id = str(uuid.uuid4())
    object_name = f"cvs/{profile.id}/{file_id}.pdf"
    
    url = upload_file_to_r2(content, object_name, "application/pdf")
    
    profile.cv_file_url = url
    profile.cv_uploaded_at = datetime.datetime.now(datetime.timezone.utc)
    
    await db.commit()
    await db.refresh(profile)
    return profile

