FROM python:3.12-slim

WORKDIR /app

# Actualizamos pip
RUN pip install --upgrade pip

# Copiamos archivos de dependencias
COPY pyproject.toml .

# Instalamos dependencias directamente
RUN pip install --no-cache-dir .

# Copiamos el resto del codigo de la app
COPY . .

# Forma shell (no exec) a propósito: necesita expandir $PORT (Railway lo inyecta dinámico —
# ["..."] en forma exec no expande variables de entorno) y encadenar con && para correr las
# migraciones antes de levantar el server. alembic usa MIGRATIONS_DATABASE_URL (rol con DDL),
# uvicorn usa DATABASE_URL (rol de mínimo privilegio) — ver alembic/env.py y config.py.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
