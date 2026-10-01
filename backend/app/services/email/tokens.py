"""Links de baja firmados.

El token es `base64url("<user_id>:<categoría>") + "." + base64url(HMAC-SHA256)`, firmado con
`SECRET_KEY`. **Sin columna en la base y sin vencimiento**: una baja no debería caducar nunca
(el mail más viejo que alguien conserve tiene que seguir funcionando), y firmarlo evita tener
que guardar y buscar un token por cada mail enviado.

El prefijo de dominio (`bbjobs-unsub-v1`) impide que la misma firma sirva para otra cosa si
alguna vez se firma algo más con `SECRET_KEY`.
"""
import base64
import hashlib
import hmac
import uuid

from app.core.config import settings
from app.models.email import EmailCategory

_DOMAIN = b"bbjobs-unsub-v1:"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: bytes) -> bytes:
    return hmac.new(settings.SECRET_KEY.encode(), _DOMAIN + payload, hashlib.sha256).digest()


def make_unsubscribe_token(user_id: uuid.UUID, category: EmailCategory | str) -> str:
    category = EmailCategory(category).value
    payload = f"{user_id}:{category}".encode()
    return f"{_b64(payload)}.{_b64(_sign(payload))}"


def verify_unsubscribe_token(token: str) -> tuple[uuid.UUID, EmailCategory] | None:
    """Devuelve (user_id, categoría) si la firma es válida, `None` en cualquier otro caso."""
    try:
        payload_b64, signature_b64 = token.split(".", 1)
        payload = _unb64(payload_b64)
        if not hmac.compare_digest(_unb64(signature_b64), _sign(payload)):
            return None
        user_id, category = payload.decode().split(":", 1)
        return uuid.UUID(user_id), EmailCategory(category)
    except (ValueError, UnicodeDecodeError):
        return None


def unsubscribe_page_url(user_id: uuid.UUID, category: EmailCategory | str) -> str:
    """Link que ve la persona (página del frontend con un botón de confirmar)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/baja?t={make_unsubscribe_token(user_id, category)}"


def unsubscribe_api_url(user_id: uuid.UUID, category: EmailCategory | str) -> str:
    """Endpoint de baja de un click (RFC 8058) que usan Gmail/Yahoo desde el header
    `List-Unsubscribe`."""
    return f"{settings.public_api_base_url}/email/unsubscribe?t={make_unsubscribe_token(user_id, category)}"
