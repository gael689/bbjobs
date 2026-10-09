"""Automatizaciones de la IA (09/10/2026) contra Postgres + pgvector (base descartable).

1. Moderación al publicar: vector y chequeos en segundo plano, chip en la lista de pendientes,
   y la creación nunca se rompe si falla Gemini.
2. Resúmenes nocturnos: caché por hash, tope de llamadas por corrida y tope diario en USD.
3. Habilidades sugeridas: aviso sólo en la web, ≥ 2 sugerencias, uno cada 30 días, interruptor.
4. Resumen diario del equipo: ítems de IA sólo si hay algo (R7).
5. Borrador semanal: siempre en borrador, uno por semana, nunca un mail.

En todas: con la compuerta o el interruptor apagados no hacen nada, y **ninguna encola un mail**
(se corre con EMAIL_MODE=simulate y los mails prendidos, así un tipo mal catalogado sí encolaría).
Gemini simulado.
"""
from __future__ import annotations

import hashlib
import os
import random
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy import func, select, text, update
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db
    from app.core.config import settings
    from app.db import session as db_session
    from app.integrations.gemini_client import AIError, AIResult, AIUsage
    from app.models.ai import (
        AiActivityLog, AiUsageLog, CandidateCvText, CandidateSummary, JobPostingVector, JobRecommendation,
    )
    from app.models.alerts import Notification
    from app.models.candidate import CandidateProfile, CandidateSkill
    from app.models.catalogs import ContractType, Industry, Skill, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.email import CampaignStatus, EmailCampaign, EmailOutbox
    from app.models.job import Application, JobPosting
    from app.models.settings import SettingKey
    from app.services.ai import automations, moderation, pipeline, skill_suggest
    from app.services.ai.skill_suggest import GeminiSuggestions
    from app.services.email import digests, monthly
    from app.services.email.campaign_ai import Draft
    from app.services.email.policy import AR_TZ
    from app.services.settings import set_setting
    from tests.test_ai_background_db import SummaryAI
    from tests.test_ai_pipeline_db import FakeAI, _vec, _world

SWITCHES = ("ia_recomendaciones_activas", "asistente_ia_activo", "emails_automaticos_activos")


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as db:
        for key in SWITCHES:
            await set_setting(db, SettingKey(key), True)
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 1000.0)
    monkeypatch.setattr(settings, "EMAIL_MODE", "simulate")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "clave-de-prueba")
    # Las tareas en segundo plano abren su propia sesión: que sea contra esta base y este loop.
    monkeypatch.setattr(db_session, "async_session_maker", session_maker)
    skill_suggest.clear_state()
    yield session_maker
    skill_suggest.clear_state()
    async with session_maker() as db:
        for key in SWITCHES:
            await set_setting(db, SettingKey(key), False)
        await db.commit()
    await engine.dispose()


@pytest.fixture
async def client(maker):
    from app.main import app

    async def _db():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
            yield c
    finally:
        app.dependency_overrides.clear()


def login(user):
    from app.main import app
    app.dependency_overrides[get_current_user] = lambda: user


async def _outbox(maker) -> int:
    async with maker() as db:
        return (await db.execute(select(func.count()).select_from(EmailOutbox))).scalar_one()


async def _switch(maker, key: str, on: bool):
    async with maker() as db:
        await set_setting(db, SettingKey(key), on)
        await db.commit()


def _tag() -> str:
    return "".join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(9))


async def _company_world(maker):
    tag = _tag()
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Ind {tag}", slug=f"ind-{tag}")
        zone = Zone(id=uuid.uuid4(), name=f"Zona {tag}", slug=f"zona-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Efectivo {tag}")
        cu = User(id=uuid.uuid4(), email=f"emp-{tag}@empresa.com", role="company", is_active=True)
        admin = User(id=uuid.uuid4(), email=f"admin-{tag}@talency.com", role="admin", is_active=True)
        db.add_all([ind, zone, ct, cu, admin])
        await db.flush()
        company = CompanyProfile(id=uuid.uuid4(), user_id=cu.id, legal_name=f"Empresa {tag}", cuit=f"30-{tag}-9",
                                 industry_id=ind.id, responsible_full_name="R", responsible_phone="2910000000",
                                 responsible_email="r@empresa.com", verification_status="verified")
        db.add(company)
        await db.commit()
    return dict(tag=tag, industry=ind, zone=zone, ct=ct, company_user=cu, company=company, admin=admin)


