from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from app.api.deps import get_db, get_current_user
from app.schemas.auth import CandidateRegister, CompanyRegister, UserLogin, Token, UserResponse
from app.models.core import User, UserRole
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile
from app.models.payment import Plan, Subscription
from app.core.security import get_password_hash, verify_password, create_access_token
from app.services.email import send_email_verification

router = APIRouter()

@router.post("/register/candidate", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register_candidate(payload: CandidateRegister, db: AsyncSession = Depends(get_db)):
    # Check existing user
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=UserRole.candidate
    )
    db.add(user)
    await db.flush()
    
    profile = CandidateProfile(
        user_id=user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone
    )
    db.add(profile)
    
    # Generar token y enviar email (simplificado)
    fake_token = str(uuid.uuid4())
    await send_email_verification(user.email, fake_token)
    
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/register/company", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def register_company(payload: CompanyRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Validar CUIT único (simplificado, se debe verificar bien en DB)
    result_cuit = await db.execute(select(CompanyProfile).where(CompanyProfile.cuit == payload.cuit))
    if result_cuit.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="CUIT already registered")
        
    user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=UserRole.company
    )
    db.add(user)
    await db.flush()
    
    profile = CompanyProfile(
        user_id=user.id,
        legal_name=payload.legal_name,
        cuit=payload.cuit,
        industry_id=payload.industry_id,
        responsible_full_name=payload.responsible_full_name,
        responsible_phone=payload.responsible_phone,
        responsible_email=payload.responsible_email
    )
    db.add(profile)
    
    # Asignar Plan Free implícito
    result_plan = await db.execute(select(Plan).where(Plan.code == "free"))
    plan = result_plan.scalar_one_or_none()
    if plan:
        subscription = Subscription(company_id=profile.id, plan_id=plan.id)
        db.add(subscription)
    
    fake_token = str(uuid.uuid4())
    await send_email_verification(user.email, fake_token)
    
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(payload: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # Refresh token as cookie (Simplificado, idealmente persiste en DB)
    refresh_token = str(uuid.uuid4()) # To be stored in RefreshToken table
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/api/v1/auth/refresh"
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(response: Response, current_user: User = Depends(get_current_user)):
    # TODO: Invalidate refresh token in DB
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")
    return {"status": "ok"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
