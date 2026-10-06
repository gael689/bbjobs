from datetime import date

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional
import uuid

from app.api.deps import get_db, get_clerk_identity, get_current_user, ClerkIdentity
from app.core.legal import LEGAL_VERSION, LEGAL_VIGENTE_DESDE
from app.models.core import User, UserRole
from app.models.company import CompanyProfile, VerificationStatus
from app.services.legal import pending_acceptance, record_acceptance

router = APIRouter()


class LegalStatus(BaseModel):
    version: str
    vigente_desde: date
    pendiente: bool


@router.get("/me/legal", response_model=LegalStatus)
async def get_legal_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return LegalStatus(version=LEGAL_VERSION, vigente_desde=LEGAL_VIGENTE_DESDE,
                       pendiente=await pending_acceptance(db, user))


@router.post("/me/legal/accept", response_model=LegalStatus)
async def accept_legal(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await record_acceptance(db, user, request)
    await db.commit()
    return LegalStatus(version=LEGAL_VERSION, vigente_desde=LEGAL_VIGENTE_DESDE, pendiente=False)


class MeResponse(BaseModel):
    onboarding_complete: bool
    user_id: Optional[uuid.UUID] = None
    role: Optional[str] = None
    email: Optional[str] = None
    is_verified: Optional[bool] = None


@router.get("/me", response_model=MeResponse)
async def get_me(
    identity: ClerkIdentity = Depends(get_clerk_identity),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.clerk_user_id == identity.clerk_user_id))
    user = result.scalar_one_or_none()
    if not user:
        return MeResponse(onboarding_complete=False)

    is_verified = None
    if user.role == UserRole.company:
        company_result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
        company = company_result.scalar_one_or_none()
        if company:
            is_verified = company.verification_status == VerificationStatus.verified

    return MeResponse(
        onboarding_complete=True,
        user_id=user.id,
        role=str(user.role),
        email=user.email,
        is_verified=is_verified,
    )