def _job(w, *, title, description, moderation_status="approved", status="active", published_at=None):
    return JobPosting(id=uuid.uuid4(), company_id=w["company"].id, company_legal_name_snapshot=w["company"].legal_name,
                      title=title, description=description, industry_id=w["industry"].id, zone_id=w["zone"].id,
                      contract_type_id=w["ct"].id, modality="presencial", status=status,
                      moderation_status=moderation_status,
                      published_at=published_at or datetime.now(timezone.utc) - timedelta(days=1))


# ── 1. Moderación al publicar ───────────────────────────────────────────────────────────

class FailingAI(FakeAI):
    async def embed(self, texts, *, task):
        raise AIError("Gemini caído", transient=True)


class BrokenAI(FakeAI):
    async def embed(self, texts, *, task):
        raise RuntimeError("algo inesperado")


async def _publish(client, w, title, description):
    login(w["company_user"])
    r = await client.post("/api/v1/me/company/jobs", json={
        "title": title, "description": description, "industry_id": str(w["industry"].id),
        "zone_id": str(w["zone"].id), "contract_type_id": str(w["ct"].id), "modality": "presencial",
    })
    assert r.status_code == 200, r.text
    return uuid.UUID(r.json()["id"])


async def _vector_of(maker, job_id):
    async with maker() as db:
        return (await db.execute(select(JobPostingVector).where(JobPostingVector.job_id == job_id))).scalar_one_or_none()


async def _pending_row(client, w, job_id):
    login(w["admin"])
    page = 1
    while True:
        r = await client.get("/api/v1/admin/jobs", params={"moderation_status": "pending_review", "page": page,
                                                           "page_size": 100})
        assert r.status_code == 200, r.text
        body = r.json()
        hit = next((i for i in body["items"] if i["id"] == str(job_id)), None)
        if hit or page * 100 >= body["total"]:
            return hit
        page += 1


async def test_publish_precomputes_checks_and_pending_list_shows_chip(maker, client, monkeypatch):
    w = await _company_world(maker)
    ai = FakeAI()
    monkeypatch.setattr(moderation, "get_provider", lambda: ai)
    desc = f"Buscamos repositor {w['tag']} para gondolas del supermercado turno tarde"
    async with maker() as db:
        original = _job(w, title=f"Repositor {w['tag']}", description=desc)
        db.add(original)
        await db.commit()
    outbox = await _outbox(maker)

    new_id = await _publish(client, w, f"Repositor {w['tag']}", desc)

    vec = await _vector_of(maker, new_id)
    assert vec is not None    # calculado en segundo plano, al publicar
    row = await _pending_row(client, w, new_id)
    assert row["ai_flags"]["possible_duplicate"] is True
    assert row["ai_flags"]["duplicate_of"] == f"Repositor {w['tag']}"
    assert row["ai_flags"]["duplicate_same_company"] is True
    async with maker() as db:
        job = (await db.execute(select(JobPosting).where(JobPosting.id == new_id))).scalar_one()
        assert str(getattr(job.moderation_status, "value", job.moderation_status)) == "pending_review"  # nunca decide
        logged = (await db.execute(select(AiActivityLog).where(AiActivityLog.job_id == new_id,
                                                               AiActivityLog.kind == "moderacion"))).scalar_one()
        assert logged.detail["duplicados"] >= 1
    assert await _outbox(maker) == outbox

    # Editar sin cambiar el texto: el vector se reusa (no se paga de nuevo).
    async with maker() as db:
        before = (await db.execute(select(func.count()).select_from(AiUsageLog).where(
            AiUsageLog.job_id == new_id))).scalar_one()
    login(w["company_user"])
    r = await client.patch(f"/api/v1/me/company/jobs/{new_id}", json={"duration_days": 20})
    assert r.status_code == 200, r.text
    async with maker() as db:
        after = (await db.execute(select(func.count()).select_from(AiUsageLog).where(
            AiUsageLog.job_id == new_id))).scalar_one()
    assert after == before

    # Editar el texto: se recalcula (otro hash).
    r = await client.patch(f"/api/v1/me/company/jobs/{new_id}", json={"description": desc + " con experiencia"})
    assert r.status_code == 200
    assert (await _vector_of(maker, new_id)).text_hash != vec.text_hash


