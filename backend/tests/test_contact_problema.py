"""Botón "Reportar un problema": va a Admin → Mensajes con el tema `problema`.

Los tests de schema y de armado son puros. El del endpoint necesita una base descartable
(`TEST_DATABASE_URL`, migrada a head) y se saltea sin ella.
"""
from __future__ import annotations

import os
import uuid
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.api.v1.contact import armar_reporte
from app.models.core import UserRole
from app.schemas.contact import ContactMessageCreate, ProblemaCreate


def test_descripcion_obligatoria_y_con_tope():
    with pytest.raises(ValidationError):
        ProblemaCreate(descripcion="   ")
    with pytest.raises(ValidationError):
        ProblemaCreate(descripcion="x" * 2001)
    p = ProblemaCreate(descripcion="  No carga el CV  ", pagina=" ", contacto="")
    assert p.descripcion == "No carga el CV"
    assert p.pagina is None and p.contacto is None


def test_no_entra_por_el_formulario_de_contacto():
    with pytest.raises(ValidationError):
        ContactMessageCreate(name="Ana", phone="2914 000000", message="hola", topic="problema")


def test_reporte_de_visitante_lleva_contacto_y_navegador():
    p = ProblemaCreate(descripcion="El filtro no anda", pagina="/empleos?zona=x", contacto="2914 555555")
    texto = armar_reporte(p, None, "Mozilla/5.0 iPhone")
    assert texto == (
        "Página: /empleos?zona=x\nUsuario: visitante sin sesión\nContacto: 2914 555555\n"
        "Navegador: Mozilla/5.0 iPhone\n\nEl filtro no anda"
    )


def test_reporte_con_sesion_usa_el_usuario_y_no_el_contacto_que_manda():
    user = SimpleNamespace(role=UserRole.company, email="rrhh@empresa.com")
    p = ProblemaCreate(descripcion="No puedo publicar", pagina="/dashboard/company/publicar", contacto="otro@x.com")
    texto = armar_reporte(p, user, None)
    assert "Usuario: Empresa · rrhh@empresa.com" in texto
    assert "otro@x.com" not in texto


TEST_DB = os.environ.get("TEST_DATABASE_URL")


@pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")
async def test_endpoint_guarda_el_reporte_de_un_visitante_y_avisa():
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
            # Un token inválido no frena el reporte: se toma como visitante.
            r = await c.post(
                "/api/v1/contact/problema",
                json={"descripcion": f"No anda el botón {tag}", "pagina": "/empleos", "contacto": f"{tag}@mail.com"},
                headers={"Authorization": "Bearer no-es-un-token", "User-Agent": "Prueba/1.0"},
            )
            assert r.status_code == 200, r.text
        async with maker() as db:
            msg = (await db.execute(
                select(ContactMessage).where(ContactMessage.message.contains(f"No anda el botón {tag}"))
            )).scalar_one()
            assert msg.topic == "problema"
            assert msg.name == "Visitante"
            assert msg.email == f"{tag}@mail.com" and msg.phone is None
            assert msg.message.startswith("Página: /empleos\nUsuario: visitante sin sesión\n")
            assert "Navegador: Prueba/1.0" in msg.message
            await db.delete(msg)
            await db.commit()
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
