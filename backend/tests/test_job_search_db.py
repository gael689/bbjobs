"""Buscador de /empleos contra Postgres (base descartable, `TEST_DATABASE_URL`, migrada a
`c7d1e5f9a2b4` o posterior: necesita `f_unaccent` y pg_trgm).

No trunca tablas: cada test crea su mundo con un sufijo único y sólo afirma sobre sus propios
avisos (que estén o que no estén en el resultado), así convive con datos de otros tests.
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
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_db
    from app.core.config import settings
    from app.integrations import gemini_client
    from app.integrations.gemini_client import AIError, AIResult, AIUsage
    from app.models.ai import AiUsageLog
    from app.models.catalogs import ContractType, Industry, Skill, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.job import JobPosting, JobPostingSkill
    from app.models.settings import SettingKey
    from app.services.ai import search_interpret
    from app.services.settings import set_setting


@pytest.fixture
async def maker():
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
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


async def _world(maker):
    """Un mundo chico con avisos reales de Bahía. Devuelve {clave: id} y el sufijo."""
    tag = uuid.uuid4().hex[:6]
    now = datetime.now(timezone.utc)
    async with maker() as db:
        comercio = Industry(id=uuid.uuid4(), name=f"Comercio {tag}", slug=f"comercio-{tag}")
        tecno = Industry(id=uuid.uuid4(), name=f"Tecnología {tag}", slug=f"tecnologia-{tag}")
        bahia = Zone(id=uuid.uuid4(), name=f"Bahía Blanca {tag}", slug=f"bahia-blanca-{tag}")
        punta = Zone(id=uuid.uuid4(), name=f"Punta Alta {tag}", slug=f"punta-alta-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Relación de dependencia {tag}")
        skill = Skill(id=uuid.uuid4(), name=f"Autoelevador {tag}", slug=f"autoelevador-{tag}", category="technical")
        cu = User(id=uuid.uuid4(), email=f"emp-{tag}@empresa.com", role="company", is_active=True)
        db.add_all([comercio, tecno, bahia, punta, ct, skill, cu])
        await db.flush()
        company_name = f"Ferretería Ñandú {tag}"
        company = CompanyProfile(id=uuid.uuid4(), user_id=cu.id, legal_name=company_name, cuit=f"30-{tag}-9",
                                 industry_id=comercio.id, responsible_full_name="R", responsible_phone="2910000000",
                                 responsible_email="r@empresa.com", verification_status="verified")
        db.add(company)
        await db.flush()

        def job(key, title, *, zone=punta, industry=comercio, description="Tareas generales.", status="active",
                moderation="approved", deleted=False, featured=False, age_days=1):
            j = JobPosting(id=uuid.uuid4(), company_id=company.id, company_legal_name_snapshot=company_name,
                           title=title, description=description, industry_id=industry.id, zone_id=zone.id,
                           contract_type_id=ct.id, modality="presencial", status=status, moderation_status=moderation,
                           is_featured=featured, published_at=now - timedelta(days=age_days),
                           deleted_at=now if deleted else None)
            db.add(j)
            return key, j

        jobs = dict([
            job("tecnico", f"Técnico electricista {tag}"),
            job("vendedor_bahia", f"Vendedor/a de salón {tag}", zone=bahia),
            job("vendedor_punta", f"Vendedor/a de mostrador {tag}"),
            job("dev", f"Desarrollador/a de Software {tag}", industry=tecno),
            job("conductor", f"Conductor de camión {tag}", description="Reparto en la ciudad."),
            job("deposito", f"Operario de depósito {tag}"),
            job("desc_tecnico", f"Ayudante general {tag}", description="Se valora formación técnica."),
            job("pausado", f"Técnico mecánico pausado {tag}", status="paused"),
            job("pendiente", f"Técnico pendiente {tag}", moderation="pending"),
            job("borrado", f"Técnico borrado {tag}", deleted=True),
            job("rechazado", f"Técnico rechazado {tag}", moderation="rejected"),
        ])
        await db.flush()
        db.add(JobPostingSkill(job_posting_id=jobs["deposito"].id, skill_id=skill.id, is_required=True))
        await db.commit()
        return {k: str(v.id) for k, v in jobs.items()}, tag, {"bahia": bahia, "punta": punta, "comercio": comercio,
                                                            "tecno": tecno, "ct": ct}


async def _search(client, q, **params):
    r = await client.get("/api/v1/jobs", params={"q": q, "page_size": 100, **params})
    assert r.status_code == 200, r.text
    return [item["id"] for item in r.json()["items"]]


HIDDEN = ("pausado", "pendiente", "borrado", "rechazado")


async def test_without_accents_finds_accented_title(maker, client):
    ids, tag, _ = await _world(maker)
    found = await _search(client, f"tecnico {tag}")
    assert ids["tecnico"] in found
    # relevancia: el del título va antes que el que sólo lo menciona en la descripción
    assert found.index(ids["tecnico"]) < found.index(ids["desc_tecnico"])
    for key in HIDDEN:
        assert ids[key] not in found


async def test_loose_words_match_title_and_zone(maker, client):
    ids, tag, _ = await _world(maker)
    found = await _search(client, f"vendedor bahia {tag}")
    assert ids["vendedor_bahia"] in found
    assert ids["vendedor_punta"] not in found     # no está en Bahía


async def test_typo_falls_back_to_similarity(maker, client):
    ids, tag, _ = await _world(maker)
    found = await _search(client, f"desarollador {tag}")
    assert ids["dev"] in found


async def test_synonym_chofer_finds_conductor(maker, client):
    ids, tag, _ = await _world(maker)
    assert ids["conductor"] in await _search(client, f"chofer {tag}")
    assert ids["conductor"] in await _search(client, f"choferes {tag}")


async def test_company_name_finds_its_jobs(maker, client):
    ids, tag, _ = await _world(maker)
    found = await _search(client, f"ferreteria nandu {tag}")
    visible = [k for k in ids if k not in HIDDEN]
    assert all(ids[k] in found for k in visible)
    assert not any(ids[k] in found for k in HIDDEN)


async def test_sector_and_skills_are_searchable(maker, client):
    ids, tag, _ = await _world(maker)
    assert ids["dev"] in await _search(client, f"tecnologia {tag}")
    assert ids["deposito"] in await _search(client, f"autoelevador {tag}")


async def test_hidden_jobs_never_show_up(maker, client):
    ids, tag, _ = await _world(maker)
    found = await _search(client, tag)
    assert ids["tecnico"] in found
    assert not any(ids[k] in found for k in HIDDEN)


async def test_other_filters_and_pagination_still_apply(maker, client):
    ids, tag, world = await _world(maker)
    found = await _search(client, f"vendedor {tag}", zone_id=str(world["punta"].id))
    assert ids["vendedor_punta"] in found and ids["vendedor_bahia"] not in found
    r = await client.get("/api/v1/jobs", params={"q": f"vendedor {tag}", "page_size": 1, "page": 2})
    body = r.json()
    assert body["total"] == 2 and len(body["items"]) == 1


async def test_stopwords_only_does_not_filter(maker, client):
    await _world(maker)
    r = await client.get("/api/v1/jobs", params={"q": "busco trabajo", "page_size": 1})
    assert r.status_code == 200 and r.json()["total"] >= 7


async def test_wildcards_are_literal(maker, client):
    ids, tag, _ = await _world(maker)
    assert await _search(client, f"%_% {tag}") == await _search(client, tag)


async def test_suggest_without_accents(maker, client):
    ids, tag, _ = await _world(maker)
    r = await client.get("/api/v1/jobs/suggest", params={"q": f"tecnico {tag}"})
    labels = [(s["label"], s["type"]) for s in r.json()]
    assert (f"Técnico electricista {tag}", "title") in labels
    assert not any("pausado" in label or "pendiente" in label for label, _ in labels)
    r = await client.get("/api/v1/jobs/suggest", params={"q": f"nandu {tag}"})
    assert [s["type"] for s in r.json()] == ["company"]


# ── /jobs/interpret (Gemini simulado) ───────────────────────────────────────────────────

class FakeProvider:
    def __init__(self, data):
        self.data = data
        self.calls = 0
        self.prompts = []

    async def generate_json(self, *, system, prompt, model, feature, **kw):
        self.calls += 1
        self.prompts.append(prompt)
        assert feature == "busqueda"
        return AIResult(data=model.model_validate(self.data),
                        usage=AIUsage(model="gemini-3.5-flash-lite", input_tokens=800, output_tokens=60))


class FailingProvider:
    async def generate_json(self, **kw):
        raise AIError("caído", transient=True)


@pytest.fixture
async def ai_on(maker, monkeypatch):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 1000.0)
    search_interpret.cache.clear()
    async with maker() as db:
        await set_setting(db, SettingKey.busqueda_ia_activa, True)
        await db.commit()
    yield
    search_interpret.cache.clear()


async def _usage_rows(maker):
    async with maker() as db:
        return (await db.execute(select(func.count()).select_from(AiUsageLog)
                                 .where(AiUsageLog.feature == "busqueda"))).scalar_one()


async def test_interpret_404_with_gate_closed(client, monkeypatch):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    r = await client.get("/api/v1/jobs/interpret", params={"q": "algo de administración cerca de punta alta"})
    assert r.status_code == 404


async def test_interpret_validates_against_catalog(maker, client, ai_on, monkeypatch):
    ids, tag, world = await _world(maker)
    fake = FakeProvider({
        "zone_slug": f"punta-alta-{tag}", "industry_slug": "industria-inventada", "modality": "full time",
        "contract_type": f"Relación de dependencia {tag}", "keywords": ["vendedor", "mujer", "joven", "30"],
        "entendimos": "Ventas en Punta Alta",
    })
    monkeypatch.setattr(search_interpret, "get_provider", lambda: fake)
    before = await _usage_rows(maker)
    q = f"busco algo de ventas en punta alta {tag}"
    r = await client.get("/api/v1/jobs/interpret", params={"q": q})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["available"] is True
    assert body["zone"]["id"] == str(world["punta"].id)
    assert body["contract_type"]["id"] == str(world["ct"].id)
    assert "industry" not in body and "modality" not in body       # inventados: descartados
    assert body["keywords"] == "vendedor"                          # sin género, edad ni números
    assert body["understood"] == "Ventas en Punta Alta"
    assert "<FRASE>" in fake.prompts[0] and f"punta-alta-{tag}" in fake.prompts[0]
    assert await _usage_rows(maker) == before + 1

    # misma frase (con otras tildes/mayúsculas): sale de la caché, no se paga de nuevo
    r = await client.get("/api/v1/jobs/interpret", params={"q": q.upper().replace("A", "Á", 1)})
    assert r.json()["zone"]["id"] == str(world["punta"].id)
    assert fake.calls == 1


async def test_interpret_unavailable_cases(maker, client, ai_on, monkeypatch):
    fake = FakeProvider({"keywords": ["administrativo"]})
    monkeypatch.setattr(search_interpret, "get_provider", lambda: fake)
    url = "/api/v1/jobs/interpret"

    # frase corta: ni se consulta
    assert (await client.get(url, params={"q": "vendedor"})).json() == {"available": False}
    # Gemini caído
    monkeypatch.setattr(search_interpret, "get_provider", lambda: FailingProvider())
    assert (await client.get(url, params={"q": "algo de administración part time"})).json() == {"available": False}
    # tope de gasto agotado
    monkeypatch.setattr(search_interpret, "get_provider", lambda: fake)
    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 0.0)
    assert (await client.get(url, params={"q": "algo de administración part time"})).json() == {"available": False}
    # sin API key
    monkeypatch.setattr(settings, "AI_DAILY_BUDGET_USD", 1000.0)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    monkeypatch.setattr(search_interpret, "get_provider", gemini_client.get_provider)   # el real: levanta AIUnavailable
    assert (await client.get(url, params={"q": "algo de administración part time"})).json() == {"available": False}
    # interruptor apagado
    monkeypatch.setattr(search_interpret, "get_provider", lambda: fake)
    async with maker() as db:
        await set_setting(db, SettingKey.busqueda_ia_activa, False)
        await db.commit()
    assert (await client.get(url, params={"q": "algo de administración part time"})).json() == {"available": False}
    assert fake.calls == 0
