from dataclasses import dataclass
import structlog
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import AsyncSessionLocal
from app.models.core import User, UserRole
from app.models.company import CompanyProfile, VerificationStatus
from app.db.rls import set_rls_context
from app.integrations.clerk_client import verify_session_token, ClerkTokenError

logger = structlog.get_logger("app.auth")

# auto_error=False: con el comportamiento por defecto un pedido sin header sale como 401/403
# genérico sin dejar rastro. Acá se responde a mano para poder loguear el motivo.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


@dataclass
class ClerkIdentity:
    """Identidad verificada por Clerk, sin requerir todavía un User local (pre-onboarding)."""
    clerk_user_id: str


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_clerk_identity(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> ClerkIdentity:
    # El motivo del rechazo se loguea (nunca el token): antes todos los 401 se veían igual y
    # no había manera de distinguir un token vencido de un origen no autorizado.
    if credentials is None:
        logger.warning("auth_rejected", reason="no_authorization_header",
                       method=request.method, path=request.url.path)
        raise _unauthorized()
    try:
        payload = await verify_session_token(credentials.credentials)
    except ClerkTokenError as e:
        logger.warning("auth_rejected", reason=e.reason, transient=e.transient,
                       method=request.method, path=request.url.path)
        if e.transient:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No pudimos verificar tu sesión en este momento. Probá de nuevo en unos segundos.",
            )
        raise _unauthorized()
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        logger.warning("auth_rejected", reason="token_without_sub",
                       method=request.method, path=request.url.path)
        raise _unauthorized()
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

async def require_company(
    current_user: User = Depends(require_role([UserRole.company])),
    db: AsyncSession = Depends(get_db)
) -> CompanyProfile:
    """El perfil de la empresa, sin exigir verificación. Usar para lo que una empresa puede
    hacer aunque Talency todavía no la haya comprobado: publicar y editar sus propias
    búsquedas. Talency modera igual (moderation_status), así que nada sale al portal sin que
    alguien lo revise — ver MODIFICACIONES-EUGENIA-2026-08-14-PLAN.md, A2. Para lo que sí
    requiere estar verificada (ver postulantes, CV, perfiles, pagos), usar
    require_verified_company."""
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == current_user.id))
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(status_code=404, detail="Company profile not found")

    return company


async def require_verified_company(
    company: CompanyProfile = Depends(require_company),
) -> CompanyProfile:
    if company.verification_status != VerificationStatus.verified:
        raise HTTPException(status_code=403, detail="Company is not verified")

    return company
