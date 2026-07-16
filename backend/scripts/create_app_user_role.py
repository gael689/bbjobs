"""
Crea (o resetea la password de) un rol de Postgres de mínimo privilegio, `app_user`, para que el
backend se conecte en runtime en vez de usar `postgres` (superusuario, dueño de todas las
tablas — ver SEGURIDAD-PLAN.md bloque E). Corre una sola vez contra la base real de Railway.

Uso: python scripts/create_app_user_role.py

Qué hace:
  1. Se conecta con las credenciales actuales de DATABASE_URL (hoy: `postgres`, superuser).
  2. Crea `app_user` sin SUPERUSER/CREATEDB/CREATEROLE (o le resetea la password si ya existe —
     idempotente, se puede re-correr).
  3. Otorga SELECT/INSERT/UPDATE/DELETE sobre todas las tablas y secuencias existentes en el
     schema public — nada de DDL (CREATE/ALTER/DROP TABLE).
  4. Configura default privileges para que las tablas que cree el rol actual en migraciones
     futuras hereden esos mismos grants automáticamente (si no, cada `alembic upgrade head`
     nuevo necesitaría un GRANT manual).
  5. Reescribe backend/.env: DATABASE_URL pasa a apuntar a app_user, MIGRATIONS_DATABASE_URL
     queda con las credenciales actuales (necesarias para que Alembic siga pudiendo hacer DDL).

La contraseña nueva se genera acá adentro y nunca se imprime a stdout — sólo queda escrita en
el archivo .env.
"""
import asyncio
import os
import secrets
from urllib.parse import urlparse, urlunparse

from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(ENV_PATH)

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

APP_ROLE = "app_user"


async def main():
    superuser_url = os.environ["DATABASE_URL"]
    parsed = urlparse(superuser_url)
    db_name = parsed.path.lstrip("/")
    admin_role = parsed.username

    new_password = secrets.token_urlsafe(32)

    engine = create_async_engine(superuser_url)
    async with engine.begin() as conn:
        exists = (await conn.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = :r"), {"r": APP_ROLE}
        )).scalar_one_or_none()

        if exists:
            await conn.execute(text(f"ALTER ROLE {APP_ROLE} WITH LOGIN PASSWORD '{new_password}'"))
            print(f"Rol '{APP_ROLE}' ya existía — password reseteada.")
        else:
            await conn.execute(text(
                f"CREATE ROLE {APP_ROLE} WITH LOGIN PASSWORD '{new_password}' "
                "NOSUPERUSER NOCREATEDB NOCREATEROLE"
            ))
            print(f"Rol '{APP_ROLE}' creado (sin SUPERUSER/CREATEDB/CREATEROLE).")

        await conn.execute(text(f'GRANT CONNECT ON DATABASE "{db_name}" TO {APP_ROLE}'))
        await conn.execute(text(f"GRANT USAGE ON SCHEMA public TO {APP_ROLE}"))
        await conn.execute(text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_ROLE}"))
        await conn.execute(text(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_ROLE}"))

        table_count = (await conn.execute(
            text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
        )).scalar_one()
        print(f"Grants DML otorgados sobre {table_count} tablas existentes en schema public.")

        # Sin esto, cada tabla nueva que cree una migración futura (corrida como `admin_role`)
        # quedaría sin grants para app_user hasta que alguien se acuerde de correrlo a mano.
        await conn.execute(text(
            f'ALTER DEFAULT PRIVILEGES FOR ROLE "{admin_role}" IN SCHEMA public '
            f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {APP_ROLE}"
        ))
        await conn.execute(text(
            f'ALTER DEFAULT PRIVILEGES FOR ROLE "{admin_role}" IN SCHEMA public '
            f"GRANT USAGE, SELECT ON SEQUENCES TO {APP_ROLE}"
        ))
        print(f"Default privileges configurados para tablas futuras creadas por '{admin_role}'.")

    await engine.dispose()

    new_netloc = f"{APP_ROLE}:{new_password}@{parsed.hostname}:{parsed.port}"
    app_user_url = urlunparse(parsed._replace(netloc=new_netloc))

    with open(ENV_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    database_url_replaced = False
    migrations_url_present = False
    for line in lines:
        if line.startswith("DATABASE_URL="):
            new_lines.append(f"DATABASE_URL={app_user_url}\n")
            database_url_replaced = True
        elif line.startswith("MIGRATIONS_DATABASE_URL="):
            new_lines.append(f"MIGRATIONS_DATABASE_URL={superuser_url}\n")
            migrations_url_present = True
        else:
            new_lines.append(line)

    if not database_url_replaced:
        raise SystemExit("No se encontró una línea DATABASE_URL= en .env — no se tocó el archivo, revisar a mano.")
    if not migrations_url_present:
        new_lines.append(f"MIGRATIONS_DATABASE_URL={superuser_url}\n")

    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print("\nbackend/.env actualizado:")
    print(f"  DATABASE_URL           -> {APP_ROLE} (mínimo privilegio, sin DDL)")
    print(f"  MIGRATIONS_DATABASE_URL -> '{admin_role}' (para que alembic pueda seguir haciendo DDL)")
    print("(La password nueva no se imprimió acá — sólo quedó escrita en el archivo .env.)")


asyncio.run(main())
