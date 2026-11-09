"""Dos remitentes según la categoría del mail: la reputación de lo masivo (novedades.) no puede
arrastrar a lo importante (avisos.)."""
import json

import httpx
import pytest

from app.core.config import settings
from app.integrations import resend_client
from app.integrations.resend_client import OutgoingEmail
from app.models.email import EmailCategory
from app.services.email.catalog import CATEGORIAS_NOVEDADES, remitente_para

AVISOS = "BBJobs <avisos@avisos.bbjobs.com.ar>"
NOVEDADES = "BBJobs Empleos <empleos@novedades.bbjobs.com.ar>"


@pytest.fixture(autouse=True)
def _config(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(settings, "RESEND_FROM_EMAIL", AVISOS)
    monkeypatch.setattr(settings, "RESEND_FROM_EMAIL_NOVEDADES", NOVEDADES)
    monkeypatch.setattr(settings, "RESEND_REPLY_TO", None)


def test_defaults_are_the_two_subdomains():
    from app.core.config import Settings

    assert Settings.model_fields["RESEND_FROM_EMAIL"].default == AVISOS
    assert Settings.model_fields["RESEND_FROM_EMAIL_NOVEDADES"].default == NOVEDADES


@pytest.mark.parametrize("category", ["cuenta", "postulaciones", "busquedas", "admin"])
def test_important_categories_go_out_from_avisos(category):
    assert remitente_para(category) == AVISOS
    assert remitente_para(EmailCategory(category)) == AVISOS


@pytest.mark.parametrize("category", ["alertas", "recordatorios", "novedades"])
def test_bulk_categories_go_out_from_novedades(category):
    assert remitente_para(category) == NOVEDADES


def test_every_category_is_assigned_on_purpose():
    # Una categoría nueva tiene que decidir su remitente: si no está en ninguna de las dos
    # listas, este test avisa. La prospección tiene su propio canal y no pasa por acá.
    avisos = {EmailCategory.cuenta, EmailCategory.postulaciones, EmailCategory.busquedas, EmailCategory.admin}
    assert set(EmailCategory) - {EmailCategory.prospeccion} == avisos | CATEGORIAS_NOVEDADES
    assert not avisos & CATEGORIAS_NOVEDADES


def test_unknown_category_is_an_error():
    with pytest.raises(ValueError):
        remitente_para("inventada")


def _capture(monkeypatch) -> dict:
    seen: dict = {}

    def handler(request):
        body = json.loads(request.content)
        seen["body"] = body
        if isinstance(body, list):
            return httpx.Response(200, json={"data": [{"id": f"m{i}"} for i in range(len(body))]})
        return httpx.Response(200, json={"id": "m"})

    monkeypatch.setattr(
        resend_client, "_make_client",
        lambda: httpx.AsyncClient(base_url=resend_client.RESEND_BASE_URL, transport=httpx.MockTransport(handler)),
    )
    return seen


async def test_payload_uses_the_sender_of_each_message(monkeypatch):
    seen = _capture(monkeypatch)
    await resend_client.send_batch([
        OutgoingEmail(to="a@x.com", subject="s", html="h", from_email=NOVEDADES),
        OutgoingEmail(to="b@x.com", subject="s", html="h"),
    ])
    assert [m["from"] for m in seen["body"]] == [NOVEDADES, AVISOS]


async def test_explicit_sender_wins_and_keeps_reply_to_of_its_own_channel(monkeypatch):
    # La prospección pasa su remitente explícito: pisa al del mensaje y no hereda el reply-to
    # de los avisos.
    monkeypatch.setattr(settings, "RESEND_REPLY_TO", "hola@bbjobs.com.ar")
    seen = _capture(monkeypatch)
    await resend_client.send_email(
        OutgoingEmail(to="a@x.com", subject="s", html="h", from_email=NOVEDADES),
        api_key="re_prospect", from_email="Talency <contacto@contacto.bbjobs.com.ar>",
    )
    assert seen["body"]["from"] == "Talency <contacto@contacto.bbjobs.com.ar>"
    assert "reply_to" not in seen["body"]


async def test_reply_to_still_applies_to_both_senders(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_REPLY_TO", "hola@bbjobs.com.ar")
    seen = _capture(monkeypatch)
    await resend_client.send_email(OutgoingEmail(to="a@x.com", subject="s", html="h", from_email=NOVEDADES))
    assert seen["body"]["reply_to"] == "hola@bbjobs.com.ar"
