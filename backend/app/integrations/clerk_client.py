"""
Wrapper sobre el SDK oficial de Clerk (clerk-backend-api).

- `verify_session_token`: verificación networkless (después del primer fetch) del session
  token que manda el frontend en el header Authorization. Usa el JWKS cacheado en memoria
  por el propio SDK (con reintento automático ante rotación de clave).
- Helpers de Backend API: alta/baja de usuarios y metadata pública — usados en onboarding,
  alta de admin, y borrado de cuenta (Ley 25.326).
"""
from functools import lru_cache
from typing import Any, Mapping

from clerk_backend_api import Clerk
from clerk_backend_api.security import (
    verify_token_async, TokenVerificationError, TokenVerificationErrorReason,
)
from clerk_backend_api.security.types import VerifyTokenOptions

from app.core.config import settings


# Motivos por los que NO es culpa del token sino de no poder consultar a Clerk (JWKS caído,
# sin red, etc.). El pedido no es "no autorizado": es un problema nuestro o de Clerk, y
# responderle 401 hace que el frontend crea que la sesión venció y le pida loguearse de nuevo.
_TRANSIENT_REASONS = {
    TokenVerificationErrorReason.JWK_FAILED_TO_LOAD,
    TokenVerificationErrorReason.JWK_REMOTE_INVALID,
    TokenVerificationErrorReason.SERVER_ERROR,
}


class ClerkTokenError(Exception):
    """El session token de Clerk no pudo verificarse (firma, expiración, azp, etc.).

    `reason` es el código de Clerk (p. ej. "token-expired", "token-invalid-authorized-parties")
    para poder loguearlo: sin él todos los rechazos se ven igual y no hay forma de saber si el
    problema es un token vencido, un origen no autorizado o una clave de otra instancia.
    `transient` marca los fallos que no son del token (ver _TRANSIENT_REASONS)."""

    def __init__(self, message: str, *, reason: str = "unknown", transient: bool = False):
        super().__init__(message)
        self.reason = reason
        self.transient = transient


async def verify_session_token(token: str) -> dict[str, Any]:
    # Async a propósito: la versión sincrónica, llamada desde un `async def`, bloquea el event
    # loop cada vez que hay que pedir el JWKS a Clerk (cada 5 min y tras cada deploy).
    try:
        return await verify_token_async(
            token,
            VerifyTokenOptions(
                secret_key=settings.CLERK_SECRET_KEY,
                authorized_parties=settings.clerk_authorized_parties,
            ),
        )
    except TokenVerificationError as e:
        raise ClerkTokenError(
            str(e), reason=e.reason.value[0], transient=e.reason in _TRANSIENT_REASONS,
        ) from e


@lru_cache
def get_clerk_client() -> Clerk:
    return Clerk(bearer_auth=settings.CLERK_SECRET_KEY)


def create_clerk_user(
    *,
    email: str,
    password: str,
    first_name: str | None = None,
    last_name: str | None = None,
    public_metadata: Mapping[str, Any] | None = None,
) -> str:
    """Crea un usuario directamente en Clerk (usado para altas de admin). Devuelve el clerk_user_id."""
    client = get_clerk_client()
    user = client.users.create(
        email_address=[email],
        password=password,
        first_name=first_name,
        last_name=last_name,
        public_metadata=public_metadata,
        skip_password_checks=True,
    )
    return user.id


def delete_clerk_user(clerk_user_id: str) -> None:
    client = get_clerk_client()
    client.users.delete(user_id=clerk_user_id)


def set_public_metadata(clerk_user_id: str, metadata: Mapping[str, Any]) -> None:
    client = get_clerk_client()
    client.users.update_metadata(user_id=clerk_user_id, public_metadata=metadata)


def get_clerk_user_email(clerk_user_id: str) -> str:
    """El session token no trae el email por default — se resuelve vía Backend API
    cuando hace falta persistirlo localmente (ej. onboarding)."""
    client = get_clerk_client()
    user = client.users.get(user_id=clerk_user_id)
    for addr in user.email_addresses:
        if addr.id == user.primary_email_address_id:
            return addr.email_address
    if user.email_addresses:
        return user.email_addresses[0].email_address
    raise ClerkTokenError(f"El usuario de Clerk {clerk_user_id} no tiene email registrado")
