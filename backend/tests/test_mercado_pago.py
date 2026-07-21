import hashlib
import hmac

from app.api.v1.webhooks import resolve_signature_data_id
from app.core.config import settings
from app.integrations.mercado_pago import verify_signature


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
