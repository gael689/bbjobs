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

## FASE 7 - Backend Planes y Suscripciones
- Creados DTOs en `payment.py` para Manejo de Planes de Empresa.
- Endpoint administrativo CRUD de Planes (`GET /admin/plans`, `POST /admin/plans`, `PATCH /admin/plans/{id}`).
- Endpoint particular para listar la suscripción actual de una empresa (`GET /me/company/subscription`).

## FASE 8 - Backend Pagos (MercadoPago)
- Creada integración modular `mercado_pago.py` para MercadoPago SDK (Sandbox/Prod).
- Soporte para creación de Preferencia en checkout con URL redireccionable (`POST /me/company/jobs/{id}/feature`).
- Endpoint Webhook tolerante a fallos y con procesamiento en Background Task (`POST /webhooks/mercado-pago`).
- Control de idempotencia y log exhaustivo en `MercadoPagoWebhookEvent`. Activa el `JobFeature` de forma automática tras validación de firma.

## FASE 9 - Backend Notificaciones (Emails)
- Añadido cliente `resend` en dependencias (Poetry).
- Creada abstracción `resend_client.py` con logs de previsualización para simular mails en desarrollo.
- Creado `app/services/email.py` con métodos abstractos (Bienvenida, Reseteo de Password, Postulaciones).

## FASE 10 - Backend Mantenimiento y Rate Limiting
- Añadido `apscheduler`, `sentry-sdk` y `slowapi` a las dependencias.
- Configurado CRON Background Job en `startup` event para que cada 1 hora desactive los "destacados" vencidos (`app/core/scheduler.py`).
- Middleware de SlowAPI integrado a FastAPI para controlar abusos de endpoints.
- Inicialización condicional de Sentry DSN para trackeo de errores en producción.

## Julio a noviembre de 2026 — portal en producción y módulos nuevos

El detalle está en el historial de git y en los planes archivados (`docs/archivo/`). En resumen:
- Login con Clerk (instancia live), CVs y logos en Cloudinary, deploy en Railway + Vercel.
- Mercado Pago para destacados, paquetes de la Base de Talento y Revisión de CV.
- SEO por rubro y por localidad, y medición propia del sitio.
- Detrás de la compuerta `MODULOS_NUEVOS_ACTIVOS`: mails automáticos (Resend), recomendados con IA
  (Gemini, RAG híbrido, agentes por tarea), campañas, prospección y Revisión de CV.

## 20/11/2026 — Preparación del lanzamiento

Todo en `main` local, sin push (migraciones `a1c3e5b7d9f2` y `b2d4f6a8c0e3`). Plan:
`LANZAMIENTO-PLAN.md`; pruebas a mano: `CHECKLIST-PRUEBAS-MANUALES.md`.

**Arreglos que habrían roto producción**
- Gemini real rechazaba toda llamada de texto con el SDK nuevo (`labels` sólo en `v1beta`): se fija
  la versión de la API. El Revisor (`gemini-3.8-flash`) no acepta `thinking_level=minimal`.
- Webhooks de Resend y Clerk compatibles con `svix 2.x` (`verify()` ya no devuelve el evento).

**IA**
- Agentes por tarea en `main` (Evaluador, Revisor, pestaña Agentes).
- Mails y teléfonos tachados en avisos y frases del buscador antes de ir a Gemini (`scrub_contacto`).
- Caché de evaluaciones atada a la lista de requisitos.
- 429 por cuota diaria sin reintentos.
- Resúmenes fallidos guardados para no repagarlos cada noche.
- Requisitos del catálogo en orden fijo.
- **Modo sombra** (`ia_recomendaciones_visibles`): la IA calcula y sólo Talency ve los resultados,
  incluido el mail diario de la empresa.
- Controles de observación en la pestaña Agentes:
  - respuestas sin cita;
  - llamadas fallidas;
  - correcciones del Revisor;
  - costo por búsqueda;
  - cuota diaria agotada.

**Mails**
- Respuestas entrantes (`email.received`): una vez por mail, sin adjuntos ni respuestas
  automáticas. Se asocian por token en el Reply-To o por dirección. Un prospecto que responde pasa
  a "respondió", y si pide la baja, se lo da de baja.
- Sólo los rebotes duros suprimen una dirección y cuentan para el freno por salud. El freno de la
  cuenta también corta la prospección.
- **Casillas de prospección:** el cupo se reparte entre ellas, cada una con su tope diario, y una
  queja o muchos rebotes la pausan sola. Nunca se envía desde la raíz del dominio, y una casilla
  sólo se activa con el dominio verificado en Resend.
- Admin → **Mails**: Respuestas, Enviados, Casillas y Salud de la cuenta.
- Retención de 90 días y borrado de cuenta también para las respuestas.

**Portal**
- Compartir el aviso por WhatsApp.
- Aviso "Postularte es gratis".
- Filtro "Sólo con sueldo publicado".

**Tests y repositorio**
- 799 tests; 20 corridas seguidas sin fallas, después de arreglar 5 causas de intermitencia.
- `tests/conftest.py`: aborta si `TEST_DATABASE_URL` no es local y vacía los catálogos al empezar.
- Raíz ordenada: `docs/referencia`, `docs/eugenia`, `docs/archivo`. `.envrc` en el `.gitignore`.

**Producción (Railway, con el token)**
- Verificado en sólo lectura: Postgres 18.6 con pgvector; migración `f1b3d5e7a9c2`; compuerta
  cerrada; logs limpios; Clerk live.
- Cargada `GEMINI_API_KEY` (proyecto con facturación) con `--skip-deploys`.

