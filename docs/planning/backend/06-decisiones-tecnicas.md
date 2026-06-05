# Paso 6 — Decisiones técnicas

> Todas las decisiones cerradas. Stack listo para iniciar implementación.

Stack base: FastAPI + PostgreSQL + Next.js (Vercel) + JWT propio + Railway (Hobby) + Mercado Pago + Cloudflare R2.

---

## 1. Autenticación — tokens

### 1.1. Access token
**Decisión: JWT firmado con HS256, TTL 30 minutos.**
- Stateless, sin infra adicional, suficiente para mono-servicio en F1.
- Secreto en variable de entorno de Railway. Rotación del secreto invalida todas las sesiones (aceptable, caso excepcional).
- Migrar a RS256 si en F2 aparecen servicios externos que necesiten verificar tokens sin conocer la clave privada.

### 1.2. Refresh token
**Decisión: token opaco persistido en tabla `RefreshToken` en DB.**
- Revocación inmediata (delete row).
- Logout revoca solo la sesión actual, no todas las del usuario.
- Auditable: podemos ver sesiones activas por usuario.
- Cookie: `httpOnly=True`, `secure=True`, `SameSite=Lax`, `Path=/api/v1/auth/refresh`.

### 1.3. Rotación del refresh token
**Decisión: rotación en cada refresh.**
- Al refrescar: el token viejo se invalida, se emite uno nuevo.
- Detección de robo: si el atacante usa un refresh ya rotado, el servidor lo detecta (el token ya no existe en DB) y puede revocar todas las sesiones activas del usuario.
- Edge case (red cortada a mitad del refresh): el frontend reintenta; se maneja con ventana de gracia de ~30 segundos opcional.

---

## 2. Almacenamiento de archivos

### 2.1. Storage
**Decisión: Cloudflare R2.**
- Sin egress fees (crítico: las empresas descargan CVs frecuentemente).
- ~$0.015/GB/mes de almacenamiento.
- API 100% compatible con S3 (`boto3` funciona sin cambios). Migrar a AWS S3 en el futuro no requiere cambio de código.
- Presigned URLs nativas.

### 2.2. Subida de archivos
**Decisión: multipart al backend (F1).**
- El backend valida mimetype real (no solo extensión), tamaño y contenido antes de guardar.
- Volumen bajo en F1, el ancho de banda del backend no es cuello de botella.
- Migrar a presigned URL directo al storage si escala.

### 2.3. Servido de archivos
**Decisión: presigned URLs cortas (5-15 minutos).**
- El backend valida permisos y emite URL firmada con expiración.
- El archivo viaja directo desde R2 al cliente sin pasar por el backend.
- Riesgo de URL compartida acotado por la ventana de expiración.

### 2.4. Borrado físico
**Decisión: inmediato para CVs, diferido para logos y documentos no sensibles.**
- CVs: borrado físico inmediato en R2 al reemplazar o al hard delete del candidato. Cumple Ley 25.326.
- Logos, documentos de verificación: job programado que limpia archivos huérfanos (sin referencia activa en DB).
- Implementar con transacción: primero actualizar DB, luego borrar en R2. Si el borrado en R2 falla, el job reintenta.

---

## 3. Autorización

### 3.1. Modelo de autorización en código
**Decisión: dependencias FastAPI + helpers reusables.**
- Helpers: `require_role("admin")`, `require_role("company")`, `require_verified_company()`, `require_owner(resource_company_id)`.
- Se componen como dependencias en cada endpoint: explícito, idiomático, DRY.
- Evita olvidar un check (si no se declara la dependencia, FastAPI no llama al endpoint).

### 3.2. Scoping de queries + RLS
**Decisión: scoping en repositorios (primaria) + Row Level Security en Postgres (defensa en profundidad).**

**Repositorios:** toda query de dominio acepta `company_id` / `candidate_id` y filtra. Testeable unitariamente.

**RLS:** segunda línea de defensa. Garantiza que aunque haya un bug en el código de la app, el motor de Postgres no devuelve datos de otro tenant.
- Tablas con datos de tenant llevan política RLS activada.
- Al abrir cada sesión/transacción: `SET LOCAL app.current_user_id = '...'` y `SET LOCAL app.current_role = '...'` via middleware FastAPI.
- El usuario de conexión de la app **no debe ser superuser** (los superuser bypassean RLS). Un usuario `app_user` sin privilegios de superuser.
- Para jobs del sistema que necesiten acceso sin RLS: usuario separado `system_user` con bypass explícito documentado.
- Las políticas se versionan en Alembic junto con el schema.

