""""Búsquedas para vos" en el panel del candidato, contra Postgres (base descartable).

- Orden: "Encaja muy bien" antes que "Encaja"; dentro del nivel, lo evaluado por la IA primero.
- Fuera: lo que ya se postuló, lo cerrado, lo no aprobado y lo que no encaja.
- La IA manda sólo si evaluó (`rerank_status == "done"`) y el candidato aceptó la 3.0 sin
  oponerse; si no, puntaje simple y motivos simples.
- Nunca sale la evidencia ni los motivos que la IA escribió para la empresa, ni datos de otro.
- Compuerta cerrada → 404; empresa → 403.

No trunca tablas: arma su propio mundo (zona y habilidades con nombre único) y mira sólo sus
búsquedas, así anda igual con la base sucia de otros tests.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db
    from app.core.config import settings
    from app.models.ai import JobRecommendation
    from app.models.candidate import CandidateProfile, CandidateSkill
    from app.models.catalogs import ContractType, Industry, Skill, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.job import Application, JobPosting, JobPostingSkill
    from app.models.legal import LegalAcceptance

SECRETO = "EVIDENCIA-PARA-LA-EMPRESA"
URL = "/api/v1/me/candidate/recommended-jobs"
URL_IDS = "/api/v1/me/candidate/recommended-job-ids"


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    yield async_sessionmaker(engine, expire_on_commit=False)
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
            c.as_user = lambda u: app.dependency_overrides.__setitem__(get_current_user, lambda: u)
            yield c
    finally:
        app.dependency_overrides.clear()


async def _world(maker):
    """Una zona y habilidades propias; dos candidatos (Ana aceptó la IA, Beto se opuso) y una
    búsqueda por caso."""
    tag = uuid.uuid4().hex[:6]
    now = datetime.now(timezone.utc)
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Ind {tag}", slug=f"ind-{tag}")
        zone = Zone(id=uuid.uuid4(), name=f"Centro {tag}", slug=f"centro-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Efectivo {tag}")
        soldadura = Skill(id=uuid.uuid4(), name=f"Soldadura {tag}", slug=f"soldadura-{tag}", category="technical")
        torno = Skill(id=uuid.uuid4(), name=f"Torno {tag}", slug=f"torno-{tag}", category="technical")
        blanda = Skill(id=uuid.uuid4(), name=f"Puntualidad {tag}", slug=f"puntualidad-{tag}", category="soft")
        cu = User(id=uuid.uuid4(), email=f"emp-{tag}@empresa.com", role="company", is_active=True)
        db.add_all([ind, zone, ct, soldadura, torno, blanda, cu])
        await db.flush()
        company = CompanyProfile(id=uuid.uuid4(), user_id=cu.id, legal_name="Metalúrgica Sur", cuit=f"30-{tag}-9",
                                 industry_id=ind.id, responsible_full_name="R", responsible_phone="2910000000",
                                 responsible_email="r@empresa.com", verification_status="verified")
        db.add(company)
        await db.flush()

        def job(key, skills=(), days=1, **kw):
            j = JobPosting(id=uuid.uuid4(), company_id=company.id, company_legal_name_snapshot="Metalúrgica Sur",
                           title=f"{key} {tag}", description="x", industry_id=ind.id, zone_id=zone.id,
                           contract_type_id=ct.id, modality=kw.pop("modality", "presencial"),
                           status=kw.pop("status", "active"),
                           moderation_status=kw.pop("moderation_status", "approved"),
                           published_at=now - timedelta(days=days), **kw)
            db.add(j)
            return j, skills

        jobs = {
            "fuerte": job("Fuerte", (soldadura, torno), days=3),       # 2 + 1 + 4 = 7 → muy bien
            "encaja": job("Encaja", (soldadura,)),                     # 2 + 1 + 2 = 5 → encaja
            "flojo": job("Flojo"),                                    # 2 + 1 = 3 → afuera
            "ia": job("IA", days=5),                                  # simple 3, la IA dice 90
            "ia_baja": job("IA baja", (soldadura, torno)),             # simple 7, la IA dice 50
            "postulada": job("Postulada", (soldadura, torno)),
            "cerrada": job("Cerrada", (soldadura, torno), status="closed"),
            "sin_aprobar": job("Sin aprobar", (soldadura, torno), moderation_status="pending_review"),
        }
        await db.flush()
        for j, skills in jobs.values():
            for s in skills:
                db.add(JobPostingSkill(job_posting_id=j.id, skill_id=s.id, is_required=True))

        people = {}
        for name, opt_out in (("ana", None), ("beto", now)):
            u = User(id=uuid.uuid4(), email=f"{name}-{tag}@mail.com", role="candidate", is_active=True,
                     last_seen_at=now)
            db.add(u)
            await db.flush()
            db.add(LegalAcceptance(user_id=u.id, document="privacidad", version="3.0"))
            p = CandidateProfile(id=uuid.uuid4(), user_id=u.id, first_name=name.title(), last_name="T",
                                 phone="2915550000", location_zone_id=zone.id, accepts_onsite=True,
                                 ai_opt_out_at=opt_out)
            db.add(p)
            await db.flush()
            for s in (soldadura, torno, blanda):
                db.add(CandidateSkill(candidate_id=p.id, skill_id=s.id))
            for key, score in (("ia", 90), ("ia_baja", 50)):
                db.add(JobRecommendation(
                    job_id=jobs[key][0].id, candidate_id=p.id, source="talent", hybrid_fit=0.8, coverage=0.9,
                    final_score=score, rerank_status="done", weights_version="t",
                    evidence={"r1": SECRETO}, reasons=[SECRETO], req_evals=[{"evidence": SECRETO}],
                ))
            people[name] = (u, p)
        db.add(Application(candidate_id=people["ana"][1].id, job_posting_id=jobs["postulada"][0].id))
        await db.commit()
    return {k: j for k, (j, _) in jobs.items()}, people, cu, (soldadura, torno, blanda)


def _mine(items, jobs):
    ids = {str(j.id): k for k, j in jobs.items()}
    return [(ids[i["id"]], i) for i in items if i["id"] in ids]


async def test_order_levels_and_exclusions(maker, client):
    jobs, people, _, (soldadura, torno, blanda) = await _world(maker)
    client.as_user(people["ana"][0])
    r = await client.get(URL)
    assert r.status_code == 200, r.text
    mine = _mine(r.json()["items"], jobs)
    # Muy bien con IA → muy bien simple → encaja. Afuera: flojo, la que la IA bajó, la postulada,
    # la cerrada y la sin aprobar.
    assert [k for k, _ in mine] == ["ia", "fuerte", "encaja"]
    by = dict(mine)
    assert by["ia"]["level"] == "Encaja muy bien" and by["ia"]["ai_evaluated"] is True
    assert "Revisada con IA: encaja muy bien" in by["ia"]["reasons"]
    assert by["fuerte"]["level"] == "Encaja muy bien" and by["fuerte"]["ai_evaluated"] is False
    assert by["encaja"]["level"] == "Encaja" and by["encaja"]["strong"] is False
    # El por qué: zona, modalidad y sólo las habilidades técnicas en común (la blanda no).
    assert by["fuerte"]["reasons"][:2] == ["En tu zona", "Presencial, como buscás"]
    assert by["fuerte"]["reasons"][2] == f"Pide {soldadura.name} y {torno.name}"
    assert blanda.name not in json.dumps(r.json())
    assert by["fuerte"]["url"].startswith("/empleos/fuerte-") and by["fuerte"]["company_name"] == "Metalúrgica Sur"
    assert r.json()["profile_gaps"] == []
    # Nunca la evidencia ni los motivos que la IA escribió para la empresa.
    assert SECRETO not in r.text

    ids = (await client.get(URL_IDS)).json()["job_ids"]
    assert [i for i in ids if i in {str(j.id) for j in jobs.values()}] == [str(jobs[k].id) for k, _ in mine]


async def test_ai_opt_out_gets_only_simple_reasons(maker, client):
    jobs, people, _, _ = await _world(maker)
    client.as_user(people["beto"][0])
    r = await client.get(URL)
    assert r.status_code == 200, r.text
    mine = _mine(r.json()["items"], jobs)
    # Sin IA: "ia" no alcanza con el simple e "ia_baja" entra por el simple. Beto no se postuló a
    # "postulada" (la postulación es de Ana): le aparece.
    assert {k for k, _ in mine} == {"fuerte", "ia_baja", "postulada", "encaja"}
    assert all(not i["ai_evaluated"] and not any("IA" in x for x in i["reasons"]) for _, i in mine)
    assert SECRETO not in r.text


async def test_ai_needs_terms_3_and_a_done_evaluation(maker, client):
    from sqlalchemy import delete, update

    jobs, people, _, _ = await _world(maker)
    ana_u, ana = people["ana"]
    async with maker() as db:
        await db.execute(update(JobRecommendation).where(
            JobRecommendation.candidate_id == ana.id, JobRecommendation.job_id == jobs["ia_baja"].id,
        ).values(rerank_status="failed"))
        await db.commit()
    client.as_user(ana_u)
    keys = [k for k, _ in _mine((await client.get(URL)).json()["items"], jobs)]
    assert "ia_baja" in keys and "ia" in keys     # sin evaluación hecha, manda el simple

    async with maker() as db:   # sin la 3.0 aceptada, la IA no cuenta
        await db.execute(delete(LegalAcceptance).where(LegalAcceptance.user_id == ana_u.id))
        await db.commit()
    mine = _mine((await client.get(URL)).json()["items"], jobs)
    assert "ia" not in [k for k, _ in mine] and not any(i["ai_evaluated"] for _, i in mine)


async def test_profile_gaps_and_empty(maker, client):
    jobs, people, _, _ = await _world(maker)
    async with maker() as db:
        u = User(id=uuid.uuid4(), email=f"nuevo-{uuid.uuid4().hex[:6]}@mail.com", role="candidate", is_active=True)
        db.add(u)
        await db.flush()
        db.add(CandidateProfile(id=uuid.uuid4(), user_id=u.id, first_name="Nuevo", last_name="T", phone="2915550001"))
        await db.commit()
    client.as_user(u)
    d = (await client.get(URL)).json()
    assert d["profile_gaps"] == ["zona", "habilidades"] and _mine(d["items"], jobs) == []


async def test_company_403_and_gate_closed_404(maker, client, monkeypatch):
    jobs, people, company_user, _ = await _world(maker)
    client.as_user(company_user)
    assert (await client.get(URL)).status_code == 403
    assert (await client.get(URL_IDS)).status_code == 403
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    client.as_user(people["ana"][0])
    assert (await client.get(URL)).status_code == 404
    assert (await client.get(URL_IDS)).status_code == 404
