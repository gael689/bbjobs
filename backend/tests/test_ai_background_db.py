"""IA de fondo (Frente 6, puntos 2, 4, 6 y 7) contra Postgres + pgvector (base descartable).

- "Búsquedas para vos" ordenado por afinidad semántica (sólo vectores ya calculados).
- Recomendados al instante: marca al postularse / al aprobar, debounce, tope de reranks.
- Resumen del candidato en 3 líneas: acceso cruzado entre empresas, cupo de la Base de Talento,
  caché, prompt sin datos personales, salida filtrada y borrado con la cuenta.
- Moderación: posible duplicado y sector dudoso, sin decidir nada.

Gemini simulado (bolsa de palabras). No trunca tablas: cada test arma su mundo con palabras
únicas, así lo que quedó de otras corridas no se parece a nada de acá.
"""
from __future__ import annotations

import os
import random
import re
import string
import uuid
from datetime import datetime, timedelta, timezone

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db, require_verified_company
    from app.api.v1 import recommendations as rec_api
    from app.core.config import settings
    from app.db import session as db_session
    from app.integrations.gemini_client import AIResult, AIUsage
    from app.models.ai import (
        AiRecomputeQueue, AiUsageLog, CandidateChunk, CandidateSummary, JobRecommendation,
        JobRequirementVector,
    )
    from app.models.candidate import CandidateProfile
    from app.models.catalogs import ContractType, Industry, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.email import EmailOutbox
    from app.models.job import JobPosting
    from app.models.settings import SettingKey
    from app.services.account_deletion import delete_account
    from app.services.ai import moderation, pipeline, realtime
    from app.services.ai.summary import SummaryOut
    from app.services.email import digests
    from app.services.email.policy import AR_TZ
    from app.services.settings import set_setting
    from tests.test_ai_pipeline_db import FakeAI, _vec, _world

MONDAY_9 = datetime(2030, 3, 4, 9, 0, tzinfo=AR_TZ).astimezone(timezone.utc) if TEST_DB else None


def _word() -> str:
    """Palabra sólo de letras (la bolsa de palabras del doble ignora dígitos), única por test."""
    return "".join(random.choice(string.ascii_lowercase) for _ in range(9))


class SummaryAI(FakeAI):
    """El doble de siempre + resumen: cita textual del primer fragmento y mete dos líneas que el
    validador tiene que tirar (empleador y edad)."""

    def __init__(self):
        super().__init__()
        self.summaries = 0
        self.prompts: list[str] = []

    async def generate_json(self, *, system, prompt, model, feature, company_id=None, max_output_tokens=2048,
                            service_tier="standard"):
        if model is not SummaryOut:
            return await super().generate_json(system=system, prompt=prompt, model=model, feature=feature,
                                               company_id=company_id, max_output_tokens=max_output_tokens,
                                               service_tier=service_tier)
        self.summaries += 1
        self.prompts.append(system + "\n" + prompt)
        ref = re.search(r"Referencia: (#\w+)", prompt).group(1)
        frags = dict(re.findall(r"\[(f\d+)\] (.+)", prompt))
        fid, text = next(iter(frags.items()))
        quote = text[:40]
        out = {"ref": ref, "lineas": [
            {"texto": "Tiene experiencia operando autoelevador en depósito.", "evidencia": quote, "fragmento": fid},
            {"texto": "Trabajó en Logística Sur SA.", "evidencia": quote, "fragmento": fid},
            {"texto": "Por su edad encaja con el equipo.", "evidencia": quote, "fragmento": fid},
            {"texto": "Inventado sin cita.", "evidencia": "esto no está en la ficha", "fragmento": "f1"},
        ]}
        return AIResult(data=SummaryOut.model_validate(out),
                        usage=AIUsage(model="gemini-3.5-flash-lite", input_tokens=800, output_tokens=120))


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as db:
        await set_setting(db, SettingKey.ia_recomendaciones_activas, True)
        await set_setting(db, SettingKey.emails_automaticos_activos, True)
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 1000.0)
    monkeypatch.setattr(settings, "EMAIL_MODE", "simulate")
    # `request_recompute` abre su propia sesión: que sea contra esta base y este loop.
    monkeypatch.setattr(db_session, "async_session_maker", session_maker)
    yield session_maker
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


# ── 1. "Búsquedas para vos" por afinidad ────────────────────────────────────────────────

