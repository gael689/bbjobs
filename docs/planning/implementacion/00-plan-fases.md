# Plan de implementación de BBJobs — por fases

> Roadmap operativo del desarrollo. Cada fase tiene objetivo, entregables, criterios de aceptación y un **gate explícito al usuario** antes de avanzar.
>
> Este documento es la guía que un agente desarrollador debe seguir paso a paso. **No se avanza a la próxima fase sin aprobación del usuario.**

---

## Principios de trabajo

1. **Una fase a la vez.** No mezclar el trabajo de dos fases.
2. **Sin atajos.** Si una fase requiere una decisión, se pregunta antes de seguir.
3. **Entregables verificables.** Cada fase termina con algo que el usuario puede revisar / ejecutar localmente.
4. **Acceptance test antes del gate.** No declarar "fase completa" hasta que los criterios de aceptación estén satisfechos.
5. **Documentar lo que se hace.** Cada fase actualiza un CHANGELOG breve dentro del repo (`docs/CHANGELOG.md`) con qué se entregó.
6. **No introducir tecnologías nuevas** sin consultar. El stack está decidido en `docs/planning/backend/06-decisiones-tecnicas.md`.

---

## Mapa general de fases

```
FASE 0    Bootstrap del proyecto (decisiones previas + repo + estructura)
─────────────────────────────────────────────────────────────────────────
FASE 1    Backend: scaffold FastAPI base
FASE 2    Backend: base de datos completa (modelos + migraciones + RLS)
FASE 3    Backend: autenticación + autorización
FASE 4    Backend: dominio core (Company, JobPosting, Candidate, Application, Skills)
FASE 5    Backend: tests psicométricos
FASE 6    Backend: storage de archivos (R2)
FASE 7    Backend: planes + subscripciones
FASE 8    Backend: pagos (Mercado Pago) + destacar búsqueda
FASE 9    Backend: mail (Resend) + notificaciones
FASE 10   Backend: jobs programados + rate limiting + observabilidad
FASE 11   Backend: admin endpoints + observatorio laboral
FASE 12   Backend: CI/CD + backup automatizado
─────────────────────────────────────────────────────────────────────────
FASE 13   Frontend: scaffold + design system + logo + componentes base
FASE 14   Frontend: auth + páginas públicas (landing, listado de jobs)
FASE 15   Frontend: portal candidato
FASE 16   Frontend: portal empresa
FASE 17   Frontend: panel admin
─────────────────────────────────────────────────────────────────────────
FASE 18   Integración E2E + QA
FASE 19   Compliance + pre-launch checklist
FASE 20   Deploy productivo + lanzamiento
```

---

## FASE 0 — Bootstrap del proyecto

**Objetivo.** Tener el repositorio creado, con la estructura de carpetas definitiva, el README inicial, y las decisiones de bootstrapping resueltas.

### Decisiones previas que el agente debe consultar al usuario

| Decisión | Opciones | Recomendación |
|----------|----------|---------------|
| ¿Monorepo o dos repos separados? | (a) Monorepo: `bbjobs/{backend,frontend,docs}`. (b) Dos repos: `bbjobs-backend` + `bbjobs-frontend`. | **Monorepo** en F1. Más simple para un único desarrollador, los cambios full-stack van en un solo PR. |
| ¿Verificó la disponibilidad de `bbjobs.com.ar`? | NIC.ar consulta. | Confirmar antes de cualquier mención al dominio. |
| ¿Repo público o privado? | GitHub público / privado. | **Privado** en F1 hasta el lanzamiento. |
| ¿Pre-commit hooks? | (a) Sí, con `pre-commit` (lint + format antes de commit). (b) No. | **Sí**. Atrapa errores antes del CI. |

### Entregables

- [ ] Repositorio git inicializado.
- [ ] Estructura de carpetas creada (ver árbol abajo).
- [ ] `README.md` con descripción del proyecto, link al planeamiento, cómo arrancar dev.
- [ ] `.gitignore` apropiado (Python, Node, IDEs, env).
- [ ] `.editorconfig` para consistencia de formato.
- [ ] `docs/CHANGELOG.md` inicial.

### Estructura de carpetas propuesta (monorepo)

```
bbjobs/
├── backend/                  # FastAPI app
│   ├── app/
│   │   ├── core/             # config, settings, security, logging
│   │   ├── db/               # session, base, alembic env
│   │   ├── models/           # SQLAlchemy ORM
│   │   ├── schemas/          # Pydantic v2 DTOs
│   │   ├── api/              # routers, divididos por dominio
│   │   │   ├── v1/
│   │   │   │   ├── auth.py
│   │   │   │   ├── companies.py
│   │   │   │   ├── jobs.py
│   │   │   │   ├── applications.py
│   │   │   │   └── ...
│   │   ├── services/         # lógica de dominio
│   │   ├── repositories/     # queries scoped por tenant
│   │   ├── deps/             # dependencias FastAPI (auth, rate limit)
│   │   ├── tasks/            # APScheduler jobs
│   │   ├── integrations/     # mercado_pago, resend, r2
│   │   └── main.py
│   ├── alembic/              # migraciones
│   ├── tests/
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                 # Next.js (App Router)
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── styles/
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── planning/             # el planeamiento actual (backend/, implementacion/)
│   ├── runbook/              # procedimientos operativos
│   └── CHANGELOG.md
│
├── infra/                    # scripts de deploy, backup
│   └── scripts/
│
├── .github/
│   └── workflows/            # CI
│
├── .gitignore
├── .editorconfig
├── README.md
└── LICENSE                   # a decidir más adelante
```

