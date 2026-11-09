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
    from app.models.alerts import CandidateJobMatch
    from app.models.candidate import CandidateProfile, CandidateSkill
    from app.models.catalogs import ContractType, Industry, Skill, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.email import EmailOutbox
    from app.models.job import Application, JobPosting, JobPostingSkill
    from app.models.legal import LegalAcceptance
    from app.models.settings import SettingKey, SiteSetting
    from app.services.email import digests, dispatcher, matches
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
            "TRUNCATE email_outbox, email_digest_state, candidate_job_matches, applications, "
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
            # Entró hace un día (fecha simulada, 2030): si no, la regla de ocaso (30 días sin entrar)
            # lo excluye del resumen semanal y del aviso, que es lo correcto.
            u = User(id=uuid.uuid4(), email=f"{name}-{tag}@mail.com", role="candidate", is_active=True,
                     last_seen_at=MONDAY_9 - timedelta(days=1))
            db.add(u)
            await db.flush()
            db.add(LegalAcceptance(user_id=u.id, document="privacidad", version="3.0"))
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


async def test_para_vos_goes_to_everyone_seen_in_the_last_30_days(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (ana_u, _), (beto_u, _) = cands
    async with maker() as db:
        # Ana actualizó el perfil hace poco pero no entra hace 40 días: cuenta la entrada.
        await db.execute(text("UPDATE users SET last_seen_at = :t WHERE id = :id"),
                         {"t": MONDAY_9 - timedelta(days=40), "id": ana_u.id})
        await db.commit()
    r = await _tick(maker, MONDAY_9)
    assert r.para_vos == 1
    para_vos = await _outbox(maker, "digest_para_vos")
    assert [m.to_email for m in para_vos] == [beto_u.email]
    assert (await _tick(maker, MONDAY_9 + timedelta(hours=1))).para_vos == 0


async def test_inactive_candidates_get_no_weekly_digest(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    async with maker() as db:
        # Sólo cuenta la última entrada, no la última edición del perfil.
        await db.execute(text("UPDATE users SET last_seen_at = NULL WHERE role = 'candidate'"))
        await db.commit()
    assert (await _tick(maker, MONDAY_9)).para_vos == 0


# ── Aviso "Hay una búsqueda que encaja con tu perfil" ───────────────────────────────────

async def _add_job(maker, company, ind, zone, title, published):
    async with maker() as db:
        ct = ContractType(id=uuid.uuid4(), name=f"Plazo {uuid.uuid4().hex[:6]}")
        db.add(ct)
        await db.flush()
        job = JobPosting(id=uuid.uuid4(), company_id=company.id, company_legal_name_snapshot="Metalúrgica Sur",
                         title=title, description="x", industry_id=ind.id, zone_id=zone.id,
                         contract_type_id=ct.id, modality="presencial", status="active", moderation_status="approved",
                         published_at=published)
        db.add(job)
        await db.commit()
        return job


async def _skill_match(maker, job, profiles):
    """La búsqueda pide una habilidad que tienen estos perfiles: zona + modalidad + 1 = 5 puntos."""
    async with maker() as db:
        tag = uuid.uuid4().hex[:6]
        sk = Skill(id=uuid.uuid4(), name=f"Soldadura {tag}", slug=f"soldadura-{tag}", category="technical")
        db.add(sk)
        await db.flush()
        db.add(JobPostingSkill(job_posting_id=job.id, skill_id=sk.id, is_required=True))
        for p in profiles:
            db.add(CandidateSkill(candidate_id=p.id, skill_id=sk.id))
        await db.commit()


async def _collect_simple(maker, job, now):
    async with maker() as db:
        j = await db.get(JobPosting, job.id)
        n = await matches.collect_simple_matches(db, j, now)
        await db.commit()
        return n


async def test_match_alert_simple_score_groups_and_waits_24h(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (ana_u, ana_p), (beto_u, beto_p) = cands
    await _skill_match(maker, job, [ana_p])           # Beto no tiene la habilidad: 3 puntos, no llega
    assert await _collect_simple(maker, job, MONDAY_9) == 1
    await _collect_simple(maker, job, MONDAY_9)       # se vuelve a evaluar, pero no duplica
    async with maker() as db:
        assert (await db.execute(select(func.count()).select_from(CandidateJobMatch))).scalar_one() == 1

    tuesday = MONDAY_9 + timedelta(days=1)
    async with maker() as db:
        assert await matches.send_match_alerts(db, tuesday) == 1
        await db.commit()
    mail = (await _outbox(maker, "aviso_busquedas"))[0]
    assert mail.to_email == ana_u.email and mail.category == "alertas"
    assert mail.subject == "Hay una búsqueda que encaja con tu perfil"
    assert "Soldador" in mail.html and "Postularme" in mail.html

    # Dos búsquedas más a las pocas horas: esperan las 24 h y salen juntas en un solo mail.
    later = [await _add_job(maker, company, ind, zone, t, tuesday) for t in ("Tornero", "Pintor")]
    for j in later:
        await _skill_match(maker, j, [ana_p])
        await _collect_simple(maker, j, tuesday + timedelta(hours=2))
    async with maker() as db:
        assert await matches.send_match_alerts(db, tuesday + timedelta(hours=3)) == 0
        assert await matches.send_match_alerts(db, tuesday + timedelta(hours=25)) == 1
        await db.commit()
    mails = sorted(await _outbox(maker, "aviso_busquedas"), key=lambda m: m.created_at)
    assert len(mails) == 2 and mails[1].subject == "Hay 2 búsquedas que encajan con tu perfil"
    assert "Tornero" in mails[1].html and "Pintor" in mails[1].html and "Soldador" not in mails[1].html


async def test_match_alert_skips_applied_inactive_and_unconsented(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (ana_u, ana_p), (beto_u, beto_p) = cands
    async with maker() as db:
        tag = uuid.uuid4().hex[:6]
        cu2 = User(id=uuid.uuid4(), email=f"caro-{tag}@mail.com", role="candidate", is_active=True,
                   last_seen_at=MONDAY_9 - timedelta(days=1))      # sin aceptar la 3.0
        db.add(cu2)
        await db.flush()
        caro = CandidateProfile(id=uuid.uuid4(), user_id=cu2.id, first_name="caro", last_name="T", phone="1",
                                location_zone_id=zone.id, accepts_onsite=True)
        db.add(caro)
        db.add(Application(candidate_id=ana_p.id, job_posting_id=job.id))       # Ana ya se postuló
        await db.execute(text("UPDATE users SET last_seen_at = :t WHERE id = :id"),
                         {"t": MONDAY_9 - timedelta(days=31), "id": beto_u.id})  # Beto no entra hace 31 días
        await db.commit()
    await _skill_match(maker, job, [ana_p, beto_p, caro])
    assert await _collect_simple(maker, job, MONDAY_9) == 0


async def test_match_alert_rechecks_at_send_time_and_para_vos_does_not_repeat(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (ana_u, ana_p), (beto_u, beto_p) = cands
    await _skill_match(maker, job, [ana_p, beto_p])
    assert await _collect_simple(maker, job, MONDAY_9 - timedelta(hours=5)) == 2
    async with maker() as db:
        db.add(Application(candidate_id=beto_p.id, job_posting_id=job.id))      # se postuló antes del mail
        await db.commit()
    sunday = MONDAY_9 - timedelta(hours=3)
    async with maker() as db:
        assert await matches.send_match_alerts(db, sunday) == 1
        await db.commit()
        status = dict((await db.execute(select(CandidateJobMatch.candidate_id, CandidateJobMatch.status))).all())
    assert status == {ana_p.id: "sent", beto_p.id: "skipped"}
    # El lunes, "Búsquedas para vos" no le repite a Ana la búsqueda del aviso.
    other = await _add_job(maker, company, ind, zone, "Electricista", MONDAY_9 - timedelta(days=2))
    await _tick(maker, MONDAY_9)
    para_vos = {m.to_email: m for m in await _outbox(maker, "digest_para_vos")}
    assert "Soldador" not in para_vos[ana_u.email].html and other.title in para_vos[ana_u.email].html


async def test_para_vos_marks_pending_matches_as_sent(maker):
    ind, zone, company, cu, job, cands = await _world(maker)
    (ana_u, ana_p), _ = cands
    await _skill_match(maker, job, [ana_p])
    await _collect_simple(maker, job, MONDAY_9 - timedelta(minutes=30))
    async with maker() as db:
        # Ya recibió un aviso hace poco: lo nuevo espera… y entra en el resumen del lunes.
        await digests._mark_sent(db, ana_u.id, matches.TEMPLATE_KEY, MONDAY_9 - timedelta(hours=1))
        await db.commit()
    r = await _tick(maker, MONDAY_9)
    assert r.para_vos >= 1 and r.avisos == 0
    async with maker() as db:
        m = (await db.execute(select(CandidateJobMatch).where(CandidateJobMatch.candidate_id == ana_p.id))).scalar_one()
    assert m.status == "sent"
    async with maker() as db:
        assert await matches.send_match_alerts(db, MONDAY_9 + timedelta(days=1)) == 0


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
    assert "1 empresa para verificar" in (await _outbox(maker, "digest_equipo"))[0].html


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
