"""Prospección contra un Postgres real (base descartable, `TEST_DATABASE_URL`)."""
from __future__ import annotations

import json
import os
import time
import uuid

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy import select, text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db
    from app.core.config import settings
    from app.models.catalogs import Industry
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.email import EmailSuppression
    from app.models.prospect import Prospect, ProspectEmail
    from app.services import prospects as svc

SECRET = "secreto-de-prueba"


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE prospects, prospect_syncs, email_suppressions, company_profiles, users "
            "RESTART IDENTITY CASCADE"
        ))
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "LEADGEN_SYNC_SECRET", SECRET)
    yield session_maker
    await engine.dispose()


@pytest.fixture
async def client(maker):
    from app.main import app

    async def _db():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c
    app.dependency_overrides.clear()


def company(eid, name="Metalúrgica Sur", **kw):
    data = {"external_id": eid, "name": name, "category": "Industria", "locality": "Bahía Blanca",
            "phone": f"0291 455 {eid[-4:]}", "emails": [{"email": f"rrhh@{eid}.com.ar", "mx_valid": True}]}
    data.update(kw)
    return data


async def _sync(client, companies, suppressions=(), sync_id=None):
    body = json.dumps({"sync_id": sync_id or f"lote-{uuid.uuid4().hex}", "companies": companies,
                       "suppressions": list(suppressions)}).encode()
    ts = str(int(time.time()))
    return await client.post("/api/v1/integrations/leadgen/sync", content=body, headers={
        "x-bbjobs-timestamp": ts, "x-bbjobs-signature": svc.sign(SECRET, ts, body),
        "content-type": "application/json"})


async def _prospects(maker) -> list:
    async with maker() as db:
        return (await db.execute(select(Prospect).order_by(Prospect.name))).scalars().all()


async def test_sync_creates_and_is_idempotent_per_batch(client, maker):
    lote = [company("aaa0001"), company("bbb0002", name="Panadería La Espiga", category="Gastronomía")]
    first = (await _sync(client, lote, sync_id="lote-fijo-1")).json()
    again = (await _sync(client, lote, sync_id="lote-fijo-1")).json()
    assert (first["created"], first["replayed"]) == (2, False)
    assert again["replayed"] is True
    assert len(await _prospects(maker)) == 2


async def test_competitors_and_duplicates_are_discarded(client, maker):
    lote = [
        company("aaa0001"),
        company("ccc0003", name="Talentos Sur", category="Consultoras y RRHH"),
        company("ddd0004", name="Metalúrgica Sur (sucursal)", phone="0291 455 0001"),  # mismo teléfono
    ]
    result = (await _sync(client, lote)).json()
    assert result["created"] == 1
    assert result["discarded_reasons"] == {"competencia": 1, "duplicada": 1}


async def test_suppressions_travel_and_the_address_is_never_used(client, maker):
    result = (await _sync(client, [company("aaa0001")], suppressions=["RRHH@aaa0001.com.ar"])).json()
    assert result["suppressed"] == 1
    async with maker() as db:
        sup = (await db.execute(select(EmailSuppression.email))).scalars().all()
        emails = (await db.execute(select(ProspectEmail.email))).scalars().all()
    assert sup == ["rrhh@aaa0001.com.ar"]
    assert emails == []  # el mail suprimido no se carga a la empresa


async def test_resync_updates_contact_but_never_stage_or_notes(client, maker):
    await _sync(client, [company("aaa0001")])
    async with maker() as db:
        p = (await db.execute(select(Prospect))).scalar_one()
        p.stage, p.notes = "reunion", "Le interesa selección de operarios"
        await db.commit()
    await _sync(client, [company("aaa0001", phone="0291 400 9999")])
    p = (await _prospects(maker))[0]
    assert (p.stage, p.notes, p.phone) == ("reunion", "Le interesa selección de operarios", "0291 400 9999")


async def test_company_already_in_bbjobs_is_marked_registered(client, maker):
    async with maker() as db:
        user = User(id=uuid.uuid4(), email="dueño@aaa0001.com.ar", role="company", is_active=True)
        industry = Industry(id=uuid.uuid4(), name=f"Test {uuid.uuid4().hex[:6]}", slug=f"test-{uuid.uuid4().hex[:8]}")
        db.add_all([user, industry])
        await db.flush()
        db.add(CompanyProfile(user_id=user.id, legal_name="Metalúrgica Sur SA", cuit="30-12345678-9",
                              industry_id=industry.id,
                              responsible_full_name="Ana", responsible_phone="2914000000",
                              responsible_email="ana@aaa0001.com.ar"))
        await db.commit()
    await _sync(client, [company("aaa0001")])
    p = (await _prospects(maker))[0]
    assert p.stage == "registrada" and p.company_profile_id is not None


async def test_admin_list_filters_and_bulk_by_filter(client, maker):
    admin = User(id=uuid.uuid4(), email="eugenia@talency.com", role="admin", is_active=True)
    candidate = User(id=uuid.uuid4(), email="cand@mail.com", role="candidate", is_active=True)
    async with maker() as db:   # el admin queda en el historial (actor_user_id): tiene que existir
        db.add_all([admin, candidate])
        await db.commit()
    await _sync(client, [company("aaa0001"), company("bbb0002", name="Panadería", category="Gastronomía",
                                                     emails=[])])
    from app.main import app
    app.dependency_overrides[get_current_user] = lambda: candidate
    assert (await client.get("/api/v1/admin/prospects")).status_code == 403

    app.dependency_overrides[get_current_user] = lambda: admin
    page = (await client.get("/api/v1/admin/prospects", params={"has_email": "true"})).json()
    assert page["total"] == 1 and page["items"][0]["primary_email"] == "rrhh@aaa0001.com.ar"

    selection = {"filter": {"category": "Gastronomía"}}
    assert (await client.post("/api/v1/admin/prospects/selection/count", json=selection)).json()["affected"] == 1
    done = (await client.post("/api/v1/admin/prospects/bulk", json={**selection, "action": "discard"})).json()
    assert done["affected"] == 1
    stages = {p.name: p.stage for p in await _prospects(maker)}
    assert stages == {"Metalúrgica Sur": "nueva", "Panadería": "descartada"}

    csv = await client.get("/api/v1/admin/prospects-export.csv")
    assert csv.status_code == 200 and "Metalúrgica Sur" in csv.content.decode("utf-8-sig")