### Criterios de aceptación

1. Cloné el repo en una máquina nueva y la estructura arriba está toda creada.
2. `README.md` permite a alguien nuevo entender el proyecto en 5 minutos.
3. `.gitignore` no permite que se filtre nada sensible (env, archivos de IDE, cache).

### Gate al usuario

→ "Estructura del repo creada. ¿OK para avanzar a FASE 1?"

---

## FASE 1 — Backend: scaffold FastAPI base

**Objetivo.** Tener una app FastAPI corriendo localmente con la configuración base, sin lógica de negocio todavía.

### Entregables

- [ ] `pyproject.toml` con todas las dependencias del stack (FastAPI, SQLAlchemy 2.x async, asyncpg, Alembic, pydantic-settings, python-jose, passlib[bcrypt], structlog, sentry-sdk, slowapi, apscheduler, boto3, resend, jinja2, mercadopago).
- [ ] `app/core/config.py` con `pydantic-settings` que lee del `.env`.
- [ ] `app/core/logging.py` con structlog configurado para JSON output.
- [ ] `app/core/security.py` con utilidades para hashing de password y JWT (sin endpoints aún).
- [ ] `app/db/session.py` con engine async y session factory.
- [ ] `app/main.py` con FastAPI app, middleware de CORS, middleware de logging con `request_id`, prefijo `/api/v1`.
- [ ] `GET /api/v1/health` que devuelve `{"status": "ok"}`.
- [ ] `GET /api/v1/health/db` que verifica conexión a Postgres.
- [ ] `Dockerfile` que build-ea la imagen del backend.
- [ ] `docker-compose.yml` para dev local (backend + postgres).
- [ ] `.env.example` con todas las variables que el backend necesita.

### Variables de entorno mínimas (`.env.example`)

```
# App
ENV=development
DEBUG=true
SECRET_KEY=replace-me

# Database
DATABASE_URL=postgresql+asyncpg://bbjobs:bbjobs@localhost:5432/bbjobs

# Auth
JWT_ALGORITHM=HS256
ACCESS_TOKEN_TTL_MINUTES=30
REFRESH_TOKEN_TTL_DAYS=30

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Sentry
SENTRY_DSN=

# Resend
RESEND_API_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Mercado Pago
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
MP_WEBHOOK_SECRET=
```

### Criterios de aceptación

1. `docker-compose up` levanta backend + postgres sin errores.
2. `curl http://localhost:8000/api/v1/health` responde `{"status": "ok"}`.
3. `curl http://localhost:8000/api/v1/health/db` responde con conexión exitosa.
4. Los logs salen en JSON estructurado a stdout, con `request_id`.
5. `uvicorn --reload` recarga al cambiar código.

### Gate al usuario

→ "Backend levantando local con health checks. ¿OK para avanzar a FASE 2?"

---

## FASE 2 — Backend: base de datos completa

**Objetivo.** Tener todos los modelos SQLAlchemy de las 15+ entidades del Paso 2 implementados, con migración inicial aplicada y políticas RLS activadas.

### Entregables

- [ ] `alembic/` inicializado con `alembic init`.
- [ ] `app/models/` con un módulo por agregado: `user.py`, `company.py`, `candidate.py`, `job_posting.py`, `application.py`, `skill.py`, `subscription.py`, `plan.py`, `payment.py`, `mp_webhook.py`, `refresh_token.py`, `audit_log.py`, etc.
- [ ] Modelos con todas las columnas, FKs, índices, constraints definidos en `02-entidades.md` y `02a-decisiones-criticas.md`.
- [ ] Migración inicial Alembic con: creación de tablas + creación del usuario `app_user` sin SUPERUSER + activación de RLS + políticas RLS por tabla con datos de tenant.
- [ ] Migración separada que inserta el catálogo inicial de skills (seed básico) y planes (Free, Pro, Premium con `is_active` y `features_json`).
- [ ] `app/db/rls.py` con helpers para setear `app.current_user_id` y `app.current_role` por sesión.
- [ ] Middleware FastAPI que setea el contexto RLS al inicio de cada request autenticado.
- [ ] Tests:
  - Test que se conecta como `app_user` SIN contexto RLS seteado y verifica que las queries devuelven vacío.
  - Test que se conecta como `app_user` CON contexto de Empresa A y verifica que NO ve JobPostings de Empresa B.

