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

def verify_signature(x_signature: str, x_request_id: str, data_id: str, ts: str) -> bool:
    """
    Verifica la firma HMAC de los webhooks de MP.
    El header x-signature tiene formato: ts=16...33,v1=9c...a3
    """
    if not settings.MP_WEBHOOK_SECRET:
        return True # Skip validation if no secret is set in local
        
    parts = dict(item.split("=") for item in x_signature.split(","))
    timestamp = parts.get("ts")
    v1 = parts.get("v1")
    
    if not timestamp or not v1:
        return False
        
    manifest = f"id:{data_id};request-id:{x_request_id};ts:{timestamp};"
    hmac_obj = hmac.new(
        settings.MP_WEBHOOK_SECRET.encode(),
        manifest.encode(),
        hashlib.sha256
    )
    expected_v1 = hmac_obj.hexdigest()
    
    return hmac.compare_digest(expected_v1, v1)
