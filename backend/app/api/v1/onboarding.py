"""
Onboarding JIT (just-in-time): el User local se crea acá, no en el signup de Clerk.
Esto evita el problema de `users.role` NOT NULL sin rol conocido — Clerk sólo garantiza
identidad; el rol y los datos de negocio se completan en este paso (ver plan §2 y §5).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_db, get_clerk_identity, ClerkIdentity
from app.core.limiter import limiter
from app.models.core import User, UserRole
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile, VerificationStatus
from app.models.payment import Plan, Subscription
from app.schemas.onboarding import CandidateOnboarding, CompanyOnboarding, OnboardingResponse
from app.integrations.clerk_client import get_clerk_user_email, set_public_metadata
from app.services.notifications import notify_all_admins

router = APIRouter()


async def _reject_if_already_onboarded(db: AsyncSession, clerk_user_id: str) -> None:
    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"code": "already_onboarded", "message": "Ya completaste el registro"},
        )


async def _reject_if_email_taken(db: AsyncSession, email: str) -> None:
    """
    Puede pasar que la misma persona cree dos identidades distintas en Clerk con el
    mismo email (ej. password + Google sin account linking activo). La segunda
    identidad pasa `_reject_if_already_onboarded` (clerk_user_id nuevo) pero no puede
    tener un User local con un email que ya es de otra cuenta. Se devuelve un código
    distinguible para que el frontend cierre esa sesión huérfana en vez de dejarla
    trabada en el form (ver plan de migración a Clerk, workstream de onboarding).
    """
    existing_email = await db.execute(select(User).where(User.email == email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={
                "code": "email_collision",
                "message": "Ya existe una cuenta con ese email. Iniciá sesión con el método original.",
            },
        )


@router.post("/me/onboarding/candidate", response_model=OnboardingResponse)
@limiter.limit("10/minute")
async def onboarding_candidate(
    request: Request,
    payload: CandidateOnboarding,
    identity: ClerkIdentity = Depends(get_clerk_identity),
    db: AsyncSession = Depends(get_db),
):
    await _reject_if_already_onboarded(db, identity.clerk_user_id)

    email = get_clerk_user_email(identity.clerk_user_id)
    await _reject_if_email_taken(db, email)

    user = User(
        email=email,
        clerk_user_id=identity.clerk_user_id,
        role=UserRole.candidate,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()

    db.add(CandidateProfile(
        user_id=user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
    ))

    await db.commit()

    try:
        set_public_metadata(identity.clerk_user_id, {"role": "candidate"})
    except Exception:
        pass  # espejo de conveniencia — no crítico si falla

    return OnboardingResponse(role="candidate")


@router.post("/me/onboarding/company", response_model=OnboardingResponse)
@limiter.limit("10/minute")
async def onboarding_company(
    request: Request,
    payload: CompanyOnboarding,
    identity: ClerkIdentity = Depends(get_clerk_identity),
    db: AsyncSession = Depends(get_db),
):
    await _reject_if_already_onboarded(db, identity.clerk_user_id)

    # Anti-duplicación de empresa (plan §9.2): CUIT único + bloqueo de evasión de suspensión.
    result_cuit = await db.execute(select(CompanyProfile).where(CompanyProfile.cuit == payload.cuit))
    existing_company = result_cuit.scalar_one_or_none()
    if existing_company:
        if str(existing_company.verification_status) in (
            str(VerificationStatus.suspended), str(VerificationStatus.rejected)
        ):
            raise HTTPException(
                status_code=409,
                detail="Esta empresa fue suspendida o rechazada y no puede volver a registrarse",
            )
        raise HTTPException(status_code=409, detail="CUIT already registered")

    email = get_clerk_user_email(identity.clerk_user_id)
    await _reject_if_email_taken(db, email)

    user = User(
        email=email,
        clerk_user_id=identity.clerk_user_id,
        role=UserRole.company,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()

    company = CompanyProfile(
        user_id=user.id,
        legal_name=payload.legal_name,
        cuit=payload.cuit,
        industry_id=payload.industry_id,
        province=payload.province,
        city=payload.city,
        employee_count=payload.employee_count,
        responsible_full_name=payload.responsible_full_name,
        responsible_phone=payload.responsible_phone,
        responsible_email=payload.responsible_email,
        responsible_position=payload.responsible_position,
        description=payload.description,
    )
    db.add(company)
    await db.flush()

    plan_result = await db.execute(select(Plan).where(Plan.code == "free"))
    plan = plan_result.scalar_one_or_none()
    if plan:
        db.add(Subscription(company_id=company.id, plan_id=plan.id))

    await notify_all_admins(
        db,
        type="admin_company_pending",
        title="Nueva empresa pendiente",
        body=f"'{company.legal_name}' se registró y espera verificación.",
        link="/dashboard/admin/empresas",
    )

    await db.commit()

    try:
        set_public_metadata(identity.clerk_user_id, {"role": "company"})
    except Exception:
        pass

    return OnboardingResponse(role="company")
