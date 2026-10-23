"""Buscador, filtros y estrella de los postulantes de una búsqueda, contra Postgres (base
descartable, `TEST_DATABASE_URL`, migrada a `b3f8d1e6a2c4` o posterior).

Como `test_job_search_db.py`: no trunca tablas; cada test crea su mundo (dos empresas, una
búsqueda cada una, cinco postulantes) y sólo afirma sobre lo suyo.
"""
from __future__ import annotations

import os
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db
    from app.models.alerts import Notification
    from app.models.candidate import CandidateProfile, Education, Experience
    from app.models.catalogs import ContractType, Industry, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.history import ApplicationStatusHistory
    from app.models.job import Application, JobPosting
    from app.services.applicant_search import anios_experiencia_sql
    from app.services.applicant_stats import anios_de_experiencia


@pytest.fixture
async def maker():
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    yield session_maker
    await engine.dispose()


class Sesion:
    """Quién está logueado en el cliente de prueba."""
    user = None


@pytest.fixture
async def client(maker):
    from app.main import app

    async def _db():
        async with maker() as db:
            yield db

    sesion = Sesion()
    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: sesion.user
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
            c.sesion = sesion
            yield c
    finally:
        app.dependency_overrides.clear()


async def _world(maker):
    tag = uuid.uuid4().hex[:6]
    hoy = date.today()
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Industria {tag}", slug=f"industria-{tag}")
        zone = Zone(id=uuid.uuid4(), name=f"Bahía {tag}", slug=f"bahia-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Dependencia {tag}")
        admin = User(id=uuid.uuid4(), email=f"admin-{tag}@talency.com", role="admin", is_active=True)
        ua = User(id=uuid.uuid4(), email=f"a-{tag}@empresa.com", role="company", is_active=True)
        ub = User(id=uuid.uuid4(), email=f"b-{tag}@empresa.com", role="company", is_active=True)
        db.add_all([ind, zone, ct, admin, ua, ub])
        await db.flush()

        def empresa(u, nombre):
            return CompanyProfile(id=uuid.uuid4(), user_id=u.id, legal_name=f"{nombre} {tag}",
                                  cuit=f"30-{uuid.uuid4().hex[:8]}-9", industry_id=ind.id,
                                  responsible_full_name="R", responsible_phone="2910000000",
                                  responsible_email="r@empresa.com", verification_status="verified")

        ca, cb = empresa(ua, "Metalúrgica A"), empresa(ub, "Metalúrgica B")
        db.add_all([ca, cb])
        await db.flush()

        def busqueda(c):
            return JobPosting(id=uuid.uuid4(), company_id=c.id, company_legal_name_snapshot=c.legal_name,
                              title=f"Técnico {tag}", description="Mantenimiento.", industry_id=ind.id,
                              zone_id=zone.id, contract_type_id=ct.id, modality="presencial",
                              status="active", moderation_status="approved",
                              published_at=datetime.now(timezone.utc))

        ja, jb = busqueda(ca), busqueda(cb)
        db.add_all([ja, jb])
        await db.flush()

        cands, users = {}, {}

        def candidato(key, nombre, apellido, nacimiento):
            u = User(id=uuid.uuid4(), email=f"{key}-{tag}@mail.com", role="candidate", is_active=True)
            c = CandidateProfile(id=uuid.uuid4(), user_id=u.id, first_name=nombre, last_name=apellido,
                                 phone="2914000000", birth_date=nacimiento)
            users[key], cands[key] = u, c

        candidato("juan", "Juan", "Pérez", date(1990, 5, 1))
        candidato("maria", "María", "Nahuelfil", date(1998, 5, 1))
        candidato("ana", "Ana", "Gómez", date(1985, 5, 1))
        candidato("luis", "Luis", "Ruiz", date(2000, 5, 1))
        candidato("sofia", "Sofía", "Díaz", date(1995, 5, 1))
        # Sin relationship entre los modelos, el orden de los INSERT lo fija cada flush.
        db.add_all(users.values())
        await db.flush()
        db.add_all(cands.values())
        await db.flush()

        db.add_all([
            # Juan: dos tramos que se pisan (2015-2020 y 2018-2021) = 6 años, no 8.
            Experience(id=uuid.uuid4(), candidate_id=cands["juan"].id, company_name="Profertil",
                       role_title="Técnico Electromecánico", start_date=date(2015, 1, 1), end_date=date(2020, 1, 1)),
            Experience(id=uuid.uuid4(), candidate_id=cands["juan"].id, company_name="Dow",
                       role_title="Mantenimiento", start_date=date(2018, 1, 1), end_date=date(2021, 1, 1)),
            # María: lo de electromecánica está en sus estudios; trabaja hoy (sin fecha de fin).
            Education(id=uuid.uuid4(), candidate_id=cands["maria"].id, institution="UTN",
                      degree="Técnica en Electromecánica", level="terciario", start_date=date(2016, 3, 1)),
            Experience(id=uuid.uuid4(), candidate_id=cands["maria"].id, company_name="Mega",
                       role_title="Soldadora", start_date=hoy - timedelta(days=400), end_date=None),
            Experience(id=uuid.uuid4(), candidate_id=cands["ana"].id, company_name="Cargill",
                       role_title="Tornera", start_date=date(2020, 1, 1), end_date=date(2022, 1, 1)),
            # Luis tiene las dos: soldador y tornero.
            Experience(id=uuid.uuid4(), candidate_id=cands["luis"].id, company_name="Taller Sur",
                       role_title="Soldador", start_date=date(2021, 1, 1), end_date=date(2022, 1, 1)),
            Experience(id=uuid.uuid4(), candidate_id=cands["luis"].id, company_name="Taller Sur",
                       role_title="Tornero", start_date=date(2022, 1, 1), end_date=date(2023, 1, 1)),
            # Sofía todavía no empezó: cuenta cero.
            Experience(id=uuid.uuid4(), candidate_id=cands["sofia"].id, company_name="Futura",
                       role_title="Administrativa", start_date=hoy + timedelta(days=30), end_date=None),
        ])

        apps = {}
        base = datetime.now(timezone.utc)
        for i, key in enumerate(("juan", "maria", "ana", "luis", "sofia")):
            apps[key] = Application(id=uuid.uuid4(), candidate_id=cands[key].id, job_posting_id=ja.id,
                                    status="new", created_at=base - timedelta(minutes=i))
        apps["juan_b"] = Application(id=uuid.uuid4(), candidate_id=cands["juan"].id, job_posting_id=jb.id,
                                     status="new")
        db.add_all(apps.values())
        await db.commit()
    return {"ja": ja, "jb": jb, "admin": admin, "ua": ua, "ub": ub, "cands": cands, "users": users, "apps": apps}


