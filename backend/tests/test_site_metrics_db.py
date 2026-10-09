"""Medición propia contra Postgres (base descartable, `TEST_DATABASE_URL`, migrada a
`a9e3f1c5b7d2` o posterior).

`site_events` es una tabla de agregados globales: cada test la vacía antes de empezar (sólo esa
tabla, y sólo en la base descartable). El resto del mundo (empresa, avisos, postulaciones) se crea
con un sufijo único, como en test_job_search_db.py.
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
    from sqlalchemy import delete, func, select, text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db
    from app.core.limiter import limiter
    from app.models.candidate import CandidateProfile
    from app.models.catalogs import ContractType, Industry, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.job import Application, JobPosting
    from app.models.metrics import SiteEvent
    from app.services import site_metrics

CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"


@pytest.fixture
async def maker():
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as db:
        await db.execute(delete(SiteEvent))
        await db.commit()
    yield session_maker
    await engine.dispose()


@pytest.fixture
async def client(maker):
    from app.main import app

    async def _db():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    limiter.enabled = False
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
            yield c
    finally:
        limiter.enabled = True
        app.dependency_overrides.clear()


def _as(role: str):
    from app.main import app
    user = User(id=uuid.uuid4(), email=f"{role}-{uuid.uuid4().hex[:6]}@x.com", role=role, is_active=True)
    app.dependency_overrides[get_current_user] = lambda: user


async def _post(client, events, ua=CHROME, **headers):
    return await client.post("/api/v1/metrics/events", json=events, headers={"user-agent": ua, **headers})


async def _rows(maker):
    async with maker() as db:
        return list((await db.execute(select(SiteEvent).order_by(SiteEvent.created_at))).scalars().all())


async def test_guarda_eventos_validos_y_responde_204(client, maker):
    vid = str(uuid.uuid4())
    r = await _post(client, [
        {"event": "page_view", "path": "/empleos?q=chofer", "visitor_id": vid, "referrer": "https://www.google.com/"},
        {"event": "search", "path": "/empleos", "search_term": "Chofér", "results": 0, "visitor_id": vid},
        {"event": "no_existe", "path": "/"},
    ], **{"x-forwarded-for": "181.10.20.30", "referer": "https://bbjobs.com.ar/empleos?q=chofer"})
    assert r.status_code == 204
    rows = await _rows(maker)
    assert sorted(e.event for e in rows) == ["page_view", "search"]
    pv = next(e for e in rows if e.event == "page_view")
    assert (pv.path, pv.source, pv.device, pv.visitor_id) == ("/empleos", "google", "desktop", vid)
    assert next(e for e in rows if e.event == "search").search_term == "chofer"


async def test_nada_personal_se_guarda(client, maker):
    await _post(client, [{"event": "page_view", "path": "/", "email": "juan@mail.com", "user_id": "u-1"}],
                ua=IPHONE, **{"x-forwarded-for": "181.10.20.30", "referer": "https://www.google.com/search?q=juan"})
    async with maker() as db:
        fila = (await db.execute(select(SiteEvent))).scalar_one()
        # La fila entera, tal cual está en la base.
        texto = (await db.execute(text("SELECT row_to_json(s)::text FROM site_events s"))).scalar_one()
    for dato in ("181.10.20.30", "juan", "u-1", "iPhone", "Mozilla", "google.com"):
        assert dato not in texto, dato
    assert fila.device == "mobile" and fila.source == "google"


async def test_bots_y_basura_no_rompen_ni_guardan(client, maker):
    for ua in ("Googlebot/2.1 (+http://www.google.com/bot.html)", "Mozilla/5.0 HeadlessChrome/141.0", ""):
        assert (await _post(client, [{"event": "page_view", "path": "/"}], ua=ua)).status_code == 204
    malos = [b"{no es json", b"\xff\xfe", b"[1,2,3]", b'{"events": "x"}', b"", b"[" + b'{"event":"page_view","path":"/"},' * 3000 + b"{}]"]
    for body in malos:
        r = await client.post("/api/v1/metrics/events", content=body,
                              headers={"user-agent": CHROME, "content-type": "text/plain"})
        assert r.status_code == 204
    # un job_id enorme o un results gigante tampoco tiran un 500
    r = await _post(client, [{"event": "view_item", "path": "/empleos/x", "job_id": "9" * 5000},
                             {"event": "search", "path": "/empleos", "search_term": "x", "results": 10**30}])
    assert r.status_code == 204
    rows = await _rows(maker)
    assert [(e.event, e.results) for e in rows] == [("search", None)]


async def test_texto_plano_como_lo_manda_sendbeacon(client, maker):
    import json
    r = await client.post("/api/v1/metrics/events", content=json.dumps([{"event": "page_view", "path": "/"}]),
                          headers={"user-agent": CHROME, "content-type": "text/plain;charset=UTF-8"})
    assert r.status_code == 204
    assert len(await _rows(maker)) == 1


async def test_rate_limit(maker):
    from app.main import app

    async def _db():
        async with maker() as db:
            yield db
    app.dependency_overrides[get_db] = _db
    limiter.reset()
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
            codes = [(await c.post("/api/v1/metrics/events", json=[], headers={"user-agent": CHROME})).status_code
                     for _ in range(62)]
    finally:
        limiter.reset()
        app.dependency_overrides.clear()
    assert codes[:60] == [204] * 60
    assert codes[-1] == 429


async def test_solo_admin_lee_las_metricas(client):
    from app.main import app
    for role in ("company", "candidate"):
        _as(role)
        assert (await client.get("/api/v1/admin/metrics?days=7")).status_code == 403
    app.dependency_overrides.pop(get_current_user, None)
    assert (await client.get("/api/v1/admin/metrics?days=7")).status_code in (401, 403)
    _as("admin")
    assert (await client.get("/api/v1/admin/metrics?days=7")).status_code == 200
    assert (await client.get("/api/v1/admin/metrics?days=15")).status_code == 422


async def _mundo(maker):
    """Empresa con dos avisos y dos candidatos postulados al primero."""
    tag = uuid.uuid4().hex[:6]
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Comercio {tag}", slug=f"comercio-{tag}")
        zona = Zone(id=uuid.uuid4(), name=f"Bahía {tag}", slug=f"bahia-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Dependencia {tag}")
        cu = User(id=uuid.uuid4(), email=f"emp-{tag}@empresa.com", role="company", is_active=True)
        db.add_all([ind, zona, ct, cu])
        await db.flush()
        company = CompanyProfile(id=uuid.uuid4(), user_id=cu.id, legal_name=f"Ferretería {tag}", cuit=f"30-{tag}-9",
                                 industry_id=ind.id, responsible_full_name="R", responsible_phone="2910000000",
                                 responsible_email="r@empresa.com", verification_status="verified")
        db.add(company)
        await db.flush()
        jobs = []
        for title in (f"Vendedor {tag}", f"Chofer {tag}"):
            j = JobPosting(id=uuid.uuid4(), company_id=company.id, company_legal_name_snapshot=company.legal_name,
                           title=title, description="x", industry_id=ind.id, zone_id=zona.id, contract_type_id=ct.id,
                           modality="presencial", status="active", moderation_status="approved",
                           published_at=datetime.now(timezone.utc))
            db.add(j)
            jobs.append(j)
        await db.flush()
        for i in range(2):
            u = User(id=uuid.uuid4(), email=f"cand{i}-{tag}@x.com", role="candidate", is_active=True)
            db.add(u)
            await db.flush()
            c = CandidateProfile(id=uuid.uuid4(), user_id=u.id, first_name="A", last_name="B", phone="2910000000")
            db.add(c)
            await db.flush()
            db.add(Application(candidate_id=c.id, job_posting_id=jobs[0].id))
        await db.commit()
        return jobs, company.legal_name


def _ev(when, event="page_view", path="/", **kw):
    return SiteEvent(created_at=when, event=event, path=path, source=kw.pop("source", "interno"),
                     device=kw.pop("device", "desktop"), **kw)


async def test_agregados_del_reporte(maker):
    jobs, empresa = await _mundo(maker)
    now = datetime.now(timezone.utc)
    hace = lambda h: now - timedelta(hours=h)  # noqa: E731
    v1, v2, v3 = (str(uuid.uuid4()) for _ in range(3))
    j1, j2 = jobs[0].id, jobs[1].id
    async with maker() as db:
        db.add_all([
            _ev(hace(1), path="/", source="google", visitor_id=v1),
            _ev(hace(1), path="/empleos", visitor_id=v1),
            _ev(hace(1), path="/empleos/vendedor-1", visitor_id=v1),
            _ev(hace(1), path="/empleos/chofer-2", visitor_id=v2, source="ia", device="mobile"),
            _ev(hace(1), path="/empresas", visitor_id=v3, source="directo", device="mobile"),
            _ev(hace(1), "view_item", "/empleos/vendedor-1", job_id=j1, visitor_id=v1),
            _ev(hace(1), "view_item", "/empleos/vendedor-1", job_id=j1, visitor_id=v2),
            _ev(hace(1), "view_item", "/empleos/chofer-2", job_id=j2, visitor_id=v2),
            _ev(hace(1), "apply", "/empleos/vendedor-1", job_id=j1, visitor_id=v1),
            _ev(hace(1), "search", "/empleos", search_term="chofer", results=4, visitor_id=v1),
            _ev(hace(1), "search", "/empleos", search_term="chofer", results=2, visitor_id=v2),
            _ev(hace(1), "search", "/empleos", search_term="soldador", results=0, visitor_id=v2),
            _ev(hace(1), "search", "/empleos", search_term="soldador", results=0, visitor_id=v3),
            _ev(hace(1), "search", "/empleos", search_term="piloto", results=0),
            _ev(hace(1), "sign_up", "/onboarding", label="candidato", visitor_id=v1),
            _ev(hace(1), "generate_lead", "/contacto", label="empresa"),
            # período anterior (7 días): hace 10 días
            _ev(hace(240), path="/", source="google", visitor_id=v1),
            # fuera de los dos períodos
            _ev(hace(24 * 40), path="/"),
        ])
        await db.commit()
        rep = await site_metrics.build_report(db, 7)

    t = rep["totales"]
    assert t["visitas"] == 5
    assert t["visitantes"] == 3
    assert t["busquedas"] == 5
    assert t["avisos_vistos"] == 3
    assert t["postulaciones"] == 1
    assert t["registros"] == 1 and rep["registros_por_tipo"] == {"candidato": 1}
    assert t["contactos"] == 1
    assert rep["totales_anteriores"]["visitas"] == 1
    assert rep["totales_anteriores"]["visitantes"] == 1

    assert len(rep["serie"]) == 7 and sum(d["visitas"] for d in rep["serie"]) == 5
    assert {o["origen"]: o["visitas"] for o in rep["origenes"]} == {"google": 1, "ia": 1, "directo": 1}
    assert {d["dispositivo"]: d["visitas"] for d in rep["dispositivos"]} == {"desktop": 3, "mobile": 2}

    paginas = {p["path"]: p["visitas"] for p in rep["paginas"]}
    assert paginas == {"/empleos/*": 2, "/": 1, "/empleos": 1, "/empresas": 1}
    assert rep["paginas"][0]["fichas"] is True

    assert rep["busquedas"][0] == {"termino": "chofer", "veces": 2, "resultados_promedio": 3.0}
    assert rep["busquedas_sin_resultados"] == [{"termino": "soldador", "veces": 2}, {"termino": "piloto", "veces": 1}]

    a1, a2 = rep["avisos"]
    assert (a1["job_id"], a1["vistas"], a1["postulaciones"], a1["conversion"]) == (str(j1), 2, 2, 1.0)
    assert a1["titulo"] == jobs[0].title and a1["empresa"] == empresa
    assert (a2["job_id"], a2["vistas"], a2["postulaciones"], a2["conversion"]) == (str(j2), 1, 0, 0.0)

    assert rep["embudo"] == {"visitantes": 3, "vieron_aviso": 2, "se_postularon": 1}


async def test_aviso_borrado_no_rompe_el_reporte(maker):
    fantasma = uuid.uuid4()
    async with maker() as db:
        db.add(_ev(datetime.now(timezone.utc) - timedelta(hours=1), "view_item", "/empleos/x", job_id=fantasma))
        await db.commit()
        rep = await site_metrics.build_report(db, 30)
    assert rep["avisos"] == [{"job_id": str(fantasma), "titulo": None, "empresa": None, "estado": None,
                              "vistas": 1, "postulaciones": 0, "conversion": 0.0}]


async def test_serie_diaria_en_hora_de_argentina(maker):
    # "ahora" = 09/10 15:00 UTC (12:00 en Argentina). Período de 7 días: 03/10 a 09/10 (Argentina).
    now = datetime(2026, 10, 9, 15, 0, tzinfo=timezone.utc)
    utc = lambda *a: datetime(*a, tzinfo=timezone.utc)  # noqa: E731
    async with maker() as db:
        # La sesión con otra zona horaria no tiene que cambiar nada.
        await db.execute(select(func.set_config("TimeZone", "Asia/Tokyo", False)))
        db.add_all([
            _ev(utc(2026, 10, 9, 2, 0)),    # 08/10 23:00 AR → cuenta el 8, no el 9
            _ev(utc(2026, 10, 9, 3, 30)),   # 09/10 00:30 AR → el 9
            _ev(utc(2026, 10, 3, 2, 59)),   # 02/10 23:59 AR → período anterior
            _ev(utc(2026, 10, 3, 3, 0)),    # 03/10 00:00 AR → primer día
        ])
        await db.commit()
        rep = await site_metrics.build_report(db, 7, now=now)
    serie = {d["fecha"]: d["visitas"] for d in rep["serie"]}
    assert list(serie)[0] == "2026-10-03" and list(serie)[-1] == "2026-10-09"
    assert serie["2026-10-08"] == 1 and serie["2026-10-09"] == 1 and serie["2026-10-03"] == 1
    assert rep["totales"]["visitas"] == 3
    assert rep["totales_anteriores"]["visitas"] == 1


async def test_retencion_13_meses(maker):
    from app.core import scheduler
    now = datetime.now(timezone.utc)
    async with maker() as db:
        db.add_all([_ev(now - timedelta(days=400)), _ev(now - timedelta(days=380))])
        await db.commit()
    scheduler_maker = scheduler.async_session_maker
    scheduler.async_session_maker = maker
    try:
        await scheduler.purge_site_events()
    finally:
        scheduler.async_session_maker = scheduler_maker
    rows = await _rows(maker)
    assert len(rows) == 1 and (now - rows[0].created_at).days == 380


async def test_reporte_vacio(client):
    _as("admin")
    r = await client.get("/api/v1/admin/metrics?days=90")
    assert r.status_code == 200
    body = r.json()
    assert body["totales"]["visitas"] == 0 and body["datos_desde"] is None
    assert len(body["serie"]) == 90 and body["avisos"] == [] and body["busquedas_sin_resultados"] == []
