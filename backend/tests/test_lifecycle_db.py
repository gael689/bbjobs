"""Avisos del ciclo de vida contra Postgres (base descartable, `TEST_DATABASE_URL`)."""
from __future__ import annotations

import os
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    from sqlalchemy import func, select, text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.config import settings
    from app.models.alerts import Notification
    from app.models.candidate import CandidateProfile
    from app.models.catalogs import ContractType, Industry, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.email import EmailOutbox
    from app.models.job import JobPosting
    from app.models.payment import TalentCreditPack, TalentUnlock
    from app.models.settings import SettingKey, SiteSetting
    from app.services import lifecycle
    from app.services.email import dispatcher
    from app.services.email.provider import SimulatedProvider
    from app.services.notifications import create_notification

NOW = datetime(2030, 3, 5, 13, 0, tzinfo=timezone.utc)   # martes 10:00 de Argentina


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE email_outbox, email_digest_state, notifications, talent_unlocks, talent_credit_packs, "
            "job_postings, candidate_profiles, company_profiles, site_settings, users RESTART IDENTITY CASCADE"))
    async with session_maker() as db:
        db.add(SiteSetting(key=SettingKey.emails_automaticos_activos.value, enabled=True))
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "EMAIL_MODE", "simulate")
    monkeypatch.setattr(settings, "EMAIL_DAILY_CAP", 0)
    monkeypatch.setattr(dispatcher, "REQUEST_INTERVAL_SECONDS", 0)
    yield session_maker
    await engine.dispose()


async def _candidate(maker, **kw):
    async with maker() as db:
        u = User(id=uuid.uuid4(), email=f"c-{uuid.uuid4().hex[:6]}@mail.com", role="candidate", is_active=True)
        db.add(u)
        await db.flush()
        p = CandidateProfile(id=uuid.uuid4(), user_id=u.id, first_name="Ana", last_name="T", phone="1", **kw)
        db.add(p)
        await db.commit()
        return u, p


async def _company(maker, verified_at=None):
    tag = uuid.uuid4().hex[:6]
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"I {tag}", slug=f"i-{tag}")
        u = User(id=uuid.uuid4(), email=f"e-{tag}@empresa.com", role="company", is_active=True)
        db.add_all([ind, u])
        await db.flush()
        c = CompanyProfile(id=uuid.uuid4(), user_id=u.id, legal_name="Empresa", cuit=f"30-{tag}-1", industry_id=ind.id,
                           responsible_full_name="R", responsible_phone="1", responsible_email="r@e.com",
                           verification_status="verified", verified_at=verified_at)
        db.add(c)
        await db.commit()
        return u, c, ind


async def _types(maker, user_id) -> list[str]:
    async with maker() as db:
        return sorted((await db.execute(select(Notification.type).where(Notification.user_id == user_id))).scalars().all())


async def test_nothing_new_with_the_gate_closed(maker, monkeypatch):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    u, _ = await _candidate(maker)
    async with maker() as db:
        user = (await db.execute(select(User).where(User.id == u.id))).scalar_one()
        await lifecycle.on_candidate_onboarded(db, user)
        assert await lifecycle.daily(db, NOW) == {}
        await db.commit()
    assert await _types(maker, u.id) == []


async def test_application_confirmation_one_mail_per_application(maker):
    u, _ = await _candidate(maker)
    async with maker() as db:
        for title in ("Cajero", "Repositor"):
            await lifecycle.on_application_sent(db, u.id, JobPosting(title=title))
        await db.commit()
        mails = (await db.execute(select(func.count()).select_from(EmailOutbox).where(
            EmailOutbox.template_key == "application_sent"))).scalar_one()
    # Eugenia (08/10/2026): una confirmación por postulación, con el puesto en el asunto. El
    # tope diario por persona lo aplica el dispatcher al enviar, no el encolado.
    assert await _types(maker, u.id) == ["application_sent", "application_sent"]
    assert mails == 2