---

## 4. Rate limiting

**Decisión: SlowAPI in-memory (proceso único en F1).**
- Sin Redis, sin infra adicional.
- Funciona perfecto con una sola instancia (Railway Hobby no escala horizontalmente por defecto).
- Si Railway escala a 2+ instancias: migrar a SlowAPI con backend Redis o mover a Cloudflare Rate Limiting.

**Endpoints con rate limit en F1:**
- `POST /api/v1/auth/login` — 5 intentos / 15 min por IP + por email.
- `POST /api/v1/auth/register/*` — 3 / hora por IP.
- `POST /api/v1/auth/password/forgot` — 3 / hora por email.
- `POST /api/v1/auth/verify-email/resend` — 3 / hora por usuario.
- `GET /api/v1/jobs` (listado público) — 60 / min por IP.
- `POST /api/v1/me/candidate/skills/suggest` — 10 / día por usuario.

**Capa adicional:** Cloudflare (si se pone delante de Railway como proxy) aplica rate limit básico a nivel de red gratis. Recomendable activarlo cuando se configure el dominio.

---

## 5. Mail transaccional

**Decisión: Resend + templates Jinja2 en el repo.**
- Free tier: 3.000 emails/mes, 100/día — suficiente para F1.
- SDK Python oficial, API moderna.
- Templates HTML en `/templates/email/` con Jinja2: versionables, sin lock-in al provider.
- Si los volúmenes crecen en F2: migrar a AWS SES ($0.10/1.000 mails) sin cambiar la estructura de templates.

**Emails de F1:**
- Verificación de email al registrarse.
- Reset de password.
- Empresa verificada / rechazada por admin.
- Nueva postulación recibida (empresa).
- Alerta de empleo (candidato).
- Confirmación de destacado pagado.

---

## 6. Webhook de Mercado Pago

### 6.1. Idempotencia
**Decisión: tabla `MercadoPagoWebhookEvent` con `mp_event_id` único.**
- `INSERT` con constraint único: si llega duplicado, falla silenciosamente y respondemos 200.
- Audit trail completo de todos los eventos recibidos.
- Ya está en el modelo de datos (Paso 2).

### 6.2. Procesamiento
**Decisión: FastAPI `BackgroundTasks`.**
- El handler HTTP persiste el evento y responde 200 a MP en < 500ms.
- El procesamiento real (actualizar `JobFeature`, `Payment`, etc.) corre en background.
- Job programado reprocesa los eventos con `processed_at IS NULL AND processing_error IS NOT NULL`.
- Si en F2 el volumen requiere más robustez: migrar a Redis + RQ.

### 6.3. Verificación de firma
**Obligatorio en F1.** Verificar `x-signature` (HMAC) de cada webhook antes de procesar. Sin esto, cualquiera puede llamar al endpoint y forzar activación de destacados. Implementar como primera validación en el handler.

---

## 7. Jobs programados

**Decisión: APScheduler in-process (dentro del proceso FastAPI).**
- Sin servicios adicionales.
- Se inicia al arrancar la app con `lifespan` de FastAPI.
- Funciona con una sola instancia (Railway Hobby).
- Si Railway escala horizontalmente: agregar distributed lock (ej. con Postgres advisory locks) o migrar a worker separado.

**Jobs de F1:**
- Vencimiento de `JobFeature` activas (diario).
- Envío de alertas de empleo (diario o por evento).
- Limpieza de `TestSubmission` en estado `in_progress` con más de 24hs (diario).
- Reproceso de webhooks MP fallidos (cada 15 min).
- Degradación de `Subscription` con `past_due` > 7 días a Free (diario).

---

## 8. Migraciones de base de datos

**Decisión: Alembic.**
- Estándar nativo de SQLAlchemy. Maduro, ampliamente documentado.
- `alembic upgrade head` en el entrypoint de Railway al deployar.
- Las políticas RLS van en migraciones Alembic junto con el schema (`op.execute("ALTER TABLE ... ENABLE ROW LEVEL SECURITY")`).