async def _para_vos_world(maker):
    tag = _word()
    weld, cash = f"soldadura{tag}", f"cajera{tag}"
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Ind {tag}", slug=f"ind-{tag}")
        zone = Zone(id=uuid.uuid4(), name=f"Zona {tag}", slug=f"zona-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Efectivo {tag}")
        cu = User(id=uuid.uuid4(), email=f"emp-{tag}@empresa.com", role="company", is_active=True)
        ku = User(id=uuid.uuid4(), email=f"cand-{tag}@mail.com", role="candidate", is_active=True)
        db.add_all([ind, zone, ct, cu, ku])
        await db.flush()
        company = CompanyProfile(id=uuid.uuid4(), user_id=cu.id, legal_name=f"Empresa {tag}", cuit=f"30-{tag}-9",
                                 industry_id=ind.id, responsible_full_name="R", responsible_phone="2910000000",
                                 responsible_email="r@empresa.com", verification_status="verified")
        cand = CandidateProfile(id=uuid.uuid4(), user_id=ku.id, first_name="Ana", last_name="T", phone="2915550000",
                                location_zone_id=zone.id, accepts_onsite=True, updated_at=MONDAY_9 - timedelta(days=1))
        db.add_all([company, cand])
        await db.flush()
        jobs = {}
        # La de caja es la más nueva: sin vectores saldría primera (mismo puntaje, orden de publicación).
        for key, title, word, hours in (("weld", f"Soldador {tag}", weld, 30), ("cash", f"Cajera {tag}", cash, 2)):
            job = JobPosting(id=uuid.uuid4(), company_id=company.id, company_legal_name_snapshot=company.legal_name,
                             title=title, description=word, industry_id=ind.id, zone_id=zone.id,
                             contract_type_id=ct.id, modality="presencial", status="active",
                             moderation_status="approved", published_at=MONDAY_9 - timedelta(hours=hours))
            db.add(job)
            await db.flush()
            db.add(JobRequirementVector(id=uuid.uuid4(), job_id=job.id, req_id="r1", text=word,
                                        embedding=_vec(f"experiencia {word}"), model="gemini-embedding-001"))
            jobs[key] = job
        db.add(CandidateChunk(id=uuid.uuid4(), candidate_id=cand.id, kind="experiencia", ordinal=0,
                              text=f"Puesto: soldador. Tareas: {weld}", embedding=_vec(f"Puesto soldador {weld}"),
                              model="gemini-embedding-001"))
        await db.commit()
    return ku, jobs


async def _para_vos_order(maker, user, jobs) -> list[str]:
    async with maker() as db:
        await digests.send_para_vos(db, MONDAY_9)
        await db.commit()
        mail = (await db.execute(select(EmailOutbox).where(EmailOutbox.user_id == user.id,
                                                           EmailOutbox.template_key == "digest_para_vos"))).scalar_one()
    titles = [j.title for j in jobs.values()]
    return sorted(titles, key=lambda t: mail.text.index(t))


async def test_para_vos_orders_by_semantic_affinity(maker):
    user, jobs = await _para_vos_world(maker)
    order = await _para_vos_order(maker, user, jobs)
    assert order[0] == jobs["weld"].title          # la cercana a su experiencia, primera


async def test_para_vos_without_ai_keeps_todays_order(maker):
    user, jobs = await _para_vos_world(maker)
    async with maker() as db:
        await set_setting(db, SettingKey.ia_recomendaciones_activas, False)
        await db.commit()
    try:
        order = await _para_vos_order(maker, user, jobs)
    finally:
        async with maker() as db:
            await set_setting(db, SettingKey.ia_recomendaciones_activas, True)
            await db.commit()
    assert order[0] == jobs["cash"].title          # sin vectores: el orden de siempre


# ── 2. Recomendados al instante ─────────────────────────────────────────────────────────

async def _queue(maker, job_id):
    async with maker() as db:
        return (await db.execute(select(AiRecomputeQueue).where(AiRecomputeQueue.job_id == job_id))).scalar_one_or_none()


