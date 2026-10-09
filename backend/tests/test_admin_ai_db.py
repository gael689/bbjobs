"""Centro de IA de Talency (admin_ai.py + activity.py) contra Postgres + pgvector (base descartable).

- Sólo admin (empresa y candidato → 403) y compuerta cerrada → 404.
- Recomendados de cualquier búsqueda: contacto sólo de postulantes de ESA búsqueda o de perfiles
  que la empresa de esa búsqueda desbloqueó; un perfil ciego sigue ciego (ni nombre, ni id, ni citas).
- Acciones: encolan sin bloquear, respetan interruptor, cuenta de Gemini y tope de gasto.
- Registro de actividad: no guarda texto del CV ni datos personales; el borrado de cuenta lo
  desengancha de la persona.

Gemini simulado (el doble de `test_ai_pipeline_db`). No trunca tablas: cada test arma su mundo.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy import delete, func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db
    from app.api.v1 import admin_ai
    from app.api.v1 import recommendations as rec_api
    from app.core.config import settings
    from app.db import session as db_session
    from app.integrations.gemini_client import AIUnavailable
    from app.models.ai import AiActivityLog, AiRecomputeQueue, AiUsageLog
    from app.models.candidate import CandidateProfile
    from app.models.core import User
    from app.models.email import EmailCampaign
    from app.models.job import JobPosting
    from app.models.payment import TalentCreditPack, TalentUnlock
    from app.models.settings import SettingKey
    from app.services.account_deletion import delete_account
    from app.services.ai import activity, ingest, realtime
    from app.services.ai import redact as redact_mod
    from app.services.email import monthly
    from app.services.settings import set_setting
    from tests.test_ai_background_db import SummaryAI
    from tests.test_ai_pipeline_db import FakeAI, _compute, _world


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as db:
        await set_setting(db, SettingKey.ia_recomendaciones_activas, True)
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 1000.0)
    monkeypatch.setattr(db_session, "async_session_maker", session_maker)
    yield session_maker
    await engine.dispose()


@pytest.fixture
async def ai(monkeypatch):
    fake = SummaryAI()
    monkeypatch.setattr(admin_ai, "_provider", lambda: fake)
    return fake


@pytest.fixture
async def admin(maker):
    async with maker() as db:
        u = User(id=uuid.uuid4(), email=f"admin-{uuid.uuid4().hex[:6]}@talency.com", role="admin", is_active=True)
        db.add(u)
        await db.commit()
    return u


@pytest.fixture
async def client(maker, admin):
    from app.main import app

    async def _db():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: admin
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
            c.as_user = lambda u: app.dependency_overrides.__setitem__(get_current_user, lambda: u)
            yield c
    finally:
        app.dependency_overrides.clear()


async def _ready_world(maker, ai):
    companies, job, people = await _world(maker)
    await _compute(maker, job.id, ai)
    return companies, job, people


def _ref(company_id, candidate_id) -> str:
    return rec_api.candidate_ref(company_id, candidate_id)


async def _activity(maker, **where) -> list:
    async with maker() as db:
        stmt = select(AiActivityLog)
        for k, v in where.items():
            stmt = stmt.where(getattr(AiActivityLog, k) == v)
        return list((await db.execute(stmt.order_by(AiActivityLog.created_at))).scalars().all())


# ── Acceso ──────────────────────────────────────────────────────────────────────────────

ENDPOINTS = [
    ("get", "/api/v1/admin/ai/jobs"),
    ("get", "/api/v1/admin/ai/activity"),
    ("get", "/api/v1/admin/ai/activity/summary"),
    ("get", "/api/v1/admin/ai/actions/status"),
    ("post", "/api/v1/admin/ai/actions/recompute-all"),
    ("post", "/api/v1/admin/ai/actions/review-pending"),
    ("post", "/api/v1/admin/ai/actions/monthly-draft"),
]


async def test_only_admin_and_gate_closed_is_404(maker, client, ai, monkeypatch):
    companies, job, people = await _world(maker)
    async with maker() as db:
        company_user = (await db.execute(select(User).where(User.id == companies[0].user_id))).scalar_one()
    candidate_user = people["bueno"][0]
    paths = ENDPOINTS + [
        ("get", f"/api/v1/admin/ai/jobs/{job.id}/recommendations"),
        ("post", f"/api/v1/admin/ai/actions/recompute-job/{job.id}"),
        ("post", f"/api/v1/admin/ai/actions/reread-cv/{people['bueno'][1].id}"),
    ]
    for user in (company_user, candidate_user):
        client.as_user(user)
        for method, path in paths:
            r = await getattr(client, method)(path)
            assert r.status_code == 403, (user.role, path, r.status_code)

    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    for user in (company_user,):
        client.as_user(user)
        assert (await client.get("/api/v1/admin/ai/jobs")).status_code == 404
    async with maker() as db:
        admin_user = User(id=uuid.uuid4(), email=f"a2-{uuid.uuid4().hex[:6]}@talency.com", role="admin", is_active=True)
    client.as_user(admin_user)
    for method, path in paths:
        assert (await getattr(client, method)(path)).status_code == 404, path


# ── Recomendados de cualquier búsqueda ──────────────────────────────────────────────────

async def test_admin_detail_shows_contact_only_for_applicants_and_unlocked(maker, client, ai):
    companies, job, people = await _ready_world(maker, ai)
    _, talento = people["talento"]
    _, bueno = people["bueno"]

    r = await client.get("/api/v1/admin/ai/jobs", params={"estado": "activas", "q": job.title, "page_size": 100})
    assert r.status_code == 200, r.text
    row = next(i for i in r.json()["items"] if i["job_id"] == str(job.id))
    assert row["applicants"] == 3 and row["recommendations"] >= 4 and row["cost_usd"] > 0
    assert row["best_score"] is not None and row["last_computed_at"]

    d = (await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations")).json()
    assert d["status"] == "ok" and d["job"]["company_name"] == "Empresa 0" and d["requirements"]
    by_ref = {x["candidate_ref"]: x for x in d["applicants"] + d["talent"]}
    app_bueno = by_ref[_ref(companies[0].id, bueno.id)]           # misma referencia que la empresa
    assert app_bueno["name"] == "Bueno Test" and app_bueno["email"].startswith("bueno-")
    assert app_bueno["phone"] == "2915550000" and app_bueno["candidate_id"] == str(bueno.id)
    assert any(e["evidence"] for e in app_bueno["evaluations"])
    # El de la Base de Talento sigue ciego: ni nombre, ni contacto, ni id, ni citas.
    blind = by_ref[_ref(companies[0].id, talento.id)]
    assert blind["locked"] and blind["source"] == "talent"
    assert blind["name"] is None and blind["email"] is None and blind["phone"] is None
    assert blind["candidate_id"] is None and all(e["evidence"] is None for e in blind["evaluations"])
    assert "Talento" not in json.dumps(blind) and "talento-" not in json.dumps(blind)
    # El tramposo (texto que parece una orden) aparece con su alerta.
    trampa = by_ref[_ref(companies[0].id, people["tramposo"][1].id)]
    assert trampa["rerank_status"] == "skipped_injection" and trampa["alerts"]

    # Desbloqueado por OTRA empresa: sigue ciego para esta búsqueda.
    async with maker() as db:
        pack = TalentCreditPack(id=uuid.uuid4(), company_id=companies[1].id, credits_total=3, status="active",
                                activated_at=datetime.now(timezone.utc))
        db.add(pack)
        await db.flush()
        db.add(TalentUnlock(company_id=companies[1].id, candidate_id=talento.id, pack_id=pack.id))
        await db.commit()
    d = (await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations")).json()
    blind = next(x for x in d["talent"] if x["candidate_ref"] == _ref(companies[0].id, talento.id))
    assert blind["name"] is None and blind["email"] is None

    # Desbloqueado por la empresa de la búsqueda: ahora sí.
    async with maker() as db:
        pack = TalentCreditPack(id=uuid.uuid4(), company_id=companies[0].id, credits_total=3, status="active",
                                activated_at=datetime.now(timezone.utc))
        db.add(pack)
        await db.flush()
        db.add(TalentUnlock(company_id=companies[0].id, candidate_id=talento.id, pack_id=pack.id))
        await db.commit()
    d = (await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations")).json()
    seen = next(x for x in d["talent"] if x["candidate_ref"] == _ref(companies[0].id, talento.id))
    assert seen["name"] == "Talento Test" and seen["unlocked"] and not seen["locked"] and seen["shown_to_company"]


async def test_admin_detail_without_recs_does_not_compute(maker, client, ai):
    companies, job, people = await _world(maker)
    d = (await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations")).json()
    assert d["status"] == "sin_calcular" and d["applicants"] == []
    assert await _activity(maker, job_id=job.id, kind=activity.KIND_RECOMPUTE) == []
    assert (await client.get(f"/api/v1/admin/ai/jobs/{uuid.uuid4()}/recommendations")).status_code == 404


async def test_admin_summary_keeps_blind_profiles_blind_and_is_logged(maker, client, ai):
    companies, job, people = await _ready_world(maker, ai)
    _, bueno = people["bueno"]
    _, talento = people["talento"]
    ref = _ref(companies[0].id, bueno.id).replace("#", "%23")
    r = await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations/{ref}/summary")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["generated_with_ai"] and body["lines"] and body["lines"][0]["evidence"]

    blind_ref = _ref(companies[0].id, talento.id).replace("#", "%23")
    r = await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations/{blind_ref}/summary")
    assert r.status_code == 200 and all(l["evidence"] is None for l in r.json()["lines"])
    assert (await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations/%23NOEXISTE/summary")).status_code == 404

    logs = await _activity(maker, job_id=job.id, kind=activity.KIND_SUMMARY)
    assert logs and all(l.detail["origen"] == "talency" for l in logs) and logs[0].cost_usd > 0
    assert all(set(l.detail) <= {"origen", "lineas", "descartadas"} for l in logs)


# ── Acciones ────────────────────────────────────────────────────────────────────────────

async def test_recompute_actions_enqueue_without_blocking_and_queue_logs_reason(maker, client, ai):
    companies, job, people = await _ready_world(maker, ai)
    calls = ai.reranks
    r = await client.post(f"/api/v1/admin/ai/actions/recompute-job/{job.id}")
    assert r.status_code == 200, r.text
    assert ai.reranks == calls                                     # no corrió nada en el pedido
    async with maker() as db:
        row = (await db.execute(select(AiRecomputeQueue).where(AiRecomputeQueue.job_id == job.id))).scalar_one()
    assert row.reason == "manual"
    assert row.requested_at <= datetime.now(timezone.utc) - realtime.DEBOUNCE + timedelta(seconds=5)

    async with maker() as db:
        # Lo que dejaron otros tests en la cola no compite con esta búsqueda por el tope de la vuelta.
        await db.execute(delete(AiRecomputeQueue).where(AiRecomputeQueue.job_id != job.id))
        await db.commit()
        await realtime.process_queue(db, ai)
    rec = await _activity(maker, job_id=job.id, kind=activity.KIND_RECOMPUTE)
    assert rec[-1].detail["motivo"] == "manual" and rec[-1].detail["candidatos"] >= 4
    assert any(l.detail.get("accion") == "recalcular_busqueda" for l in await _activity(maker, job_id=job.id,
                                                                                         kind=activity.KIND_MANUAL))

    r = await client.post("/api/v1/admin/ai/actions/recompute-all")
    assert r.status_code == 200 and r.json()["queued"] >= 1
    async with maker() as db:
        assert (await db.execute(select(AiRecomputeQueue.reason).where(AiRecomputeQueue.job_id == job.id))
                ).scalar_one() == "manual"
    status = (await client.get("/api/v1/admin/ai/actions/status")).json()
    assert status["queue"] >= 1 and status["ai_configured"] and status["recs_switch_on"]

    # Una búsqueda pausada no se recalcula.
    async with maker() as db:
        j = (await db.execute(select(JobPosting).where(JobPosting.id == job.id))).scalar_one()
        j.status = "paused"
        await db.commit()
    assert (await client.post(f"/api/v1/admin/ai/actions/recompute-job/{job.id}")).status_code == 409


async def test_actions_respect_budget_provider_and_switch(maker, client, ai, monkeypatch):
    companies, job, people = await _world(maker)
    cand = people["bueno"][1]
    async with maker() as db:
        p = (await db.execute(select(CandidateProfile).where(CandidateProfile.id == cand.id))).scalar_one()
        p.cv_file_url = "https://res.cloudinary.com/x/raw/upload/v1/cv/test.pdf"
        await db.commit()
    actions = [f"/api/v1/admin/ai/actions/recompute-job/{job.id}", "/api/v1/admin/ai/actions/recompute-all",
               "/api/v1/admin/ai/actions/review-pending", f"/api/v1/admin/ai/actions/reread-cv/{cand.id}"]

    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 0.0)
    for path in actions + ["/api/v1/admin/ai/actions/monthly-draft"]:
        r = await client.post(path)
        assert r.status_code == 409 and "tope" in r.json()["detail"], (path, r.text)
    assert (await client.get("/api/v1/admin/ai/activity/summary")).json()["budget_left"] is False

    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 1000.0)
    monkeypatch.setattr(admin_ai, "_provider", lambda: None)
    for path in actions:
        r = await client.post(path)
        assert r.status_code == 409 and "Gemini" in r.json()["detail"], (path, r.text)

    monkeypatch.setattr(admin_ai, "_provider", lambda: ai)
    async with maker() as db:
        await set_setting(db, SettingKey.ia_recomendaciones_activas, False)
        await db.commit()
    try:
        for path in actions:
            r = await client.post(path)
            assert r.status_code == 409 and "apagada" in r.json()["detail"], (path, r.text)
        d = (await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations")).json()
        assert d["enabled"] is False and d["status"] == "apagado"
    finally:
        async with maker() as db:
            await set_setting(db, SettingKey.ia_recomendaciones_activas, True)
            await db.commit()
    async with maker() as db:
        queued = (await db.execute(select(AiRecomputeQueue).where(AiRecomputeQueue.job_id == job.id))).scalar_one_or_none()
    assert queued is None                                          # nada se encoló sin IA ni presupuesto


async def test_review_pending_runs_in_background_and_logs_flags(maker, client, ai):
    companies, job, people = await _world(maker)
    from tests.test_ai_background_db import _word
    text = " ".join(_word() for _ in range(6))      # único: los avisos de otros tests no se le parecen
    async with maker() as db:
        j = (await db.execute(select(JobPosting).where(JobPosting.id == job.id))).scalar_one()
        j.description = text
        dup = JobPosting(id=uuid.uuid4(), company_id=companies[1].id, company_legal_name_snapshot="Empresa 1",
                         title=job.title, description=text, industry_id=job.industry_id, zone_id=job.zone_id,
                         contract_type_id=job.contract_type_id, modality="presencial", status="active",
                         moderation_status="pending_review")
        db.add(dup)
        await db.commit()
    r = await client.post("/api/v1/admin/ai/actions/review-pending")
    assert r.status_code == 200, r.text
    logs = await _activity(maker, job_id=dup.id, kind=activity.KIND_MODERATION)
    assert logs and logs[-1].detail["motivo"] == "talency" and logs[-1].detail["duplicados"] >= 1
    assert str(job.id) in logs[-1].detail["duplicados_ids"] and logs[-1].alert
    async with maker() as db:
        j = (await db.execute(select(JobPosting).where(JobPosting.id == dup.id))).scalar_one()
    assert str(getattr(j.moderation_status, "value", j.moderation_status)) == "pending_review"   # no decide nada


async def test_reread_cv_logs_anonymization_without_cv_text(maker, client, ai, monkeypatch):
    companies, job, people = await _world(maker)
    user, cand = people["bueno"]
    async with maker() as db:
        p = (await db.execute(select(CandidateProfile).where(CandidateProfile.id == cand.id))).scalar_one()
        p.cv_file_url = f"https://res.cloudinary.com/x/raw/upload/v1/cv/{uuid.uuid4().hex}.pdf"
        await db.commit()
    secret = "Experiencia operando autoelevador zorzalcito en planta"
    cv_text = f"Bueno Test\n{user.email}\nTel 291 555 0000\n{secret}"

    async def fake_fetch(url):
        return b"%PDF-fake"
    monkeypatch.setattr(admin_ai, "_fetch_cv", fake_fetch)
    monkeypatch.setattr(ingest, "extract_cv_text", lambda data: ingest.CvExtraction(status="ok", text=cv_text, pages=1))

    r = await client.post(f"/api/v1/admin/ai/actions/reread-cv/{cand.id}")
    assert r.status_code == 200, r.text
    reads = await _activity(maker, candidate_id=cand.id, kind=activity.KIND_CV_READ)
    assert reads and reads[-1].detail["estado"] == "ok" and reads[-1].detail["fugas"] == 0 and not reads[-1].alert
    assert reads[-1].detail["datos_tapados"] >= 1

    # Si la anonimización deja pasar algo, queda la alerta (con cuántos, nunca cuáles).
    monkeypatch.setattr(redact_mod, "redact", lambda text, **kw: redact_mod.Redaction(text=text))
    assert (await client.post(f"/api/v1/admin/ai/actions/reread-cv/{cand.id}")).status_code == 200
    reads = await _activity(maker, candidate_id=cand.id, kind=activity.KIND_CV_READ)
    assert reads[-1].alert and reads[-1].detail["fugas"] >= 1

    everything = json.dumps([l.detail for l in await _activity(maker, candidate_id=cand.id)], ensure_ascii=False)
    for personal in ("Bueno", user.email, "2915550000", "555 0000", "zorzalcito", "autoelevador"):
        assert personal not in everything

    r = await client.get("/api/v1/admin/ai/activity", params={"tipo": "cv_lectura", "solo_alertas": True,
                                                                "candidate_id": str(cand.id)})
    assert r.status_code == 200 and r.json()["total"] >= 1 and all(i["alert"] for i in r.json()["items"])
    s = (await client.get("/api/v1/admin/ai/activity/summary")).json()
    assert s["today"]["anonymization_alerts"] >= 1 and s["today"]["cv_reads"] >= 2

    no_cv = people["flojo"][1]
    assert (await client.post(f"/api/v1/admin/ai/actions/reread-cv/{no_cv.id}")).status_code == 409
    assert (await client.post(f"/api/v1/admin/ai/actions/reread-cv/{uuid.uuid4()}")).status_code == 404


async def test_monthly_draft_now_is_one_per_month_and_never_sends(maker, client, ai, monkeypatch):
    async with maker() as db:
        await db.execute(delete(EmailCampaign).where(EmailCampaign.name.like(f"{monthly.NAME_PREFIX}%")))
        await db.commit()

    def no_ai():
        raise AIUnavailable("sin cuenta")
    monkeypatch.setattr(monthly, "get_provider", no_ai)
    r = await client.post("/api/v1/admin/ai/actions/monthly-draft")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["generated_by_ai"] is False and body["name"].startswith(monthly.NAME_PREFIX)
    async with maker() as db:
        c = (await db.execute(select(EmailCampaign).where(EmailCampaign.id == uuid.UUID(body["campaign_id"])))).scalar_one()
    assert c.status == "draft"
    assert (await client.post("/api/v1/admin/ai/actions/monthly-draft")).status_code == 409
    logs = [l for l in await _activity(maker, kind=activity.KIND_CAMPAIGN_DRAFT) if l.detail.get("campana") == body["campaign_id"]]
    assert logs and logs[0].detail["origen"] == "talency" and logs[0].detail["con_ia"] is False


# ── Registro de actividad ───────────────────────────────────────────────────────────────

def test_clean_detail_keeps_only_short_scalars():
    long_text = "x" * 500
    out = activity._clean({"motivo": "noche", "n": 3, "texto": long_text, "anidado": {"cv": "algo"},
                           "ids": [uuid.UUID(int=1), "a", {"b": 1}], "costo": Decimal("0.5")})
    assert out["motivo"] == "noche" and out["n"] == 3 and len(out["texto"]) == activity.MAX_STR
    assert "anidado" not in out and out["ids"] == [str(uuid.UUID(int=1)), "a"] and out["costo"] == 0.5


async def test_activity_feed_merges_searches_and_filters(maker, client, ai):
    companies, job, people = await _ready_world(maker, ai)
    async with maker() as db:
        for _ in range(3):
            db.add(AiUsageLog(id=uuid.uuid4(), feature="busqueda", model="gemini-3.5-flash-lite",
                              input_tokens=100, output_tokens=10, cost_usd=Decimal("0.0001")))
        await db.commit()
    r = await client.get("/api/v1/admin/ai/activity", params={"tipo": "busqueda"})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert items and items[0]["kind"] == "busqueda" and items[0]["detail"]["consultas"] >= 3
    assert set(items[0]["detail"]) == {"consultas", "agregado"}           # nunca las frases

    r = await client.get("/api/v1/admin/ai/activity", params={"tipo": "recalculo", "page_size": 5})
    feed = r.json()
    assert feed["total"] >= 1 and len(feed["items"]) <= 5
    mine = [i for i in feed["items"] if i["job_id"] == str(job.id)] or \
        (await client.get("/api/v1/admin/ai/activity", params={"tipo": "recalculo", "job_id": str(job.id)})).json()["items"]
    assert mine[0]["job_title"] == job.title and mine[0]["company_name"] == "Empresa 0" and mine[0]["cost_usd"] > 0

    today = datetime.now(timezone.utc).date()
    r = await client.get("/api/v1/admin/ai/activity", params={"desde": str(today + timedelta(days=2))})
    assert r.json()["total"] == 0
    s = (await client.get("/api/v1/admin/ai/activity/summary")).json()
    assert s["today"]["recomputes"] >= 1 and s["week"]["spend_usd"] >= s["today"]["spend_usd"] > 0
    assert s["today"]["searches"] >= 3


async def test_account_deletion_unlinks_activity_from_the_person(maker, client, ai, monkeypatch):
    companies, job, people = await _ready_world(maker, ai)
    user, cand = people["bueno"]
    ref = _ref(companies[0].id, cand.id).replace("#", "%23")
    assert (await client.get(f"/api/v1/admin/ai/jobs/{job.id}/recommendations/{ref}/summary")).status_code == 200
    assert await _activity(maker, candidate_id=cand.id)
    async with maker() as db:
        u = (await db.execute(select(User).where(User.id == user.id))).scalar_one()
        await delete_account(db, u, actor=None, reason="test", delete_in_clerk=False)
    assert await _activity(maker, candidate_id=cand.id) == []
    async with maker() as db:
        still = (await db.execute(select(func.count()).select_from(AiActivityLog).where(
            AiActivityLog.job_id == job.id, AiActivityLog.kind == activity.KIND_SUMMARY))).scalar_one()
    assert still >= 1                                              # queda la estadística, sin dueño