@pytest.mark.parametrize("provider_cls", ["FailingAI", "BrokenAI"])
async def test_publish_never_breaks_when_gemini_fails(maker, client, monkeypatch, provider_cls):
    w = await _company_world(maker)
    ai = {"FailingAI": FailingAI, "BrokenAI": BrokenAI}[provider_cls]()
    monkeypatch.setattr(moderation, "get_provider", lambda: ai)
    new_id = await _publish(client, w, f"Cajero {w['tag']}", f"Atencion de caja {w['tag']}")
    async with maker() as db:
        assert (await db.execute(select(JobPosting).where(JobPosting.id == new_id))).scalar_one() is not None
    assert await _vector_of(maker, new_id) is None
    row = await _pending_row(client, w, new_id)
    assert row is not None and row["ai_flags"] is None


async def test_publish_with_gate_or_switch_off_does_nothing(maker, client, monkeypatch):
    w = await _company_world(maker)
    ai = FakeAI()
    monkeypatch.setattr(moderation, "get_provider", lambda: ai)

    await _switch(maker, "ia_recomendaciones_activas", False)
    off_switch = await _publish(client, w, f"Mozo {w['tag']}", f"Salon y barra {w['tag']}")
    assert await _vector_of(maker, off_switch) is None

    await _switch(maker, "ia_recomendaciones_activas", True)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    off_gate = await _publish(client, w, f"Bachero {w['tag']}", f"Cocina y limpieza {w['tag']}")
    assert await _vector_of(maker, off_gate) is None

    # Con la compuerta cerrada, la lista tampoco trae señales (aunque haya vector).
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    async with maker() as db:
        job = (await db.execute(select(JobPosting).where(JobPosting.id == off_gate))).scalar_one()
        await moderation.ensure_vector(db, ai, job)
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    row = await _pending_row(client, w, off_gate)
    assert row["ai_flags"] is None


# ── 2. Resúmenes nocturnos ──────────────────────────────────────────────────────────────

async def _summary_world(maker):
    """El mundo de los recomendados (`test_ai_pipeline_db._world`) con índice y recomendados ya
    calculados. Cierra las demás búsquedas activas de la base descartable, así la corrida de la
    noche sólo ve ésta."""
    async with maker() as db:
        await db.execute(update(JobPosting).where(JobPosting.status == "active").values(status="closed"))
        await db.commit()
    _companies, job, people = await _world(maker)
    world = {"job": job, "people": people}
    ai = SummaryAI()
    async with maker() as db:
        await pipeline.index_candidates(db, ai, [p.id for _u, p in people.values()])
        job = (await db.execute(select(JobPosting).where(JobPosting.id == job.id))).scalar_one()
        await pipeline.compute_recommendations(db, ai, job, rerank_enabled=True)
        await db.commit()
    return world, ai


async def _summaries(maker, job_id) -> int:
    async with maker() as db:
        return (await db.execute(select(func.count()).select_from(CandidateSummary).where(
            CandidateSummary.job_id == job_id))).scalar_one()


