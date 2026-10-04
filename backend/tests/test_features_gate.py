"""Compuerta de módulos en desarrollo: cerrada, nadie ve nada (ni el panel de admin)."""
import httpx
import pytest

from app.core.config import settings
from app.models.settings import NEW_MODULE_SETTINGS, SettingKey


@pytest.fixture
async def client():
    from app.main import app

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


def test_gate_is_closed_by_default():
    # El default del código es "cerrado": un deploy sin la variable no muestra nada.
    from app.core.config import Settings

    assert Settings.model_fields["MODULOS_NUEVOS_ACTIVOS"].default is False


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/v1/email/unsubscribe?t=x"),
    ("POST", "/api/v1/email/unsubscribe?t=x"),
    ("GET", "/api/v1/me/email-preferences"),
    ("POST", "/api/v1/webhooks/resend"),
    ("GET", "/api/v1/me/candidate/cv-review"),
    ("POST", "/api/v1/me/candidate/cv-review/checkout"),
    ("GET", "/api/v1/admin/cv-reviews"),
    ("GET", "/api/v1/me/company/jobs/00000000-0000-0000-0000-000000000000/recommendations"),
    ("GET", "/api/v1/me/candidate/ai-view"),
    ("GET", "/api/v1/admin/ai/usage"),
])
async def test_new_routes_are_404_with_the_gate_closed(client, monkeypatch, method, path):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    resp = await client.request(method, path)
    assert resp.status_code == 404


async def test_new_routes_exist_with_the_gate_open(client, monkeypatch):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    resp = await client.get("/api/v1/email/unsubscribe", params={"t": "x"})
    assert resp.status_code == 303


def test_new_module_switches_are_listed():
    assert {SettingKey.emails_automaticos_activos, SettingKey.ia_recomendaciones_activas,
            SettingKey.revision_cv_activa} <= NEW_MODULE_SETTINGS
    assert SettingKey.stats_visibles_en_landing not in NEW_MODULE_SETTINGS


async def test_admin_settings_hide_new_switches_when_closed(monkeypatch):
    from app.api.v1 import admin

    async def fake_all(_db):
        return {k.value: False for k in SettingKey}

    monkeypatch.setattr(admin, "get_all_settings", fake_all)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    visible = (await admin._visible_settings(None)).model_dump(exclude_none=True)
    assert set(visible) == {"stats_visibles_para_candidatos", "stats_visibles_en_landing"}

    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    visible = (await admin._visible_settings(None)).model_dump(exclude_none=True)
    assert "revision_cv_activa" in visible
