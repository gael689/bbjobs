"""Base del módulo de mails: links de baja, renderer, proveedor y ajustes del cliente de Resend."""
import uuid

import pytest

from app.core.config import settings
from app.integrations import resend_client
from app.integrations.resend_client import OutgoingEmail, clean_tag, idempotency_key
from app.models.email import EmailCategory
from app.services.email import provider as email_provider
from app.services.email.render import BUTTON, absolute_url, render_email, substitute
from app.services.email.tokens import (
    NotUnsubscribable,
    make_unsubscribe_token,
    unsubscribe_page_url,
    verify_unsubscribe_token,
)

USER = uuid.UUID("11111111-2222-3333-4444-555555555555")


# --- links de baja ----------------------------------------------------------------------

def test_token_round_trip():
    token = make_unsubscribe_token(USER, EmailCategory.alertas)
    assert verify_unsubscribe_token(token) == (USER, EmailCategory.alertas)


def test_token_with_altered_signature_is_rejected():
    token = make_unsubscribe_token(USER, "novedades")
    payload, firma = token.split(".")
    otra = "A" + firma[1:] if firma[0] != "A" else "B" + firma[1:]
    assert verify_unsubscribe_token(f"{payload}.{otra}") is None


def test_token_cannot_be_moved_to_another_category():
    # Firma de "alertas" pegada a un payload de "novedades": no vale.
    alertas = make_unsubscribe_token(USER, "alertas")
    novedades = make_unsubscribe_token(USER, "novedades")
    assert verify_unsubscribe_token(f"{novedades.split('.')[0]}.{alertas.split('.')[1]}") is None


def test_token_signed_with_another_secret_is_rejected(monkeypatch):
    token = make_unsubscribe_token(USER, "alertas")
    monkeypatch.setattr(settings, "SECRET_KEY", "otra-clave")
    assert verify_unsubscribe_token(token) is None


@pytest.mark.parametrize("basura", ["", "sinpunto", "a.b", "....", "%%%.%%%"])
def test_malformed_tokens_are_rejected(basura):
    assert verify_unsubscribe_token(basura) is None


def test_account_category_has_no_unsubscribe_link():
    # M16: los avisos de cuenta llegan siempre.
    with pytest.raises(NotUnsubscribable):
        make_unsubscribe_token(USER, EmailCategory.cuenta)


def test_account_category_token_is_rejected_even_if_signed(monkeypatch):
    # Un token de `cuenta` firmado a mano (o por código viejo) tampoco sirve.
    from app.services.email import tokens

    payload = f"{USER}:cuenta".encode()
    token = f"{tokens._b64(payload)}.{tokens._b64(tokens._sign(payload))}"
    assert verify_unsubscribe_token(token) is None


