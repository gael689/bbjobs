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
from app.models.email import ALWAYS_SENT, EmailCategory

_DOMAIN = b"bbjobs-unsub-v1:"


class NotUnsubscribable(ValueError):
    """La categoría llega siempre (`ALWAYS_SENT`): no existe un link para darse de baja."""


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: bytes) -> bytes:
    return hmac.new(settings.SECRET_KEY.encode(), _DOMAIN + payload, hashlib.sha256).digest()


def make_unsubscribe_token(user_id: uuid.UUID, category: EmailCategory | str) -> str:
    category = EmailCategory(category)
    if category in ALWAYS_SENT:
        raise NotUnsubscribable(f"La categoría '{category.value}' no se puede apagar")
    payload = f"{user_id}:{category.value}".encode()
    return f"{_b64(payload)}.{_b64(_sign(payload))}"


def verify_unsubscribe_token(token: str) -> tuple[uuid.UUID, EmailCategory] | None:
    """Devuelve (user_id, categoría) si la firma es válida y la categoría se puede apagar;
    `None` en cualquier otro caso. Rechazar `ALWAYS_SENT` acá también importa: un token de
    `cuenta` firmado por una versión vieja del código no tiene que poder apagar nada (M16)."""
    try:
        payload_b64, signature_b64 = token.split(".", 1)
        payload = _unb64(payload_b64)
        if not hmac.compare_digest(_unb64(signature_b64), _sign(payload)):
            return None
        user_id, category = payload.decode().split(":", 1)
        parsed = EmailCategory(category)
        if parsed in ALWAYS_SENT:
            return None
        return uuid.UUID(user_id), parsed
    except (ValueError, UnicodeDecodeError):
        return None


def unsubscribe_page_url(user_id: uuid.UUID, category: EmailCategory | str) -> str:
    """Link que ve la persona (página del frontend con un botón de confirmar)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/baja?t={make_unsubscribe_token(user_id, category)}"


def unsubscribe_api_url(user_id: uuid.UUID, category: EmailCategory | str) -> str:
    """Endpoint de baja de un click (RFC 8058) que usan Gmail/Yahoo desde el header
    `List-Unsubscribe`. **Da de baja sólo por POST**: los antivirus y escáneres de correo abren
    los links con GET, y una baja por GET daría de baja a gente que nunca hizo click (M15). El
    GET de esa URL tiene que redirigir a la página `/baja` con su botón de confirmar."""
    return f"{settings.public_api_base_url}/email/unsubscribe?t={make_unsubscribe_token(user_id, category)}"


# ── Bajas de empresas prospecto (no son usuarios) ──────────────────────────────────────────

_PROSPECT_DOMAIN = b"bbjobs-unsub-prospect-v1:"


def _sign_prospect(payload: bytes) -> bytes:
    return hmac.new(settings.SECRET_KEY.encode(), _PROSPECT_DOMAIN + payload, hashlib.sha256).digest()


def make_prospect_token(prospect_id: uuid.UUID) -> str:
    payload = str(prospect_id).encode()
    return f"{_b64(payload)}.{_b64(_sign_prospect(payload))}"


def verify_prospect_token(token: str) -> uuid.UUID | None:
    """Otro dominio de firma que el de usuarios: un token de una no sirve para la otra."""
    try:
        payload_b64, signature_b64 = token.split(".", 1)
        payload = _unb64(payload_b64)
        if not hmac.compare_digest(_unb64(signature_b64), _sign_prospect(payload)):
            return None
        return uuid.UUID(payload.decode())
    except (ValueError, UnicodeDecodeError):
        return None


def prospect_unsubscribe_page_url(prospect_id: uuid.UUID) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/baja?tipo=empresa&t={make_prospect_token(prospect_id)}"


def prospect_unsubscribe_api_url(prospect_id: uuid.UUID) -> str:
    return f"{settings.public_api_base_url}/email/unsubscribe-prospect?t={make_prospect_token(prospect_id)}"
