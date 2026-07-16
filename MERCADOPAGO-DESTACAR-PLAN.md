# Módulo de pago — Destacar búsqueda (Mercado Pago)

> Plan de punta a punta (backend + frontend) para el único flujo de pago de Fase 1: una empresa
> paga **$5.000 ARS** para destacar una búsqueda puntual.

## ✅ Implementado — 2026-07-15 (A→J completos)

Todo el módulo está construido y verificado (backend arranca en vivo, `tsc`/`lint` limpios,
migraciones aplicadas contra Railway, simulación completa del flujo compra→aprobación→prioridad
admin→cierre→apagado del destacado corrida contra la base real). **Lo único que falta es cargar
credenciales reales de Mercado Pago** (`MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY`/`MP_WEBHOOK_SECRET`,
hoy vacías) — sin eso, `create_preference()` devuelve una URL de checkout simulada y la firma
del webhook no se valida (ver §6, sin cambios). Todo lo demás — lógica, validaciones, UI,
prioridad de moderación, historial — funciona.

Detalle de lo hecho, bloque por bloque:
- **A** — `FRONTEND_URL` en config, `FEATURED_JOB_PRICE`/`FEATURED_JOB_CURRENCY` en
  `schemas/payment.py`, schemas `JobFeatureResponse`/`FeatureStatusResponse`/`FeatureHistoryItem`.
  Se retiró `FEATURE_DURATION_DAYS` (quedaba muerto y confundía con el diseño viejo).
- **B** — Migración `e9f2a6c4b8d1`: índice único parcial en `job_features` (sólo un pago
  `pending_payment`/`active` por búsqueda a la vez) — probado que rechaza duplicados.
- **C** — `process_mp_payment` reescrito con sesión propia (se sacó el antipatrón de reusar la
  sesión del request en el `BackgroundTasks`), `ends_at = job.expires_at` (ya no `+7 días`),
  maneja pagos rechazados, notifica a la empresa y a todos los admins. Nuevo
  `app/services/job_features.py::end_active_feature_for_job` enchufado en `expire_jobs`,
  `admin.py::takedown_job` y `jobs.py::update_job_posting` (cierre manual). Se retiró
  `check_expired_features` del scheduler (el timer independiente ya no existe) — **se encontró y
  corrigió un bug real de este cambio**: quedó una referencia colgante a la función borrada en
  `start_scheduler()` que el chequeo de import no detectaba (sólo corre en el lifespan real) y
  tumbaba el servidor al arrancar; lo agarró la prueba con el server en vivo, no el import suelto.
- **D** — `POST /me/company/jobs/{id}/feature` corregido (valida estado de la búsqueda y pagos
  en curso, usa las constantes de precio, `success_url` real). Nuevos
  `GET .../feature/status`, `GET /me/company/features`, `GET /admin/features`,
  `total_revenue_featured` en `DashboardMetrics`.
- **E** — `GET /admin/jobs` prioriza `is_featured` en el orden.
- **F** — Botón "Destacar" + modal de confirmación + badge "Destacada" en
  `dashboard/company/estadisticas`.
- **G** — `dashboard/company/pagos` (historial + polling de vuelta de Mercado Pago) + entrada
  de menú.
- **H** — `dashboard/admin/pagos` (historial de todas las empresas) + tile de ingresos en
  `admin/estadisticas` + entrada de menú.
- **I** — Badge "Destacado" (mismo estilo que ya existía en el home) en `/empleos`,
  `/empleos/[id]` y `JobPreviewPanel`.
- **J** — Badge "Pagada — prioridad" en `admin/busquedas`.

---

## 0. Qué ya existe (relevado antes de planear)

Ya hay scaffolding real, pero **diseñado para un modelo distinto al que pedís**: el código y los
docs de `docs/planning/backend/` asumen un destacado con **duración propia fija (7 días,
configurable por admin), independiente de la búsqueda**. Vos querés que dure exactamente lo que
dure la búsqueda — es un cambio de diseño deliberado, no completar algo a medias.

