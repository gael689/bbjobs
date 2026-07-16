FROM python:3.12-slim

WORKDIR /app

# Actualizamos pip
RUN pip install --upgrade pip

# Copiamos todo el código ANTES de instalar. `pyproject.toml` declara `packages = ["app"]`
# (hatchling) — `pip install .` empaqueta e instala el propio paquete `app`, no sólo las
# dependencias de terceros. Instalarlo con sólo pyproject.toml presente (sin el código fuente
# copiado todavía) deja el paquete `app` mal instalado — se pierde algo de cache de capas de
# Docker, pero es la única forma correcta dado cómo está armado este pyproject.toml.
COPY . .

RUN pip install --no-cache-dir .

# Forma shell (no exec) a propósito: necesita expandir $PORT (Railway lo inyecta dinámico —
# ["..."] en forma exec no expande variables de entorno) y encadenar con && para correr las
# migraciones antes de levantar el server. alembic usa MIGRATIONS_DATABASE_URL (rol con DDL),
# uvicorn usa DATABASE_URL (rol de mínimo privilegio) — ver alembic/env.py y config.py.
# `python -m alembic` en vez del binario `alembic` a secas — no cambia el comportamiento una vez
# que el paquete está bien instalado (ver el reorder de COPY arriba, que era la causa real de un
# ModuleNotFoundError: No module named 'app' visto en Railway), pero es más robusto: `python -m`
# garantiza que se usa el mismo intérprete/entorno que el resto del CMD.
CMD python -m alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