async def test_applications_mark_job_once_and_queue_processes_after_debounce(maker, client):
    from app.main import app

    companies, job, people = await _world(maker)
    extra = []
    async with maker() as db:
        for i in range(2):
            u = User(id=uuid.uuid4(), email=f"nuevo{i}-{uuid.uuid4().hex[:6]}@mail.com", role="candidate", is_active=True)
            db.add(u)
            await db.flush()
            db.add(CandidateProfile(id=uuid.uuid4(), user_id=u.id, first_name=f"Nuevo{i}", last_name="T",
                                    phone="2915550000", accepts_onsite=True))
            extra.append(u)
        await db.commit()
    for u in extra:
        app.dependency_overrides[get_current_user] = lambda u=u: u
        r = await client.post(f"/api/v1/jobs/{job.id}/apply", json={})
        assert r.status_code == 200, r.text
    async with maker() as db:
        rows = (await db.execute(select(func.count()).select_from(AiRecomputeQueue)
                                 .where(AiRecomputeQueue.job_id == job.id))).scalar_one()
    assert rows == 1                                  # dos postulaciones → una sola marca (debounce)
    first = await _queue(maker, job.id)
    assert first.reason == "postulacion"

    ai = FakeAI()
    async with maker() as db:
        ids = list((await db.execute(select(CandidateProfile.id))).scalars().all())
        await pipeline.index_candidates(db, ai, ids)
        await db.commit()
        stats = await realtime.process_queue(db, ai, now=first.requested_at + timedelta(seconds=30))
    assert stats["busquedas"] == 0 and await _queue(maker, job.id) is not None   # todavía en ventana
    async with maker() as db:
        stats = await realtime.process_queue(db, ai, now=first.requested_at + realtime.DEBOUNCE + timedelta(seconds=1))
    assert stats["busquedas"] == 1 and await _queue(maker, job.id) is None
    async with maker() as db:
        recs = (await db.execute(select(func.count()).select_from(JobRecommendation)
                                 .where(JobRecommendation.job_id == job.id))).scalar_one()
    assert recs >= 4 and ai.reranks >= 1


async def test_queue_respects_max_reranks_per_run(maker, monkeypatch):
    companies, job, people = await _world(maker)
    ai = FakeAI()
    async with maker() as db:
        ids = list((await db.execute(select(CandidateProfile.id))).scalars().all())
        await pipeline.index_candidates(db, ai, ids)
        await realtime.mark(db, job.id, "aprobada")
        await db.commit()
    later = datetime.now(timezone.utc) + timedelta(minutes=5)
    monkeypatch.setattr(settings, "AI_MAX_RERANKS_PER_RUN", 1)
    async with maker() as db:
        stats = await realtime.process_queue(db, ai, now=later)
    assert ai.reranks == 1 and stats["pendientes"] == 1
    assert await _queue(maker, job.id) is not None    # quedó para la próxima vuelta
    async with maker() as db:
        limited = (await db.execute(select(func.count()).select_from(JobRecommendation).where(
            JobRecommendation.job_id == job.id, JobRecommendation.rerank_status == "skipped_limit"))).scalar_one()
    assert limited >= 1
    monkeypatch.setattr(settings, "AI_MAX_RERANKS_PER_RUN", 50)
    async with maker() as db:
        await realtime.process_queue(db, ai, now=later)
    assert await _queue(maker, job.id) is None


async def test_approval_marks_job_and_switch_off_does_not(maker, client):
    from app.main import app

    companies, job, people = await _world(maker)
    async with maker() as db:
        admin = User(id=uuid.uuid4(), email=f"admin-{uuid.uuid4().hex[:6]}@bbjobs.com", role="admin", is_active=True)
        db.add(admin)
        await db.commit()
    app.dependency_overrides[get_current_user] = lambda: admin
    r = await client.patch(f"/api/v1/admin/jobs/{job.id}/moderate", json={"action": "approve", "notes": None})
    assert r.status_code == 200, r.text
    assert (await _queue(maker, job.id)).reason == "aprobada"

    async with maker() as db:
        await db.execute(AiRecomputeQueue.__table__.delete().where(AiRecomputeQueue.job_id == job.id))
        await set_setting(db, SettingKey.ia_recomendaciones_activas, False)
        await db.commit()
    try:
        r = await client.patch(f"/api/v1/admin/jobs/{job.id}/moderate", json={"action": "approve", "notes": None})
        assert r.status_code == 200 and await _queue(maker, job.id) is None
    finally:
        async with maker() as db:
            await set_setting(db, SettingKey.ia_recomendaciones_activas, True)
            await db.commit()


# ── 3. Resumen del candidato ────────────────────────────────────────────────────────────

async def _summary_world(maker, monkeypatch):
    companies, job, people = await _world(maker)
    ai = SummaryAI()
    async with maker() as db:
        ids = [p.id for _, p in people.values()]
        await pipeline.index_candidates(db, ai, ids)
        j = (await db.execute(select(JobPosting).where(JobPosting.id == job.id))).scalar_one()
        await pipeline.compute_recommendations(db, ai, j, rerank_enabled=True)
        await db.commit()
    monkeypatch.setattr(rec_api, "provider_or_none", lambda: ai)
    return companies, job, people, ai