async def test_nightly_summaries_are_ready_and_cached(maker):
    world, ai = await _summary_world(maker)
    outbox = await _outbox(maker)
    async with maker() as db:
        stats = await automations.nightly_summaries(db, ai)
    assert stats["generados"] >= 1 and stats["tope"] == 0
    assert ai.summaries == stats["generados"]
    assert await _summaries(maker, world["job"].id) == stats["generados"]
    # Lo que llega al modelo está anonimizado (lo garantiza summary.py; se verifica igual).
    for prompt in ai.prompts:
        assert "Bueno" not in prompt and "Logística Sur" not in prompt

    async with maker() as db:   # segunda noche sin cambios: todo de la caché, nada pagado
        again = await automations.nightly_summaries(db, ai)
    assert again["generados"] == 0 and again["reusados"] == stats["generados"]
    assert ai.summaries == stats["generados"]
    assert await _outbox(maker) == outbox


async def test_nightly_summaries_respect_call_cap_and_budget(maker, monkeypatch):
    world, ai = await _summary_world(maker)
    async with maker() as db:
        stats = await automations.nightly_summaries(db, ai, max_calls=1)
    assert ai.summaries == 1 and stats["tope"] == 1

    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 0.0)
    async with maker() as db:
        stats = await automations.nightly_summaries(db, ai)
    assert ai.summaries == 1 and stats["tope"] == 1 and stats["generados"] == 0


async def test_nightly_summaries_off_does_nothing(maker, monkeypatch):
    world, ai = await _summary_world(maker)
    await _switch(maker, "ia_recomendaciones_activas", False)
    async with maker() as db:
        assert (await automations.nightly_summaries(db, ai))["busquedas"] == 0
    await _switch(maker, "ia_recomendaciones_activas", True)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    async with maker() as db:
        assert (await automations.nightly_summaries(db, ai))["busquedas"] == 0
    assert ai.summaries == 0
    assert await _summaries(maker, world["job"].id) == 0


async def test_nightly_runs_summaries_after_recommendations(maker, monkeypatch):
    from app.services.ai import jobs as ai_jobs

    world, ai = await _summary_world(maker)
    monkeypatch.setattr(ai_jobs, "async_session_maker", maker)
    monkeypatch.setattr(ai_jobs, "get_provider", lambda: ai)
    total = await ai_jobs.nightly()
    assert total["resumenes"] >= 1
    assert await _summaries(maker, world["job"].id) >= 1


# ── 3. Habilidades sugeridas (sólo en la web) ───────────────────────────────────────────

class SkillsAI(FakeAI):
    def __init__(self, picks):
        super().__init__()
        self.picks = picks
        self.skill_calls = 0

    async def generate_json(self, *, system, prompt, model, feature, **kw):
        if model is GeminiSuggestions:
            self.skill_calls += 1
            return AIResult(data=GeminiSuggestions.model_validate({"sugerencias": self.picks}),
                            usage=AIUsage(model="gemini-3.5-flash-lite", input_tokens=2000, output_tokens=300))
        return await super().generate_json(system=system, prompt=prompt, model=model, feature=feature, **kw)


CV = ("Experiencia\nCajera en supermercado: cobro con caja registradora y cierre de caja diario.\n"
      "Armado de planillas de stock en Excel y control de inventario semanal.")


async def _skills_world(maker, *, with_cv_text=True):
    tag = _tag()
    cv = CV + f" Curso de atencion al cliente {tag}."   # único por test: la caché de habilidades es por texto
    async with maker() as db:
        caja = Skill(id=uuid.uuid4(), name=f"Manejo de caja {tag}", slug=f"caja-{tag}", category="technical")
        excel = Skill(id=uuid.uuid4(), name=f"Excel {tag}", slug=f"excel-{tag}", category="technical")
        ku = User(id=uuid.uuid4(), email=f"cand-{tag}@mail.com", role="candidate", is_active=True)
        db.add_all([caja, excel, ku])
        await db.flush()
        cand = CandidateProfile(id=uuid.uuid4(), user_id=ku.id, first_name="Lucia", last_name=f"Paz{tag}",
                                phone="2915551234", cv_file_url=f"https://res.cloudinary.com/x/raw/upload/cv-{tag}.pdf")
        db.add(cand)
        await db.flush()
        if with_cv_text:
            db.add(CandidateCvText(candidate_id=cand.id, status="ok", text=cv, redaction_stats={}, notes=[],
                                   source_hash=hashlib.sha256(cand.cv_file_url.encode()).hexdigest()))
        await db.commit()
    picks = [{"habilidad": f"Manejo de caja {tag}", "evidencia": "cobro con caja registradora y cierre de caja diario"},
             {"habilidad": f"Excel {tag}", "evidencia": "Armado de planillas de stock en Excel"}]
    return dict(tag=tag, user=ku, candidate=cand, caja=caja, excel=excel, picks=picks, cv=cv)


