"""Aviso a buscadores (services/indexing.py) con httpx mockeado: nada sale a internet."""
import json
import uuid
from types import SimpleNamespace

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.services import indexing

JOB_ID = uuid.UUID("3f2a1b4c-1111-4222-8333-944445555666")
ZONE_ID = uuid.uuid4()
IND_ID = uuid.uuid4()
FICHA = "https://www.bbjobs.com.ar/empleos/cajero-a-3f2a1b4c-1111-4222-8333-944445555666"


def _job(**kw):
    base = dict(id=JOB_ID, title="Cajero/a", zone_id=ZONE_ID, industry_id=IND_ID,
                status="active", moderation_status="approved", deleted_at=None)
    base.update(kw)
    return SimpleNamespace(**base)


@pytest.fixture(autouse=True)
def _limpio(monkeypatch):
    monkeypatch.setattr(indexing.settings, "INDEXNOW_KEY", None)
    monkeypatch.setattr(indexing.settings, "GOOGLE_INDEXING_CREDENTIALS", None)
    monkeypatch.setattr(indexing, "_google_token", None)
    monkeypatch.setattr(indexing, "_TRANSPORT", None)

    async def _slugs(ids):
        return {ZONE_ID: "zona-norte", IND_ID: "comercio"}

    monkeypatch.setattr(indexing, "_resolve_slugs", _slugs)


def _mock(monkeypatch, handler):
    calls: list[httpx.Request] = []

    def _h(request):
        calls.append(request)
        return handler(request)

    monkeypatch.setattr(indexing, "_TRANSPORT", httpx.MockTransport(_h))
    return calls


def _service_account():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                            serialization.NoEncryption()).decode()
    info = {"type": "service_account", "client_email": "bbjobs@proyecto.iam.gserviceaccount.com",
            "private_key": pem, "private_key_id": "abc",
            "token_uri": "https://oauth2.googleapis.com/token"}
    return info, key.public_key()


# ── qué cambió ──

def test_change_for_detecta_aparicion_baja_y_titulo():
    antes = indexing.snapshot(_job(moderation_status="pending_review"))
    c = indexing.change_for(antes, _job())
    assert c.kind == indexing.UPDATED and c.title == "Cajero/a"

    c = indexing.change_for(indexing.snapshot(_job()), _job(status="closed"))
    assert c.kind == indexing.DELETED

    c = indexing.change_for(indexing.snapshot(_job()), _job(deleted_at="ayer"))
    assert c.kind == indexing.DELETED

    c = indexing.change_for(indexing.snapshot(_job()), _job(title="Cajero/a Senior"))
    assert c.kind == indexing.UPDATED and c.old_title == "Cajero/a"

    # nada visible cambió: pausada que sigue pausada, o editar la descripción
    assert indexing.change_for(indexing.snapshot(_job(status="paused")), _job(status="closed")) is None
    assert indexing.change_for(indexing.snapshot(_job()), _job()) is None


# ── sin variables no hace nada ──

async def test_sin_variables_no_llama_nada(monkeypatch):
    llamado = []

    async def _process(changes):
        llamado.append(changes)

    monkeypatch.setattr(indexing, "process", _process)
    calls = _mock(monkeypatch, lambda r: httpx.Response(200))
    indexing.notify(indexing.change_for(indexing.snapshot(_job()), _job(status="closed")))
    assert not indexing._tasks and llamado == []
    await indexing.process([indexing.JobChange(indexing.UPDATED, JOB_ID, "Cajero/a")])
    assert calls == []


# ── IndexNow ──

async def test_indexnow_manda_el_payload_correcto(monkeypatch):
    monkeypatch.setattr(indexing.settings, "INDEXNOW_KEY", "clave-de-prueba-123")
    calls = _mock(monkeypatch, lambda r: httpx.Response(202))

    cambio = indexing.change_for(indexing.snapshot(_job()), _job(title="Cajero/a Senior"))
    indexing.notify(cambio)
    for t in list(indexing._tasks):
        await t

    assert len(calls) == 1
    req = calls[0]
    assert str(req.url) == "https://api.indexnow.org/indexnow" and req.method == "POST"
    body = json.loads(req.content)
    assert body["host"] == "www.bbjobs.com.ar"
    assert body["key"] == "clave-de-prueba-123"
    assert body["keyLocation"] == "https://www.bbjobs.com.ar/indexnow-key.txt"
    assert body["urlList"] == [
        "https://www.bbjobs.com.ar/empleos/cajero-a-senior-3f2a1b4c-1111-4222-8333-944445555666",
        FICHA,  # la URL vieja (otro título) también, para que el buscador vea el 308
        "https://www.bbjobs.com.ar/trabajo-en/bahia-blanca",
        "https://www.bbjobs.com.ar/empleos-de/comercio",
    ]


