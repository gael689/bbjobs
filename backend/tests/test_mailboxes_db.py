"""Casillas de prospección: reparto del cupo, frenos por casilla y la API del admin
(LANZAMIENTO-PLAN.md). Contra Postgres descartable; Resend simulado."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_email_dispatch_db import (  # noqa: F401  (los fixtures se importan para que pytest los vea)
    TEST_DB, WHSEC, _row, _signed, _user, client, maker,
)

pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    from sqlalchemy import select, text

    from app.api.deps import get_current_user
    from app.core.config import settings
    from app.models.core import User
    from app.models.email import EmailMailbox, EmailOutbox
    from app.models.prospect import Prospect
    from app.services.email import mailboxes, prospect_dispatch as pd
    from app.services.email.policy import AR_TZ

TEN = datetime(2030, 3, 6, 10, 0, tzinfo=AR_TZ).astimezone(timezone.utc) if TEST_DB else None   # miércoles, en franja


@pytest.fixture(autouse=True)
def _config(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", WHSEC)
    monkeypatch.setattr(settings, "PROSPECT_DAILY_CAP", 100)
    monkeypatch.setattr(settings, "PROSPECT_MODE", "simulate")
    monkeypatch.setattr(settings, "PROSPECT_REPLY_DOMAIN", "r.contacto.bbjobs.com.ar")
    monkeypatch.setattr(pd, "REQUEST_INTERVAL_SECONDS", 0)


async def _vaciar_casillas(maker):
    async with maker() as db:
        await db.execute(text("TRUNCATE email_mailboxes"))
        await db.commit()


@pytest.fixture(autouse=True)
async def _sin_casillas(maker):
    """El `maker` compartido no vacía las casillas (no cuelgan de `users`): cada test arranca sin
    ninguna y no deja ninguna para los de otros archivos (que mandan prospección)."""
    await _vaciar_casillas(maker)
    yield
    await _vaciar_casillas(maker)


async def _box(maker, address, limit=2, status="activa", name="", **kw):
    async with maker() as db:
        box = EmailMailbox(id=uuid.uuid4(), address=address, display_name=name, daily_limit=limit, status=status, **kw)
        db.add(box)
        await db.commit()
        return box.id


async def _queue(maker, n):
    """n mails de prospección pendientes, a n empresas distintas."""
    async with maker() as db:
        for i in range(n):
            p = Prospect(id=uuid.uuid4(), external_id=f"x-{uuid.uuid4().hex}", name=f"Empresa {i}")
            db.add(p)
            await db.flush()
            db.add(EmailOutbox(
                id=uuid.uuid4(), user_id=None, prospect_id=p.id, to_email=f"e{i}-{uuid.uuid4().hex[:6]}@empresa.com",
                category="prospeccion", template_key="prospeccion", subject="Hola", html="", text="Hola",
                status="pending", attempts=0, touch=1, scheduled_at=TEN - timedelta(hours=1)))
        await db.commit()


async def _rows(maker):
    async with maker() as db:
        return list((await db.execute(select(EmailOutbox).where(EmailOutbox.category == "prospeccion")
                                      .order_by(EmailOutbox.sent_at, EmailOutbox.created_at))).scalars().all())


# ── Direcciones ─────────────────────────────────────────────────────────────────────────

def test_the_root_domain_and_odd_addresses_are_rejected():
    assert mailboxes.parse_address(" Eugenia@Contacto.BBJobs.com.ar ") == ("eugenia@contacto.bbjobs.com.ar", "contacto.bbjobs.com.ar")
    for malo in ("eugenia@bbjobs.com.ar", "sin-arroba", "a b@contacto.bbjobs.com.ar", "@contacto.bbjobs.com.ar", ""):
        with pytest.raises(mailboxes.MailboxError):
            mailboxes.parse_address(malo)


# ── Reparto ─────────────────────────────────────────────────────────────────────────────

async def test_dispatch_spreads_the_quota_between_mailboxes_and_stops_at_their_limits(maker):
    await _box(maker, "eugenia@contacto.bbjobs.com.ar", limit=2, name="Eugenia · BBJobs")
    await _box(maker, "hola@contacto.bbjobs.com.ar", limit=2)
    await _queue(maker, 5)
    sender = pd.SimulatedProspectSender()
    stats = await pd.dispatch_prospects(session_maker=maker, sender=sender, now=TEN, use_configured_sender=False)
    assert stats.sent == 4                                                    # el cupo de las dos casillas
    desde = [m.from_email for m in sender.sent]
    assert sorted(desde) == ["Eugenia · BBJobs <eugenia@contacto.bbjobs.com.ar>"] * 2 + ["hola@contacto.bbjobs.com.ar"] * 2
    assert desde[0] != desde[1]                                              # se turnan: no manda todo una sola
    rows = await _rows(maker)
    assert sorted(r.status for r in rows) == ["pending", "sent", "sent", "sent", "sent"]
    assert {r.from_email for r in rows if r.status == "sent"} == {"eugenia@contacto.bbjobs.com.ar", "hola@contacto.bbjobs.com.ar"}

    # Al día siguiente el cupo se renueva; hoy, una segunda vuelta no manda nada más.
    again = await pd.dispatch_prospects(session_maker=maker, sender=sender, now=TEN + timedelta(minutes=5),
                                        use_configured_sender=False)
    assert again.sent == 0
    tomorrow = await pd.dispatch_prospects(session_maker=maker, sender=sender, now=TEN + timedelta(days=1),
                                           use_configured_sender=False)
    assert tomorrow.sent == 1


async def test_reply_to_carries_a_token_that_points_at_the_mail(maker):
    await _box(maker, "eugenia@contacto.bbjobs.com.ar")
    await _queue(maker, 1)
    sender = pd.SimulatedProspectSender()
    await pd.dispatch_prospects(session_maker=maker, sender=sender, now=TEN, use_configured_sender=False)
    row = (await _rows(maker))[0]
    assert sender.sent[0].reply_to == f"eugenia+{row.id.hex}@r.contacto.bbjobs.com.ar"


async def test_paused_and_inactive_mailboxes_are_never_used(maker):
    await _box(maker, "a@contacto.bbjobs.com.ar", status="pausada")
    await _box(maker, "b@contacto.bbjobs.com.ar", status="inactiva")
    await _box(maker, "c@contacto.bbjobs.com.ar", limit=1)
    await _queue(maker, 3)
    sender = pd.SimulatedProspectSender()
    await pd.dispatch_prospects(session_maker=maker, sender=sender, now=TEN, use_configured_sender=False)
    assert [m.from_email for m in sender.sent] == ["c@contacto.bbjobs.com.ar"]


async def test_without_mailboxes_the_old_fixed_sender_still_works(maker, monkeypatch):
    monkeypatch.setattr(settings, "PROSPECT_REPLY_TO", "hola@r.contacto.bbjobs.com.ar")
    await _queue(maker, 2)
    sender = pd.SimulatedProspectSender()
    stats = await pd.dispatch_prospects(session_maker=maker, sender=sender, now=TEN, use_configured_sender=False)
    assert stats.sent == 2 and all(m.from_email is None for m in sender.sent)
    assert all(m.reply_to == "hola@r.contacto.bbjobs.com.ar" for m in sender.sent)


# ── Frenos ──────────────────────────────────────────────────────────────────────────────

async def _sent_from(maker, address, n, **kw):
    uid = await _user(maker, email=f"u-{uuid.uuid4().hex[:6]}@mail.com")
    ids = []
    for _ in range(n):
        rid = await _row(maker, uid, category="prospeccion", key="prospeccion",
                         provider_message_id=f"re_{uuid.uuid4().hex[:10]}", **kw)
        ids.append(rid)
    async with maker() as db:
        await db.execute(text("UPDATE email_outbox SET status='sent', sent_at=now(), from_email=:a WHERE id = ANY(:ids)"),
                         {"a": address, "ids": ids})
        await db.commit()
    return ids


async def _event(client, kind, rid_pm, extra=None):
    body, headers = _signed({"type": kind, "data": {"email_id": rid_pm, "to": ["x@y.com"], **(extra or {})}})
    assert (await client.post("/api/v1/webhooks/resend", content=body, headers=headers)).status_code == 200


async def _provider_id(maker, rid):
    async with maker() as db:
        return (await db.execute(select(EmailOutbox.provider_message_id).where(EmailOutbox.id == rid))).scalar_one()


async def _status(maker, address):
    async with maker() as db:
        box = (await db.execute(select(EmailMailbox).where(EmailMailbox.address == address))).scalar_one()
        return box.status, box.status_reason


async def test_three_hard_bounces_pause_only_that_mailbox(client, maker):
    await _box(maker, "mala@contacto.bbjobs.com.ar")
    await _box(maker, "buena@contacto.bbjobs.com.ar")
    ids = await _sent_from(maker, "mala@contacto.bbjobs.com.ar", 5)
    for rid in ids[:2]:
        await _event(client, "email.bounced", await _provider_id(maker, rid), {"bounce": {"type": "Permanent"}})
    assert (await _status(maker, "mala@contacto.bbjobs.com.ar"))[0] == "activa"          # 2 de 5: todavía no
    await _event(client, "email.bounced", await _provider_id(maker, ids[2]), {"bounce": {"type": "Permanent"}})
    status, reason = (await _status(maker, "mala@contacto.bbjobs.com.ar"))
    assert status == "pausada" and "rebotes" in reason
    assert (await _status(maker, "buena@contacto.bbjobs.com.ar"))[0] == "activa"


async def test_transient_bounces_do_not_pause_a_mailbox(client, maker):
    await _box(maker, "a@contacto.bbjobs.com.ar")
    for rid in await _sent_from(maker, "a@contacto.bbjobs.com.ar", 5):
        await _event(client, "email.bounced", await _provider_id(maker, rid), {"bounce": {"type": "Transient"}})
    assert (await _status(maker, "a@contacto.bbjobs.com.ar"))[0] == "activa"


async def test_one_spam_complaint_pauses_the_mailbox_and_tells_the_team(client, maker):
    from app.models.alerts import Notification

    admin = await _user(maker, email="admin@bbjobs.com.ar", role="admin")
    await _box(maker, "a@contacto.bbjobs.com.ar")
    rid = (await _sent_from(maker, "a@contacto.bbjobs.com.ar", 10))[0]
    await _event(client, "email.complained", await _provider_id(maker, rid))
    status, reason = await _status(maker, "a@contacto.bbjobs.com.ar")
    assert status == "pausada" and "queja" in reason
    async with maker() as db:
        n = (await db.execute(select(Notification).where(Notification.type == "admin_email_health"))).scalars().all()
    assert [x.user_id for x in n] == [admin]


# ── API del admin ───────────────────────────────────────────────────────────────────────

async def _as(maker, role="admin"):
    from app.main import app

    uid = await _user(maker, email=f"{role}-{uuid.uuid4().hex[:6]}@bbjobs.com.ar", role=role)
    async with maker() as db:
        user = (await db.execute(select(User).where(User.id == uid))).scalar_one()
    app.dependency_overrides[get_current_user] = lambda: user


async def test_admin_creates_lists_pauses_and_reactivates_a_mailbox(client, maker):
    await _as(maker)
    r = await client.post("/api/v1/admin/mail/mailboxes",
                          json={"address": "Eugenia@contacto.bbjobs.com.ar", "display_name": "Eugenia", "daily_limit": 30})
    assert r.status_code == 201, r.text
    box = r.json()
    assert box["address"] == "eugenia@contacto.bbjobs.com.ar" and box["status"] == "activa" and box["daily_limit"] == 30
    assert (await client.post("/api/v1/admin/mail/mailboxes", json={"address": "eugenia@contacto.bbjobs.com.ar"})).status_code == 409
    assert (await client.post("/api/v1/admin/mail/mailboxes", json={"address": "eugenia@bbjobs.com.ar"})).status_code == 400

    r = await client.patch(f"/api/v1/admin/mail/mailboxes/{box['id']}", json={"status": "pausada", "daily_limit": 10})
    assert r.json()["status"] == "pausada" and r.json()["daily_limit"] == 10
    r = await client.patch(f"/api/v1/admin/mail/mailboxes/{box['id']}", json={"status": "activa"})
    assert r.json()["status"] == "activa" and r.json()["status_reason"] is None
    assert [b["address"] for b in (await client.get("/api/v1/admin/mail/mailboxes")).json()] == ["eugenia@contacto.bbjobs.com.ar"]
    assert (await client.patch(f"/api/v1/admin/mail/mailboxes/{uuid.uuid4()}", json={"status": "pausada"})).status_code == 404


async def test_a_mailbox_on_an_unverified_domain_is_created_inactive_and_cannot_be_activated(client, maker, monkeypatch):
    async def dominios(*, api_key=None):
        return [{"name": "contacto.bbjobs.com.ar", "status": "pending"}]

    monkeypatch.setattr(settings, "PROSPECT_MODE", "resend")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(mailboxes.resend_client, "list_domains", dominios)
    await _as(maker)
    box = (await client.post("/api/v1/admin/mail/mailboxes", json={"address": "a@contacto.bbjobs.com.ar"})).json()
    assert box["status"] == "inactiva" and "verificado" in box["status_reason"]
    r = await client.patch(f"/api/v1/admin/mail/mailboxes/{box['id']}", json={"status": "activa"})
    assert r.status_code == 409

    async def verificado(*, api_key=None):
        return [{"name": "contacto.bbjobs.com.ar", "status": "verified"}]

    monkeypatch.setattr(mailboxes.resend_client, "list_domains", verificado)
    assert (await client.patch(f"/api/v1/admin/mail/mailboxes/{box['id']}", json={"status": "activa"})).json()["status"] == "activa"


async def test_mailbox_listing_counts_sent_bounced_and_complained(client, maker):
    await _as(maker)
    await _box(maker, "a@contacto.bbjobs.com.ar", limit=50)
    ids = await _sent_from(maker, "a@contacto.bbjobs.com.ar", 4)
    async with maker() as db:
        await db.execute(text("UPDATE email_outbox SET bounced_at=now() WHERE id = :i"), {"i": ids[0]})
        await db.execute(text("UPDATE email_outbox SET complained_at=now() WHERE id = :i"), {"i": ids[1]})
        await db.commit()
    box = (await client.get("/api/v1/admin/mail/mailboxes")).json()[0]
    assert (box["sent_today"], box["sent_14d"], box["bounced_14d"], box["complained_14d"]) == (4, 4, 1, 1)


async def test_mailbox_endpoints_are_admin_only_and_hidden_with_the_gate_closed(client, maker, monkeypatch):
    await _as(maker, role="candidate")
    assert (await client.get("/api/v1/admin/mail/mailboxes")).status_code == 403
    assert (await client.post("/api/v1/admin/mail/mailboxes", json={"address": "a@contacto.bbjobs.com.ar"})).status_code == 403
    await _as(maker)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    assert (await client.get("/api/v1/admin/mail/mailboxes")).status_code == 404