async def _skill_notices(maker, user_id) -> list:
    async with maker() as db:
        return list((await db.execute(select(Notification).where(
            Notification.user_id == user_id, Notification.type == "skill_suggestions_ready"))).scalars().all())


async def _user_outbox(maker, user_id) -> int:
    async with maker() as db:
        return (await db.execute(select(func.count()).select_from(EmailOutbox).where(
            EmailOutbox.user_id == user_id))).scalar_one()


async def test_skill_suggestions_notify_on_the_web_only_once_a_month(maker):
    w = await _skills_world(maker)
    ai = SkillsAI(w["picks"])
    async with maker() as db:
        assert await automations.notify_skill_suggestions(db, ai, [w["candidate"].id]) == 1
    notices = await _skill_notices(maker, w["user"].id)
    assert len(notices) == 1 and notices[0].link == "/dashboard/candidate/perfil"
    assert w["caja"].name in notices[0].body
    assert await _user_outbox(maker, w["user"].id) == 0   # nunca mail

    # Otro CV a la semana: dentro de los 30 días no se avisa ni se paga una llamada.
    skill_suggest.clear_state()
    async with maker() as db:
        assert await automations.notify_skill_suggestions(db, ai, [w["candidate"].id]) == 0
    assert ai.skill_calls == 1
    # A los 31 días, sí.
    async with maker() as db:
        later = datetime.now(timezone.utc) + timedelta(days=31)
        assert await automations.notify_skill_suggestions(db, ai, [w["candidate"].id], now=later) == 1
    assert len(await _skill_notices(maker, w["user"].id)) == 2


async def test_skill_suggestions_need_two_and_use_the_cache(maker):
    w = await _skills_world(maker)
    ai = SkillsAI(w["picks"][:1])
    async with maker() as db:
        assert await automations.notify_skill_suggestions(db, ai, [w["candidate"].id]) == 0
    assert await _skill_notices(maker, w["user"].id) == []

    # Ya tiene una de las dos: queda una sola sugerencia → no avisa. La caché evita la segunda llamada.
    w2 = await _skills_world(maker)
    ai2 = SkillsAI(w2["picks"])
    async with maker() as db:
        db.add(CandidateSkill(candidate_id=w2["candidate"].id, skill_id=w2["excel"].id))
        await db.commit()
        assert await automations.notify_skill_suggestions(db, ai2, [w2["candidate"].id]) == 0
        assert await automations.notify_skill_suggestions(db, ai2, [w2["candidate"].id]) == 0
    assert ai2.skill_calls == 1


async def test_skill_suggestions_off_does_nothing(maker, monkeypatch):
    w = await _skills_world(maker)
    ai = SkillsAI(w["picks"])
    await _switch(maker, "asistente_ia_activo", False)
    async with maker() as db:
        assert await automations.notify_skill_suggestions(db, ai, [w["candidate"].id]) == 0
    await _switch(maker, "asistente_ia_activo", True)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    async with maker() as db:
        assert await automations.notify_skill_suggestions(db, ai, [w["candidate"].id]) == 0
    assert ai.skill_calls == 0
    assert await _skill_notices(maker, w["user"].id) == []


