"""Aceptación de términos y botón de arrepentimiento."""
import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.api.v1.contact import _ALFABETO, nuevo_codigo
from app.core.legal import LEGAL_VERSION
from app.models.contact import ContactTopic
from app.schemas.contact import ArrepentimientoCreate, ContactMessageCreate
from app.schemas.onboarding import CandidateOnboarding

FRONT_LEGAL = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "legal.ts"


def test_frontend_and_backend_share_the_legal_version():
    # Si difieren, el cartel del panel pide aceptar una versión distinta de la publicada.
    m = re.search(r'LEGAL_VERSION\s*=\s*"([^"]+)"', FRONT_LEGAL.read_text(encoding="utf-8"))
    assert m and m.group(1) == LEGAL_VERSION


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
