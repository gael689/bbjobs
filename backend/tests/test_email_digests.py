"""Resúmenes: piezas puras (puntaje semanal, listas en el mail, texto del aviso al candidato)."""
import uuid
from types import SimpleNamespace

from app.services.email.copy import DIGESTS
from app.services.email.digests import score_for_candidate
from app.services.email.render import EmailItem, render_email

IND, Z1, Z2 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()


def _job(**kw):
    base = dict(industry_id=IND, zone_id=Z1, modality="presencial")
    base.update(kw)
    return SimpleNamespace(**base)


def test_weekly_score_prefers_zone_and_shared_skills():
    s1, s2 = uuid.uuid4(), uuid.uuid4()
    cerca = score_for_candidate(_job(), {s1}, {s1}, Z1, {"onsite"})
    lejos = score_for_candidate(_job(), {s1}, set(), Z2, {"remote"})
    assert cerca > lejos and cerca >= 3 > lejos


def test_weekly_score_uses_zone_proximity_not_exact_zone():
    z_norte, z_suarez = uuid.uuid4(), uuid.uuid4()
    slugs = {Z1: "bahia-blanca", z_norte: "zona-norte", z_suarez: "coronel-suarez"}
    exacta = score_for_candidate(_job(), set(), set(), Z1, {"onsite"}, slugs)
    vecina = score_for_candidate(_job(), set(), set(), z_norte, {"onsite"}, slugs)
    lejana = score_for_candidate(_job(), set(), set(), z_suarez, {"onsite"}, slugs)
    # La zona pesa poco y nada (ZONE_POINTS = 0,5): la modalidad suma 1 y la cercanía, medio punto.
    assert exacta == vecina == 1.5 and lejana == 1.125
    assert score_for_candidate(_job(), set(), set(), None, {"onsite"}, slugs) == 1


def test_remote_jobs_count_as_close_for_everyone():
    assert score_for_candidate(_job(modality="remoto"), set(), set(), Z2, set()) == 1.5


def test_items_render_as_links_escaped_and_in_plain_text():
    out = render_email(heading="h", body="b", items=[
        EmailItem("Cajero <b>", "Centro · presencial", "/empleos/1"),
        EmailItem("Sin link", None, "javascript:alert(1)"),
    ])
    assert "Cajero &lt;b&gt;" in out.html and "/empleos/1" in out.html
    assert "javascript:" not in out.html
    assert "- Cajero <b> (Centro · presencial)" in out.text


def test_match_alert_copy_singular_and_plural():
    copy = DIGESTS["aviso_busquedas"]
    assert copy.source == "propuesto" and copy.item_cta == "Postularme"
    assert copy.for_count(1).subject == "Hay una búsqueda que encaja con tu perfil"
    many = copy.for_count(3)
    assert many.subject == "Hay 3 búsquedas que encajan con tu perfil"
    assert "3 búsquedas" in many.heading and many.intro.startswith("Las elegimos")
