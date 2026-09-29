"""get_clerk_identity: qué status sale para cada motivo de rechazo.

El bug de fondo era que todo rechazo era un 401 mudo: no se podía distinguir un token vencido
de un fallo de Clerk, y el frontend trataba ambos como "sesión vencida"."""
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

from app.api import deps
from app.integrations.clerk_client import ClerkTokenError


def _request() -> Request:
    return Request({"type": "http", "method": "PATCH", "path": "/api/v1/me/candidate/profile",
                    "headers": [], "query_string": b""})


def _creds(token: str = "tok") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.mark.asyncio
async def test_sin_header_es_401():
    with pytest.raises(HTTPException) as e:
        await deps.get_clerk_identity(_request(), None)
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_token_vencido_es_401(monkeypatch):
    async def boom(_):
        raise ClerkTokenError("expired", reason="token-expired")
    monkeypatch.setattr(deps, "verify_session_token", boom)
    with pytest.raises(HTTPException) as e:
        await deps.get_clerk_identity(_request(), _creds())
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_fallo_de_clerk_es_503_y_no_401(monkeypatch):
    async def boom(_):
        raise ClerkTokenError("jwks", reason="jwk-failed-to-load", transient=True)
    monkeypatch.setattr(deps, "verify_session_token", boom)
    with pytest.raises(HTTPException) as e:
        await deps.get_clerk_identity(_request(), _creds())
    assert e.value.status_code == 503


@pytest.mark.asyncio
async def test_token_sin_sub_es_401(monkeypatch):
    async def ok(_):
        return {}
    monkeypatch.setattr(deps, "verify_session_token", ok)
    with pytest.raises(HTTPException) as e:
        await deps.get_clerk_identity(_request(), _creds())
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_token_valido_devuelve_la_identidad(monkeypatch):
    async def ok(_):
        return {"sub": "user_123"}
    monkeypatch.setattr(deps, "verify_session_token", ok)
    ident = await deps.get_clerk_identity(_request(), _creds())
    assert ident.clerk_user_id == "user_123"


def test_los_motivos_de_red_de_clerk_se_marcan_transitorios():
    from clerk_backend_api.security import TokenVerificationError, TokenVerificationErrorReason as R
    from app.integrations import clerk_client as cc
    assert R.JWK_FAILED_TO_LOAD in cc._TRANSIENT_REASONS
    assert R.TOKEN_EXPIRED not in cc._TRANSIENT_REASONS
    assert R.TOKEN_INVALID_AUTHORIZED_PARTIES not in cc._TRANSIENT_REASONS
