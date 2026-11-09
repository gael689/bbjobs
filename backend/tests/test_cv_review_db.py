"""Revisión de CV contra un Postgres real (base descartable, `TEST_DATABASE_URL`).

Lo corre `scripts/probar_local_mails.ps1`. Sin la variable se saltea.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy import func, select, text
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db
    from app.core.config import settings
    from app.models.alerts import Notification
    from app.models.candidate import CandidateProfile
    from app.models.core import User
    from app.models.payment import CvReviewOrder, CvReviewStatus, Payment, PaymentType
    from app.models.settings import SettingKey, SiteSetting
    from app.services import cv_review as service
    from app.services.account_deletion import delete_account

CV = "https://res.cloudinary.com/demo/raw/private/v1/cvs/ana.pdf"


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE payments, cv_review_orders, email_outbox, notifications, site_settings, "
            "candidate_profiles, users, audit_logs RESTART IDENTITY CASCADE"
        ))
    async with session_maker() as db:
        db.add(SiteSetting(key=SettingKey.revision_cv_activa.value, enabled=True))
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(service, "create_preference", lambda **kw: "https://mp.test/checkout")
    yield session_maker
    await engine.dispose()


async def _candidate(maker, email="ana@mail.com", cv=CV, phone="2915551234"):
    async with maker() as db:
        user = User(id=uuid.uuid4(), email=email, role="candidate", is_active=True)
        db.add(user)
        await db.flush()
        profile = CandidateProfile(id=uuid.uuid4(), user_id=user.id, first_name="Ana", last_name="Pérez",
                                   phone=phone, cv_file_url=cv)
        db.add(profile)
        await db.commit()
        return user, profile


async def _admin(maker):
    async with maker() as db:
        admin = User(id=uuid.uuid4(), email="admin@talency.com", role="admin", is_active=True)
        db.add(admin)
        await db.commit()
        return admin


async def _checkout(maker, user, profile, **kw):
    async with maker() as db:
        args = dict(objective="Administrativa", contact_channel="whatsapp", contact_value=None, consent=True)
        args.update(kw)
        return await service.start_checkout(db, user=user, candidate=profile, **args)


async def _pay(maker, payment_id, status="approved", previous=None):
    async with maker() as db:
        payment = (await db.execute(select(Payment).where(Payment.id == payment_id))).scalar_one()
        await service.process_payment(db, payment, status, previous)
        payment.mp_status = status
        await db.commit()


async def _order(maker, order_id) -> "CvReviewOrder":
    async with maker() as db:
        return (await db.execute(select(CvReviewOrder).where(CvReviewOrder.id == order_id))).scalar_one()


async def _notif_types(maker) -> list[str]:
    async with maker() as db:
        return sorted(t for (t,) in (await db.execute(select(Notification.type))).all())


# ── Checkout ────────────────────────────────────────────────────────────────────────────

async def test_checkout_creates_candidate_payment_and_freezes_cv(maker):
    user, profile = await _candidate(maker)
    order, payment, link = await _checkout(maker, user, profile)
    assert link == "https://mp.test/checkout"
    assert (payment.candidate_id, payment.company_id, payment.type) == (profile.id, None, PaymentType.cv_review)
    saved = await _order(maker, order.id)
    assert saved.status == "pending_payment"
    assert saved.cv_file_url_snapshot == CV
    assert saved.contact_value == "2915551234"  # por defecto, el teléfono del perfil
    assert float(saved.price) == 12000.0


async def test_checkout_requires_cv_phone_consent_and_sales_on(maker):
    user, sin_cv = await _candidate(maker, cv=None)
    with pytest.raises(service.CvReviewError):
        await _checkout(maker, user, sin_cv)

    user2, perfil = await _candidate(maker, email="beto@mail.com")
    with pytest.raises(service.CvReviewError):
        await _checkout(maker, user2, perfil, consent=False)

    async with maker() as db:
        await db.execute(text("UPDATE site_settings SET enabled = false"))
        await db.commit()
    with pytest.raises(service.CvReviewError) as err:
        await _checkout(maker, user2, perfil)
    assert err.value.status_code == 409


async def test_abandoned_checkout_reuses_the_same_order(maker):
    user, profile = await _candidate(maker)
    first, p1, _ = await _checkout(maker, user, profile)
    second, p2, _ = await _checkout(maker, user, profile, contact_channel="email")
    assert first.id == second.id and p1.id != p2.id
    assert (await _order(maker, first.id)).contact_value == "ana@mail.com"


# ── Pago (webhook) ──────────────────────────────────────────────────────────────────────

async def test_approved_payment_moves_to_paid_and_notifies_once(maker):
    await _admin(maker)
    user, profile = await _candidate(maker)
    order, payment, _ = await _checkout(maker, user, profile)
    await _pay(maker, payment.id)
    await _pay(maker, payment.id)  # MP reintenta: no duplica nada
    saved = await _order(maker, order.id)
    assert saved.status == "paid" and saved.paid_at is not None
    assert await _notif_types(maker) == ["admin_cv_review_new", "cv_review_paid"]


async def test_second_approved_payment_is_flagged_for_refund(maker):
    await _admin(maker)
    user, profile = await _candidate(maker)
    order, p1, _ = await _checkout(maker, user, profile)
    _, p2, _ = await _checkout(maker, user, profile)  # pagó dos links distintos
    await _pay(maker, p1.id)
    await _pay(maker, p2.id)
    assert (await _order(maker, order.id)).status == "paid"
    assert "admin_cv_review_duplicate_payment" in await _notif_types(maker)


async def test_late_payment_on_an_expired_order_is_honored(maker):
    user, profile = await _candidate(maker)
    order, payment, _ = await _checkout(maker, user, profile)
    async with maker() as db:
        await db.execute(text("UPDATE cv_review_orders SET status='canceled', canceled_at=now()"))
        await db.commit()
    await _pay(maker, payment.id)
    assert (await _order(maker, order.id)).status == "paid"


async def test_refund_from_mercado_pago_marks_the_order(maker):
    user, profile = await _candidate(maker)
    order, payment, _ = await _checkout(maker, user, profile)
    await _pay(maker, payment.id)
    await _pay(maker, payment.id, status="refunded", previous="approved")
    assert (await _order(maker, order.id)).status == "refunded"


# ── Talency ─────────────────────────────────────────────────────────────────────────────

async def test_admin_transitions_and_notifications(maker):
    admin = await _admin(maker)
    user, profile = await _candidate(maker)
    order, payment, _ = await _checkout(maker, user, profile)
    await _pay(maker, payment.id)

    async with maker() as db:
        o = (await db.execute(select(CvReviewOrder))).scalar_one()
        with pytest.raises(service.CvReviewError):
            await service.change_status(db, o, CvReviewStatus.delivered, admin=admin, note=None)
        await service.change_status(db, o, CvReviewStatus.in_progress, admin=admin, note="La llamo mañana")
        await service.change_status(db, o, CvReviewStatus.delivered, admin=admin, note=None)
        await db.commit()
    saved = await _order(maker, order.id)
    assert saved.status == "delivered" and saved.taken_by_admin_id == admin.id
    types = await _notif_types(maker)
    assert "cv_review_in_progress" in types and "cv_review_delivered" in types


async def test_housekeeping_expires_unpaid_and_reminds_once(maker):
    await _admin(maker)
    u1, unpaid = await _candidate(maker)
    u2, paid = await _candidate(maker, email="beto@mail.com")
    o1, _, _ = await _checkout(maker, u1, unpaid)
    o2, pay2, _ = await _checkout(maker, u2, paid)
    await _pay(maker, pay2.id)
    now = datetime.now(timezone.utc)
    async with maker() as db:
        await db.execute(text("UPDATE cv_review_orders SET created_at = :t WHERE id = :id"),
                         {"t": now - timedelta(hours=25), "id": o1.id})
        await db.execute(text("UPDATE cv_review_orders SET paid_at = :t WHERE id = :id"),
                         {"t": now - timedelta(hours=49), "id": o2.id})
        await db.commit()
    for _ in range(2):  # dos vueltas del reloj: los recordatorios no se repiten
        async with maker() as db:
            await service.housekeeping(db, now=now)
            await db.commit()
    assert (await _order(maker, o1.id)).status == "canceled"
    assert (await _notif_types(maker)).count("admin_cv_review_overdue") == 2  # 24 h y 48 h


# ── Integridad en la base ───────────────────────────────────────────────────────────────

async def test_only_one_open_order_per_candidate(maker):
    _, profile = await _candidate(maker)
    async with maker() as db:
        for _ in range(2):
            db.add(CvReviewOrder(id=uuid.uuid4(), candidate_id=profile.id, status="paid",
                                 contact_channel="whatsapp", price=1, currency="ARS"))
        with pytest.raises(IntegrityError):
            await db.commit()


async def test_a_payment_has_exactly_one_payer(maker):
    async with maker() as db:
        db.add(Payment(id=uuid.uuid4(), type=PaymentType.cv_review, amount=1, currency="ARS"))
        with pytest.raises(IntegrityError):
            await db.commit()


async def test_account_deletion_keeps_the_payment_and_scrubs_contact(maker):
    user, profile = await _candidate(maker)
    order, payment, _ = await _checkout(maker, user, profile)
    await _pay(maker, payment.id)
    async with maker() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        preview = await delete_account(db, u, actor=None, reason="test", delete_in_clerk=False)
    assert preview.mode.value == "tombstone"
    saved = await _order(maker, order.id)
    assert (saved.contact_value, saved.objective, saved.cv_file_url_snapshot) == (None, None, None)
    async with maker() as db:
        assert (await db.execute(select(func.count()).select_from(Payment))).scalar_one() == 1


# ── API: aislamiento entre postulantes ──────────────────────────────────────────────────

async def test_a_candidate_cannot_see_another_candidates_order(maker):
    from app.main import app

    ana, ana_profile = await _candidate(maker)
    beto, _ = await _candidate(maker, email="beto@mail.com")
    order, _, _ = await _checkout(maker, ana, ana_profile)

    async def _db():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
            app.dependency_overrides[get_current_user] = lambda: beto
            assert (await c.get(f"/api/v1/me/candidate/cv-review/{order.id}")).status_code == 404
            assert (await c.get("/api/v1/me/candidate/cv-review")).json()["orders"] == []
            assert (await c.get("/api/v1/admin/cv-reviews")).status_code == 403

            app.dependency_overrides[get_current_user] = lambda: ana
            assert (await c.get(f"/api/v1/me/candidate/cv-review/{order.id}")).status_code == 200
    finally:
        app.dependency_overrides.clear()
