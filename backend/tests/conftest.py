"""Guarda de seguridad e higiene de los tests de integración.

Los tests con base hacen `TRUNCATE … users CASCADE`: borran TODO. Por eso `TEST_DATABASE_URL` sólo se
acepta si apunta a esta misma máquina (el `backend/.env` y Railway apuntan a producción). Si no,
pytest se corta antes de correr el primer test (auditoría del 20/11/2026).

Además, al empezar la sesión se vacían los catálogos (rubros, zonas, tipos de contrato,
habilidades): los tests los llenan con nombres únicos al azar y nadie los borraba, así que la base
descartable acumulaba decenas de miles de filas y, con sufijos de 6 caracteres, una corrida de
cada tantas chocaba con un nombre viejo (`contract_types_name_key`)."""
import asyncio
import os
from urllib.parse import urlparse

LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1", "host.docker.internal"}


def pytest_configure(config):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        return
    host = urlparse(url.replace("+asyncpg", "")).hostname
    if host not in LOCAL_HOSTS:
        raise SystemExit(
            f"TEST_DATABASE_URL apunta a {host!r}: los tests borran toda la base. "
            "Usá una base descartable local (127.0.0.1)."
        )


def pytest_sessionstart(session):
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        return

    async def limpiar():
        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        engine = create_async_engine(url)
        try:
            async with engine.begin() as conn:
                await conn.execute(text(
                    "TRUNCATE contract_types, industries, zones, skills RESTART IDENTITY CASCADE"))
        finally:
            await engine.dispose()

    try:
        asyncio.run(limpiar())
    except Exception as exc:   # base sin migrar o sin permisos: los tests con base avisarán solos
        print(f"[conftest] no se pudieron vaciar los catálogos: {str(exc)[:120]}")
