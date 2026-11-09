"""Bombita de recomendados sin mirar (empresa) y aviso "Hay una búsqueda que encaja con tu perfil"
(candidato), contra Postgres + pgvector (base descartable). PLAN-FINAL-IA-Y-MAILS §3 y §4.

- La bombita cuenta los recomendados ≥ 70 sin mirar de cada búsqueda **de la empresa** (acceso
  cruzado), sin 👎 ni perfiles de la Base fuera del cupo, y se apaga al abrir Recomendados.
- El aviso al candidato con IA: sólo puntajes evaluados (`rerank_status == "done"`), nunca a quien
  ya se postuló, y lo anota el recálculo de la cola al terminar.
- La lápida borra lo anotado para el aviso.
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
    from sqlalchemy import func, select, text, update
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db, require_verified_company
    from app.core.config import settings
    from app.db import session as db_session
    from app.models.ai import JobRecommendation
    from app.models.alerts import CandidateJobMatch
    from app.models.core import User
    from app.models.settings import SettingKey, SiteSetting
    from app.services.account_deletion import delete_account
    from app.services.ai import realtime
    from app.services.email import matches
    from tests.test_ai_pipeline_db import FakeAI, _compute, _world


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE ai_usage_log, job_recommendations, candidate_job_matches, candidate_chunks, candidate_ai_index, "
            "candidate_cv_texts, job_ai_profiles, job_requirement_vectors, ai_recompute_queue, applications, "
            "job_posting_skills, job_postings, candidate_skills, experiences, candidate_profiles, company_profiles, "
            "site_settings, users RESTART IDENTITY CASCADE"
        ))
    async with session_maker() as db:
        db.add(SiteSetting(key=SettingKey.ia_recomendaciones_activas.value, enabled=True))
        db.add(SiteSetting(key=SettingKey.emails_automaticos_activos.value, enabled=True))
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 100.0)
    monkeypatch.setattr(settings, "EMAIL_MODE", "simulate")
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


async def _ready(maker):
    """El mundo del pipeline, calculado, con todos entrando hace un día y la búsqueda recién
    publicada. "bueno" (postulante) y "talento" (Base) quedan con 91, evaluados por la IA."""
    companies, job, people = await _world(maker)
    await _compute(maker, job.id, FakeAI())
    now = datetime.now(timezone.utc)
    async with maker() as db:
        await db.execute(update(User).values(last_seen_at=now - timedelta(days=1)))
        await db.execute(text("UPDATE job_postings SET published_at = :t WHERE id = :id"),
                         {"t": now - timedelta(days=1), "id": job.id})
        await db.execute(update(JobRecommendation).where(JobRecommendation.job_id == job.id).values(final_score=40))
        for key in ("bueno", "talento"):
            await db.execute(update(JobRecommendation).where(
                JobRecommendation.job_id == job.id, JobRecommendation.candidate_id == people[key][1].id,
            ).values(final_score=91, rerank_status="done"))
        await db.commit()
    return companies, job, people


async def _company_user(maker, company):
    async with maker() as db:
        return await db.get(User, company.user_id)


# ── Bombita de la empresa ───────────────────────────────────────────────────────────────

async def test_pending_counts_only_own_jobs_and_stops_after_viewing(maker, client):
    from app.main import app

    companies, job, people = await _ready(maker)
    url = "/api/v1/me/company/recommendations/pending"

    app.dependency_overrides[require_verified_company] = lambda: companies[1]
    r = await client.get(url)
    assert r.status_code == 200 and r.json() == {"total": 0, "jobs": []}           # acceso cruzado
    # La otra empresa tampoco puede abrir los recomendados ajenos (ni marcarlos como vistos).
    assert (await client.get(f"/api/v1/me/company/jobs/{job.id}/recommendations")).status_code == 404

    app.dependency_overrides[require_verified_company] = lambda: companies[0]
    d = (await client.get(url)).json()
    assert d["total"] == 2 and d["jobs"][0]["job_id"] == str(job.id) and d["jobs"][0]["title"] == job.title

    r = await client.get(f"/api/v1/me/company/jobs/{job.id}/recommendations")
    assert r.status_code == 200, r.text
    assert (await client.get(url)).json()["total"] == 0                              # ya los vio

    # Un candidato nuevo que encaja vuelve a prender la bombita.
    async with maker() as db:
        await db.execute(update(JobRecommendation).where(
            JobRecommendation.job_id == job.id, JobRecommendation.candidate_id == people["flojo"][1].id,
        ).values(final_score=75, rerank_status="done", company_viewed_at=None))
        await db.commit()
    assert (await client.get(url)).json()["total"] == 1


async def test_pending_skips_thumbs_down_and_talent_beyond_quota(maker, client, monkeypatch):
    from app.main import app

    companies, job, people = await _ready(maker)
    app.dependency_overrides[require_verified_company] = lambda: companies[0]
    url = "/api/v1/me/company/recommendations/pending"
    async with maker() as db:
        await db.execute(update(JobRecommendation).where(
            JobRecommendation.job_id == job.id, JobRecommendation.candidate_id == people["bueno"][1].id,
        ).values(feedback=-1))
        await db.commit()
    assert (await client.get(url)).json()["total"] == 1                              # queda el de la Base
    monkeypatch.setattr(settings, "RECS_TALENT_FREE_COUNT", 0)
    assert (await client.get(url)).json()["total"] == 0                              # fuera de su cupo
    # Abrir la pantalla con el cupo en 0 no marca como visto al que no ve.
    await client.get(f"/api/v1/me/company/jobs/{job.id}/recommendations")
    monkeypatch.setattr(settings, "RECS_TALENT_FREE_COUNT", 3)
    assert (await client.get(url)).json()["total"] == 1


async def test_notifications_summary_folds_count_highlights_and_pending(maker, client):
    from app.main import app

    companies, job, people = await _ready(maker)
    owner = await _company_user(maker, companies[0])
    stranger = await _company_user(maker, companies[1])

    app.dependency_overrides[get_current_user] = lambda: owner
    d = (await client.get("/api/v1/me/notifications/summary")).json()
    assert d["count"] == 0 and d["highlights"] == []
    assert d["recommended"]["total"] == 2 and d["recommended"]["jobs"][0]["title"] == job.title

    app.dependency_overrides[get_current_user] = lambda: stranger
    d = (await client.get("/api/v1/me/notifications/summary")).json()
    assert d["recommended"] == {"total": 0, "jobs": []}

    candidate = people["talento"][0]
    app.dependency_overrides[get_current_user] = lambda: candidate
    assert (await client.get("/api/v1/me/notifications/summary")).json()["recommended"] is None


# ── Aviso al candidato con IA ───────────────────────────────────────────────────────────

async def test_ai_matches_only_evaluated_and_not_applied(maker):
    companies, job, people = await _ready(maker)
    async with maker() as db:
        # Uno de la Base con buen puntaje pero sin evaluar por la IA: no cuenta.
        await db.execute(update(JobRecommendation).where(
            JobRecommendation.job_id == job.id, JobRecommendation.candidate_id == people["tramposo"][1].id,
        ).values(final_score=95, rerank_status="skipped_limit"))
        j = await db.get(type(job), job.id)
        assert await matches.collect_ai_matches(db, j) == 1
        await db.commit()
        found = (await db.execute(select(CandidateJobMatch.candidate_id, CandidateJobMatch.via))).all()
    # "bueno" tiene 91 evaluado, pero ya se postuló.
    assert found == [(people["talento"][1].id, "ia")]


async def test_ai_matches_respect_opt_out_and_emails_switch(maker):
    from app.services.settings import set_setting

    companies, job, people = await _ready(maker)
    async with maker() as db:
        await set_setting(db, SettingKey.emails_automaticos_activos, False)
        j = await db.get(type(job), job.id)
        assert await matches.collect_ai_matches(db, j) == 0                         # mails apagados
        await set_setting(db, SettingKey.emails_automaticos_activos, True)
        await db.execute(text("UPDATE candidate_profiles SET ai_opt_out_at = now() WHERE id = :id"),
                         {"id": people["talento"][1].id})
        assert await matches.collect_ai_matches(db, j) == 0                         # se opuso a la IA
        await db.rollback()


async def test_recompute_queue_collects_matches_when_it_finishes(maker, monkeypatch):
    companies, job, people = await _ready(maker)
    seen = []

    async def fake_collect(db, j, now=None):
        seen.append(j.id)
        return 0

    monkeypatch.setattr(matches, "collect_ai_matches", fake_collect)
    ai = FakeAI()
    async with maker() as db:
        await realtime.mark(db, job.id, "aprobada")
        await db.commit()
    async with maker() as db:
        stats = await realtime.process_queue(db, ai, now=datetime.now(timezone.utc) + timedelta(minutes=5))
    assert stats["busquedas"] == 1 and seen == [job.id]


async def test_tombstone_removes_matches(maker):
    companies, job, people = await _ready(maker)
    user, bueno = people["bueno"]          # se postuló: el borrado es en lápida
    async with maker() as db:
        db.add(CandidateJobMatch(id=uuid.uuid4(), candidate_id=bueno.id, job_id=job.id, score=91, via="ia",
                                 status="sent"))
        await db.commit()
    async with maker() as db:
        u = await db.get(User, user.id)
        await delete_account(db, u, actor=None, reason="test", delete_in_clerk=False)
        await db.commit()
        left = (await db.execute(select(func.count()).select_from(CandidateJobMatch)
                                 .where(CandidateJobMatch.candidate_id == bueno.id))).scalar_one()
    assert left == 0
