"""Prospección: piezas puras (normalización, competencia, firma) y compuerta."""
import time

import httpx
import pytest

from app.core.config import settings
from app.services import prospects as svc


@pytest.mark.parametrize("raw,key", [
    ("+54 9 291 455-1234", "2914551234"),
    ("0291 455 1234", "2914551234"),
    ("(0291) 4551234", "2914551234"),
    ("455-1234", None),
    (None, None),
])
def test_phone_key_crosses_formats(raw, key):
    assert svc.phone_key(raw) == key


def test_domains_ignore_personal_providers():
    assert svc.domain_of_email("rrhh@Metalurgica-Sur.com.ar") == "metalurgica-sur.com.ar"
    assert svc.domain_of_email("juan@gmail.com") is None
    assert svc.domain_of_url("https://www.metalurgica-sur.com.ar/contacto") == "metalurgica-sur.com.ar"
    assert svc.domain_of_url("metalurgica-sur.com.ar") == "metalurgica-sur.com.ar"


@pytest.mark.parametrize("name,category,es", [
    ("Talentos Sur", "Consultoras y RRHH", True),
    ("Consultora Andina de Recursos Humanos", None, True),
    ("Selección de Personal BB", "Servicios", True),
    ("Metalúrgica Sur", "Industria", False),
    ("Panadería La Espiga", "Gastronomía", False),
])
def test_competitors_are_detected(name, category, es):
    assert svc.is_competitor(name, category) is es


def test_signature_round_trip_and_rejections():
    body = b'{"sync_id":"abc12345"}'
    ts = str(int(time.time()))
    sig = svc.sign("secreto", ts, body)
    assert svc.verify_signature("secreto", ts, sig, body)
    assert not svc.verify_signature("otro", ts, sig, body)
    assert not svc.verify_signature("secreto", ts, sig, body + b" ")
    viejo = str(int(time.time()) - 600)
    assert not svc.verify_signature("secreto", viejo, svc.sign("secreto", viejo, body), body)
    assert not svc.verify_signature("secreto", None, sig, body)


@pytest.fixture
async def client():
    from app.main import app

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/v1/integrations/leadgen/sync"),
    ("GET", "/api/v1/admin/prospects"),
    ("POST", "/api/v1/admin/prospects/bulk"),
])
async def test_prospect_routes_are_404_with_the_gate_closed(client, monkeypatch, method, path):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    assert (await client.request(method, path)).status_code == 404


async def test_sync_without_secret_is_503_and_bad_signature_401(client, monkeypatch):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "LEADGEN_SYNC_SECRET", None)
    assert (await client.post("/api/v1/integrations/leadgen/sync", content=b"{}")).status_code == 503

    monkeypatch.setattr(settings, "LEADGEN_SYNC_SECRET", "secreto")
    resp = await client.post("/api/v1/integrations/leadgen/sync", content=b"{}",
                             headers={"x-bbjobs-timestamp": str(int(time.time())), "x-bbjobs-signature": "mal"})
    assert resp.status_code == 401
