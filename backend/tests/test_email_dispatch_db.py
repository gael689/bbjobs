"""Cola de mails contra un Postgres real: encolado, dispatcher, bajas y webhook de Resend.

Necesitan `TEST_DATABASE_URL` apuntando a una base **descartable** con las migraciones
aplicadas (lo arma `scripts/probar_local_mails.ps1`). Sin esa variable se saltean: nunca corren
contra la base de `DATABASE_URL`, que en `backend/.env` es producción.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.integrations.resend_client import EmailSendError
from app.services.email.provider import SimulatedProvider

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy import select, text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from svix.webhooks import Webhook

    from app.api.deps import get_db
    from app.core.config import settings
    from app.models.core import User
    from app.models.email import EmailOutbox, EmailPreference, EmailSuppression
    from app.models.settings import SettingKey, SiteSetting
    from app.services.email import dispatcher
    from app.services.email.policy import AR_TZ
    from app.services.email.tokens import make_unsubscribe_token
    from app.services.notifications import create_notification

# Un mediodía de un día hábil en el futuro: siempre posterior a `scheduled_at` de lo encolado.
NOON = datetime(2030, 3, 6, 12, 0, tzinfo=AR_TZ).astimezone(timezone.utc) if TEST_DB else None
WHSEC = "whsec_" + "dGVzdC1zZWNyZXQtcGFyYS1sb3MtdGVzdHMtMTIzNDU="


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE email_outbox, email_preferences, email_suppressions, email_templates, "
            "notifications, site_settings, users RESTART IDENTITY CASCADE"
        ))
    async with session_maker() as db:
        db.add(SiteSetting(key=SettingKey.emails_automaticos_activos.value, enabled=True))
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "EMAIL_MODE", "simulate")
    monkeypatch.setattr(settings, "EMAIL_DAILY_CAP", 0)
    monkeypatch.setattr(dispatcher, "REQUEST_INTERVAL_SECONDS", 0)
    yield session_maker
    await engine.dispose()


async def _user(maker, email="ana@mail.com", role="candidate", **kw) -> uuid.UUID:
    async with maker() as db:
        user = User(id=uuid.uuid4(), email=email, role=role, is_active=True, **kw)
        db.add(user)
        await db.commit()
        return user.id


async def _row(maker, user_id, *, to="ana@mail.com", category="postulaciones",
               key="application_selected", scheduled=None, **kw) -> uuid.UUID:
    async with maker() as db:
        row = EmailOutbox(
            id=uuid.uuid4(), user_id=user_id, to_email=to, category=category, template_key=key,
            subject="Asunto", html="<p>hola</p>", text="hola", status="pending", attempts=0,
            scheduled_at=scheduled or NOON - timedelta(minutes=1), **kw,
        )
        db.add(row)
        await db.commit()
        return row.id


async def _get(maker, row_id) -> "EmailOutbox":
    async with maker() as db:
        return (await db.execute(select(EmailOutbox).where(EmailOutbox.id == row_id))).scalar_one()


# ── Encolado ────────────────────────────────────────────────────────────────────────────

async def test_notification_enqueues_rendered_email_in_same_transaction(maker):
    uid = await _user(maker)
    async with maker() as db:
        await create_notification(db, user_id=uid, type="application_selected",
                                  title="¡Te seleccionaron!", body="Para 'Cajero'.",
                                  link="/dashboard/candidate/postulaciones")
        await db.commit()
        row = (await db.execute(select(EmailOutbox))).scalar_one()
    assert row.to_email == "ana@mail.com"
    assert row.category == "postulaciones"
    assert "¡Te seleccionaron!" in row.html and "/baja?t=" in row.html


async def test_rollback_of_the_event_drops_the_email_too(maker):
    uid = await _user(maker)
    async with maker() as db:
        await create_notification(db, user_id=uid, type="application_selected", title="t", body="b")
        await db.rollback()
    async with maker() as db:
        assert (await db.execute(select(EmailOutbox))).first() is None


async def test_nothing_is_enqueued_with_the_gate_closed(maker, monkeypatch):
    # Compuerta de módulos en desarrollo cerrada (producción): aunque el interruptor esté
    # prendido, no se encola nada.
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    uid = await _user(maker)
    async with maker() as db:
        await create_notification(db, user_id=uid, type="application_selected", title="t", body="b")
        await db.commit()
        assert (await db.execute(select(EmailOutbox))).first() is None


async def test_nothing_is_enqueued_with_the_switch_off(maker):
    uid = await _user(maker)
    async with maker() as db:
        await db.execute(text("UPDATE site_settings SET enabled = false"))
        await create_notification(db, user_id=uid, type="application_selected", title="t", body="b")
        await db.commit()
        assert (await db.execute(select(EmailOutbox))).first() is None


async def test_digest_and_web_only_types_are_not_enqueued(maker):
    uid = await _user(maker)
    async with maker() as db:
        await create_notification(db, user_id=uid, type="application_new", title="t", body="b")
        await create_notification(db, user_id=uid, type="application_new_status", title="t", body="b")
        await db.commit()
        assert (await db.execute(select(EmailOutbox))).first() is None


async def test_discarded_is_delayed_24h(maker):
    uid = await _user(maker)
    before = datetime.now(timezone.utc)
    async with maker() as db:
        await create_notification(db, user_id=uid, type="application_discarded", title="t", body="b",
                                  ref_id=uuid.uuid4())
        await db.commit()
        row = (await db.execute(select(EmailOutbox))).scalar_one()
    assert row.scheduled_at >= before + timedelta(hours=23, minutes=59)


# ── Dispatcher ──────────────────────────────────────────────────────────────────────────

async def test_dispatch_sends_with_unsubscribe_headers(maker):
    uid = await _user(maker)
    rid = await _row(maker, uid)
    provider = SimulatedProvider()
    stats = await dispatcher.dispatch_due(session_maker=maker, provider=provider, now=NOON)
    row = await _get(maker, rid)
    assert stats.sent == 1 and row.status == "sent" and row.provider_message_id.startswith("sim_")
    msg = provider.sent[0]
    assert msg.headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert msg.idempotency_key == f"outbox/{rid}"


async def test_account_emails_have_no_unsubscribe_header(maker):
    uid = await _user(maker)
    await _row(maker, uid, category="cuenta", key="company_verified")
    provider = SimulatedProvider()
    await dispatcher.dispatch_due(session_maker=maker, provider=provider, now=NOON)
    assert "List-Unsubscribe" not in provider.sent[0].headers


async def test_discarded_is_canceled_if_the_application_no_longer_is(maker):
    uid = await _user(maker)
    rid = await _row(maker, uid, key="application_discarded", ref_id=uuid.uuid4())
    stats = await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=NOON)
    assert stats.canceled == 1 and (await _get(maker, rid)).status == "canceled"


async def test_suppressed_and_deleted_recipients_are_skipped(maker):
    uid = await _user(maker)
    gone = await _user(maker, email="eliminado+1@bbjobs.invalid", deleted_at=datetime.now(timezone.utc))
    async with maker() as db:
        db.add(EmailSuppression(email="ana@mail.com", reason="bounced"))
        await db.commit()
    a = await _row(maker, uid)
    b = await _row(maker, gone, to="eliminado+1@bbjobs.invalid")
    provider = SimulatedProvider()
    await dispatcher.dispatch_due(session_maker=maker, provider=provider, now=NOON)
    assert provider.sent == []
    assert {(await _get(maker, a)).status, (await _get(maker, b)).status} == {"skipped"}


async def test_opt_out_skips_optional_but_not_account(maker):
    uid = await _user(maker)
    async with maker() as db:
        db.add(EmailPreference(user_id=uid, category="postulaciones", enabled=False))
        db.add(EmailPreference(user_id=uid, category="cuenta", enabled=False))
        await db.commit()
    optional = await _row(maker, uid)
    account = await _row(maker, uid, category="cuenta", key="company_verified")
    await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=NOON)
    assert (await _get(maker, optional)).status == "skipped"
    assert (await _get(maker, account)).status == "sent"


async def test_outside_window_is_deferred_to_8am(maker):
    uid = await _user(maker)
    night = datetime(2030, 3, 6, 23, 0, tzinfo=AR_TZ).astimezone(timezone.utc)
    rid = await _row(maker, uid, scheduled=night - timedelta(minutes=1))
    await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=night)
    row = await _get(maker, rid)
    assert row.status == "pending"
    assert row.scheduled_at == datetime(2030, 3, 7, 8, 0, tzinfo=AR_TZ)


async def test_third_noncritical_mail_waits_for_tomorrow(maker):
    uid = await _user(maker)
    ids = [await _row(maker, uid) for _ in range(3)]
    await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=NOON)
    statuses = sorted([(await _get(maker, i)).status for i in ids])
    assert statuses == ["pending", "sent", "sent"]


async def test_daily_cap_lets_only_account_emails_through(maker, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_DAILY_CAP", 1)
    a, b = await _user(maker), await _user(maker, email="beto@mail.com")
    first = await _row(maker, a)
    await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=NOON)
    assert (await _get(maker, first)).status == "sent"

    blocked = await _row(maker, b, to="beto@mail.com")
    account = await _row(maker, b, to="beto@mail.com", category="cuenta", key="talent_pack_active")
    await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=NOON)
    assert (await _get(maker, blocked)).status == "pending"
    assert (await _get(maker, account)).status == "sent"


class _BadAddressProvider(SimulatedProvider):
    """Rechaza el lote entero si trae una dirección inválida (como Resend), y esa sola de a una."""

    async def send_batch(self, messages, *, idempotency_key=None):
        if any(m.to.startswith("mal") for m in messages):
            raise EmailSendError("422 dirección inválida", transient=False, status_code=422)
        return await super().send_batch(messages, idempotency_key=idempotency_key)


async def test_permanent_batch_error_isolates_the_bad_email(maker):
    ids = []
    for i, email in enumerate(["uno@mail.com", "mal@@mail", "dos@mail.com"]):
        uid = await _user(maker, email=email)
        ids.append(await _row(maker, uid, to=email))
    stats = await dispatcher.dispatch_due(session_maker=maker, provider=_BadAddressProvider(), now=NOON)
    statuses = {(await _get(maker, i)).to_email: (await _get(maker, i)).status for i in ids}
    assert statuses == {"uno@mail.com": "sent", "mal@@mail": "failed", "dos@mail.com": "sent"}
    assert stats.sent == 2 and stats.failed == 1


class _DownProvider(SimulatedProvider):
    async def send(self, msg):
        raise EmailSendError("Resend respondió 503", transient=True, status_code=503)


async def test_transient_error_goes_back_to_the_queue_with_backoff(maker):
    uid = await _user(maker)
    rid = await _row(maker, uid)
    await dispatcher.dispatch_due(session_maker=maker, provider=_DownProvider(), now=NOON)
    row = await _get(maker, rid)
    assert (row.status, row.attempts) == ("pending", 1)
    assert row.scheduled_at == NOON + timedelta(minutes=1)


async def test_stuck_sending_rows_are_requeued(maker):
    uid = await _user(maker)
    rid = await _row(maker, uid)
    async with maker() as db:
        await db.execute(text("UPDATE email_outbox SET status='sending', claimed_at=:t"),
                         {"t": NOON - timedelta(minutes=30)})
        await db.commit()
    await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=NOON)
    assert (await _get(maker, rid)).status == "sent"


async def test_without_provider_due_emails_are_skipped_not_left_pending(maker):
    uid = await _user(maker)
    rid = await _row(maker, uid)
    await dispatcher.dispatch_due(session_maker=maker, provider=None, use_configured_provider=False, now=NOON)
    assert (await _get(maker, rid)).status == "skipped"


# ── API: bajas y webhook ────────────────────────────────────────────────────────────────

@pytest.fixture
async def client(maker):
    from app.main import app

    async def _db():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c
    app.dependency_overrides.clear()


async def test_get_unsubscribe_link_only_redirects(client, maker):
    uid = await _user(maker)
    token = make_unsubscribe_token(uid, "alertas")
    resp = await client.get("/api/v1/email/unsubscribe", params={"t": token})
    assert resp.status_code == 303 and "/baja?t=" in resp.headers["location"]
    async with maker() as db:
        assert (await db.execute(select(EmailPreference))).first() is None


async def test_post_unsubscribe_turns_the_category_off(client, maker):
    uid = await _user(maker)
    token = make_unsubscribe_token(uid, "alertas")
    for _ in range(2):  # dos veces: idempotente
        resp = await client.post("/api/v1/email/unsubscribe", params={"t": token})
        assert resp.status_code == 200
    async with maker() as db:
        pref = (await db.execute(select(EmailPreference))).scalar_one()
    assert (pref.category, pref.enabled) == ("alertas", False)


async def test_invalid_unsubscribe_token_is_400(client):
    resp = await client.post("/api/v1/email/unsubscribe", params={"t": "basura.basura"})
    assert resp.status_code == 400


def _signed(payload: dict, secret: str = WHSEC) -> tuple[bytes, dict]:
    body = json.dumps(payload).encode()
    msg_id = f"msg_{uuid.uuid4().hex}"
    ts = datetime.now(timezone.utc)
    signature = Webhook(secret).sign(msg_id, ts, body.decode())
    return body, {"svix-id": msg_id, "svix-timestamp": str(int(ts.timestamp())),
                  "svix-signature": signature, "content-type": "application/json"}


async def test_webhook_without_secret_is_rejected(client, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", None)
    resp = await client.post("/api/v1/webhooks/resend", content=b"{}")
    assert resp.status_code == 503


async def test_webhook_with_bad_signature_is_401(client, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", WHSEC)
    body, headers = _signed({"type": "email.delivered", "data": {}}, secret="whsec_" + "b3RyYQ==")
    resp = await client.post("/api/v1/webhooks/resend", content=body, headers=headers)
    assert resp.status_code == 401


async def test_bounce_marks_the_email_and_suppresses_the_address_once(client, maker, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_WEBHOOK_SECRET", WHSEC)
    uid = await _user(maker)
    rid = await _row(maker, uid, provider_message_id="re_123")
    event = {"type": "email.bounced", "data": {"email_id": "re_123", "to": ["Ana@Mail.com"]}}
    for _ in range(2):  # Resend reintenta: el mismo evento dos veces no duplica nada
        body, headers = _signed(event)
        assert (await client.post("/api/v1/webhooks/resend", content=body, headers=headers)).status_code == 200
    assert (await _get(maker, rid)).bounced_at is not None
    async with maker() as db:
        sup = (await db.execute(select(EmailSuppression))).scalars().all()
    assert [s.email for s in sup] == ["ana@mail.com"]
