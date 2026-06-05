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

## FASE 2 y 3 - Modelos de Datos y Autenticación Completa
- Archivo de entorno Alembic (`env.py`, `script.py.mako`, `alembic.ini`) configurado para usar base de datos asíncrona.
- Definidas más de 30 entidades SQLAlchemy (`User`, `JobPosting`, `Application`, `CompanyProfile`, etc.) bajo el esquema establecido.
- Configurada dependencia de Row Level Security (RLS) asíncrona inyectada en sesión base.
- Configurados Schemas de Pydantic para el login y registro.
- Creados Endpoints de autenticación (JWT, Login, Register Candidate, Register Company) con creación automática de perfiles y planes por default.
- Creadas dependencias de FastApi (`require_role`, `require_verified_company`, `get_current_user`) para roles y verificación.

## FASE 4 - Backend Dominio Core
- Creados Schemas de Pydantic para Validaciones, Entradas y Salidas de `Company`, `Candidate`, `Skill`, `JobPosting`, y `Application`.
- Creados Endpoints CRUD para el perfil de Empresa (`/me/company/profile`, `/me/company/verification/request`).
- Creados Endpoints CRUD para el perfil de Candidato (`/me/candidate/profile`).
- Creados Endpoints de Búsquedas Públicas y de la Empresa propietaria (`/jobs`, `/me/company/jobs`).
- Creados Endpoints del flujo de Postulaciones (`/jobs/{id}/apply`, `/me/candidate/applications`, `/me/company/jobs/{id}/applications`, cambio de estados).
- Creados Endpoints de Skills (`/skills`, `/skills/suggest`).

## FASE 5 - Backend Tests Psicométricos
- Creados DTOs de Request y Response para tests y sumisiones.
- Lógica de Listado de Tests Activos y Detalle completo (`/tests`, `/tests/{id}`).
- Control de Cooldown de 30 Días para repetición (`/tests/{id}/start`).
- Carga de respuestas e historial de resultados promediados (`/tests/submissions/{sub_id}/complete`, `/me/candidate/tests`).

## FASE 6 - Backend Storage (Cloudflare R2)
- Implementado conector `boto3` a S3 Compatible de R2 (`r2.py`).
- Añadido soporte `python-multipart` y endpoint `POST /me/candidate/cv` para candidatos con tope 5MB a formato PDF exclusivo.
- Añadido endpoint `POST /me/company/logo` para subida de logos (máx 1MB), imágenes.
- Añadido endpoint `POST /me/company/verification/documents` para documentos pesados empresariales (máx 5MB).
