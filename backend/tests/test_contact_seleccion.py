"""Consulta por selección de personal (/seleccion-de-personal): tema propio y campos opcionales
(puesto, sector, vacantes) que se anteponen al mensaje, sin columnas nuevas.

Los tests de schema son puros. El del endpoint necesita una base descartable
(`TEST_DATABASE_URL`, migrada a head) y se saltea sin ella.
"""
from __future__ import annotations

import os
import uuid

import pytest
from pydantic import ValidationError

from app.api.v1.contact import armar_mensaje
from app.models.contact import ContactTopic
from app.schemas.contact import ContactMessageCreate

BASE = {"name": "Ana Paz", "phone": "2914 000000", "message": "Necesitamos un chofer."}


def test_old_payload_without_new_fields_still_works():
    m = ContactMessageCreate(**BASE)
    assert m.topic == ContactTopic.general
    assert m.puesto is None and m.sector is None and m.vacantes is None
    assert armar_mensaje(m) == "Necesitamos un chofer."


def test_seleccion_fields_go_on_top_of_the_message():
    m = ContactMessageCreate(**BASE, topic="seleccion", puesto=" Chofer de reparto ", sector="Logística", vacantes=2)
    assert armar_mensaje(m) == (
        "Puesto a cubrir: Chofer de reparto\nSector: Logística\nVacantes: 2\n\nNecesitamos un chofer."
    )


def test_empty_optional_fields_are_ignored():
    m = ContactMessageCreate(**BASE, topic="seleccion", puesto="  ", sector="", vacantes="")
    assert m.puesto is None and m.sector is None and m.vacantes is None
    assert armar_mensaje(m) == "Necesitamos un chofer."


def test_vacantes_must_be_reasonable():
    with pytest.raises(ValidationError):
        ContactMessageCreate(**BASE, topic="seleccion", vacantes=0)
    with pytest.raises(ValidationError):
        ContactMessageCreate(**BASE, topic="seleccion", vacantes=5000)
    with pytest.raises(ValidationError):
        ContactMessageCreate(**BASE, topic="seleccion", puesto="x" * 201)


TEST_DB = os.environ.get("TEST_DATABASE_URL")


@pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")
async def test_endpoint_stores_seleccion_and_notifies_admins():
    import httpx
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_db
    from app.main import app
    from app.models.contact import ContactMessage

    engine = create_async_engine(TEST_DB)
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def _db():
        async with maker() as db:
            yield db

    tag = uuid.uuid4().hex[:8]
    app.dependency_overrides[get_db] = _db
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
            r = await c.post(
                "/api/v1/contact",
                json={
                    **BASE,
                    "name": f"Ana {tag}",
                    "topic": "seleccion",
                    "company_name": "Transportes del Sur",
                    "puesto": "Chofer",
                    "sector": "Logística",
                    "vacantes": 3,
                },
            )
            assert r.status_code == 200, r.text
        async with maker() as db:
            msg = (await db.execute(select(ContactMessage).where(ContactMessage.name == f"Ana {tag}"))).scalar_one()
            assert msg.topic == "seleccion"
            assert msg.company_name == "Transportes del Sur"
            assert msg.message.startswith("Puesto a cubrir: Chofer\nSector: Logística\nVacantes: 3\n\n")
            await db.delete(msg)
            await db.commit()
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
