"""Aceptación de términos y botón de arrepentimiento."""
import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.api.v1.contact import _ALFABETO, nuevo_codigo
from app.core import legal as legal_core
from app.core.config import settings
from app.models.contact import ContactTopic
from app.schemas.contact import ArrepentimientoCreate, ContactMessageCreate
from app.schemas.onboarding import CandidateOnboarding

FRONT_LEGAL = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "legal.ts"


def test_frontend_and_backend_share_the_legal_versions():
    # Si difieren, el cartel del panel pide aceptar una versión distinta de la publicada.
    front = FRONT_LEGAL.read_text(encoding="utf-8")
    for name, value in (("LEGAL_VERSION_BASE", legal_core.LEGAL_VERSION_BASE),
                        ("LEGAL_VERSION_MODULOS", legal_core.LEGAL_VERSION_MODULOS)):
        m = re.search(name + r'\s*=\s*"([^"]+)"', front)
        assert m and m.group(1) == value, name


def test_the_v3_text_only_applies_with_the_gate_open(monkeypatch):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    assert legal_core.current_version() == "2.0"
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    assert legal_core.current_version() == "3.0"
    assert legal_core.current_version() in legal_core.AI_CONSENT_VERSIONS


def test_onboarding_accepts_without_the_field_for_old_frontends():
    assert CandidateOnboarding(first_name="A", last_name="B", phone="2914000000").acepta_terminos is False


def test_contact_form_cannot_create_a_withdrawal_without_code():
    with pytest.raises(ValidationError):
        ContactMessageCreate(name="A", phone="2914000000", topic=ContactTopic.arrepentimiento, message="x")


def test_withdrawal_requires_email_and_a_known_purchase():
    ok = ArrepentimientoCreate(name="Ana Paz", email="ana@empresa.com", compra="pack", detalle="Pack del 01/10")
    assert ok.phone is None
    with pytest.raises(ValidationError):
        ArrepentimientoCreate(name="Ana Paz", email="no-es-mail", compra="pack", detalle="Pack del 01/10")
    with pytest.raises(ValidationError):
        ArrepentimientoCreate(name="Ana Paz", email="ana@empresa.com", compra="auto", detalle="Pack del 01/10")


def test_tracking_code_is_easy_to_dictate():
    codes = {nuevo_codigo() for _ in range(200)}
    assert all(re.fullmatch(r"ARR-[A-Z2-9]{6}", c) for c in codes)
    assert not set("01IO") & set(_ALFABETO)
    assert len(codes) > 190
