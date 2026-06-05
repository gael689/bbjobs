# Changelog - BBJobs

Llevaremos aquí el registro de las funcionalidades entregadas en cada fase.

## FASE 0 - Bootstrap del proyecto
- Repositorio inicializado.
- Estructura de carpetas base creada (backend, frontend, docs, infra, github).
- Archivos `.gitignore`, `.editorconfig` y `README.md` configurados.
- Hooks de `pre-commit` instalados.

## FASE 1 - Backend: scaffold FastAPI base
- Archivo `pyproject.toml` configurado con dependencias de Python 3.12 usando standard setup.
- App base de FastAPI configurada con middlewares de CORS y logueo JSON (structlog).
- Sesión asíncrona de base de datos preparada (`app.db.session`).
- Funciones utilitarias de seguridad (JWT, Bcrypt) configuradas.
- Endpoints de healthcheck disponibles en `/api/v1/health`.
- Entornos y variables de desarrollo aislados con `pydantic-settings` y `.env.example`.
- Configuración lista en `Dockerfile` y `docker-compose.yml` para desarrollo local ágil.