def test_unsubscribe_page_points_to_frontend(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.bbjobs.com.ar/")
    url = unsubscribe_page_url(USER, "alertas")
    assert url.startswith("https://www.bbjobs.com.ar/baja?t=")


# --- renderer ---------------------------------------------------------------------------

def test_substitute_replaces_known_and_blanks_unknown():
    assert substitute("Hola {{ nombre }}, {{otra}}!", {"nombre": "Ana"}) == "Hola Ana, !"


def test_user_content_is_escaped():
    out = render_email(heading="<b>Hola</b>", body='Empresa "X" <script>alert(1)</script>')
    assert "<script>" not in out.html
    assert "&lt;script&gt;" in out.html
    assert "&lt;b&gt;Hola&lt;/b&gt;" in out.html


def test_variables_cannot_inject_markup():
    body = substitute("Hola {{nombre}}", {"nombre": "<img src=x onerror=alert(1)>"})
    out = render_email(heading="t", body=body)
    assert "<img src=x" not in out.html


@pytest.mark.parametrize("link", ["javascript:alert(1)", "data:text/html,hola", "ftp://x.com", "//evil.com"])
def test_only_http_links_reach_the_button(link):
    assert absolute_url(link) is None
    out = render_email(heading="t", body="b", cta_label="Ir", cta_url=link)
    assert "Ir</a>" not in out.html


def test_relative_links_become_absolute(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://www.bbjobs.com.ar")
    assert absolute_url("/dashboard/candidate") == "https://www.bbjobs.com.ar/dashboard/candidate"


def test_button_uses_accessible_color():
    out = render_email(heading="t", body="b", cta_label="Ver", cta_url="https://www.bbjobs.com.ar")
    assert f"background:{BUTTON}" in out.html
    assert BUTTON == "#187B8E"


def test_plain_text_version_has_body_link_and_unsubscribe():
    out = render_email(
        heading="Nueva búsqueda", body="Párrafo uno.\n\nPárrafo dos.",
        cta_label="Ver", cta_url="https://www.bbjobs.com.ar/empleos",
        unsubscribe_url="https://www.bbjobs.com.ar/baja?t=abc",
    )
    assert "Párrafo dos." in out.text
    assert "Ver: https://www.bbjobs.com.ar/empleos" in out.text
    assert "https://www.bbjobs.com.ar/baja?t=abc" in out.text
    assert 'lang="es"' in out.html


def test_email_stays_well_under_gmail_clip_limit():
    # Gmail recorta los mails de más de 102 KB (v3 M10).
    out = render_email(heading="t", body="texto " * 2000, cta_label="Ver", cta_url="https://x.com")
    assert len(out.html.encode()) < 102 * 1024


# --- ajustes del cliente de Resend ------------------------------------------------------

def test_idempotency_key_format():
    assert idempotency_key("outbox", "abc") == "outbox/abc"
    with pytest.raises(ValueError):
        idempotency_key("x" * 250, "y" * 10)


@pytest.mark.parametrize("raw,clean", [
    ("application_selected", "application_selected"),
    ("postulación nueva", "postulaci_n_nueva"),
    ("", "_"),
])
def test_tags_are_cleaned(raw, clean):
    assert clean_tag(raw) == clean


def test_payload_cleans_tags(monkeypatch):
    msg = OutgoingEmail(to="a@b.com", subject="s", html="<p>x</p>", tags={"tipo": "búsqueda nueva"})
    assert resend_client._payload(msg)["tags"] == [{"name": "tipo", "value": "b_squeda_nueva"}]


# --- proveedor --------------------------------------------------------------------------

def test_auto_without_key_is_off(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_MODE", "auto")
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    assert email_provider.resolve_mode() == "off"
    assert email_provider.get_email_provider() is None


def test_auto_with_key_is_resend(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_MODE", "auto")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    assert isinstance(email_provider.get_email_provider(), email_provider.ResendProvider)


def test_resend_mode_without_key_falls_back_to_off(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_MODE", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    assert email_provider.resolve_mode() == "off"


def test_invalid_mode_is_a_configuration_error(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_MODE", "mandar-todo")
    with pytest.raises(ValueError):
        email_provider.resolve_mode()


async def test_simulated_provider_records_and_never_touches_the_network(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_MODE", "simulate")

    async def boom(*args, **kwargs):
        raise AssertionError("el simulador no debe llamar a Resend")

    monkeypatch.setattr(resend_client, "send_batch", boom)
    monkeypatch.setattr(resend_client, "send_email", boom)
    provider = email_provider.get_email_provider()
    ids = await provider.send_batch([OutgoingEmail(to="a@b.com", subject="s", html="h")] * 2)
    assert len(ids) == 2 and all(i.startswith("sim_") for i in ids)
    assert len(provider.sent) == 2


async def test_simulated_provider_enforces_batch_limit():
    with pytest.raises(ValueError):
        await email_provider.SimulatedProvider().send_batch(
            [OutgoingEmail(to="a@b.com", subject="s", html="h")] * 101
        )