**Se reusa tal cual:**
- Modelos `JobFeature`, `Payment`, `MercadoPagoWebhookEvent` (tablas ya migradas).
- `app/integrations/mercado_pago.py`: `create_preference()` (real) y `verify_signature()` (real,
  HMAC correcto — hoy es un no-op porque `MP_WEBHOOK_SECRET` está vacío).
- `POST /me/company/jobs/{id}/feature` (existe, hay que corregirlo — ver §2).
- `POST /webhooks/mercado-pago` con verificación de firma + idempotencia por `mp_event_id` (real,
  hay que corregir el procesamiento — ver §2).
- El listado público ya ordena `is_featured.desc()` primero — no hay que tocar esa parte.
- `notification-config.ts` (frontend) **ya tiene mapeados** `job_feature_active`,
  `job_feature_rejected`, `job_feature_expired`, `admin_payment_received` — quedaron
  preparados de antes, sin usar. No hace falta tocar ese archivo.

**Se ignora, no se toca (fuera de alcance):** `Plan`, `Subscription`,
`Payment.related_job_feature_id` (columna muerta, redundante con `JobFeature.payment_id`) — son
para el modelo de suscripciones mensuales, que no es parte de este pedido.

**Bugs reales encontrados en el código que se va a tocar de todas formas (se corrigen acá):**
1. El webhook procesa el pago pasando la **sesión de DB del request** a un `BackgroundTasks` —
   antipatrón conocido de FastAPI (la sesión puede estar cerrada cuando corre la tarea).
2. `success_url` está hardcodeada a `localhost:3000` y a una ruta que no existe en el frontend
   real (`/me/company/jobs/{id}`, las rutas reales son `/dashboard/company/...`).
3. No se maneja el caso de pago rechazado/cancelado — el `JobFeature` se queda en
   `pending_payment` para siempre.
4. No se dispara ninguna notificación desde el webhook (ni éxito, ni rechazo, ni aviso a admins).
5. `GET /me/company/features` y `GET /me/company/payments` están documentados pero no existen.

---

## Decisiones tomadas (confirmadas con el usuario)

1. **Se puede pagar en cualquier momento** — apenas se publica la búsqueda (aunque todavía esté
   pendiente de aprobación de Talency) o después de que ya esté aprobada y visible. Si paga
   estando pendiente, se le avisa a la empresa que se va a destacar apenas se apruebe, **y esa
   búsqueda pasa a tener prioridad de revisión** en la cola del admin.
2. **Duración del destacado = duración de la búsqueda.** No es un timer independiente — el
   destacado termina cuando la búsqueda deja de estar activa (vence, la cierra la empresa, o la
   da de baja un admin), sea cual sea el motivo.
3. **Se incluye una pantalla de historial de pagos** para la empresa (no queda para después).
4. **Precio fijo, sin lógica de configuración**: $5.000 ARS, una constante en el código (no un
   valor editable por admin) — coincide con el pedido explícito, evita sobre-ingeniería.
5. **Sin reembolso.** Si Talency rechaza o da de baja una búsqueda ya paga, no hay reembolso
   automático (mismo criterio que ya estaba documentado). Se avisa esto en el momento del pago.

**Diseño clave que sale de la decisión 1**: `JobPosting.is_featured` se pone en `True` apenas se
confirma el pago (webhook), **sin importar si la búsqueda ya está aprobada**. No hace falta
ninguna lógica extra de "activar cuando se apruebe": el listado público ya exige
`moderation_status == approved` de todas formas, así que `is_featured=True` en una búsqueda
pendiente no tiene ningún efecto visible hasta que se apruebe — pero ya sirve, sin cambios, para
**ordenar la cola de moderación del admin** (`ORDER BY is_featured DESC`). Un solo campo, dos usos.

