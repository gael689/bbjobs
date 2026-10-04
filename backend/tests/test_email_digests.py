"""Resúmenes: piezas puras (coincidencia de alertas, puntaje semanal, listas en el mail)."""
import uuid
from types import SimpleNamespace

from app.services.email.digests import alert_matches, score_for_candidate
from app.services.email.render import EmailItem, render_email

IND, Z1, Z2 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()


def _job(**kw):
    base = dict(industry_id=IND, zone_id=Z1, modality="presencial")
    base.update(kw)
    return SimpleNamespace(**base)


def _alert(**kw):
    base = dict(industry_id=None, zone_id=None, modality=None)
    base.update(kw)
    return SimpleNamespace(**base)


def test_alert_filters_are_and_and_empty_means_any():
    assert alert_matches(_alert(), _job())
    assert alert_matches(_alert(industry_id=IND, zone_id=Z1), _job())
    assert not alert_matches(_alert(zone_id=Z2), _job())
    assert not alert_matches(_alert(modality="remoto"), _job())


def test_weekly_score_prefers_zone_and_shared_skills():
    s1, s2 = uuid.uuid4(), uuid.uuid4()
    cerca = score_for_candidate(_job(), {s1}, {s1}, Z1, {"onsite"})
    lejos = score_for_candidate(_job(), {s1}, set(), Z2, {"remote"})
    assert cerca > lejos and cerca >= 3 > lejos


def test_remote_jobs_count_as_close_for_everyone():
    assert score_for_candidate(_job(modality="remoto"), set(), set(), Z2, set()) >= 3


def test_items_render_as_links_escaped_and_in_plain_text():
    out = render_email(heading="h", body="b", items=[
        EmailItem("Cajero <b>", "Centro · presencial", "/empleos/1"),
        EmailItem("Sin link", None, "javascript:alert(1)"),
    ])
    assert "Cajero &lt;b&gt;" in out.html and "/empleos/1" in out.html
    assert "javascript:" not in out.html
    assert "- Cajero <b> (Centro · presencial)" in out.text
