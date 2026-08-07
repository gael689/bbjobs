import hashlib
import hmac

from app.api.v1.webhooks import resolve_signature_data_id, _es_notificacion_de_pago
from app.core.config import settings
from app.integrations.mercado_pago import verify_signature, webhook_signature_required


def _sign(secret: str, data_id: str, request_id: str, ts: str) -> str:
    manifest = f"id:{data_id.lower()};request-id:{request_id};ts:{ts};"
    digest = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return f"ts={ts},v1={digest}"


def test_resolve_signature_data_id_prefers_query_string():
    query_params = {"data.id": "123456789"}
    payload = {"data": {"id": "999999999"}}
    assert resolve_signature_data_id(query_params, payload) == "123456789"


def test_resolve_signature_data_id_falls_back_to_body():
    query_params = {}
    payload = {"data": {"id": "999999999"}}
    assert resolve_signature_data_id(query_params, payload) == "999999999"


def test_resolve_signature_data_id_missing_everywhere():
    assert resolve_signature_data_id({}, {}) == ""


def test_verify_signature_accepts_valid_signature(monkeypatch):
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "test-secret")
    x_signature = _sign("test-secret", "123456789", "req-1", "1700000000")
    assert verify_signature(x_signature, "req-1", "123456789") is True


def test_verify_signature_rejects_tampered_signature(monkeypatch):
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "test-secret")
    x_signature = _sign("test-secret", "123456789", "req-1", "1700000000")
    assert verify_signature(x_signature, "req-1", "different-data-id") is False


def test_verify_signature_is_case_insensitive_on_data_id(monkeypatch):
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "test-secret")
    # Firmado con el id en mayúsculas -- debe validar igual porque MP lo espera en minúsculas.
    x_signature = _sign("test-secret", "abc123", "req-1", "1700000000")
    assert verify_signature(x_signature, "req-1", "ABC123") is True


def test_verify_signature_skips_validation_without_secret(monkeypatch):
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", None)
    assert verify_signature("ts=1,v1=bogus", "req-1", "anything") is True


# ── Endurecimiento del webhook (Bloque E, agosto/2026) ───────────────────────

def test_firma_obligatoria_solo_con_secret_cargado(monkeypatch):
    """El endpoint tiene que poder distinguir "no hay secret" de "no mandaron la firma".

    Antes validaba `if x_signature and x_request_id`, así que omitir los headers salteaba la
    verificación entera — con plata de por medio, eso es un agujero."""
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "", raising=False)
    assert webhook_signature_required() is False

    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "un-secret", raising=False)
    assert webhook_signature_required() is True


def test_firma_malformada_no_revienta(monkeypatch):
    """Un header hostil no debe dar 500: `dict(item.split("="))` explotaba con una parte sin
    "=" o con más de uno."""
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "un-secret", raising=False)
    for basura in ["", "basura", "ts", "ts=1,v1", "=,=", "ts=1,v1=abc=def"]:
        assert verify_signature(basura, "req-1", "123") is False


def test_firma_valida_pasa(monkeypatch):
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "un-secret", raising=False)
    firma = _sign("un-secret", "123", "req-1", "1700000000")
    assert verify_signature(firma, "req-1", "123") is True


def test_firma_de_otro_secret_no_pasa(monkeypatch):
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "un-secret", raising=False)
    firma = _sign("otro-secret", "123", "req-1", "1700000000")
    assert verify_signature(firma, "req-1", "123") is False


def test_solo_se_procesan_notificaciones_de_pago():
    """MP manda merchant_order por el mismo endpoint, con un id de orden que no sirve para
    payment().get() — se ignoran en vez de quedar registradas como error."""
    assert _es_notificacion_de_pago({"type": "payment"}) is True
    assert _es_notificacion_de_pago({"action": "payment.updated"}) is True
    assert _es_notificacion_de_pago({"type": "merchant_order"}) is False
    assert _es_notificacion_de_pago({"action": "merchant_order.updated"}) is False
    # Sin ningún campo se asume pago — es el comportamiento que había antes.
    assert _es_notificacion_de_pago({}) is True