### Criterios de aceptación

1. `alembic upgrade head` aplica todas las migraciones sin error desde DB vacía.
2. `alembic downgrade base` revierte todo sin error.
3. Todos los modelos del documento de entidades existen y son importables.
4. Los tests de RLS pasan: usuario sin contexto ve cero filas, usuario con contexto ve solo sus filas.
5. La DB tiene los planes Free/Pro/Premium pre-cargados.
6. La DB tiene un catálogo mínimo de skills (al menos 20 skills comunes).

### Gate al usuario

→ "Schema completo, migraciones OK, RLS verificado. ¿OK para avanzar a FASE 3?"

---

## FASE 3 — Backend: autenticación + autorización

**Objetivo.** Implementar el sistema de login/registro/refresh/logout completo con verificación de email, y los helpers de autorización para usar en endpoints.

### Entregables

- [ ] Endpoints de auth (según `05-endpoints.md`):
  - `POST /api/v1/auth/register/candidate`
  - `POST /api/v1/auth/register/company`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/verify-email`
  - `POST /api/v1/auth/verify-email/resend`
  - `POST /api/v1/auth/password/forgot`
  - `POST /api/v1/auth/password/reset`
- [ ] Lógica de JWT HS256 con TTL 30 min.
- [ ] Lógica de refresh token: emisión, persistencia, rotación, ventana de gracia de 30s para el token superseded, revocación en logout.
- [ ] Cookie del refresh: httpOnly, secure, SameSite=Lax, Path=/api/v1/auth/refresh.
- [ ] `app/deps/auth.py`:
  - `get_current_user()` → usuario autenticado o 401.
  - `require_role(role)` → factory de dependencia.
  - `require_verified_company()` → empresa con `verification_status='verified'`.
  - `require_owner(resource_company_id_or_candidate_id)` → propiedad del recurso.
- [ ] Verificación de email vía link con token de un solo uso (tabla `EmailVerificationToken` o similar).
- [ ] Reset de password vía link con token de un solo uso (tabla `PasswordResetToken`).
- [ ] Stub del envío de mail (logs en consola en F3, integración real en FASE 9).
- [ ] Tests unitarios: registro válido/inválido, login válido/inválido, refresh válido/expired/rotado, logout que invalida la sesión, verify-email, password reset.

### Criterios de aceptación

1. Puedo registrarme como candidato y como empresa, recibo (en consola) el link de verificación.
2. Verifico el email y puedo loguearme.
3. Login devuelve access token en JSON + refresh en cookie.
4. Con el access token puedo acceder a un endpoint protegido.
5. Cuando expira el access, hago refresh y recibo nuevo access + nueva refresh cookie.
6. El refresh viejo ya no funciona (excepto en la ventana de gracia de 30s).
7. Logout revoca el refresh y el endpoint protegido devuelve 401 con el access viejo.
8. Tests de auth pasan al 100%.

### Gate al usuario

→ "Auth completo y testeado. ¿OK para avanzar a FASE 4?"

---

## FASE 4 — Backend: dominio core

**Objetivo.** Implementar las entidades centrales del negocio: Company, JobPosting, Candidate, Application, Skill (con sugerencias). Sin pagos, sin storage de archivos todavía (stubs).

### Entregables

- [ ] Endpoints de `Company`: ver/editar perfil propio, request de verificación, ver mis búsquedas.
- [ ] Endpoints de `Candidate`: ver/editar perfil propio, ver mis postulaciones.
- [ ] Endpoints de `JobPosting`: CRUD para empresa (crear, editar, pausar, cerrar), listado público con filtros, detalle público.
- [ ] Endpoints de `Application`: crear (candidato postula), listar por job (empresa), cambiar estado (empresa), ver detalle (con `seen_at` automático).
- [ ] Endpoints de `Skill`: listar catálogo público, agregar skill al perfil, sugerir nueva skill (estado `pending`).
- [ ] Repositorios con scoping por `company_id` / `candidate_id`.
- [ ] Validación de transiciones de estado de `JobPosting` y `Application` (según Paso 3).
- [ ] Tests de scoping: empresa A no puede leer ni modificar JobPostings de empresa B (verifica también que RLS responde correctamente).

### Criterios de aceptación

1. Una empresa verificada puede crear, editar y publicar una búsqueda.
2. Un candidato puede ver el listado público y postularse a una búsqueda.
3. La empresa ve sus postulaciones y puede cambiar el estado.
4. Las transiciones inválidas devuelven 400.
5. Empresa A no puede acceder a recursos de empresa B (test explícito).
6. Skills: catálogo se puede consultar, candidato puede sugerir skill nueva en estado `pending`.

### Gate al usuario

→ "Dominio core operativo. ¿OK para avanzar a FASE 5?"

---

## FASE 5 — Backend: tests psicométricos

**Objetivo.** Sistema de tests psicométricos con cooldown de 30 días, historial visible solo para el candidato, último resultado visible para empresa.

### Entregables

- [ ] Modelos `PsychometricTest`, `TestSubmission`.
- [ ] Endpoints: listar tests disponibles, iniciar submission, enviar respuestas, ver historial (candidato), ver último resultado (empresa autorizada).
- [ ] Lógica del cooldown 30 días entre intentos completados del mismo test por candidato.
- [ ] Job de limpieza de `TestSubmission` en `in_progress` con más de 24hs (preparar la función, registrar en APScheduler en FASE 10).
- [ ] Seed inicial: al menos 1 test psicométrico de ejemplo con preguntas (DISC simplificado o similar).
- [ ] Tests: cooldown respeta los 30 días, empresa ve solo el último resultado de candidatos que se postularon a sus búsquedas.

### Criterios de aceptación

1. Candidato lista tests, inicia uno, completa y ve su resultado.
2. Si intenta repetir el mismo test antes de 30 días, devuelve 400 con mensaje claro.
3. Empresa ve último resultado de un candidato solo si éste se postuló a una de sus búsquedas.
4. Candidato ve su historial completo.

### Gate al usuario

→ "Tests psicométricos operativos. ¿OK para avanzar a FASE 6?"

---

## FASE 6 — Backend: storage de archivos (Cloudflare R2)

**Objetivo.** Subida y servido de archivos (CVs, logos de empresa, documentos de verificación) contra Cloudflare R2.

### Entregables

- [ ] Cuenta de Cloudflare creada por el usuario, bucket R2 + access key generados.
- [ ] `app/integrations/r2.py` con cliente boto3 configurado.
- [ ] Endpoints:
  - `POST /me/candidate/cv` (multipart, valida mimetype + tamaño máx 5MB).
  - `GET /me/candidate/cv/url` (presigned URL 15 min, solo para el dueño o empresa autorizada).
  - `POST /me/company/logo` (multipart, max 1MB).
  - `POST /me/company/verification/documents` (multipart, max 5MB cada uno).
- [ ] Paths en R2: estructura `cvs/{candidate_uuid}/{file_uuid}.pdf`, `logos/{company_uuid}/{file_uuid}.png`, etc. UUIDs no adivinables.
- [ ] Borrado físico inmediato del CV viejo al subir nuevo.
- [ ] Job (función + registro en FASE 10) de limpieza de archivos huérfanos para logos y docs no sensibles.
- [ ] Tests: subida válida e inválida (mimetype, tamaño), URL presigned funciona, URL expirada falla, autorización de descarga.

### Criterios de aceptación

1. Candidato sube un CV PDF de 3MB, se guarda en R2 con path correcto.
2. Empresa autorizada (a la que el candidato se postuló) puede obtener presigned URL y descargar el CV.
3. Otra empresa no autorizada recibe 403.
4. Reemplazar el CV borra el viejo del bucket.
5. Subir CV de 10MB devuelve 413.
6. Subir un .exe disfrazado de .pdf falla la validación de mimetype real.

### Gate al usuario

→ "Storage R2 funcionando. ¿OK para avanzar a FASE 7?"

---

## FASE 7 — Backend: planes y subscripciones

**Objetivo.** CRUD de planes (admin), subscripción Free implícita al crear empresa, endpoints para consultar plan actual.

### Entregables

- [ ] Modelos `Plan`, `Subscription` ya creados en FASE 2.
- [ ] Endpoints admin: `GET/POST/PATCH /api/v1/admin/plans`.
- [ ] Lógica: al crear empresa, se crea automáticamente una `Subscription` con plan Free, `status='active'`.
- [ ] Endpoint: `GET /me/company/subscription` devuelve plan actual + features.
- [ ] Invariante en backend: una empresa SIEMPRE tiene una subscripción activa.
- [ ] Tests: crear empresa genera Free implícita, admin puede editar features del plan, downgrade automático al vencer (preparar función, registrar en FASE 10).

### Criterios de aceptación

1. Crear empresa nueva → consulta de subscription devuelve plan Free.
2. Admin puede listar / crear / editar planes y modificar el `features_json`.
3. Cambiar el plan Free afecta automáticamente a todas las empresas Free (los features son por referencia, no snapshot).

### Gate al usuario

→ "Subscripciones y planes operativos. ¿OK para avanzar a FASE 8?"

---

## FASE 8 — Backend: pagos (Mercado Pago) + destacar búsqueda

**Objetivo.** Único flujo de pago real de F1: empresa paga para destacar una búsqueda durante N días (default 7).

### Entregables

- [ ] Cuenta de Mercado Pago del usuario configurada, credenciales en `.env`.
- [ ] `app/integrations/mercado_pago.py` con cliente y helpers (crear preferencia, verificar firma).
- [ ] Endpoint: `POST /me/company/jobs/{id}/feature` → crea preferencia MP, devuelve URL de checkout.
- [ ] Endpoint: `POST /api/v1/webhooks/mercado-pago` → recibe evento, verifica firma `x-signature`, persiste en `MercadoPagoWebhookEvent`, dispara procesamiento en BackgroundTask.
- [ ] Lógica de procesamiento: si `Payment.status == approved` → crear `JobFeature` activa por N días + marcar `JobPosting.is_featured=true` con `featured_until`.
- [ ] Idempotencia: `INSERT` en `MercadoPagoWebhookEvent` con UNIQUE en `mp_event_id`.
- [ ] Advisory lock o SELECT FOR UPDATE en el procesamiento para evitar race condition.
- [ ] Endpoint admin: `GET /api/v1/admin/payments` para ver historial.
- [ ] Tests: preferencia se crea correctamente, webhook con firma válida procesa, webhook con firma inválida rechaza, webhook duplicado no duplica efectos, advisory lock funciona.

### Criterios de aceptación

1. Una empresa pide destacar una búsqueda → recibe URL de MP sandbox.
2. Pago aprobado en sandbox → webhook llega → JobFeature activa.
3. El listado público muestra la búsqueda destacada arriba durante N días.
4. Pasado el TTL, la búsqueda vuelve a su lugar normal (job de vencimiento corre en FASE 10).
5. Webhook con firma manipulada devuelve 401.
6. Mismo evento de MP llegando 2 veces no genera 2 JobFeature.

### Gate al usuario

→ "Pagos en sandbox funcionando. ¿OK para avanzar a FASE 9?"

---

## FASE 9 — Backend: mail (Resend) + notificaciones

**Objetivo.** Integrar Resend, reemplazar todos los stubs de envío de mail por mails reales.

### Entregables

- [ ] Cuenta de Resend creada, dominio verificado (con SPF + DKIM + DMARC).
- [ ] `app/integrations/resend.py` con cliente.
- [ ] `templates/email/` con templates Jinja2 versionados:
  - `verify_email.html`
  - `password_reset.html`
  - `company_verified.html`
  - `company_rejected.html`
  - `new_application.html` (empresa recibe nueva postulación)
  - `job_alert.html` (alerta de empleo para candidato)
  - `feature_payment_confirmation.html`
- [ ] Servicio `MailService` con métodos por tipo de email, encolado en BackgroundTask para no bloquear request.
- [ ] Reintentos: si Resend devuelve error, encolar en tabla `MailQueue` para reproceso (job en FASE 10).
- [ ] Unsubscribe link en alertas de empleo (obligatorio por compliance).
- [ ] Tests: cada template renderiza sin error, llamada a Resend mock-eada.

### Criterios de aceptación

1. Registro de candidato → llega mail de verificación real al inbox.
2. Postulación → empresa recibe mail real.
3. SPF, DKIM, DMARC verifican OK en mail-tester.com.
4. Mails que fallan quedan en `MailQueue` para reproceso.

### Gate al usuario

→ "Mails reales funcionando. ¿OK para avanzar a FASE 10?"

---

## FASE 10 — Backend: jobs programados + rate limiting + observabilidad

**Objetivo.** Activar APScheduler con todos los jobs definidos en fases previas, rate limiting en endpoints sensibles, y Sentry capturando errores.

### Entregables

- [ ] APScheduler integrado en `app/main.py` con `lifespan`.
- [ ] Jobs registrados:
  - Vencimiento de `JobFeature` activas (diario, idempotente / catch-up).
  - Envío de alertas de empleo (diario).
  - Limpieza de `TestSubmission in_progress > 24h` (diario).
  - Reproceso de webhooks MP fallidos (cada 15 min).
  - Reproceso de `MailQueue` fallida (cada 15 min).
  - Degradación de `Subscription past_due > 7 días` a Free (diario).
  - Limpieza de archivos huérfanos en R2 para logos/docs (semanal).
- [ ] SlowAPI integrado con backend en memoria.
- [ ] Rate limits configurados según `06-decisiones-tecnicas.md` § 4.
- [ ] Sentry inicializado con DSN, integración FastAPI + SQLAlchemy.
- [ ] Healthcheck `/api/v1/health/jobs` que devuelve último timestamp de ejecución de cada job.

### Criterios de aceptación

1. Forzar 6 logins fallidos seguidos → respuesta 429.
2. Webhook MP simulado que falla en procesamiento → queda con `processing_error`, job lo reprocesa.
3. Forzar un error 500 en algún endpoint → aparece en Sentry agrupado.
4. JobFeature vencida desaparece del listado destacado al correr el job.

### Gate al usuario

→ "Jobs + rate limit + Sentry operativos. ¿OK para avanzar a FASE 11?"

---

## FASE 11 — Backend: admin + observatorio laboral

**Objetivo.** Endpoints del rol admin (Talency) y endpoints públicos del observatorio laboral con agregaciones.

### Entregables

- [ ] Endpoints admin:
  - Listar empresas pendientes de verificación, aprobar, rechazar.
  - Suspender/reactivar empresa.
  - Ver todas las búsquedas, ocultar contenido moderado.
  - Listar skills sugeridas pendientes, aprobar (auto-vincula al candidato que sugirió), rechazar.
  - Ver métricas operativas.
- [ ] Endpoints del observatorio (públicos, abierto a empresas verificadas y admin sin gateo de plan):
  - Sueldo promedio por puesto/rubro/seniority.
  - Rubros que más contratan.
  - Skills más demandadas.
- [ ] Lógica: las agregaciones se calculan sobre `JobPosting` activas y cerradas (no eliminadas), respetando `company_legal_name_snapshot` para preservar histórico aunque la empresa se dé de baja.

### Criterios de aceptación

1. Admin aprueba empresa → empresa pasa a `verified` → puede publicar.
2. Admin aprueba skill sugerida → skill aparece en catálogo + vinculada al candidato.
3. Endpoint del observatorio devuelve datos agregados sin filtrar (anonimizados).

### Gate al usuario

→ "Admin + observatorio operativos. ¿OK para avanzar a FASE 12?"

---

## FASE 12 — Backend: CI/CD + backup automatizado

**Objetivo.** Pipeline de CI corriendo en GitHub Actions, backup diario de Postgres a R2.

### Entregables

- [ ] `.github/workflows/backend-ci.yml`:
  - Lint (`ruff` o equivalente).
  - Typecheck (`mypy`).
  - Tests (`pytest`).
  - Build de imagen Docker (sin push aún).
- [ ] `infra/scripts/backup-db.sh`: `pg_dump` + upload a R2 con timestamp en el nombre.
- [ ] Job en APScheduler que ejecuta el script de backup diariamente.
- [ ] Job que mantiene solo los últimos 7 backups (rotación).
- [ ] Procedimiento de restauración documentado en `docs/runbook/restore-db.md` y probado al menos una vez.
- [ ] Dockerfile optimizado: multi-stage, ejecuta `alembic upgrade head` en entrypoint.
- [ ] Configuración de Railway: backend service + Postgres service + variables de entorno.

### Criterios de aceptación

1. Abro PR → CI corre lint + typecheck + tests automáticamente.
2. Backup diario corre y sube `.sql.gz` a R2.
3. Restauración probada en DB local con uno de los dumps.
4. Backend deployado a Railway accesible vía URL pública.
5. Postgres en Railway accesible solo desde el backend (no expuesto a internet).

### Gate al usuario

→ "Backend listo en Railway con CI y backup. ¿OK para avanzar al frontend (FASE 13)?"

---

## FASE 13 — Frontend: scaffold + design system + logo

**Objetivo.** Tener la app Next.js corriendo localmente con la paleta, tipografía, logo y componentes base configurados, lista para construir las páginas.

> **Consultar `docs/planning/implementacion/sistema-visual.md` para la paleta exacta y el logo.**

### Decisiones previas que el agente debe consultar al usuario

| Decisión | Opciones | Recomendación |
|----------|----------|---------------|
| ¿Tailwind CSS? | (a) Sí. (b) CSS Modules. (c) Otro. | **Tailwind** + variables CSS con la paleta. Estándar de facto en Next.js. |
| ¿Librería de componentes? | (a) shadcn/ui (componentes copy-paste). (b) Mantine. (c) Custom desde cero. | **shadcn/ui**. Da componentes accesibles, totalmente customizables a la paleta de BBJobs, sin lock-in. |
| ¿Fetching de datos? | (a) Fetch nativo + React Query. (b) SWR. (c) Solo Server Components. | **Server Components + Server Actions** para mutations, **fetch + React Query** para lo que necesite estado del lado del cliente. |
| ¿Form lib? | (a) react-hook-form + zod. (b) Server Actions puras. | **react-hook-form + zod** para formularios complejos (registro, publicar búsqueda). |
| ¿Testing del frontend? | (a) Playwright para E2E + Vitest para unitarios. (b) Solo E2E. | **Playwright** para E2E críticos, Vitest opcional. |

### Entregables

- [ ] `npx create-next-app@latest frontend --typescript --app --tailwind --eslint`.
- [ ] `tailwind.config.ts` con la paleta de `sistema-visual.md` mapeada a variables CSS.
- [ ] `app/globals.css` con las CSS variables `--primary`, `--secondary`, etc.
- [ ] Logo agregado en `public/logo.png` + componente `<BBJobsLogo />` reutilizable (logo + texto "BBJobs").
- [ ] shadcn/ui inicializado con el tema mappeado a la paleta.
- [ ] Tipografía configurada (Inter o equivalente vía `next/font/google`).
- [ ] Componentes base creados/personalizados: Button, Input, Card, Dialog, DropdownMenu, Toast.
- [ ] Layout principal con header (logo + nav + login button), footer.
- [ ] Página `/` con un hero usando el tagline "El trabajo que buscás está en Bahía".
- [ ] Cliente HTTP (`lib/api.ts`) que conoce el backend, maneja refresh automático del token.

### Criterios de aceptación

1. `npm run dev` levanta la app en `localhost:3000`.
2. Hero de la home tiene el logo + tagline + paleta correcta aplicada (teal + naranja pastel).
3. Botones primarios usan `--primary`, los secundarios `--secondary`.
4. Mobile-first: el header se reorganiza en mobile, todo se ve bien en pantalla chica.
5. shadcn Dialog y Toast funcionan con el tema custom.

### Gate al usuario

→ "Frontend con design system y logo aplicados. ¿OK para avanzar a FASE 14?"

---

## FASE 14 — Frontend: auth + páginas públicas

**Objetivo.** Páginas públicas de la web + flujos completos de registro/login.

### Entregables

- [ ] Páginas:
  - `/` — Hero + secciones para empresas / candidatos / IA / observatorio / planes.
  - `/jobs` — Listado público de búsquedas con filtros (rubro, ubicación, modalidad, seniority).
  - `/jobs/[id]` — Detalle de búsqueda con CTA "Postularme".
  - `/login`
  - `/register/candidate`
  - `/register/company`
  - `/verify-email` — landing del link de verificación.
  - `/forgot-password`, `/reset-password`.
- [ ] Flujo de auth completo en el cliente:
  - Login guarda el access token en memoria, el refresh ya está en cookie httpOnly.
  - Interceptor que renueva el access token automáticamente cuando expira.
  - Logout llama al endpoint y limpia el estado.
- [ ] Protected routes con redirect a `/login` si no autenticado.
- [ ] SSR / ISR para las páginas públicas (`/`, `/jobs`, `/jobs/[id]`) → SEO friendly.

### Criterios de aceptación

1. Puedo registrarme como candidato desde el frontend, recibir el mail, verificar, loguearme.
2. Mismo flujo como empresa.
3. Ruta protegida sin login → redirige a `/login`.
4. Acceso a `/jobs` muestra el listado correcto, con destacadas arriba.
5. Lighthouse Score: Performance > 85, Accessibility > 95 en `/` y `/jobs`.

### Gate al usuario

→ "Auth + páginas públicas operativas. ¿OK para avanzar a FASE 15?"

---

## FASE 15 — Frontend: portal candidato

**Objetivo.** Todas las funcionalidades del rol candidato.

### Entregables

- [ ] `/me/candidate/dashboard` — resumen de postulaciones, estado de tests, alertas activas.
- [ ] `/me/candidate/profile` — editar perfil, subir CV, agregar skills (con sugerir nueva).
- [ ] `/me/candidate/applications` — listado con estado y filtros.
- [ ] `/me/candidate/tests` — tests disponibles, hacer test, ver historial.
- [ ] `/me/candidate/alerts` — configurar alertas de empleo.
- [ ] Acción de postularse desde el detalle de búsqueda → un click si CV ya cargado.
- [ ] Acción de exportar mis datos (Ley 25.326).
- [ ] Acción de borrar mi cuenta (hard delete + anonización).

### Criterios de aceptación

1. Candidato sube CV → aparece en su perfil con "actualizado hace 0 días".
2. Candidato se postula a una búsqueda → la postulación aparece en su dashboard.
3. Candidato hace un test psicométrico → resultado guardado, no puede repetir antes de 30 días.
4. Export devuelve JSON con todos sus datos.

### Gate al usuario

→ "Portal candidato completo. ¿OK para avanzar a FASE 16?"

---

## FASE 16 — Frontend: portal empresa

**Objetivo.** Todas las funcionalidades del rol empresa.

### Entregables

- [ ] `/me/company/dashboard` — métricas, búsquedas activas, postulaciones recientes.
- [ ] `/me/company/profile` — editar perfil, subir logo, request de verificación.
- [ ] `/me/company/jobs` — listado, crear, editar, pausar, cerrar búsquedas.
- [ ] `/me/company/jobs/[id]/applications` — postulantes recibidos con filtros y kanban de estados.
- [ ] `/me/company/jobs/[id]/applications/[id]` — detalle del postulante con CV descargable, resultado del último test psicométrico.
- [ ] **Flujo de destacar búsqueda**: botón en detalle del job → modal → redirect a MP → vuelve a la app → muestra confirmación.
- [ ] `/me/company/subscription` — plan actual y features.
- [ ] Export de datos.

### Criterios de aceptación

1. Empresa no verificada NO ve el botón de publicar (o ve un mensaje).
2. Empresa verificada crea búsqueda → aparece en listado público.
3. Empresa recibe postulación → ve al candidato con CV descargable.
4. Empresa destaca una búsqueda con MP sandbox → vuelve y la búsqueda muestra badge de "destacada".
5. Empresa cambia estado de application → candidato lo ve reflejado.

### Gate al usuario

→ "Portal empresa completo, incluyendo flujo de pago. ¿OK para avanzar a FASE 17?"

---

## FASE 17 — Frontend: panel admin

**Objetivo.** Todas las funcionalidades del rol admin (Talency).

### Entregables

- [ ] `/admin/dashboard` — métricas operativas.
- [ ] `/admin/companies` — listado, filtros por estado, ver detalle, aprobar/rechazar verificación, suspender/reactivar.
- [ ] `/admin/jobs` — todas las búsquedas, moderar.
- [ ] `/admin/skills` — catálogo, ver sugerencias pendientes, aprobar/rechazar.
- [ ] `/admin/plans` — CRUD de planes y features.
- [ ] `/admin/payments` — historial de pagos.
- [ ] `/admin/observatory` — vista interna del observatorio.

### Criterios de aceptación

1. Admin aprueba una empresa pendiente → empresa recibe mail y puede publicar.
2. Admin aprueba skill sugerida → entra al catálogo y al perfil del candidato que sugirió.
3. Admin crea un plan nuevo → aparece como opción en la sección de planes pública.

### Gate al usuario

→ "Panel admin completo. ¿OK para avanzar a FASE 18?"

---

## FASE 18 — Integración E2E + QA

**Objetivo.** Probar end-to-end los flujos críticos en un entorno staging, encontrar y arreglar bugs antes del lanzamiento.

### Entregables

- [ ] Suite Playwright con E2E de:
  - Registro → verificación → login.
  - Empresa pide verificación → admin aprueba → empresa publica búsqueda.
  - Candidato sube CV → se postula → empresa ve postulación.
  - Empresa destaca búsqueda con MP sandbox.
  - Candidato hace test psicométrico → empresa ve último resultado.
- [ ] CI corre los Playwright tests en cada PR.
- [ ] Deploy a staging en Railway + Vercel.
- [ ] Pruebas manuales documentadas con resultado.
- [ ] Lista de bugs encontrados y resueltos.

### Criterios de aceptación

1. Toda la suite E2E pasa contra staging.
2. Manual smoke test completo: ningún bug crítico.

### Gate al usuario

→ "Sistema testeado end-to-end en staging. ¿OK para avanzar a FASE 19?"

---

## FASE 19 — Compliance + pre-launch checklist

**Objetivo.** Marcar todos los ítems del checklist pre-launch (Paso 7).

### Entregables

- [ ] Dominio `bbjobs.com.ar` comprado en NIC.ar y configurado en Railway + Vercel.
- [ ] Política de privacidad publicada en `/privacy`.
- [ ] Términos y condiciones publicados en `/terms`.
- [ ] DKIM/SPF/DMARC verificados con mail-tester.com.
- [ ] Pago real de $1 en MP producción ejecutado y validado.
- [ ] Backup de DB probado restaurando en local.
- [ ] Runbook en `docs/runbook/` con:
  - Cómo deployar.
  - Cómo hacer rollback de deploy.
  - Cómo hacer rollback de migración.
  - Cómo restaurar la DB de un backup.
  - Cómo rotar el secret de JWT.
  - Contactos críticos (MP, Resend, Cloudflare).
- [ ] Sentry configurado con alerta por mail al primer error nuevo.

### Criterios de aceptación

Cada ítem del checklist del Paso 7 § 6 está ✅.

### Gate al usuario

→ "Pre-launch checklist completo. ¿OK para avanzar a FASE 20 (lanzamiento)?"

---

## FASE 20 — Deploy productivo + lanzamiento

**Objetivo.** Lanzar BBJobs a producción.

### Entregables

- [ ] Backend en `api.bbjobs.com.ar` accesible.
- [ ] Frontend en `bbjobs.com.ar` accesible.
- [ ] SSL configurado (Vercel y Railway lo proveen automáticamente).
- [ ] DNS verificado.
- [ ] Cuentas de admin (Talency) creadas en producción.
- [ ] Primer batch de empresas reales invitadas a registrarse y verificarse.
- [ ] Monitoreo activo: Sentry + Railway logs + uptime check externo (UptimeRobot free).

### Criterios de aceptación

1. Usuario externo accede al sitio, se registra, se postula.
2. Empresa se registra, se verifica manualmente, publica.
3. Sin errores críticos en Sentry durante las primeras 48hs.

### Gate al usuario

→ "🚀 BBJobs lanzado."

---

## Anexo: fases futuras (post F1, no incluidas en este plan)

- IA aplicada al matching (vectorización de CVs y búsquedas, cosine similarity).
- Suscripciones recurrentes con MP preapproval.
- App mobile (React Native o nativa) → reusar API v1.
- Multi-user por empresa.
- Onboarding asistido para empresas.
- Newsletter / blog del observatorio laboral.

---

## Tracking

Para cada fase, mantener actualizado este checklist en `docs/CHANGELOG.md`:

```
- [x] FASE 0 — Bootstrap (YYYY-MM-DD)
- [ ] FASE 1 — Backend scaffold
- [ ] ...
```

---

*Plan creado al cerrar el planeamiento funcional. La implementación arranca por FASE 0.*