async def test_summary_cross_company_404_cache_and_no_personal_data(maker, client, monkeypatch):
    from app.main import app

    companies, job, people, ai = await _summary_world(maker, monkeypatch)
    user, bueno = people["bueno"]
    ref = rec_api.candidate_ref(companies[0].id, bueno.id)
    url = f"/api/v1/me/company/jobs/{job.id}/recommendations/{ref.replace('#', '%23')}/summary"

    app.dependency_overrides[require_verified_company] = lambda: companies[1]
    assert (await client.get(url)).status_code == 404                     # búsqueda ajena
    other_ref = rec_api.candidate_ref(companies[1].id, bueno.id)          # ref de otra empresa
    app.dependency_overrides[require_verified_company] = lambda: companies[0]
    assert (await client.get(url.replace(ref.replace('#', '%23'), other_ref.replace('#', '%23')))).status_code == 404

    r = await client.get(url)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["generated_with_ai"] and "Decide la empresa" in data["disclaimer"]
    texts = [l["text"] for l in data["lines"]]
    assert texts == ["Tiene experiencia operando autoelevador en depósito."]   # empleador y edad, fuera
    assert data["lines"][0]["evidence"]

    prompt = ai.prompts[0]
    for secret in ("Bueno", "2915550000", user.email, "Logística Sur", "Test"):
        assert secret not in prompt
    assert "FICHA_NO_CONFIABLE" in prompt

    assert (await client.get(url)).status_code == 200
    assert ai.summaries == 1                                               # caché
    async with maker() as db:
        assert (await db.execute(select(func.count()).select_from(AiUsageLog).where(
            AiUsageLog.feature == "resumen", AiUsageLog.job_id == job.id))).scalar_one() == 1


async def test_summary_of_blind_talent_hides_evidence_and_respects_quota(maker, client, monkeypatch):
    from app.main import app

    companies, job, people, ai = await _summary_world(maker, monkeypatch)
    _, talento = people["talento"]
    app.dependency_overrides[require_verified_company] = lambda: companies[0]
    ref = rec_api.candidate_ref(companies[0].id, talento.id).replace("#", "%23")
    url = f"/api/v1/me/company/jobs/{job.id}/recommendations/{ref}/summary"
    monkeypatch.setattr(settings, "RECS_TALENT_FREE_COUNT", 1000)
    r = await client.get(url)
    assert r.status_code == 200, r.text
    assert all(l["evidence"] is None for l in r.json()["lines"])          # ciego: la cita, tapada
    monkeypatch.setattr(settings, "RECS_TALENT_FREE_COUNT", 0)
    monkeypatch.setattr(settings, "RECS_TALENT_PACK_COUNT", 0)
    assert (await client.get(url)).status_code == 404                     # fuera del cupo que ve


async def test_summary_is_deleted_with_the_account(maker, client, monkeypatch):
    from app.main import app

    companies, job, people, ai = await _summary_world(maker, monkeypatch)
    user, bueno = people["bueno"]
    app.dependency_overrides[require_verified_company] = lambda: companies[0]
    ref = rec_api.candidate_ref(companies[0].id, bueno.id).replace("#", "%23")
    assert (await client.get(f"/api/v1/me/company/jobs/{job.id}/recommendations/{ref}/summary")).status_code == 200
    async with maker() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        await delete_account(db, u, actor=None, reason="test", delete_in_clerk=False)
    async with maker() as db:
        left = (await db.execute(select(func.count()).select_from(CandidateSummary)
                                 .where(CandidateSummary.candidate_id == bueno.id))).scalar_one()
    assert left == 0


# ── 4. Moderación: duplicados y sector ──────────────────────────────────────────────────