def _como(client, user):
    client.sesion.user = user


async def _lista(client, w, **params):
    r = await client.get(f"/api/v1/me/company/jobs/{w['ja'].id}/applications", params={"page_size": 100, **params})
    assert r.status_code == 200, r.text
    return r.json()


def _quienes(w, data) -> set[str]:
    por_id = {str(c.id): k for k, c in w["cands"].items()}
    return {por_id[i["candidate_id"]] for i in data["items"]}


async def test_tecnico_electromecanico_encuentra_experiencia_y_estudios(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    data = await _lista(client, w, q="tecnico electromecanico")
    assert _quienes(w, data) == {"juan", "maria"}
    por_cand = {i["candidate_id"]: i["match"] for i in data["items"]}
    assert por_cand[str(w["cands"]["juan"].id)] == "Experiencia: Técnico Electromecánico en Profertil"
    assert por_cand[str(w["cands"]["maria"].id)] == "Estudios: Técnica en Electromecánica (UTN)"


async def test_nombre_apellido_sin_tildes_y_empresa(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    assert _quienes(w, await _lista(client, w, q="perez")) == {"juan"}
    assert _quienes(w, await _lista(client, w, q="Juan Pérez")) == {"juan"}
    assert _quienes(w, await _lista(client, w, q="nahuelfil")) == {"maria"}
    assert _quienes(w, await _lista(client, w, q="profertil")) == {"juan"}
    # El parámetro viejo sigue andando como alias.
    assert _quienes(w, await _lista(client, w, position="profertil")) == {"juan"}


async def test_error_de_tipeo_en_la_empresa(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    assert _quienes(w, await _lista(client, w, q="profertl")) == {"juan"}


async def test_and_entre_palabras(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    assert _quienes(w, await _lista(client, w, q="soldador tornero")) == {"luis"}
    # masculino/femenino: "soldador" encuentra a la soldadora
    assert _quienes(w, await _lista(client, w, q="soldador")) == {"maria", "luis"}


async def test_anios_de_experiencia_en_sql_igual_que_python(maker, client):
    w = await _world(maker)
    async with maker() as db:
        for key, cand in w["cands"].items():
            exps = (await db.execute(select(Experience).where(Experience.candidate_id == cand.id))).scalars().all()
            sql = (await db.execute(
                select(anios_experiencia_sql()).select_from(CandidateProfile).where(CandidateProfile.id == cand.id)
            )).scalar()
            assert float(sql) == anios_de_experiencia(exps), key
    _como(client, w["ua"])
    assert _quienes(w, await _lista(client, w, experience_min=5.5)) == {"juan"}          # 6.0, no 8
    assert _quienes(w, await _lista(client, w, experience_max=0.5)) == {"sofia"}


async def test_edad(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    hoy = date.today()
    edad_ana = hoy.year - 1985 - ((hoy.month, hoy.day) < (5, 1))
    assert _quienes(w, await _lista(client, w, age_min=edad_ana)) == {"ana"}


async def test_filtro_por_estado(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    for key, estado in (("juan", "in_process"), ("ana", "selected")):
        r = await client.patch(f"/api/v1/me/company/applications/{w['apps'][key].id}/status", json={"status": estado})
        assert r.status_code == 200, r.text
    assert _quienes(w, await _lista(client, w, status="in_process")) == {"juan"}
    r = await client.get(f"/api/v1/me/company/jobs/{w['ja'].id}/applications",
                         params=[("status", "in_process"), ("status", "selected"), ("page_size", 100)])
    assert _quienes(w, r.json()) == {"juan", "ana"}
    data = await _lista(client, w, status="new")
    assert _quienes(w, data) == {"maria", "luis", "sofia"}


async def test_estrella_privada_sin_aviso_y_separada_por_lado(maker, client):
    w = await _world(maker)
    juan, ana = w["apps"]["juan"], w["apps"]["ana"]

    _como(client, w["ua"])
    r = await client.put(f"/api/v1/me/company/applications/{juan.id}/star")
    assert r.status_code == 200 and r.json()["starred_at"]
    assert _quienes(w, await _lista(client, w, starred="true")) == {"juan"}

    _como(client, w["admin"])
    r = await client.put(f"/api/v1/admin/applications/{ana.id}/star")
    assert r.status_code == 200
    admin = (await client.get(f"/api/v1/admin/jobs/{w['ja'].id}/applications",
                              params={"starred": "true", "page_size": 100})).json()
    assert _quienes(w, admin) == {"ana"}                      # la de la empresa no la ve Talency

    _como(client, w["ua"])
    empresa = await _lista(client, w)
    estrellas = {i["candidate_id"]: i["starred_at"] for i in empresa["items"]}
    assert estrellas[str(w["cands"]["ana"].id)] is None       # la de Talency no la ve la empresa

    # Ni aviso ni historial para el postulante.
    async with maker() as db:
        uid = w["users"]["juan"].id
        assert (await db.execute(select(func.count()).select_from(Notification)
                                 .where(Notification.user_id == uid))).scalar() == 0
        assert (await db.execute(select(func.count()).select_from(ApplicationStatusHistory)
                                 .where(ApplicationStatusHistory.application_id == juan.id))).scalar() == 0

    # El postulante no recibe la estrella por ningún lado.
    _como(client, w["users"]["juan"])
    r = await client.get("/api/v1/me/candidate/applications")
    assert r.status_code == 200
    assert all("starred" not in k for item in r.json() for k in item)

    _como(client, w["ua"])
    r = await client.delete(f"/api/v1/me/company/applications/{juan.id}/star")
    assert r.status_code == 200
    assert _quienes(w, await _lista(client, w, starred="true")) == set()


async def test_orden_estrella_primero(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    await client.put(f"/api/v1/me/company/applications/{w['apps']['sofia'].id}/star")
    data = await _lista(client, w, orden="estrella")
    assert data["items"][0]["candidate_id"] == str(w["cands"]["sofia"].id)


async def test_cruce_entre_empresas(maker, client):
    w = await _world(maker)
    _como(client, w["ub"])
    assert (await client.get(f"/api/v1/me/company/jobs/{w['ja'].id}/applications")).status_code == 404
    assert (await client.get(f"/api/v1/me/company/jobs/{w['ja'].id}/applications/counts")).status_code == 404
    assert (await client.put(f"/api/v1/me/company/applications/{w['apps']['juan'].id}/star")).status_code == 404
    # B puede ver a Juan (se postuló a su búsqueda), pero abrirlo con la postulación de A no la marca.
    r = await client.get(f"/api/v1/me/company/candidates/{w['cands']['juan'].id}",
                         params={"application_id": str(w["apps"]["juan"].id)})
    assert r.status_code == 200
    async with maker() as db:
        app = await db.get(Application, w["apps"]["juan"].id)
        assert app.seen_at is None and app.company_starred_at is None


async def test_visto_de_cada_lado(maker, client):
    w = await _world(maker)
    juan = w["apps"]["juan"]
    _como(client, w["ua"])
    r = await client.get(f"/api/v1/me/company/candidates/{w['cands']['juan'].id}",
                         params={"application_id": str(juan.id)})
    assert r.status_code == 200
    assert _quienes(w, await _lista(client, w, seen="true")) == {"juan"}
    assert "juan" not in _quienes(w, await _lista(client, w, seen="false"))

    _como(client, w["admin"])
    r = await client.get(f"/api/v1/admin/candidates/{w['cands']['ana'].id}",
                         params={"application_id": str(w["apps"]["ana"].id)})
    assert r.status_code == 200
    admin = (await client.get(f"/api/v1/admin/jobs/{w['ja'].id}/applications",
                              params={"seen": "true", "page_size": 100})).json()
    assert _quienes(w, admin) == {"ana"}

    async with maker() as db:
        app = await db.get(Application, juan.id)
        assert app.status == "new"                                  # sin cambio de estado
        ana = await db.get(Application, w["apps"]["ana"].id)
        assert ana.seen_at is None                                  # el admin no marca la de la empresa
        assert (await db.execute(select(func.count()).select_from(Notification)
                                 .where(Notification.user_id == w["users"]["juan"].id))).scalar() == 0


async def test_conteos(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    await client.patch(f"/api/v1/me/company/applications/{w['apps']['juan'].id}/status", json={"status": "in_process"})
    await client.put(f"/api/v1/me/company/applications/{w['apps']['ana'].id}/star")
    r = await client.get(f"/api/v1/me/company/jobs/{w['ja'].id}/applications/counts")
    assert r.status_code == 200
    c = r.json()
    assert c["total"] == 5
    assert c["by_status"] == {"new": 4, "in_process": 1}
    assert c["starred"] == 1
    assert c["unseen"] == 4                         # el cambio de estado marca visto a Juan


async def test_paginacion_estable_con_filtros(maker, client):
    w = await _world(maker)
    _como(client, w["ua"])
    vistos = []
    for page in (1, 2, 3):
        r = await client.get(f"/api/v1/me/company/jobs/{w['ja'].id}/applications",
                             params={"page": page, "page_size": 2, "experience_max": 100})
        data = r.json()
        assert data["total"] == 5
        vistos += [i["id"] for i in data["items"]]
    assert len(vistos) == 5 and len(set(vistos)) == 5


async def test_admin_tiene_los_mismos_filtros(maker, client):
    w = await _world(maker)
    _como(client, w["admin"])
    r = await client.get(f"/api/v1/admin/jobs/{w['ja'].id}/applications",
                         params={"q": "tecnico electromecanico", "page_size": 100})
    assert r.status_code == 200
    assert _quienes(w, r.json()) == {"juan", "maria"}
    _como(client, w["ua"])
    assert (await client.get(f"/api/v1/admin/jobs/{w['ja'].id}/applications")).status_code == 403
    assert (await client.put(f"/api/v1/admin/applications/{w['apps']['juan'].id}/star")).status_code == 403
