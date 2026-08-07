import mercadopago
from app.core.config import settings
import structlog
import hashlib
import hmac

logger = structlog.get_logger("app.integrations.mp")

def get_mp_client():
    if not settings.MP_ACCESS_TOKEN:
        return None
    return mercadopago.SDK(settings.MP_ACCESS_TOKEN)

def create_preference(title: str, price: float, external_reference: str, success_url: str):
    sdk = get_mp_client()
    if not sdk:
        logger.warning("MercadoPago no configurado. Simulando URL.")
        return "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=mock_123"
        
    preference_data = {
        "items": [
            {
                "title": title,
                "quantity": 1,
                "unit_price": price,
                "currency_id": "ARS"
            }
        ],
        "external_reference": external_reference,
        "back_urls": {
            "success": success_url,
            "failure": success_url,
            "pending": success_url
        },
        "auto_return": "approved",
    }
    
    try:
        preference_response = sdk.preference().create(preference_data)
        preference = preference_response["response"]
        return preference["init_point"]
    except Exception as e:
        logger.error("mp_preference_error", error=str(e))
        raise e

def webhook_signature_required() -> bool:
    """¿Hay que exigir firma válida? Sí en cuanto haya un secret cargado.

    Se separa de `verify_signature` para que el endpoint pueda rechazar un pedido que viene
    **sin** los headers de firma: antes sólo validaba `if x_signature and x_request_id`, o sea
    que bastaba con no mandarlos para saltear la verificación entera."""
    return bool(settings.MP_WEBHOOK_SECRET)


def verify_signature(x_signature: str, x_request_id: str, data_id: str) -> bool:
    """
    Verifica la firma HMAC de los webhooks de MP.
    El header x-signature tiene formato: ts=16...33,v1=9c...a3
    """
    if not settings.MP_WEBHOOK_SECRET:
        # Sin secret configurado no hay nada contra qué validar (entorno local). En producción
        # el secret está cargado y este camino no se toma — ver webhook_signature_required.
        return True

    # Parseo defensivo: un header mal formado (una parte sin "=", o con más de uno) hacía
    # explotar el dict() y devolvía un 500 en vez de un 401.
    try:
        parts = {}
        for item in x_signature.split(","):
            clave, _, valor = item.strip().partition("=")
            if not _:
                return False
            parts[clave] = valor
    except Exception:
        return False

    timestamp = parts.get("ts")
    v1 = parts.get("v1")

    if not timestamp or not v1:
        return False

    # MP espera el data.id en minúsculas si es alfanumérico (numérico hoy, pero alinea con la spec).
    manifest = f"id:{data_id.lower()};request-id:{x_request_id};ts:{timestamp};"
    hmac_obj = hmac.new(
        settings.MP_WEBHOOK_SECRET.encode(),
        manifest.encode(),
        hashlib.sha256
    )
    expected_v1 = hmac_obj.hexdigest()
    
    return hmac.compare_digest(expected_v1, v1)