async def test_index_tick_reads_new_cv_and_notifies_skills(maker, monkeypatch):
    from app.services.ai import ingest
    from app.services.ai import jobs as ai_jobs
    from app.services.ai.ingest import CvExtraction

    w = await _skills_world(maker, with_cv_text=False)
    ai = SkillsAI(w["picks"])

    async def fake_fetch(url):
        return b"%PDF-1.4 falso"

    monkeypatch.setattr(ai_jobs, "fetch_cv", fake_fetch)
    monkeypatch.setattr(ingest, "extract_cv_text", lambda data: CvExtraction(status="ok", text=w["cv"]))
    monkeypatch.setattr(ai_jobs, "async_session_maker", maker)
    monkeypatch.setattr(ai_jobs, "get_provider", lambda: ai)
    monkeypatch.setattr(automations, "SKILL_NOTICE_PER_RUN", 10_000)
    outbox = await _user_outbox(maker, w["user"].id)

    await ai_jobs.index_tick()
    assert len(await _skill_notices(maker, w["user"].id)) == 1
    # La vuelta siguiente no relee el mismo CV (mismo archivo) ni vuelve a avisar.
    await ai_jobs.index_tick()
    assert len(await _skill_notices(maker, w["user"].id)) == 1
    assert await _user_outbox(maker, w["user"].id) == outbox


# ── 4. Resumen diario del equipo ────────────────────────────────────────────────────────

def _morning() -> datetime:
    today = datetime.now(AR_TZ).date()
    return datetime(today.year, today.month, today.day, 9, 0, tzinfo=AR_TZ).astimezone(timezone.utc)


async def _team_digest(maker, admin_id) -> EmailOutbox | None:
    async with maker() as db:
        return (await db.execute(select(EmailOutbox).where(
            EmailOutbox.user_id == admin_id, EmailOutbox.template_key == "digest_equipo"))).scalar_one_or_none()


async def _clean_slate(maker):
    """El resumen del equipo mira toda la base: para probar R7 se arranca de cero."""
    async with maker() as db:
        await db.execute(text(
            "TRUNCATE ai_activity_log, ai_usage_log, email_campaigns, contact_messages, cv_review_orders, "
            "job_recommendations, job_posting_vectors, applications, job_postings, company_profiles, "
            "email_outbox, email_digest_state RESTART IDENTITY CASCADE"))
        await db.commit()


async def test_team_digest_never_goes_out_empty_and_lists_ai_items(maker, monkeypatch):
    await _clean_slate(maker)
    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 1.0)
    w = await _company_world(maker)
    now = _morning()
    async with maker() as db:
        assert await automations.team_ai_items(db, now) == []
        await digests.send_team_daily(db, now)
        await db.commit()
    assert await _team_digest(maker, w["admin"].id) is None     # R7: sin nada, no sale

    # Hay de todo: candidato que encaja sin mirar, duplicado pendiente, fuga y gasto al 90 %.
    ai = FakeAI()
    async with maker() as db:
        desc = f"Chofer {w['tag']} de reparto con registro profesional"
        live = _job(w, title=f"Chofer {w['tag']}", description=desc)
        dup = _job(w, title=f"Chofer {w['tag']}", description=desc, moderation_status="pending_review")
        ku = User(id=uuid.uuid4(), email=f"c-{w['tag']}@mail.com", role="candidate", is_active=True)
        db.add_all([live, dup, ku])
        await db.flush()
        cand = CandidateProfile(id=uuid.uuid4(), user_id=ku.id, first_name="Ana", last_name="T", phone="2915550000")
        db.add(cand)
        await db.flush()
        db.add(Application(candidate_id=cand.id, job_posting_id=live.id))
        db.add(JobRecommendation(id=uuid.uuid4(), job_id=live.id, candidate_id=cand.id, source="applicant",
                                 hybrid_fit=0.9, coverage=0.9, final_score=88, weights_version="t"))
        await moderation.ensure_vector(db, ai, live)
        await moderation.ensure_vector(db, ai, dup)
        db.add(AiActivityLog(id=uuid.uuid4(), kind="cv_lectura", candidate_id=cand.id, detail={"fugas": 1},
                             cost_usd=0, alert=True, created_at=now - timedelta(hours=2)))
        db.add(AiUsageLog(id=uuid.uuid4(), feature="rerank", model="gemini-3.5-flash-lite", cost_usd=0.9,
                          created_at=now - timedelta(minutes=30)))
        await db.commit()
    async with maker() as db:
        titles = [t for t, _, _ in await automations.team_ai_items(db, now)]
    assert any("encajan y nadie miró" in t for t in titles)
    assert any("posible duplicado" in t for t in titles)
    assert "Alerta de anonimización de CVs" in titles
    assert "Gasto de IA cerca del tope" in titles

    async with maker() as db:
        await digests.send_team_daily(db, now)
        await db.commit()
    mail = await _team_digest(maker, w["admin"].id)
    assert mail is not None and "posible duplicado" in mail.text
    assert mail.text.count("Gasto de IA") == 1     # el aviso de tope reemplaza al gasto suelto


