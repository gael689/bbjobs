from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.deps import get_db, require_role, get_current_user
from app.models.core import User, UserRole
from app.models.company import CompanyProfile, VerificationStatus
from app.schemas.company import CompanyProfileResponse, CompanyProfileUpdate, VerificationRequestModel

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
        # We only allow requesting if it's pending (or maybe rejected, but keep it simple)
        raise HTTPException(status_code=400, detail="Cannot request verification from this status")
        
    profile.verification_notes = payload.notes
    await db.commit()
    await db.refresh(profile)
    return profile