async def _moderation_world(maker):
    vocab = {k: [_word() for _ in range(4)] for k in ("a", "b", "c")}
    async with maker() as db:
        tag = _word()
        zone = Zone(id=uuid.uuid4(), name=f"Zona {tag}", slug=f"zona-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Efectivo {tag}")
        inds = {k: Industry(id=uuid.uuid4(), name=f"Sector {k.upper()} {tag}", slug=f"sector-{k}-{tag}") for k in vocab}
        cus = [User(id=uuid.uuid4(), email=f"emp{i}-{tag}@empresa.com", role="company", is_active=True) for i in range(2)]
        db.add_all([zone, ct, *inds.values(), *cus])
        await db.flush()
        comps = [CompanyProfile(id=uuid.uuid4(), user_id=u.id, legal_name=f"Empresa {i} {tag}", cuit=f"30-{tag}{i}-9",
                                industry_id=inds["a"].id, responsible_full_name="R", responsible_phone="2910000000",
                                responsible_email="r@empresa.com", verification_status="verified")
                 for i, u in enumerate(cus)]
        db.add_all(comps)
        await db.flush()

        def job(company, ind_key, words, title, **kw):
            j = JobPosting(id=uuid.uuid4(), company_id=company.id, company_legal_name_snapshot=company.legal_name,
                           title=title, description=" ".join(words), industry_id=inds[ind_key].id, zone_id=zone.id,
                           contract_type_id=ct.id, modality="presencial", **kw)
            db.add(j)
            return j

        for k, words in vocab.items():
            for i in range(moderation.MIN_SECTOR_JOBS):
                job(comps[1], k, words + [_word()], f"{k} {i}", status="closed", moderation_status="approved")
        original = job(comps[1], "b", vocab["b"] + ["repetido"], "Original activo", status="active",
                       moderation_status="approved", published_at=datetime.now(timezone.utc))
        # Nueva, por revisar: el mismo texto que la activa (de OTRA empresa), cargada en el sector A.
        nueva = job(comps[0], "a", vocab["b"] + ["repetido"], "Original activo", status="active",
                    moderation_status="pending_review")
        distinta = job(comps[0], "a", vocab["a"], "Distinta", status="active", moderation_status="pending_review")
        await db.commit()
    return inds, comps, original, nueva, distinta


async def test_moderation_flags_duplicate_and_wrong_sector_without_deciding(maker, client, monkeypatch):
    from app.main import app

    inds, comps, original, nueva, distinta = await _moderation_world(maker)
    ai = FakeAI()
    async with maker() as db:
        n = await moderation.embed_missing(db, ai, limit=10_000)
        await db.commit()
    assert n >= 17
    monkeypatch.setattr(rec_api, "provider_or_none", lambda: ai)
    async with maker() as db:
        admin = User(id=uuid.uuid4(), email=f"admin-{uuid.uuid4().hex[:6]}@bbjobs.com", role="admin", is_active=True)
        db.add(admin)
        await db.commit()
    app.dependency_overrides[get_current_user] = lambda: admin

    data = (await client.get(f"/api/v1/admin/jobs/{nueva.id}/ai-checks")).json()
    assert data["enabled"] and data["available"]
    assert [d["job_id"] for d in data["duplicates"]] == [str(original.id)]
    assert data["duplicates"][0]["same_company"] is False and data["duplicates"][0]["similarity"] >= 0.92
    assert data["sector"]["suggested_industry_id"] == str(inds["b"].id)
    assert "no aprueba ni rechaza" in data["disclaimer"]

    clean = (await client.get(f"/api/v1/admin/jobs/{distinta.id}/ai-checks")).json()
    assert clean["duplicates"] == [] and clean["sector"] is None

    async with maker() as db:
        still = (await db.execute(select(JobPosting.moderation_status).where(JobPosting.id == nueva.id))).scalar_one()
        spent = (await db.execute(select(func.count()).select_from(AiUsageLog)
                                  .where(AiUsageLog.feature == "moderacion"))).scalar_one()
    assert str(getattr(still, "value", still)) == "pending_review" and spent >= 1


async def test_moderation_does_not_opine_on_sector_with_little_data(maker):
    tag = _word()
    ai = FakeAI()
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Nuevo {tag}", slug=f"nuevo-{tag}")
        zone = Zone(id=uuid.uuid4(), name=f"Zona {tag}", slug=f"zona-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Efectivo {tag}")
        cu = User(id=uuid.uuid4(), email=f"emp-{tag}@empresa.com", role="company", is_active=True)
        db.add_all([ind, zone, ct, cu])
        await db.flush()
        comp = CompanyProfile(id=uuid.uuid4(), user_id=cu.id, legal_name=f"Empresa {tag}", cuit=f"30-{tag}-9",
                              industry_id=ind.id, responsible_full_name="R", responsible_phone="2910000000",
                              responsible_email="r@empresa.com", verification_status="verified")
        db.add(comp)
        await db.flush()
        job = JobPosting(id=uuid.uuid4(), company_id=comp.id, company_legal_name_snapshot=comp.legal_name,
                         title=f"Puesto {tag}", description=f"{_word()} {_word()}", industry_id=ind.id, zone_id=zone.id,
                         contract_type_id=ct.id, modality="presencial", status="active", moderation_status="pending_review")
        db.add(job)
        await db.commit()
        checks = await moderation.checks_for(db, ai, job)
        await db.commit()
    assert checks.available and checks.sector is None and checks.note
