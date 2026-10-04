"""Campañas a usuarios y a prospectos contra Postgres (base descartable, `TEST_DATABASE_URL`)."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.services.email.prospect_dispatch import SimulatedProspectSender, in_window

TEST_DB = os.environ.get("TEST_DATABASE_URL")

if TEST_DB:
    import httpx
    from sqlalchemy import func, select, text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_db
    from app.core.config import settings
    from app.models.candidate import CandidateProfile
    from app.models.catalogs import Industry
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.email import CampaignStatus, EmailCampaign, EmailOutbox, EmailPreference, EmailSuppression
    from app.models.payment import CvReviewOrder, Payment, PaymentType
    from app.models.prospect import Prospect, ProspectEmail
    from app.services.email import campaigns as svc
    from app.services.email import dispatcher, monthly, prospect_dispatch
    from app.services.email.policy import AR_TZ
    from app.services.email.provider import SimulatedProvider
    from app.services.email.tokens import make_prospect_token

# Martes 5 de marzo de 2030, 10:00 de Argentina (día hábil, dentro de la franja de prospección).
TUESDAY_10 = datetime(2030, 3, 5, 10, 0, tzinfo=AR_TZ).astimezone(timezone.utc)


def test_prospect_window_is_weekdays_9_to_12():
    assert in_window(TUESDAY_10)
    assert not in_window(TUESDAY_10 + timedelta(hours=3))           # 13:00
    assert not in_window(TUESDAY_10 + timedelta(days=4))            # sábado


db_only = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE email_outbox, email_campaigns, email_preferences, email_suppressions, prospects, "
            "cv_review_orders, payments, candidate_profiles, company_profiles, site_settings, notifications, users "
            "RESTART IDENTITY CASCADE"
        ))
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "EMAIL_MODE", "simulate")
    monkeypatch.setattr(settings, "PROSPECT_DAILY_CAP", 20)
    monkeypatch.setattr(prospect_dispatch, "REQUEST_INTERVAL_SECONDS", 0)
    monkeypatch.setattr(dispatcher, "REQUEST_INTERVAL_SECONDS", 0)
    yield session_maker
    await engine.dispose()


async def _people(maker):
    tag = uuid.uuid4().hex[:6]
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Ind {tag}", slug=f"ind-{tag}")
        admin = User(id=uuid.uuid4(), email=f"eugenia-{tag}@talency.com", role="admin", is_active=True)
        db.add_all([ind, admin])
        out = {"admin": admin}
        for key, consent in (("acepto", True), ("callado", None), ("rechazo", False)):
            u = User(id=uuid.uuid4(), email=f"{key}-{tag}@mail.com", role="candidate", is_active=True)
            db.add(u)
            await db.flush()
            db.add(CandidateProfile(id=uuid.uuid4(), user_id=u.id, first_name=key, last_name="T", phone="1",
                                    cv_file_url="https://res.cloudinary.com/x/raw/private/v1/cv.pdf"))
            if consent is not None:
                db.add(EmailPreference(user_id=u.id, category="novedades", enabled=consent))
            out[key] = u
        cu = User(id=uuid.uuid4(), email=f"empresa-{tag}@empresa.com", role="company", is_active=True)
        db.add(cu)
        await db.flush()
        db.add(CompanyProfile(id=uuid.uuid4(), user_id=cu.id, legal_name="Metalúrgica Sur", cuit=f"30-{tag}-1",
                              industry_id=ind.id, responsible_full_name="R", responsible_phone="1",
                              responsible_email="r@e.com", verification_status="verified"))
        out["empresa"] = cu
        await db.commit()
    return out


async def _campaign(maker, **kw):
    async with maker() as db:
        c = EmailCampaign(id=uuid.uuid4(), name="Prueba", subject="Hola {{nombre}}", body="Texto de la campaña.",
                          status=CampaignStatus.draft.value, recipients_total=0, audience={}, follow_ups=[], **kw)
        db.add(c)
        await db.commit()
        return c


async def _approve_and_queue(maker, campaign_id, admin):
    async with maker() as db:
        c = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign_id))).scalar_one()
        n = await svc.approve(db, c, admin, TUESDAY_10 - timedelta(minutes=1))
        await db.commit()
    async with maker() as db:
        await svc.materialize_due(db, TUESDAY_10)
        await db.commit()
    return n


@db_only
async def test_candidates_only_with_explicit_consent(maker):
    p = await _people(maker)
    c = await _campaign(maker, target="users", audience_key="cand_cv_sin_revision", product="cv_review")
    assert await _approve_and_queue(maker, c.id, p["admin"]) == 1
    async with maker() as db:
        rows = (await db.execute(select(EmailOutbox.to_email, EmailOutbox.subject))).all()
    assert [r.to_email for r in rows] == [p["acepto"].email]
    assert rows[0].subject == "Hola acepto"


@db_only
async def test_companies_are_opt_out_and_nobody_gets_two_campaigns_a_week(maker):
    p = await _people(maker)
    first = await _campaign(maker, target="users", audience_key="emp_todas", product="portal")
    assert await _approve_and_queue(maker, first.id, p["admin"]) == 1
    second = await _campaign(maker, target="users", audience_key="emp_todas", product="portal")
    async with maker() as db:
        c = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == second.id))).scalar_one()
        with pytest.raises(svc.CampaignError):   # la audiencia quedó vacía por R5
            await svc.approve(db, c, p["admin"], None)


@db_only
async def test_nothing_queues_without_approval(maker):
    p = await _people(maker)
    await _campaign(maker, target="users", audience_key="emp_todas", product="portal")
    async with maker() as db:
        await svc.materialize_due(db, TUESDAY_10)
        await db.commit()
        assert (await db.execute(select(func.count()).select_from(EmailOutbox))).scalar_one() == 0


async def _prospects(maker, n=3):
    ids = []
    async with maker() as db:
        for i in range(n):
            pr = Prospect(id=uuid.uuid4(), source="leadgen", external_id=f"p{i}-{uuid.uuid4().hex[:4]}",
                          name=f"Empresa {i}", stage="nueva")
            db.add(pr)
            await db.flush()
            db.add(ProspectEmail(id=uuid.uuid4(), prospect_id=pr.id, email=f"rrhh{i}@empresa{i}.com", is_primary=True))
            ids.append(pr.id)
        await db.commit()
    return ids


@db_only
async def test_prospect_campaign_goes_through_its_own_channel_only(maker):
    p = await _people(maker)
    ids = await _prospects(maker)
    c = await _campaign(maker, target="prospects", product="seleccion_personal",
                        follow_ups=[{"after_days": 7, "subject": "Seguimiento", "body": "Segundo toque."}])
    async with maker() as db:
        camp = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == c.id))).scalar_one()
        camp.audience = {"ids": [str(i) for i in ids]}
        await db.commit()
    assert await _approve_and_queue(maker, c.id, p["admin"]) == 3

    # El dispatcher de avisos no toca la prospección.
    stats = await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=TUESDAY_10)
    assert stats.sent == 0

    sender = SimulatedProspectSender()
    out = await prospect_dispatch.dispatch_prospects(session_maker=maker, sender=sender, now=TUESDAY_10)
    assert out.sent == 3 and out.followups_queued == 3
    assert all("List-Unsubscribe-Post" in m.headers for m in sender.sent)
    async with maker() as db:
        stages = set((await db.execute(select(Prospect.stage))).scalars().all())
    assert stages == {"contactada"}


@db_only
async def test_follow_up_is_canceled_if_the_first_was_not_delivered(maker):
    p = await _people(maker)
    ids = await _prospects(maker, 1)
    c = await _campaign(maker, target="prospects", product="portal",
                        follow_ups=[{"after_days": 7, "subject": "Seguimiento", "body": "Segundo toque."}])
    async with maker() as db:
        camp = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == c.id))).scalar_one()
        camp.audience = {"ids": [str(ids[0])]}
        await db.commit()
    await _approve_and_queue(maker, c.id, p["admin"])
    await prospect_dispatch.dispatch_prospects(session_maker=maker, sender=SimulatedProspectSender(), now=TUESDAY_10)
    later = TUESDAY_10 + timedelta(days=7)
    out = await prospect_dispatch.dispatch_prospects(session_maker=maker, sender=SimulatedProspectSender(), now=later)
    assert out.canceled == 1 and out.sent == 0     # sin delivered_at del primero, no hay segundo


@db_only
async def test_prospect_daily_cap_and_window(maker, monkeypatch):
    p = await _people(maker)
    ids = await _prospects(maker, 5)
    monkeypatch.setattr(settings, "PROSPECT_DAILY_CAP", 2)
    c = await _campaign(maker, target="prospects", product="portal")
    async with maker() as db:
        camp = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == c.id))).scalar_one()
        camp.audience = {"ids": [str(i) for i in ids]}
        await db.commit()
    await _approve_and_queue(maker, c.id, p["admin"])
    night = TUESDAY_10 + timedelta(hours=10)
    assert (await prospect_dispatch.dispatch_prospects(session_maker=maker, sender=SimulatedProspectSender(), now=night)).sent == 0
    assert (await prospect_dispatch.dispatch_prospects(session_maker=maker, sender=SimulatedProspectSender(), now=TUESDAY_10)).sent == 2
    assert (await prospect_dispatch.dispatch_prospects(session_maker=maker, sender=SimulatedProspectSender(),
                                                       now=TUESDAY_10 + timedelta(minutes=30))).sent == 0


@db_only
async def test_prospect_unsubscribe_suppresses_every_address(maker):
    from app.main import app

    ids = await _prospects(maker, 1)

    async def _db():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as client:
            resp = await client.post("/api/v1/email/unsubscribe-prospect", params={"t": make_prospect_token(ids[0])})
            assert resp.status_code == 200
    finally:
        app.dependency_overrides.clear()
    async with maker() as db:
        pr = (await db.execute(select(Prospect))).scalar_one()
        sup = (await db.execute(select(EmailSuppression.email))).scalars().all()
    assert pr.do_not_contact and sup == ["rrhh0@empresa0.com"]


@db_only
async def test_conversions_count_real_purchases_in_14_days(maker):
    p = await _people(maker)
    c = await _campaign(maker, target="users", audience_key="cand_cv_sin_revision", product="cv_review")
    await _approve_and_queue(maker, c.id, p["admin"])
    async with maker() as db:
        await db.execute(text("UPDATE email_outbox SET status='sent', sent_at=:t"), {"t": TUESDAY_10})
        cand = (await db.execute(select(CandidateProfile).join(User).where(User.id == p["acepto"].id))).scalar_one()
        order = CvReviewOrder(id=uuid.uuid4(), candidate_id=cand.id, status="paid", contact_channel="whatsapp",
                              price=1, currency="ARS", paid_at=TUESDAY_10 + timedelta(days=3))
        db.add(order)
        await db.commit()
    async with maker() as db:
        camp = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == c.id))).scalar_one()
        assert await svc.measure_conversions(db, camp) == 1


@db_only
async def test_monthly_draft_is_created_once_and_never_sent(maker):
    p = await _people(maker)
    first_day = datetime(2030, 4, 1, 9, 30, tzinfo=AR_TZ).astimezone(timezone.utc)
    async with maker() as db:
        made = await monthly.prepare_monthly_draft(db, first_day)
        await db.commit()
        again = await monthly.prepare_monthly_draft(db, first_day + timedelta(hours=2))
        await db.commit()
        status = (await db.execute(select(EmailCampaign.status))).scalars().all()
    assert made is not None and again is None and status == ["draft"]
    assert "marzo" in made.name and "postulaciones" in made.body
