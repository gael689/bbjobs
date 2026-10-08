"""Textos de los mails (PDF de Eugenia, 08/10/2026): variables, negritas seguras y firma."""
import uuid

from app.models.email import EmailCategory
from app.models.job import NOT_ADVANCED_STATUSES, SELECTABLE_STATUSES, ApplicationStatus
from app.services.email.catalog import RULES
from app.services.email.copy import COPY, DIGESTS, fill_copy, first_name, greeting
from app.services.email.outbox import build_content

UID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _build(type_, **variables):
    rule = RULES[type_]
    return build_content(
        user_id=UID, category=rule.category, title="t", body="b", link="/dashboard/candidate/postulaciones",
        cta_label=rule.cta_label, unsubscribable=rule.unsubscribable, override=None,
        type=type_, variables=variables, role="candidate",
    )


def test_every_copy_has_a_catalog_rule():
    assert set(COPY) <= set(RULES)
    assert set(DIGESTS) <= set(RULES)


def test_eugenia_subjects_with_job_title():
    subject, r = _build("application_sent", nombre="Ana", puesto="Vendedor/a")
    assert subject == "Postulación confirmada: Vendedor/a"
    assert "¡Hola, Ana!" in r.html and "¡Tu postulación quedó registrada!" in r.html
    assert "<strong>Vendedor/a</strong>" in r.html
    assert "Ver mis postulaciones" in r.html


def test_greeting_without_name_falls_back():
    assert greeting("") == "¡Hola!"
    _, r = _build("application_seen", puesto="X")
    assert "¡Hola!" in r.html


def test_first_name():
    assert first_name("María José Pérez") == "María"
    assert first_name("  ") == ""
    assert first_name(None) == ""


def test_user_values_cannot_inject_bold_or_html():
    subject, r = _build("application_in_process", nombre="<b>Ana</b>", puesto="**Gerente** <script>x</script>")
    assert "<script>" not in r.html and "&lt;script&gt;" in r.html
    assert "**" not in subject
    assert "<b>Ana</b>" not in r.html


def test_empty_variable_paragraph_is_dropped():
    copy = COPY["company_rejected"]
    sin = fill_copy(copy, {"empresa": "ACME", "detalle": ""}, None)
    con = fill_copy(copy, {"empresa": "ACME", "detalle": "Falta el CUIT"}, None)
    assert "Motivo" not in sin.body
    assert "**Motivo:** Falta el CUIT" in con.body


def test_visible_company_message_goes_inside_the_mail():
    _, r = _build("application_discarded", nombre="Ana", puesto="X", mensaje_empresa="Gracias por postularte")
    assert "Mensaje de la empresa:" in r.html and "Gracias por postularte" in r.html


def test_signature_and_manage_link():
    _, r = _build("application_sent", nombre="Ana", puesto="X")
    assert "BBJobs. El talento de Bahía, más cerca." in r.html
    assert "Una iniciativa de Talency." in r.html
    assert "Administrar notificaciones" in r.html and "/dashboard/candidate/perfil#mails" in r.html
    assert "Dejar de recibir estos mails" in r.html
    assert "**" not in r.text


def test_account_mails_have_no_unsubscribe():
    rule = RULES["company_verified"]
    assert rule.category == EmailCategory.cuenta
    subject, r = build_content(
        user_id=UID, category=rule.category, title="t", body="b", link=None, cta_label=rule.cta_label,
        unsubscribable=rule.unsubscribable, override=None, type="company_verified",
        variables={"empresa": "Logística Sur", "nombre": "Rocío"}, role="company",
    )
    assert subject == "Logística Sur ya puede publicar búsquedas en BBJobs"
    assert "Dejar de recibir" not in r.html
    assert "/dashboard/company/publicar" in r.html


def test_unknown_type_keeps_notification_text():
    subject, r = build_content(
        user_id=UID, category=EmailCategory.admin, title="Título viejo", body="Cuerpo viejo", link=None,
        cta_label="Ver", unsubscribable=False, override=None, type="admin_email_health", variables={},
    )
    assert subject == "Título viejo" and "Cuerpo viejo" in r.html


def test_selectable_statuses_follow_eugenia():
    assert ApplicationStatus.contacted not in SELECTABLE_STATUSES
    assert ApplicationStatus.finalist not in SELECTABLE_STATUSES
    assert ApplicationStatus.discarded_interview in SELECTABLE_STATUSES
    assert set(NOT_ADVANCED_STATUSES) == {ApplicationStatus.discarded, ApplicationStatus.discarded_interview}


def test_both_not_advanced_mails_wait_24h_and_revalidate():
    for key in ("application_discarded", "application_discarded_interview"):
        assert RULES[key].delay.total_seconds() == 24 * 3600
        assert RULES[key].still_valid is not None


def test_application_sent_is_one_per_application():
    assert RULES["application_sent"].once_per_day is False