async def test_team_ai_items_off(maker, monkeypatch):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    async with maker() as db:
        assert await automations.team_ai_items(db, _morning()) == []


# ── 5. Borrador semanal ─────────────────────────────────────────────────────────────────

def _random_monday(hour=9, minute=30) -> datetime:
    d = date(2031, 1, 6) + timedelta(days=7 * random.randint(0, 5000))
    return datetime(d.year, d.month, d.day, hour, minute, tzinfo=AR_TZ).astimezone(timezone.utc)


class DraftAI:
    def __init__(self):
        self.calls = 0

    async def generate_json(self, *, system, prompt, model, feature, **kw):
        self.calls += 1
        data = {"asuntos": ["Búsquedas nuevas en Bahía"], "preheader": "Mirá lo nuevo", "cuerpo": "Hola {{nombre}}",
                "boton": "Ver búsquedas"}
        return AIResult(data=Draft.model_validate(data), usage=AIUsage(model="gemini-3.5-flash-lite", input_tokens=500))


async def test_weekly_draft_once_per_week_always_draft_never_mail(maker, monkeypatch):
    w = await _company_world(maker)
    monday = _random_monday()
    ai = DraftAI()
    monkeypatch.setattr(monthly, "get_provider", lambda: ai)
    async with maker() as db:
        db.add(_job(w, title=f"Electricista {w['tag']}", description="Obra", published_at=monday - timedelta(days=2)))
        await db.commit()
    outbox = await _outbox(maker)

    async with maker() as db:
        campaign = await monthly.prepare_weekly_draft(db, monday)
        await db.commit()
    assert campaign is not None and campaign.name.startswith(monthly.WEEKLY_PREFIX)
    assert campaign.status == CampaignStatus.draft.value and campaign.generated_by_ai
    async with maker() as db:
        assert await monthly.prepare_weekly_draft(db, monday + timedelta(hours=3)) is None   # no se duplica
        stored = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == campaign.id))).scalar_one()
        assert stored.status == CampaignStatus.draft.value
        notes = (await db.execute(select(func.count()).select_from(Notification).where(
            Notification.user_id == w["admin"].id, Notification.type == "admin_campaign_weekly_ready"))).scalar_one()
        assert notes == 1
    assert await _outbox(maker) == outbox     # aviso sólo en la web
    assert ai.calls == 1


async def test_weekly_draft_not_on_other_days_off_or_empty(maker, monkeypatch):
    w = await _company_world(maker)
    monkeypatch.setattr(monthly, "get_provider", lambda: DraftAI())
    monday = _random_monday()
    async with maker() as db:
        db.add(_job(w, title=f"Pintor {w['tag']}", description="Obra", published_at=monday - timedelta(days=1)))
        await db.commit()
    async with maker() as db:
        assert await monthly.prepare_weekly_draft(db, monday + timedelta(days=1)) is None    # martes
        assert await monthly.prepare_weekly_draft(db, _random_monday(8, 0)) is None          # antes de las 9
        assert await monthly.prepare_weekly_draft(db, _random_monday()) is None              # semana sin búsquedas
    await _switch(maker, "emails_automaticos_activos", False)
    async with maker() as db:
        assert await monthly.prepare_weekly_draft(db, monday) is None
    await _switch(maker, "emails_automaticos_activos", True)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    async with maker() as db:
        assert await monthly.prepare_weekly_draft(db, monday) is None
