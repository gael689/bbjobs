"""Mails de Eugenia (08/10/2026) contra un Postgres real: estados nuevos, vista previa del mail al
cambiar el estado y "¿Seguís buscando trabajo?" a la semana sin entrar.

Usa la base descartable de `TEST_DATABASE_URL` y el mundo de prueba de las notas (dos empresas,
un candidato postulado a las dos). Sin la variable se saltean.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from tests.test_application_notes_db import (  # noqa: F401  (fixtures)
    NOON,
    PRIVADA,
    TEST_DB,
    VISIBLE,
    _app,
    _mails,
    _notifs,
    _world,
    client,
    maker,
)

pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    from sqlalchemy import select, text

    from app.models.alerts import Notification
    from app.models.core import User
    from app.services import lifecycle
    from app.services.email import dispatcher
    from app.services.email.provider import SimulatedProvider


def _status_url(app_id) -> str:
    return f"/api/v1/me/company/applications/{app_id}/status"


# ── Vista previa del mail al cambiar el estado ────────────────────────────────────────

async def test_preview_shows_the_real_mail_with_name_and_job(client, maker):
    w = await _world(maker)
    a = w["a"]
    client.as_user(a["user"])
    r = await client.post(f"{_status_url(a['app'].id)}-preview", json={"status": "in_process"})
    assert r.status_code == 200
    data = r.json()
    assert data["sends_email"] is True and data["delay_hours"] == 0
    assert data["subject"] == f"Tu postulación avanzó: {a['job'].title}"
    assert "¡Hola, Ana!" in data["html"] and "¡Tu postulación avanzó!" in data["html"]
    # No cambió nada.
    assert (await _app(maker, a["app"].id)).status == "new"
    assert await _notifs(maker, w["cand_user"].id) == []


async def test_preview_includes_only_visible_notes(client, maker):
    w = await _world(maker)
    client.as_user(w["a"]["user"])
    url = f"{_status_url(w['a']['app'].id)}-preview"
    privada = (await client.post(url, json={"status": "discarded", "note": PRIVADA, "note_visible": False})).json()
    visible = (await client.post(url, json={"status": "discarded", "note": VISIBLE, "note_visible": True})).json()
    assert PRIVADA not in privada["html"] and PRIVADA not in privada["text"]
    assert VISIBLE in visible["html"] and "Mensaje de la empresa:" in visible["html"]
    assert visible["delay_hours"] == 24


async def test_preview_of_new_status_sends_no_email(client, maker):
    w = await _world(maker)
    client.as_user(w["a"]["user"])
    data = (await client.post(f"{_status_url(w['a']['app'].id)}-preview", json={"status": "new"})).json()
    assert data["sends_email"] is False and data["html"] is None


async def test_preview_of_another_company_application_is_404(client, maker):
    w = await _world(maker)
    client.as_user(w["a"]["user"])
    r = await client.post(f"{_status_url(w['b']['app'].id)}-preview", json={"status": "selected"})
    assert r.status_code == 404


async def test_preview_is_404_with_the_gate_closed(client, maker, monkeypatch):
    from app.core.config import settings

    w = await _world(maker)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    client.as_user(w["a"]["user"])
    r = await client.post(f"{_status_url(w['a']['app'].id)}-preview", json={"status": "selected"})
    assert r.status_code == 404


# ── Estados ─────────────────────────────────────────────────────────────────────────────

async def test_contacted_and_finalist_can_no_longer_be_chosen(client, maker):
    w = await _world(maker)
    client.as_user(w["a"]["user"])
    for status in ("contacted", "finalist"):
        r = await client.patch(_status_url(w["a"]["app"].id), json={"status": status})
        assert r.status_code == 422, status
    assert (await _app(maker, w["a"]["app"].id)).status == "new"


async def test_old_application_in_contacted_can_move_on(client, maker):
    w = await _world(maker)
    async with maker() as db:
        await db.execute(text("UPDATE applications SET status='contacted' WHERE id=:id"), {"id": w["a"]["app"].id})
        await db.commit()
    client.as_user(w["a"]["user"])
    assert (await client.patch(_status_url(w["a"]["app"].id), json={"status": "in_process"})).status_code == 200
    assert (await _app(maker, w["a"]["app"].id)).status == "in_process"


async def test_discarded_after_interview_waits_24h_and_cancels_if_status_changes(client, maker):
    w = await _world(maker)
    a = w["a"]
    client.as_user(a["user"])
    assert (await client.patch(_status_url(a["app"].id), json={"status": "discarded_interview"})).status_code == 200
    [mail] = await _mails(maker, w["cand_user"].id, "application_discarded_interview")
    assert mail.subject == f"Novedades sobre tu postulación a {a['job'].title}"
    assert "por compartir tu experiencia en las entrevistas" in mail.html
    assert mail.scheduled_at - mail.created_at >= timedelta(hours=23, minutes=59)

    # La empresa se arrepiente antes de las 24 h: el mail se cancela al revalidar.
    assert (await client.patch(_status_url(a["app"].id), json={"status": "in_process"})).status_code == 200
    stats = await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(),
                                          now=NOON + timedelta(days=400))
    async with maker() as db:
        from app.models.email import EmailOutbox

        estado = (await db.execute(select(EmailOutbox.status).where(EmailOutbox.id == mail.id))).scalar_one()
    assert estado == "canceled", stats


async def test_status_mail_carries_the_job_title(client, maker):
    w = await _world(maker)
    a = w["a"]
    client.as_user(a["user"])
    await client.patch(_status_url(a["app"].id), json={"status": "selected"})
    [mail] = await _mails(maker, w["cand_user"].id, "application_selected")
    assert mail.subject == f"¡Fuiste seleccionado/a para {a['job'].title}!"
    assert "¡Hola, Ana!" in mail.html


# ── "¿Seguís buscando trabajo?" ───────────────────────────────────────────────────────

async def _set_seen(maker, user_id, when):
    async with maker() as db:
        await db.execute(text("UPDATE users SET last_seen_at=:t, created_at=:t WHERE id=:id"),
                         {"t": when, "id": user_id})
        await db.commit()


async def _reactivations(maker, now) -> int:
    async with maker() as db:
        n = await lifecycle.reactivations(db, now)
        await db.commit()
    return n


async def test_reactivation_after_a_week_without_entering(maker):
    w = await _world(maker)
    now = datetime.now(timezone.utc)
    uid = w["cand_user"].id
    # Las postulaciones del mundo de prueba son de hoy: se las corre al pasado.
    async with maker() as db:
        await db.execute(text("UPDATE applications SET created_at=:t"), {"t": now - timedelta(days=30)})
        await db.commit()

    await _set_seen(maker, uid, now - timedelta(days=3))
    assert await _reactivations(maker, now) == 0          # entró hace 3 días

    await _set_seen(maker, uid, now - timedelta(days=8))
    assert await _reactivations(maker, now) == 1          # una semana sin entrar
    assert await _reactivations(maker, now + timedelta(days=10)) == 0   # como mucho cada 30 días


async def test_reactivation_stops_after_three_unanswered(maker):
    w = await _world(maker)
    now = datetime.now(timezone.utc)
    uid = w["cand_user"].id
    async with maker() as db:
        await db.execute(text("UPDATE applications SET created_at=:t"), {"t": now - timedelta(days=200)})
        await db.commit()
    await _set_seen(maker, uid, now - timedelta(days=200))
    async with maker() as db:
        for _ in range(3):
            db.add(Notification(user_id=uid, type="candidate_reactivation", title="t", body="b"))
        await db.commit()
    assert await _reactivations(maker, now) == 0


async def test_last_seen_is_touched_at_most_once_per_hour(maker, monkeypatch):
    from app.api import deps

    w = await _world(maker)
    monkeypatch.setattr(deps, "AsyncSessionLocal", maker)
    async with maker() as db:
        user = (await db.execute(select(User).where(User.id == w["cand_user"].id))).scalar_one()
    assert user.last_seen_at is None
    await deps._touch_last_seen(user)
    async with maker() as db:
        primero = (await db.execute(select(User.last_seen_at).where(User.id == user.id))).scalar_one()
    assert primero is not None
    user.last_seen_at = primero
    await deps._touch_last_seen(user)
    async with maker() as db:
        segundo = (await db.execute(select(User.last_seen_at).where(User.id == user.id))).scalar_one()
    assert segundo == primero