---

## 9. ORM

**Decisión: SQLAlchemy 2.x puro + Pydantic v2 schemas separados.**
- SQLAlchemy para modelos de DB y queries.
- Pydantic v2 para schemas de API (DTOs): `JobPostingCreate`, `JobPostingResponse`, `JobPostingUpdate` son clases Pydantic independientes de la clase SQLAlchemy `JobPosting`.
- Separación explícita: la DB evoluciona sin romper el contrato de la API y viceversa. Nunca se expone accidentalmente un campo de DB (como `password_hash`).
- Sintaxis async de SQLAlchemy 2.x (`async with session.begin()`).

---

## 10. Logging y observabilidad

**Decisión: structlog + Sentry free tier.**

**structlog:**
- Logs estructurados JSON a stdout.
- Railway indexa y muestra los logs (retención 7 días en Hobby).
- Middleware agrega automáticamente `request_id`, `user_id`, `endpoint`, `method`, `status_code`, `duration_ms` a cada log.

**Sentry (free tier: 5.000 errores/mes):**
- Integración con FastAPI/Starlette: `sentry_sdk.init(dsn=..., integrations=[StarletteIntegration(), SqlalchemyIntegration()])`.
- Agrupa errores idénticos, stack trace con contexto de request y variables.
- Alertas por mail en primer error nuevo.

---

## 11. CORS

**Decisión:**
```python
CORSMiddleware(
    allow_origins=["https://bbjobs.com.ar"],  # controlado por env var ALLOWED_ORIGINS
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
```
- `ALLOWED_ORIGINS` como env var (lista separada por coma): en dev incluye `http://localhost:3000`, en prod solo `https://bbjobs.com.ar`.
- Cookie del refresh: `Path=/api/v1/auth/refresh` — la cookie no se envía a ningún otro endpoint.
- Mientras no haya dominio propio: se usan las URLs de Railway/Vercel y se actualizan las env vars cuando llegue el dominio.

---

## 12. Manejo de secretos

**Decisión: Railway env vars + `pydantic-settings`.**
- Todas las variables de configuración se leen con `pydantic-settings` desde env vars.
- Separación por entorno mediante Railway Environments (producción / staging).
- No hay secretos en código ni en archivos commiteados.
- Migrar a Doppler/Infisical si el equipo crece o aparece auditoría formal.

---

## 13. Versionado del API

**Decisión: prefijo `/api/v1` desde el día 0.**
- Permite introducir `/api/v2` en F2 (app mobile) sin romper el frontend web existente.
- Ya asumido en el documento de endpoints (Paso 5).

---

## 14. Hosting

**Decisión:**
- **Backend (FastAPI) + Base de datos (Postgres):** Railway (Hobby, $5/mes base).
- **Frontend (Next.js):** Vercel (Hobby, gratis).
- Dominio: `bbjobs.com.ar` a comprar en NIC.ar. Backend en `api.bbjobs.com.ar`, frontend en `bbjobs.com.ar`.
- Hasta tener el dominio: URLs temporales de Railway y Vercel en las env vars.

---

## Resumen del stack técnico completo

| Componente | Tecnología |
|------------|-----------|
| Backend | FastAPI (Python) |
| Base de datos | PostgreSQL |
| ORM | SQLAlchemy 2.x async |
| Migraciones | Alembic |
| Validación / serialización | Pydantic v2 (schemas separados) |
| Frontend | Next.js (App Router) |
| Auth | JWT HS256 + RefreshToken en DB |
| Hosting backend/DB | Railway (Hobby) |
| Hosting frontend | Vercel (Hobby) |
| Storage archivos | Cloudflare R2 |
| Pagos | Mercado Pago |
| Mail | Resend + Jinja2 |
| Logging | structlog → stdout (Railway) |
| Errores | Sentry free tier |
| Rate limiting | SlowAPI in-memory |
| Jobs programados | APScheduler in-process |
| Webhook MP | FastAPI BackgroundTasks |
| Secretos | Railway env vars + pydantic-settings |
| Autorización | Dependencias FastAPI + helpers + RLS Postgres |

---

*Paso 6 cerrado. Siguiente: Paso 7 — Riesgos y dependencias (`07-riesgos-dependencias.md`).*