**Por qué importa la prioridad, no es solo cortesía**: el plazo de 20 días de una búsqueda
empieza a correr desde que se publica, no desde que se aprueba — mientras espera revisión, va
perdiendo días de exposición igual. Priorizar las pagas protege el tiempo que la empresa compró.

---

## 1. Backend — cambios en el modelo de datos

**Sin romper el esquema** — se reusan las tablas existentes, solo cambia qué valores se escriben:
- `JobFeature.ends_at`: en vez de `now + 7 días`, se copia **`job.expires_at`** en el momento en
  que el pago se confirma (si la empresa después achica el plazo de la búsqueda, el destacado
  queda con el valor que tenía al momento de pagar — no se re-sincroniza en caliente; es un
  detalle menor, poco probable que un usuario reduzca el plazo justo después de pagar).
- `JobFeature.starts_at`: fecha real de confirmación del pago (sin cambios respecto a hoy).
- Ya no hace falta ningún timer independiente para vencer el destacado — se apaga como evento
  derivado de que la búsqueda misma deja de estar activa (ver §3).

**Migración nueva (una sola, chica):** índice único parcial en `job_features` —
`WHERE status IN ('pending_payment', 'active')` sobre `job_posting_id` — para que dos intentos
de pago simultáneos sobre la misma búsqueda no puedan generar dos `JobFeature` activos en
paralelo (belt-and-suspenders además del chequeo a nivel aplicación). Justificado por ser dinero
real: vale la pena el resguardo extra a nivel base de datos.

---

## 2. Backend — endpoint de compra (`POST /me/company/jobs/{id}/feature`)

Se corrige y extiende:
- Validar que la búsqueda no esté `closed`/`expired` (sí se permite `pending_review` o `active`,
  por la decisión 1).
- Validar que no haya ya un `JobFeature` en `pending_payment` o `active` para esa búsqueda → 400
  ("ya hay un pago en curso o un destacado activo para esta búsqueda").
- Usar constantes `FEATURED_JOB_PRICE = 5000`, `FEATURED_JOB_CURRENCY = "ARS"` (en
  `schemas/payment.py`, mismo patrón que `MAX_JOB_DURATION_DAYS` en `schemas/job.py`) en vez del
  número mágico actual.
- `success_url` construida con una variable de entorno `FRONTEND_URL` (nueva en `core/config.py`)
  + la ruta real del frontend (ver §4): algo como
  `{FRONTEND_URL}/dashboard/company/pagos?payment_id={id}&job_id={job.id}`.
- Respuesta sin cambios: `{ init_point, payment_id }`.

**Nuevo `GET /me/company/jobs/{id}/feature/status`** — chequeo puntual del estado de un pago
(para el polling del frontend al volver de Mercado Pago): devuelve estado del pago, estado del
destacado, `is_featured`, `featured_until`.

**Nuevo `GET /me/company/features`** — historial completo para la pantalla nueva: por cada
compra, título de la búsqueda, monto, fecha, estado del pago, estado del destacado, y hasta
cuándo dura/duró.

**Nuevo `GET /admin/features`** — mismo historial pero **de todas las empresas de la
plataforma**, para que Talency vea la plata que entró en total. Cada fila suma el nombre de la
empresa (además de lo que ya tiene la versión de empresa): búsqueda, empresa, monto, fecha,
estado del pago, estado del destacado. Pensado para el admin, no reemplaza al de la empresa —
son dos endpoints separados (uno scoped a la empresa logueada, otro sin ese filtro y sólo para
`UserRole.admin`), reusando el mismo query interno con un parámetro opcional de `company_id`.
Métrica agregada opcional para el dashboard: `total_revenue_featured` (suma de pagos
`approved`) en `DashboardMetrics` — da una foto rápida sin tener que entrar al historial.

---

## 3. Backend — procesamiento del pago (webhook) y apagado del destacado

**`process_mp_payment` (dentro de `webhooks.py`)** — se reescribe:
- Abre su **propia sesión de DB** (`async with async_session_maker() as db:`) en vez de reusar
  la del request — corrige el antipatrón real de hoy.