# ── Google Indexing API ──

async def test_google_pide_token_y_publica_updated_y_deleted(monkeypatch):
    info, public_key = _service_account()
    monkeypatch.setattr(indexing.settings, "GOOGLE_INDEXING_CREDENTIALS", json.dumps(info))

    def handler(req):
        if req.url.host == "oauth2.googleapis.com":
            return httpx.Response(200, json={"access_token": "tok-123", "expires_in": 3599})
        return httpx.Response(200, json={})

    calls = _mock(monkeypatch, handler)
    await indexing.process([
        indexing.JobChange(indexing.UPDATED, JOB_ID, "Cajero/a"),
        indexing.JobChange(indexing.DELETED, JOB_ID, "Cajero/a"),
    ])

    token_req, pub1, pub2 = calls
    form = dict(x.split("=", 1) for x in token_req.content.decode().split("&"))
    assert form["grant_type"] == "urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"
    claims = jwt.decode(form["assertion"], public_key, algorithms=["RS256"],
                        audience="https://oauth2.googleapis.com/token")
    assert claims["iss"] == info["client_email"]
    assert claims["scope"] == "https://www.googleapis.com/auth/indexing"

    for req, tipo in ((pub1, "URL_UPDATED"), (pub2, "URL_DELETED")):
        assert str(req.url) == "https://indexing.googleapis.com/v3/urlNotifications:publish"
        assert req.headers["Authorization"] == "Bearer tok-123"
        assert json.loads(req.content) == {"url": FICHA, "type": tipo}

    # el token queda cacheado: el segundo aviso no lo vuelve a pedir
    await indexing.process([indexing.JobChange(indexing.UPDATED, JOB_ID, "Cajero/a")])
    assert len(calls) == 4 and calls[3].url.host == "indexing.googleapis.com"


async def test_credenciales_rotas_no_rompen(monkeypatch):
    monkeypatch.setattr(indexing.settings, "GOOGLE_INDEXING_CREDENTIALS", "{no es json")
    calls = _mock(monkeypatch, lambda r: httpx.Response(200))
    await indexing.process([indexing.JobChange(indexing.UPDATED, JOB_ID, "Cajero/a")])
    assert calls == []


# ── errores de red ──

async def test_error_de_red_no_levanta(monkeypatch):
    info, _ = _service_account()
    monkeypatch.setattr(indexing.settings, "INDEXNOW_KEY", "clave-de-prueba-123")
    monkeypatch.setattr(indexing.settings, "GOOGLE_INDEXING_CREDENTIALS", json.dumps(info))

    def handler(req):
        raise httpx.ConnectError("sin red", request=req)

    calls = _mock(monkeypatch, handler)
    await indexing.process([indexing.JobChange(indexing.DELETED, JOB_ID, "Cajero/a")])
    assert len(calls) == 2  # intentó IndexNow y el token de Google, y siguió de largo


async def test_error_inesperado_tampoco_levanta(monkeypatch):
    monkeypatch.setattr(indexing.settings, "INDEXNOW_KEY", "clave-de-prueba-123")

    async def _explota(ids):
        raise RuntimeError("base caída")

    monkeypatch.setattr(indexing, "_resolve_slugs", _explota)
    calls = _mock(monkeypatch, lambda r: httpx.Response(500, text="error"))
    await indexing.process([indexing.JobChange(indexing.UPDATED, JOB_ID, "Cajero/a",
                                               zone_id=ZONE_ID)])
    # sin catálogo igual avisa la ficha
    assert json.loads(calls[0].content)["urlList"] == [FICHA]
