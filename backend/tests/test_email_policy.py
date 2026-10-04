"""Política de envío (v4 §2.1) y catálogo de avisos — sin base ni red."""
import ast
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.models.email import EmailCategory
from app.services.email import policy
from app.services.email.catalog import RULES, Rule, rule_for
from app.services.email.policy import AR_TZ, Defer, Recipient, Send, Skip, decide


def ar(y, m, d, h, mi=0) -> datetime:
    """Hora de Argentina → UTC, que es como llega `now` al dispatcher."""
    return datetime(y, m, d, h, mi, tzinfo=AR_TZ).astimezone(timezone.utc)


OK = Recipient(email="ana@mail.com", is_active=True, deleted=False, suppressed=False, category_enabled=True)
NORMAL = Rule(EmailCategory.postulaciones)
CRITICO = Rule(EmailCategory.cuenta, critical=True)
MEDIODIA = ar(2026, 10, 5, 12)


def d(rule=NORMAL, recipient=OK, now=MEDIODIA, enabled=True, template=True, sent=0):
    return decide(rule, recipient, now=now, emails_enabled=enabled, template_enabled=template,
                  sent_today_noncritical=sent)


# --- se descarta ---------------------------------------------------------------------------

def test_global_switch_off_skips_everything_even_critical():
    assert isinstance(d(CRITICO, enabled=False), Skip)


def test_template_disabled_by_talency_skips():
    assert isinstance(d(template=False), Skip)


@pytest.mark.parametrize("cambio", [
    {"deleted": True}, {"is_active": False}, {"suppressed": True},
    {"email": "eliminado+123@bbjobs.invalid"},
])
def test_unreachable_recipients_are_skipped_even_for_critical(cambio):
    recipient = Recipient(**{**OK.__dict__, **cambio})
    assert isinstance(d(CRITICO, recipient=recipient), Skip)


def test_user_opt_out_skips_optional_categories():
    sin_ganas = Recipient(**{**OK.__dict__, "category_enabled": False})
    assert isinstance(d(NORMAL, recipient=sin_ganas), Skip)


def test_opt_out_does_not_apply_to_account_category():
    # Una preferencia vieja en `cuenta` (que no debería existir) no apaga los avisos de pago.
    sin_ganas = Recipient(**{**OK.__dict__, "category_enabled": False})
    assert isinstance(d(CRITICO, recipient=sin_ganas), Send)


# --- franja horaria (R2) y críticos (R3) ---------------------------------------------------

@pytest.mark.parametrize("hora,sale", [(7, False), (8, True), (12, True), (20, True), (21, False), (23, False)])
def test_send_window_08_to_21_argentina(hora, sale):
    decision = d(now=ar(2026, 10, 5, hora, 30 if hora == 20 else 0))
    assert isinstance(decision, Send) is sale


def test_outside_window_defers_to_next_8am_argentina():
    noche = d(now=ar(2026, 10, 5, 23))
    assert isinstance(noche, Defer)
    assert noche.until == ar(2026, 10, 6, 8)

    madrugada = d(now=ar(2026, 10, 6, 3))
    assert madrugada.until == ar(2026, 10, 6, 8)


def test_critical_ignores_window_and_daily_cap():
    assert isinstance(d(CRITICO, now=ar(2026, 10, 5, 3), sent=50), Send)


# --- tope por persona (R4) -----------------------------------------------------------------

def test_third_noncritical_mail_of_the_day_moves_to_tomorrow():
    assert isinstance(d(sent=1), Send)
    tercero = d(sent=2)
    assert isinstance(tercero, Defer)
    assert tercero.until == ar(2026, 10, 6, 8)


def test_local_day_start_uses_argentina_midnight():
    # 01:00 UTC del 6/10 son las 22:00 del 5/10 en Argentina: el día sigue siendo el 5.
    now = datetime(2026, 10, 6, 1, 0, tzinfo=timezone.utc)
    assert policy.local_day_start(now) == ar(2026, 10, 5, 0)


# --- catálogo -----------------------------------------------------------------------------

_NOTIFY = {"create_notification", "notify_all_admins"}
_TYPE_LIKE = re.compile(r"^[a-z]+(?:_[a-z]+)+$")


def _strings(node: ast.AST) -> set[str]:
    return {
        n.value for n in ast.walk(node)
        if isinstance(n, ast.Constant) and isinstance(n.value, str) and _TYPE_LIKE.match(n.value)
    }


def _types_emitted_in_code() -> set[str]:
    """Los `type` de cada llamada a create_notification / notify_all_admins, leídos con `ast`.

    - `type="x"` o `type="a" if c else "b"`: las constantes de la expresión.
    - `type=variable` (p. ej. `notif_type`): las constantes que se le asignan a esa variable y
      los primeros elementos de las tuplas de la función (el diccionario de estados)."""
    found: set[str] = set()
    app_dir = Path(__file__).resolve().parents[1] / "app"
    for path in app_dir.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for func in ast.walk(tree):
            if not isinstance(func, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for call in ast.walk(func):
                if not (isinstance(call, ast.Call) and getattr(call.func, "id", getattr(call.func, "attr", None)) in _NOTIFY):
                    continue
                type_kw = next((k.value for k in call.keywords if k.arg == "type"), None)
                if type_kw is None or (isinstance(type_kw, ast.Name) and type_kw.id == "type"):
                    continue  # el propio notify_all_admins reenviando su parámetro
                if isinstance(type_kw, ast.Name):
                    for node in ast.walk(func):
                        if isinstance(node, ast.Assign) and any(
                            isinstance(t, ast.Name) and t.id == type_kw.id for t in node.targets
                        ):
                            found |= _strings(node.value)
                        if isinstance(node, ast.Tuple) and node.elts and isinstance(node.elts[0], ast.Constant):
                            found |= _strings(node.elts[0])
                else:
                    found |= _strings(type_kw)
    return found


def test_every_notification_type_in_the_code_has_a_rule():
    emitted = _types_emitted_in_code()
    assert len(emitted) >= 30, emitted  # si baja mucho, el escaneo se rompió
    missing = sorted(t for t in emitted if t not in RULES)
    assert missing == [], f"Tipos sin regla en services/email/catalog.py: {missing}"


def test_unknown_type_sends_no_email():
    assert rule_for("tipo_que_no_existe").mode == "none"


def test_payments_and_account_status_are_critical_and_cannot_be_turned_off():
    for t in ("company_verified", "company_suspended", "job_feature_active", "talent_pack_rejected"):
        assert RULES[t].critical and not RULES[t].unsubscribable


def test_discarded_waits_24h_and_revalidates():
    rule = RULES["application_discarded"]
    assert rule.delay == timedelta(hours=24)
    assert rule.still_valid is not None


def test_company_new_applications_go_to_the_digest_not_one_by_one():
    assert RULES["application_new"].mode == "digest"
