from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import AsyncSessionLocal
from app.models.core import User, UserRole
from app.models.company import CompanyProfile, VerificationStatus
from app.db.rls import set_rls_context
from app.integrations.clerk_client import verify_session_token, ClerkTokenError

bearer_scheme = HTTPBearer()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@dataclass
class ClerkIdentity:
    """Identidad verificada por Clerk, sin requerir todavía un User local (pre-onboarding)."""
    clerk_user_id: str


async def get_clerk_identity(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ClerkIdentity:
    try:
        payload = verify_session_token(credentials.credentials)
    except ClerkTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    return ClerkIdentity(clerk_user_id=clerk_user_id)


async def get_current_user(
    identity: ClerkIdentity = Depends(get_clerk_identity),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Requiere que exista un User local (onboarding ya completado). Clerk maneja la
    autenticación; los roles y permisos de negocio los decide nuestra DB (ver plan §8)."""
    result = await db.execute(select(User).where(User.clerk_user_id == identity.clerk_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="onboarding_required",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Setup RLS context for the session
    await set_rls_context(db, user.id, str(user.role))
    return user


def require_role(allowed_roles: list[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

async def require_verified_company(
    current_user: User = Depends(require_role([UserRole.company])),
    db: AsyncSession = Depends(get_db)
) -> CompanyProfile:
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(status_code=404, detail="Company profile not found")

    if company.verification_status != VerificationStatus.verified:
        raise HTTPException(status_code=403, detail="Company is not verified")

    return company
