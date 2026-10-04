"""Resúmenes de punta a punta contra Postgres (base descartable, `TEST_DATABASE_URL`)."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    from sqlalchemy import func, select, text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.config import settings
    from app.models.alerts import JobAlert
    from app.models.candidate import CandidateProfile
    from app.models.catalogs import ContractType, Industry, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.email import EmailOutbox
    from app.models.job import Application, JobPosting
    from app.models.settings import SettingKey, SiteSetting
    from app.services.email import digests, dispatcher
    from app.services.email.policy import AR_TZ
    from app.services.email.provider import SimulatedProvider

# Lunes 4 de marzo de 2030, 09:00 de Argentina.
MONDAY_9 = datetime(2030, 3, 4, 9, 0, tzinfo=AR_TZ).astimezone(timezone.utc) if TEST_DB else None


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE email_outbox, email_digest_state, job_alert_notifications, job_alerts, applications, "
            "job_postings, candidate_profiles, company_profiles, site_settings, users RESTART IDENTITY CASCADE"
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


async def _world(maker, published=None):
    tag = uuid.uuid4().hex[:6]
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Ind {tag}", slug=f"ind-{tag}")
        zone = Zone(id=uuid.uuid4(), name=f"Centro {tag}", slug=f"centro-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Efectivo {tag}")
        cu = User(id=uuid.uuid4(), email=f"emp-{tag}@empresa.com", role="company", is_active=True)
        db.add_all([ind, zone, ct, cu])
        await db.flush()
        company = CompanyProfile(id=uuid.uuid4(), user_id=cu.id, legal_name="Metalúrgica Sur", cuit=f"30-{tag}-9",
                                 industry_id=ind.id, responsible_full_name="R", responsible_phone="2910000000",
                                 responsible_email="r@empresa.com", verification_status="verified")
        db.add(company)
        await db.flush()
        job = JobPosting(id=uuid.uuid4(), company_id=company.id, company_legal_name_snapshot="Metalúrgica Sur",
                         title="Soldador", description="Soldadura MIG", industry_id=ind.id, zone_id=zone.id,
                         contract_type_id=ct.id, modality="presencial", status="active", moderation_status="approved",
                         published_at=published or (MONDAY_9 - timedelta(days=1)))
        db.add(job)
        candidates = []
        for name in ("ana", "beto"):
            u = User(id=uuid.uuid4(), email=f"{name}-{tag}@mail.com", role="candidate", is_active=True)
            db.add(u)
            await db.flush()
            # updated_at cerca de la fecha simulada (2030): si no, la regla de ocaso (90 días sin
            # actividad) los excluye del resumen semanal, que es lo correcto.
            p = CandidateProfile(id=uuid.uuid4(), user_id=u.id, first_name=name, last_name="T", phone="2915550000",
                                 location_zone_id=zone.id, accepts_onsite=True,
                                 updated_at=MONDAY_9 - timedelta(days=1))
            db.add(p)
            candidates.append((u, p))
        await db.flush()
        await db.commit()
        return ind, zone, company, cu, job, candidates


async def _outbox(maker, key=None):
    async with maker() as db:
        q = select(EmailOutbox)
        if key:
            q = q.where(EmailOutbox.template_key == key)
        return (await db.execute(q)).scalars().all()


async def _tick(maker, now):
    async with maker() as db:
        r = await digests.tick(db, now)
        await db.commit()
        return r


async def test_daily_alert_sends_once_with_the_new_job(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (ana_u, ana_p), _ = cands
    async with maker() as db:
        db.add(JobAlert(id=uuid.uuid4(), candidate_id=ana_p.id, zone_id=zone.id, frequency="daily", is_active=True,
                        created_at=MONDAY_9 - timedelta(days=3)))
        await db.commit()
    first = await _tick(maker, MONDAY_9)
    again = await _tick(maker, MONDAY_9 + timedelta(minutes=15))
    assert first.alertas_daily == 1 and again.alertas_daily == 0
    mails = await _outbox(maker, "digest_alertas")
    assert len(mails) == 1 and "Soldador" in mails[0].html and mails[0].to_email == ana_u.email


async def test_applied_jobs_are_not_alerted(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (_, ana_p), _ = cands
    async with maker() as db:
        db.add(Application(candidate_id=ana_p.id, job_posting_id=job.id))
        db.add(JobAlert(id=uuid.uuid4(), candidate_id=ana_p.id, zone_id=zone.id, frequency="instant", is_active=True,
                        created_at=MONDAY_9 - timedelta(days=3)))
        await db.commit()
    assert (await _tick(maker, MONDAY_9)).alertas_instant == 0


async def test_para_vos_only_for_candidates_without_alerts_and_active(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (_, ana_p), (beto_u, beto_p) = cands
    async with maker() as db:
        db.add(JobAlert(id=uuid.uuid4(), candidate_id=ana_p.id, zone_id=zone.id, frequency="weekly", is_active=True,
                        created_at=MONDAY_9 - timedelta(days=30)))
        await db.commit()
    r = await _tick(maker, MONDAY_9)
    assert r.para_vos == 1
    para_vos = await _outbox(maker, "digest_para_vos")
    assert [m.to_email for m in para_vos] == [beto_u.email]
    assert (await _tick(maker, MONDAY_9 + timedelta(hours=1))).para_vos == 0


async def test_inactive_candidates_get_no_weekly_digest(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    async with maker() as db:
        await db.execute(text("UPDATE candidate_profiles SET updated_at = :t"), {"t": MONDAY_9 - timedelta(days=200)})
        await db.commit()
    assert (await _tick(maker, MONDAY_9)).para_vos == 0


async def test_company_daily_digest_lists_new_applications(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    async with maker() as db:
        for _, p in cands:
            db.add(Application(candidate_id=p.id, job_posting_id=job.id, created_at=MONDAY_9 - timedelta(hours=3)))
        await db.commit()
    assert (await _tick(maker, MONDAY_9)).empresas == 1
    mail = (await _outbox(maker, "digest_empresa"))[0]
    assert "2 postulaciones nuevas" in mail.html and mail.to_email == cu.email
    assert (await _tick(maker, MONDAY_9 + timedelta(minutes=30))).empresas == 0


async def test_team_digest_waits_for_830_and_goes_once(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    async with maker() as db:
        db.add(User(id=uuid.uuid4(), email="eugenia@talency.com", role="admin", is_active=True))
        db.add(CompanyProfile(id=uuid.uuid4(), user_id=cands[0][0].id, legal_name="Pendiente SA", cuit="30-99999999-9",
                              industry_id=ind.id, responsible_full_name="R", responsible_phone="1",
                              responsible_email="p@x.com", verification_status="pending"))
        await db.commit()
    early = datetime(2030, 3, 4, 8, 15, tzinfo=AR_TZ).astimezone(timezone.utc)
    assert (await _tick(maker, early)).equipo == 0
    assert (await _tick(maker, MONDAY_9)).equipo == 1
    assert (await _tick(maker, MONDAY_9 + timedelta(minutes=15))).equipo == 0
    assert "empresa(s) para verificar" in (await _outbox(maker, "digest_equipo"))[0].html


async def test_unhealthy_account_brakes_reminders_but_not_postulaciones(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (u, _), _ = cands
    async with maker() as db:
        for i in range(120):   # 120 enviados en la semana, 10 rebotes = 8 %
            db.add(EmailOutbox(id=uuid.uuid4(), user_id=None, to_email=f"x{i}@m.com", category="postulaciones",
                               template_key="application_selected", subject="s", html="h", status="sent",
                               attempts=1, sent_at=MONDAY_9 - timedelta(days=1),
                               bounced_at=MONDAY_9 - timedelta(days=1) if i < 10 else None))
        for cat, key in (("recordatorios", "profile_incomplete"), ("postulaciones", "application_selected")):
            db.add(EmailOutbox(id=uuid.uuid4(), user_id=u.id, to_email=u.email, category=cat, template_key=key,
                               subject="s", html="h", status="pending", attempts=0, scheduled_at=MONDAY_9 - timedelta(minutes=1)))
        await db.commit()
    await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=MONDAY_9)
    async with maker() as db:
        rows = dict((await db.execute(
            select(EmailOutbox.category, EmailOutbox.status).where(EmailOutbox.user_id == u.id))).all())
    assert rows == {"recordatorios": "pending", "postulaciones": "sent"}


async def test_retention_empties_content_after_90_days_and_keeps_metadata(maker):
    from app.services.email.retention import purge_old_content

    old = MONDAY_9 - timedelta(days=100)
    async with maker() as db:
        db.add(EmailOutbox(id=uuid.uuid4(), user_id=None, to_email="x@m.com", category="postulaciones",
                           template_key="application_selected", subject="Datos", html="<p>datos</p>", text="datos",
                           status="sent", attempts=1, sent_at=old, delivered_at=old, created_at=old))
        db.add(EmailOutbox(id=uuid.uuid4(), user_id=None, to_email="y@m.com", category="postulaciones",
                           template_key="application_selected", subject="Nuevo", html="<p>nuevo</p>", text="nuevo",
                           status="sent", attempts=1, sent_at=MONDAY_9, created_at=MONDAY_9))
        await db.commit()
        assert await purge_old_content(db, MONDAY_9) == 1
        await db.commit()
        rows = {r.to_email: r for r in (await db.execute(select(EmailOutbox))).scalars().all()}
    assert rows["x@m.com"].html == "" and rows["x@m.com"].delivered_at is not None
    assert rows["y@m.com"].html == "<p>nuevo</p>"