- **Pago aprobado**: actualiza `Payment`, pasa `JobFeature` a `active` con
  `ends_at = job.expires_at`, pone `job.is_featured = True` y `job.featured_until = ends_at`.
  Notifica a la empresa (`job_feature_active`) con un mensaje que **depende de si la búsqueda ya
  está aprobada** ("¡Ya está destacada!" vs. "Se va a destacar apenas se apruebe — tiene
  prioridad de revisión"). Notifica también a todos los admins (`admin_payment_received`) —
  les da visibilidad de que entró plata y de que esa búsqueda ahora tiene prioridad.
- **Pago rechazado/cancelado**: pasa `JobFeature` a `canceled`, notifica a la empresa
  (`job_feature_rejected`) con un link para reintentar.
- **Pendiente/en proceso**: solo actualiza el estado visible del pago, sin notificar (para no
  generar ruido con los reintentos típicos de MP durante el procesamiento).

**Apagado del destacado — nuevo helper compartido** `end_active_feature_for_job(db, job)`
(en un `app/services/job_features.py` nuevo): busca el `JobFeature` activo de esa búsqueda, lo
pasa a `expired`, y limpia `job.is_featured`/`job.featured_until`. Se llama desde:
- `expire_jobs()` (scheduler) — cuando la búsqueda vence sola.
- `admin.py::takedown_job` — cuando un admin la da de baja por incumplimiento.
- `jobs.py::update_job_posting` — cuando la empresa la cierra manualmente (transición a
  `closed`), por prolijidad de datos (aunque una búsqueda cerrada ya no se lista igual).

Esto **reemplaza** al `check_expired_features` actual del scheduler (el timer independiente de 7
días) — se puede retirar esa tarea entera, ya no hace falta un poll aparte: el destacado se apaga
como consecuencia directa de que la búsqueda deja de estar activa, en el mismo momento en que eso
pasa, sin importar el motivo.

**Cola de moderación del admin**: `GET /admin/jobs` pasa a ordenar por
`is_featured.desc(), published_at.asc()` — las pagas aparecen primero, y entre el resto, las más
viejas primero (orden justo). Sin cambios de esquema, solo el `ORDER BY`.

---

## 4. Frontend

**Tipos** (`company/types.ts`): `is_featured`, `featured_until` en `JobPosting`; constante
`FEATURED_JOB_PRICE = 5000` espejada (mismo criterio que `MAX_JOB_DURATION_DAYS` hoy); tipo
nuevo para los ítems del historial.

**Botón "Destacar" — en `dashboard/company/estadisticas`** (donde ya se listan todas las
búsquedas de la empresa): por cada búsqueda no destacada y no cerrada/vencida, un botón
"Destacar ⚡ — $5.000". Al hacer clic, un modal de confirmación explica el precio, que dura lo
que dure la búsqueda, que no hay reembolso, y — si la búsqueda todavía está pendiente de
aprobación — que se va a destacar apenas se apruebe y que gana prioridad de revisión. Al
confirmar: `POST .../feature` → redirección a `init_point` (afuera del sitio, checkout de MP).
Si ya está destacada: badge "Destacada" (mismo estilo que ya existe en el home) con "hasta
DD/MM" en vez del botón.

**Pantalla nueva `dashboard/company/pagos`** ("Historial de pagos"): lista cada compra con
búsqueda, monto, fecha, estado (badges: pendiente/activo/rechazado/vencido). Nueva entrada en el
menú del panel de empresa. Esta misma pantalla recibe la vuelta de Mercado Pago
(`?payment_id=...&job_id=...`): mientras esos parámetros estén presentes, hace polling corto
(cada ~3s, hasta ~30s) contra `GET .../feature/status` y muestra "Confirmando tu pago..." hasta
que el webhook ya haya resuelto el estado real (la fuente de verdad sigue siendo el webhook, la
pantalla solo refleja lo que ya pasó — nunca cambia el estado ella misma).

**Visibilidad pública del destacado** (hoy solo existe en el home, falta en donde la gente
realmente busca empleo):
- `components/jobs/JobPreviewPanel.tsx` (`PreviewJob`): sumar `is_featured` + el mismo badge.
- `app/empleos/page.tsx`: sumar `is_featured` al tipo/fetch y mostrar el badge — hoy no lo
  muestra, es el gap más importante a cerrar acá.
- `app/empleos/[id]/page.tsx`: badge junto al título si `is_featured`.

**Panel de admin** (`dashboard/admin/busquedas`): badge "Pagada — prioridad" en las búsquedas con
`is_featured` (se ve incluso mientras siguen pendientes de aprobación). El orden ya viene
resuelto por el backend, no hay que ordenar nada del lado del frontend.

**Pantalla nueva `dashboard/admin/pagos`** ("Pagos"): mismo formato que la de la empresa, pero
con una columna extra de empresa y sin scope — todo lo que se cobró en la plataforma. Nueva
entrada en el menú del panel admin. Tile "Ingresos por destacados" en `dashboard/admin/estadisticas`
con el total acumulado (`total_revenue_featured`), al lado de las métricas que ya existen.

---

## 5. Orden de implementación sugerido

A. Config (`FRONTEND_URL`) + constantes de precio + schemas nuevos (`JobFeatureResponse`,
   historial, status).
B. Migración: índice único parcial en `job_features`.
C. Reescribir `process_mp_payment` (sesión propia, `ends_at` = `job.expires_at`, rechazo,
   notificaciones) + helper `end_active_feature_for_job` + enchufarlo en `expire_jobs`/
   `takedown_job`/`update_job_posting` + retirar `check_expired_features`.
D. Corregir/extender `POST .../feature` + nuevos `GET .../feature/status`, `GET .../features`
   (empresa) y `GET /admin/features` (admin, todas las empresas) + `total_revenue_featured`.
E. Prioridad en `GET /admin/jobs` (`ORDER BY`).
F. Frontend: tipos + botón "Destacar" + modal de confirmación en `estadisticas`.
G. Frontend: pantalla "Historial de pagos" (empresa) + polling de vuelta de MP + entrada de menú.
H. Frontend: pantalla "Pagos" (admin, todas las empresas) + tile de ingresos en
   `admin/estadisticas`.
I. Frontend: badge "Destacada" en `/empleos`, `/empleos/[id]`, `JobPreviewPanel`.
J. Frontend admin: badge de prioridad en `admin/busquedas`.
K. **Prueba manual obligatoria antes de anunciarlo**: con `MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY`/
   `MP_WEBHOOK_SECRET` de **sandbox** de Mercado Pago cargados (hoy están vacíos), hacer una
   compra de prueba de punta a punta con una tarjeta de test, confirmar que el webhook llega,
   que se firma correctamente, que `is_featured` se activa, que la prioridad de admin funciona,
   y que el destacado se apaga solo al cerrar/vencer la búsqueda manualmente en la prueba.

## 6. Único pendiente real: credenciales de Mercado Pago

`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` y `MP_WEBHOOK_SECRET` están vacíos hoy — mientras sigan así,
`create_preference()` devuelve una URL simulada y la verificación de firma del webhook es un
no-op (no rechaza nada). El resto del módulo — validaciones, lógica de destacado, prioridad de
moderación, historial, UI — está completo y probado; **esto es lo único que falta** para poder
cobrar de verdad:

1. Crear (o pedirle a Talency) una cuenta de Mercado Pago para BBJobs.
2. Sacar las credenciales de **sandbox/test** desde el panel de desarrolladores de MP y
   cargarlas en `backend/.env` — con eso ya se puede hacer una compra de prueba real de punta a
   punta (paso K del orden de implementación).
3. Recién después, para cobrar dinero real, reemplazar por las credenciales de **producción**.
