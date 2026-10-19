"""Textos de Eugenia para empresas (E3–E21, PDF del 19/10/2026): voz de empresa, WhatsApp desde
la configuración, variables nuevas y los avisos de regalos de Talency. Sin base de datos."""
import re
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import settings
from app.core.scheduler import days_until
from app.services.ai.jobs import recommended_email_vars
from app.services.email.catalog import RULES
from app.services.email.copy import COPY, DIGESTS, dias_texto, greeting
from app.services.email.outbox import build_content
from app.services.email.render import EmailItem, render_email

UID = uuid.UUID("00000000-0000-0000-0000-000000000002")

# E3–E21 en el orden del PDF de Eugenia (E21 es el resumen diario, en DIGESTS).
EUGENIA_EMPRESAS = [
    "company_rejected", "company_suspended", "company_reactivated", "company_onboarding_guide",
    "job_approved", "job_rejected", "job_takedown", "job_reopened", "job_deleted",
    "job_expiring_soon", "job_expired", "job_no_applications", "job_feature_active",
    "job_feature_rejected", "job_feature_expired", "talent_pack_active", "talent_pack_rejected",
    "recommended_candidates_new",
]
SAMPLE = {"nombre": "Rocío", "empresa": "Logística Sur", "puesto": "Operario/a", "dias": "3 días",
          "cantidad": 4, "cantidad_contactos": 10, "puestos": "A, B", "mensaje": "Te quedan 2.",
          "detalle": "x", "porcentaje": 60}


def _company(type_, **variables):
    rule = RULES[type_]
    return build_content(
        user_id=UID, category=rule.category, title="t", body="b", link="/dashboard/company",
        cta_label=rule.cta_label, unsubscribable=rule.unsubscribable, override=None,
        type=type_, variables=variables, role="company",
    )


def test_all_company_texts_from_the_pdf_are_eugenias():
    for key in EUGENIA_EMPRESAS:
        assert COPY[key].source == "eugenia", key
        assert COPY[key].voice == "empresa", key
        assert COPY[key].help_whatsapp and "{whatsapp}" in COPY[key].help_whatsapp, key
    assert DIGESTS["digest_empresa"].source == "eugenia"


def test_every_source_is_known_and_every_copy_has_a_rule():
    for key, copy in COPY.items():
        assert copy.source in ("eugenia", "propuesto"), key
        assert key in RULES, key
        for variant in copy.variants.values():
            assert variant.source in ("eugenia", "propuesto")
    for key, digest in DIGESTS.items():
        assert digest.source in ("eugenia", "propuesto"), key


@pytest.mark.parametrize("key", sorted(COPY))
def test_no_variable_is_left_unreplaced(key):
    copy = COPY[key]
    for variant in [None, *copy.variants]:
        variables = dict(SAMPLE, **({"variante": variant} if variant else {}))
        subject, r = _company(key, **variables)
        for text in (subject, r.html, r.text):
            assert not re.search(r"\{[a-z_]+\}", text), (key, variant, text[:200])


def test_company_voice_greeting_signature_and_whatsapp():
    subject, r = _company("job_approved", nombre="Rocío", puesto="Operario/a", enlace="/empleos/operario-x")
    assert subject == "Tu publicación fue aprobada"
    assert "Hola, Rocío:" in r.html and "¡Hola" not in r.html
    assert "Saludos," in r.html and "<strong>Equipo de BBJobs</strong>" in r.html
    assert "Una iniciativa de Talency" in r.html
    assert "El talento de Bahía" not in r.html          # esa firma es de los candidatos
    assert 'href="https://wa.me/5492915089353"' in r.html and ">291 508-9353</a>" in r.html
    assert "Ver mi publicación" in r.html and "/empleos/operario-x" in r.html
    assert "Hola, Rocío:" in r.text and "Equipo de BBJobs" in r.text
    assert "291 508-9353 (https://wa.me/5492915089353)" in r.text
    assert "<h1" not in r.html                            # sus textos de empresa no tienen título


def test_greeting_voices():
    assert greeting("Rocío", "empresa") == "Hola, Rocío:"
    assert greeting("", "empresa") == "Hola:"
    assert greeting("Ana") == "¡Hola, Ana!"


def test_whatsapp_link_comes_from_settings(monkeypatch):
    monkeypatch.setattr(settings, "TALENCY_WHATSAPP", "+54 9 291 000-1111")
    monkeypatch.setattr(settings, "TALENCY_WHATSAPP_DISPLAY", "291 000-1111")
    _, r = _company("company_reactivated", nombre="Rocío")
    assert 'href="https://wa.me/5492910001111"' in r.html and "291 000-1111" in r.html
    assert "5492915089353" not in r.html


def test_job_title_cannot_inject_bold_links_or_whatsapp():
    evil = '**Gerente** <a href="https://malo.example">clic</a> {whatsapp}'
    subject, r = _company("job_rejected", nombre="<b>R</b>", puesto=evil)
    assert "malo.example\">" not in r.html and "<a href=\"https://malo.example" not in r.html
    assert "&lt;a href=" in r.html
    assert r.html.count("https://wa.me/") == 1          # sólo el renglón fijo de ayuda
    assert "<strong>Gerente</strong>" not in r.html
    assert "<b>R</b>" not in r.html


