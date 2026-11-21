"""Respuestas entrantes, rebotes duros vs. transitorios, frenos y la API de Mails del admin
(LANZAMIENTO-PLAN.md). Contra Postgres descartable; Resend simulado."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_email_dispatch_db import (  # noqa: F401  (los fixtures se importan para que pytest los vea)
    TEST_DB, WHSEC, NOON, _get, _row, _signed, _user, client, maker,
)

pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    from sqlalchemy import select, text

    from app.api.deps import get_current_user
    from app.core.config import settings
    from app.models.core import User
    from app.models.email import EmailOutbox, EmailReply, EmailSuppression
    from app.models.prospect import Prospect, ProspectEmail, ProspectEvent, ProspectStage
    from app.services.account_deletion import delete_account  # noqa: F401
    from app.services.email import inbox
    from app.services.email.retention import purge_old_content


def _received(email_id="re_in_1", sender="Ana Pérez <ana@mail.com>", to="hola@r.bbjobs.com.ar", subject="Re: tu aviso"):
    return {"type": "email.received", "data": {"email_id": email_id, "from": sender, "to": [to], "subject": subject}}


@pytest.fixture(autouse=True)
def _config(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", WHSEC)


@pytest.fixture
def cuerpo(monkeypatch):
    """Resend simulado: devuelve el cuerpo de la respuesta (y los headers) que se le pida."""
    state = {"content": {"text": "Hola, me interesa. Adjunto mi CV.", "headers": {}}, "calls": 0}

    async def fake(email_id, *, api_key=None):
        state["calls"] += 1
        return state["content"]

    monkeypatch.setattr(inbox.resend_client, "get_received_email", fake)
    return state


async def _sent(maker, uid, **kw):
    """Un mail ya enviado (el helper `_row` de los otros tests deja todo en `pending`)."""
    rid = await _row(maker, uid, **kw)
    async with maker() as db:
        await db.execute(text("UPDATE email_outbox SET status = 'sent', sent_at = now() WHERE id = :i"), {"i": rid})
        await db.commit()
    return rid


async def _post(client, payload):
    body, headers = _signed(payload)
    resp = await client.post("/api/v1/webhooks/resend", content=body, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _replies(maker):
    async with maker() as db:
        return list((await db.execute(select(EmailReply))).scalars().all())


# ── Recepción ───────────────────────────────────────────────────────────────────────────

async def test_reply_is_stored_once_and_linked_to_the_user(client, maker, cuerpo):
    uid = await _user(maker, email="ana@mail.com")
    for _ in range(2):   # Resend reintenta
        assert (await _post(client, _received()))["status"] == "ok"
    replies = await _replies(maker)
    assert len(replies) == 1 and cuerpo["calls"] == 1
    r = replies[0]
    assert r.from_email == "ana@mail.com" and r.user_id == uid and r.status == "nueva"
    assert "me interesa" in r.body and r.subject == "Re: tu aviso"


async def test_reply_is_linked_by_the_token_in_the_reply_to(client, maker, cuerpo):
    uid = await _user(maker, email="otra@mail.com")
    rid = await _row(maker, uid, to="otra@mail.com")
    # Contesta desde una dirección distinta: el token del Reply-To manda.
    await _post(client, _received(sender="alias@otro.com", to=f"hola+{rid.hex}@r.bbjobs.com.ar"))
    r = (await _replies(maker))[0]
    assert r.outbox_id == rid and r.user_id == uid


async def test_automatic_replies_and_our_own_mail_are_not_stored(client, maker, cuerpo):
    cuerpo["content"] = {"text": "Estoy fuera de la oficina", "headers": {"Auto-Submitted": "auto-replied"}}
    assert (await _post(client, _received("re_a1")))["inbox"] == "auto"
    cuerpo["content"] = {"text": "x", "headers": {}}
    assert (await _post(client, _received("re_a2", subject="Respuesta automática: tu aviso")))["inbox"] == "auto"
    assert (await _post(client, _received("re_a3", sender="BBJobs <avisos@avisos.bbjobs.com.ar>")))["inbox"] == "propio"
    assert await _replies(maker) == []


async def test_attachments_are_never_requested_or_stored(client, maker, cuerpo):
    cuerpo["content"] = {"text": "Mi CV va adjunto", "attachments": [{"filename": "cv.pdf", "content": "JVBERi0x"}],
                         "headers": {}}
    payload = _received("re_att")
    payload["data"]["attachments"] = [{"id": "att_1", "filename": "cv.pdf"}]
    await _post(client, payload)
    r = (await _replies(maker))[0]
    assert "JVBERi0x" not in r.body and "cv.pdf" not in r.body


async def test_prospect_reply_moves_the_stage_and_cancels_follow_ups(client, maker, cuerpo):
    async with maker() as db:
        p = Prospect(id=uuid.uuid4(), external_id=f"x-{uuid.uuid4().hex}", name="Ferretería Sur",
                     stage=ProspectStage.contactada.value)
        db.add(p)
        await db.flush()
        db.add(ProspectEmail(id=uuid.uuid4(), prospect_id=p.id, email="info@ferreteriasur.com", is_primary=True))
        await db.commit()
        pid = p.id
    await _post(client, _received(sender="info@ferreteriasur.com"))
    async with maker() as db:
        p = (await db.execute(select(Prospect).where(Prospect.id == pid))).scalar_one()
        events = [e.kind for e in (await db.execute(select(ProspectEvent).where(ProspectEvent.prospect_id == pid))).scalars()]
    assert p.stage == ProspectStage.respondio.value and not p.do_not_contact and events == ["respuesta"]
    assert (await _replies(maker))[0].prospect_id == pid


async def test_prospect_asking_to_stop_is_unsubscribed(client, maker, cuerpo):
    cuerpo["content"] = {"text": "Por favor no me escriban más.\n\n> mensaje original: dar de baja", "headers": {}}
    async with maker() as db:
        p = Prospect(id=uuid.uuid4(), external_id=f"x-{uuid.uuid4().hex}", name="Kiosco Norte",
                     stage=ProspectStage.contactada.value)
        db.add(p)
        await db.flush()
        db.add(ProspectEmail(id=uuid.uuid4(), prospect_id=p.id, email="kiosco@norte.com", is_primary=True))
        await db.commit()
        pid = p.id
    await _post(client, _received(sender="kiosco@norte.com"))
    async with maker() as db:
        p = (await db.execute(select(Prospect).where(Prospect.id == pid))).scalar_one()
    assert p.do_not_contact and p.do_not_contact_reason == "respuesta"


def test_unsubscribe_phrases():
    assert inbox.wants_unsubscribe("Les pido la baja de este mail")
    assert inbox.wants_unsubscribe("no queremos recibir más mails")
    assert not inbox.wants_unsubscribe("Gracias, me interesa la búsqueda de cajero")
    assert not inbox.wants_unsubscribe("Hola. " + "x" * 700 + " baja")        # sólo se mira el principio


# ── Rebotes ─────────────────────────────────────────────────────────────────────────────

async def test_transient_bounce_does_not_suppress_or_count_for_health(client, maker):
    uid = await _user(maker)
    rid = await _sent(maker, uid, provider_message_id="re_t1")
    await _post(client, {"type": "email.bounced", "data": {
        "email_id": "re_t1", "to": ["ana@mail.com"], "bounce": {"type": "Transient", "subType": "MailboxFull"}}})
    row = await _get(maker, rid)
    assert row.bounced_at is not None and row.bounce_permanent is False
    async with maker() as db:
        assert (await db.execute(select(EmailSuppression))).first() is None


async def test_permanent_bounce_suppresses(client, maker):
    uid = await _user(maker)
    rid = await _sent(maker, uid, provider_message_id="re_p1")
    await _post(client, {"type": "email.bounced", "data": {
        "email_id": "re_p1", "to": ["ana@mail.com"], "bounce": {"type": "Permanent"}}})
    assert (await _get(maker, rid)).bounce_permanent is True
    async with maker() as db:
        assert [s.email for s in (await db.execute(select(EmailSuppression))).scalars()] == ["ana@mail.com"]


async def test_health_ignores_transient_bounces(maker):
    from app.services.email import digests

    uid = await _user(maker)
    now = datetime.now(timezone.utc)
    async with maker() as db:
        for i in range(120):
            db.add(EmailOutbox(
                id=uuid.uuid4(), user_id=uid, to_email=f"u{i}@mail.com", category="postulaciones",
                template_key="application_selected", subject="s", html="h", status="sent", sent_at=now,
                bounced_at=now if i < 10 else None, bounce_permanent=False if i < 10 else None))
        await db.commit()
        assert not (await digests.email_health(db, now))["unhealthy"]      # 10 transitorios no frenan
        await db.execute(text("UPDATE email_outbox SET bounce_permanent = true"))
        await db.commit()
        health = await digests.email_health(db, now)
        assert health["unhealthy"] and health["bounce_pct"] > 4             # los mismos 10, duros, sí


async def test_prospect_dispatch_stops_when_the_account_is_unhealthy(maker, monkeypatch):
    """Con la cuenta sobre los límites de Resend la prospección es lo primero que se corta."""
    from app.services.email import prospect_dispatch as pd

    uid = await _user(maker)
    now = NOON
    async with maker() as db:
        for i in range(120):
            db.add(EmailOutbox(
                id=uuid.uuid4(), user_id=uid, to_email=f"u{i}@mail.com", category="postulaciones",
                template_key="application_selected", subject="s", html="h", status="sent", sent_at=now,
                bounced_at=now if i < 10 else None))
        await db.commit()
    sender = pd.SimulatedProspectSender()
    stats = await pd.dispatch_prospects(session_maker=maker, sender=sender, now=now, use_configured_sender=False)
    assert stats.sent == 0 and sender.sent == []


# ── Borrado y retención ─────────────────────────────────────────────────────────────────

async def test_replies_are_deleted_with_the_account_and_purged_after_90_days(client, maker, cuerpo):
    uid = await _user(maker, email="ana@mail.com")
    await _post(client, _received())
    async with maker() as db:
        await db.execute(text("UPDATE email_replies SET received_at = now() - interval '100 days'"))
        await db.commit()
        assert await purge_old_content(db) >= 1
        await db.commit()
        r = (await db.execute(select(EmailReply))).scalar_one()
        assert r.body == "" and r.subject == "(contenido vencido)"
        await db.execute(EmailReply.__table__.delete().where(EmailReply.user_id == uid))   # lo mismo que hace delete_account
        await db.commit()
        assert (await db.execute(select(EmailReply))).first() is None


# ── API del admin ───────────────────────────────────────────────────────────────────────

async def _as(client, maker, role="admin"):
    from app.main import app

    uid = await _user(maker, email=f"{role}-{uuid.uuid4().hex[:6]}@bbjobs.com.ar", role=role)
    async with maker() as db:
        user = (await db.execute(select(User).where(User.id == uid))).scalar_one()
    app.dependency_overrides[get_current_user] = lambda: user
    return user


async def test_admin_lists_sent_mails_filters_and_hides_the_body(client, maker):
    await _as(client, maker)
    uid = await _user(maker, email="cand@mail.com", role="candidate")
    rid = await _sent(maker, uid, to="cand@mail.com")
    async with maker() as db:
        await db.execute(text("UPDATE email_outbox SET delivered_at = now() WHERE id = :i"), {"i": rid})
        await db.commit()
    await _sent(maker, uid, to="rebota@mail.com")
    async with maker() as db:
        await db.execute(text("UPDATE email_outbox SET bounced_at = now() WHERE to_email = 'rebota@mail.com'"))
        await db.commit()
    d = (await client.get("/api/v1/admin/mail/sent")).json()
    assert d["total"] == 2 and all("html" not in i and "text" not in i for i in d["items"])
    assert {i["to_email"]: i["delivery"] for i in d["items"]} == {"cand@mail.com": "entregado", "rebota@mail.com": "rebotado"}
    only = (await client.get("/api/v1/admin/mail/sent", params={"delivery": "rebotado"})).json()
    assert [i["to_email"] for i in only["items"]] == ["rebota@mail.com"]
    found = (await client.get("/api/v1/admin/mail/sent", params={"q": "CAND@"})).json()
    assert found["total"] == 1


async def test_admin_replies_inbox_and_mark_as_handled(client, maker, cuerpo):
    admin = await _as(client, maker)
    await _post(client, _received())
    d = (await client.get("/api/v1/admin/mail/replies")).json()
    assert d["total"] == 1 and d["new"] == 1 and d["items"][0]["kind"] == "desconocido"
    rid = d["items"][0]["id"]
    assert (await client.patch(f"/api/v1/admin/mail/replies/{rid}", json={"status": "atendida"})).status_code == 200
    assert (await client.get("/api/v1/admin/mail/replies")).json()["total"] == 0           # ya no está en "nuevas"
    assert (await client.get("/api/v1/admin/mail/replies", params={"status": "atendida"})).json()["total"] == 1
    async with maker() as db:
        r = (await db.execute(select(EmailReply))).scalar_one()
    assert r.attended_by_user_id == admin.id and r.attended_at is not None
    assert (await client.patch(f"/api/v1/admin/mail/replies/{uuid.uuid4()}", json={"status": "nueva"})).status_code == 404


async def test_admin_health_reports_rates_limits_and_no_domains_without_a_key(client, maker, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    await _as(client, maker)
    uid = await _user(maker, role="candidate")
    await _sent(maker, uid)
    h = (await client.get("/api/v1/admin/mail/health")).json()
    assert h["bounce_limit_pct"] == 4.0 and h["complaint_limit_pct"] == 0.08 and h["unhealthy"] is False
    assert h["resend_configured"] is False and h["domains"] is None and len(h["daily"]) == 14


async def test_admin_health_lists_domains_when_resend_answers(client, maker, monkeypatch):
    from app.api.v1 import admin_mail

    async def fake_domains(*, api_key=None):
        return [{"name": "avisos.bbjobs.com.ar", "status": "verified"}, {"name": "r.bbjobs.com.ar", "status": "pending"}]

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(admin_mail.resend_client, "list_domains", fake_domains)
    await _as(client, maker)
    h = (await client.get("/api/v1/admin/mail/health")).json()
    assert [(d["name"], d["verified"]) for d in h["domains"]] == [
        ("avisos.bbjobs.com.ar", True), ("r.bbjobs.com.ar", False)]


async def test_mail_endpoints_are_admin_only_and_hidden_with_the_gate_closed(client, maker, monkeypatch):
    for path in ("sent", "replies", "health"):
        await _as(client, maker, role="candidate")
        assert (await client.get(f"/api/v1/admin/mail/{path}")).status_code == 403
    await _as(client, maker)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    for path in ("sent", "replies", "health"):
        assert (await client.get(f"/api/v1/admin/mail/{path}")).status_code == 404