async def test_profile_reminder_stops_after_three_without_changes(maker):
    u, p = await _candidate(maker)
    async with maker() as db:
        await db.execute(text("UPDATE candidate_profiles SET updated_at = :t"), {"t": NOW - timedelta(days=30)})
        for i in range(3):
            db.add(EmailOutbox(id=uuid.uuid4(), user_id=u.id, to_email=u.email, category="recordatorios",
                               template_key="profile_incomplete", subject="s", html="h", status="sent", attempts=1,
                               sent_at=NOW - timedelta(days=21 - 7 * i)))
        await create_notification(db, user_id=u.id, type="profile_incomplete", title="t", body="b", ref_id=p.id)
        await db.commit()
    stats = await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(),
                                          now=datetime.now(timezone.utc) + timedelta(seconds=5))
    assert stats.canceled == 1 and stats.sent == 0


async def test_unlock_notifies_candidate_and_pack_low_once(maker):
    cu, company, _ = await _company(maker, verified_at=NOW - timedelta(days=30))
    u, p = await _candidate(maker)
    async with maker() as db:
        # Fecha real (no la simulada): la notificación se guarda con la hora del servidor.
        pack = TalentCreditPack(id=uuid.uuid4(), company_id=company.id, credits_total=3, status="active",
                                activated_at=datetime.now(timezone.utc) - timedelta(days=1))
        db.add(pack)
        await db.flush()
        db.add(TalentUnlock(company_id=company.id, candidate_id=p.id, pack_id=pack.id))
        await db.flush()
        comp = (await db.execute(select(CompanyProfile).where(CompanyProfile.id == company.id))).scalar_one()
        prof = (await db.execute(select(CandidateProfile).where(CandidateProfile.id == p.id))).scalar_one()
        await lifecycle.on_talent_unlocked(db, prof, comp)
        await lifecycle.on_pack_consumed(db, comp)
        await lifecycle.on_pack_consumed(db, comp)    # una sola vez por pack
        await db.commit()
    assert await _types(maker, u.id) == ["talent_profile_unlocked"]
    assert await _types(maker, cu.id) == ["talent_pack_low"]
    async with maker() as db:
        mail = (await db.execute(select(EmailOutbox).where(
            EmailOutbox.template_key == "talent_profile_unlocked"))).scalar_one()
    assert comp.legal_name in mail.html and mail.subject == "Una empresa vio tu perfil en BBJobs"


async def test_company_guide_at_day_2_and_7_and_stops_after_publishing(maker):
    cu, company, ind = await _company(maker, verified_at=NOW - timedelta(days=3))
    async with maker() as db:
        assert (await lifecycle.daily(db, NOW))["guias"] == 1
        assert (await lifecycle.daily(db, NOW + timedelta(hours=1)))["guias"] == 0
        assert (await lifecycle.daily(db, NOW + timedelta(days=5)))["guias"] == 1    # día 8: la del día 7
        assert (await lifecycle.daily(db, NOW + timedelta(days=30)))["guias"] == 0   # nunca más de dos
        await db.commit()


async def test_job_without_applications_once_and_reactivation_every_90_days(maker):
    cu, company, ind = await _company(maker, verified_at=NOW - timedelta(days=60))
    zone_tag = uuid.uuid4().hex[:6]
    async with maker() as db:
        zone = Zone(id=uuid.uuid4(), name=f"Z {zone_tag}", slug=f"z-{zone_tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"C {zone_tag}")
        db.add_all([zone, ct])
        await db.flush()
        db.add(JobPosting(id=uuid.uuid4(), company_id=company.id, company_legal_name_snapshot="E", title="Soldador",
                          description="x", industry_id=ind.id, zone_id=zone.id, contract_type_id=ct.id,
                          modality="presencial", status="active", moderation_status="approved",
                          published_at=NOW - timedelta(days=8)))
        await db.commit()
    u, _ = await _candidate(maker, cv_file_url="https://res.cloudinary.com/x/raw/private/v1/cv.pdf")
    async with maker() as db:
        await db.execute(text("UPDATE candidate_profiles SET updated_at = :t"), {"t": NOW - timedelta(days=70)})
        first = await lifecycle.daily(db, NOW)
        second = await lifecycle.daily(db, NOW + timedelta(days=1))
        later = await lifecycle.daily(db, NOW + timedelta(days=95))
        await db.commit()
    assert (first["sin_postulaciones"], second["sin_postulaciones"]) == (1, 0)
    assert (first["reactivaciones"], second["reactivaciones"], later["reactivaciones"]) == (1, 0, 1)