def test_suspended_and_registration_have_no_button():
    _, r = _company("company_suspended", nombre="Rocío")
    assert "Ver en BBJobs" not in r.html and 'href="http' not in r.html.replace("https://wa.me", "")
    _, r = _company("welcome_company", nombre="Rocío", empresa="Logística Sur")
    assert "Ver en BBJobs" not in r.html


def test_rejections_do_not_carry_the_reason_in_the_mail():
    # P11: "consultá el motivo en tu cuenta"; el motivo no viaja en el mail.
    for key in ("company_rejected", "job_rejected"):
        _, r = _company(key, nombre="R", puesto="X", detalle="El aviso pide edad")
        assert "El aviso pide edad" not in r.html and "Motivo:" not in r.html


def test_days_variables():
    assert dias_texto(1) == "1 día" and dias_texto(20) == "20 días"
    now = datetime(2030, 1, 1, tzinfo=timezone.utc)
    assert days_until(now + timedelta(days=2, hours=20), now) == 3
    assert days_until(now + timedelta(days=3), now) == 3
    assert days_until(now + timedelta(hours=2), now) == 1
    _, r = _company("job_expiring_soon", nombre="R", puesto="X", dias=dias_texto(1))
    assert "vencerá en 1 día," in r.html
    _, r = _company("job_expired", nombre="R", puesto="X", dias=dias_texto(20))
    assert "plazo máximo de 20 días" in r.html and "30 días" not in r.html


def test_recommended_variants():
    assert recommended_email_vars(["Chofer"], 3) == {"cantidad": 3, "puesto": "Chofer"}
    assert recommended_email_vars(["Chofer"], 1) == {"variante": "uno", "puesto": "Chofer"}
    assert recommended_email_vars(["Chofer", "Cajero/a"], 4)["variante"] == "varias"
    s1, r1 = _company("recommended_candidates_new", nombre="R", **recommended_email_vars(["Chofer"], 3))
    assert s1 == "Tenés nuevos perfiles recomendados para tu búsqueda"
    assert "Identificamos 3 nuevos perfiles" in r1.html and "<strong>Chofer</strong>" in r1.html
    s2, r2 = _company("recommended_candidates_new", nombre="R", **recommended_email_vars(["Chofer"], 1))
    assert "un nuevo perfil que podría" in r2.html and "Tenés un nuevo perfil" in s2
    s3, r3 = _company("recommended_candidates_new", nombre="R",
                      **recommended_email_vars(["Chofer", "Cajero/a"], 4))
    assert s3.endswith("tus búsquedas") and "Chofer, Cajero/a" in r3.html
    assert "/dashboard/company/recomendados" in r1.html


def test_paid_feature_waiting_for_approval_does_not_say_active():
    _, r = _company("job_feature_active", nombre="R", puesto="X", variante="sin_aprobar")
    assert "ya está activo" not in r.html and "apenas la aprobemos" in r.html
    _, r = _company("job_feature_active", nombre="R", puesto="X")
    assert "que contrataste" in r.html and "ya está" in r.html


def test_gifts_from_talency_have_their_own_notice_without_payment_words():
    for key in ("job_feature_granted", "talent_pack_granted"):
        assert key in RULES and RULES[key].critical
        assert COPY[key].source == "propuesto" and "P9" in COPY[key].confirmar
        _, r = _company(key, nombre="R", puesto="X", cantidad_contactos=5)
        low = r.html.lower()
        assert "contrataste" not in low and "acredit" not in low and "tu compra" not in low
    _, r = _company("talent_pack_granted", nombre="R", cantidad_contactos=5)
    assert "Tenés 5 contactos" in r.html


def test_paid_pack_says_how_many_contacts():
    _, r = _company("talent_pack_active", nombre="R", cantidad_contactos=10)
    assert "Tu compra incluye 10 contactos" in r.html


def test_company_digest_has_list_then_outro_and_signature():
    d = DIGESTS["digest_empresa"]
    r = render_email(
        heading=d.heading, body=d.intro, cta_label=d.cta_label, cta_url="/dashboard/company/postulaciones",
        greeting=greeting("Rocío", d.voice), voice=d.voice, outro=d.outro, help_whatsapp=d.help_whatsapp,
        items=[EmailItem("Chofer", "4 postulaciones nuevas", "/dashboard/company/postulaciones")],
    )
    assert d.subject == "Tu resumen de postulaciones"
    html = r.html
    assert html.index("4 postulaciones nuevas") < html.index("Ingresá a tu cuenta para conocer") < html.index(
        "Ver postulaciones</a>") < html.index("wa.me") < html.index("Equipo de BBJobs")
    assert "Hola, Rocío:" in html


def test_candidate_mails_keep_their_voice():
    rule = RULES["application_sent"]
    _, r = build_content(
        user_id=UID, category=rule.category, title="t", body="b", link=None, cta_label=rule.cta_label,
        unsubscribable=rule.unsubscribable, override=None, type="application_sent",
        variables={"nombre": "Ana", "puesto": "X"}, role="candidate",
    )
    assert "¡Hola, Ana!" in r.html and "BBJobs. El talento de Bahía, más cerca." in r.html
    assert "wa.me" not in r.html and "Equipo de BBJobs" not in r.html
