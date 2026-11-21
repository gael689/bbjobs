# Paso 8 — Módulo de notificaciones (in-app)

> Planeamiento del centro de notificaciones in-app de BBJobs para los tres roles
> (candidato, empresa, admin). Cubre backend (modelo, servicio, eventos, endpoints)
> y frontend (campana, panel, entrega).
>
> **Alcance F1:** notificaciones **in-app** (campana en el navbar + panel). El envío por
> mail queda desacoplado y se enchufa cuando esté la API key de Resend/Brevo — cada
> evento puede además disparar un mail sin bloquear lo in-app.
>
> **Decisiones tomadas** (validadas con el usuario antes de escribir este doc):
> 1. Se enriquece el modelo `Notification` con `type` + `link` (una migración Alembic).
> 2. Entrega en frontend por **polling ~45 s** + refresco al abrir la campana / cambiar de ruta. Tiempo real (SSE/WebSocket) → Fase 2.
> 3. **No** se notifica al candidato el estado `seen` (vista automática, ruidosa). Solo transiciones reales: `in_process`, `contacted`, `discarded`.

---

## 1. Diagnóstico del estado actual

### Lo que ya existe

- **Modelo** `Notification` (`app/models/alerts.py`): `user_id`, `title`, `body`, `is_read`, `read_at`, `created_at`. Minimalista.
- **Endpoints** (`app/api/v1/notifications.py`):
  - `GET /me/notifications` — últimas 50, orden desc.
  - `PATCH /me/notifications/{id}/read` — marca una leída.
  - `POST /me/notifications/read-all` — marca todas leídas.
- **Generación**: solo en `app/api/v1/admin.py`, con 5 usos **inline** de `Notification(...)`:
  - verificar / rechazar empresa
  - suspender / reactivar empresa
  - takedown de búsqueda

### Los huecos (eventos operativos que hoy NO notifican a nadie)

1. **Empresa** no se entera de una **nueva postulación** (Flujo 3, paso 4).
2. **Candidato** no se entera de **cambios de estado de su postulación**.
3. **Admin** no se entera de **empresa pendiente de verificación** ni de **skills sugeridas**.
4. **Frontend**: no hay ninguna UI (ni campana, ni badge, ni panel). El backend genera notificaciones que nadie puede ver.

---

## 2. Catálogo de notificaciones por rol

> Cada fila define el `type` (clave estable para ícono + color), el destinatario, el
> disparador en código, y el copy sugerido en español rioplatense. `{…}` = interpolación.

### 2.1. Candidato

| `type` | Título | Cuerpo | Disparador | Link | Estado |
|--------|--------|--------|-----------|------|--------|
| `application_in_process` | Avanzaste en una búsqueda | Una empresa te puso en proceso de selección para **{job_title}**. | `PATCH /me/company/applications/{id}/status` → `in_process` | `/dashboard/candidate?tab=applications` | ⚠️ falta |
| `application_contacted` | ¡Una empresa quiere contactarte! | Fuiste marcado como *contactado* en la búsqueda **{job_title}**. | idem → `contacted` | `/dashboard/candidate?tab=applications` | ⚠️ falta |
| `application_discarded` | Novedades en tu postulación | Tu postulación a **{job_title}** no avanzó en esta oportunidad. ¡Seguí participando en otras búsquedas! | idem → `discarded` | `/empleos` | ⚠️ falta |
| `skill_approved` | Habilidad aprobada | Tu sugerencia **{skill_name}** fue aprobada y agregada a tu perfil. | admin aprueba skill sugerida | `/dashboard/candidate?tab=profile` | ⚠️ falta |
| `skill_rejected` | Habilidad no aprobada | Tu sugerencia **{skill_name}** no fue incorporada al catálogo. | admin rechaza skill | `/dashboard/candidate?tab=profile` | ⚠️ falta |
| `job_closed_applied` | Una búsqueda cerró | La búsqueda **{job_title}** a la que te postulaste ya no está activa. | cierre/takedown de una búsqueda con postulantes | `/empleos` | opcional |

> **Nota copy `discarded`.** Tono cuidado: nunca "fuiste rechazado". El candidato no
> controla el estado ni ve el detalle; solo recibe una señal amable de que puede seguir.

### 2.2. Empresa

| `type` | Título | Cuerpo | Disparador | Link | Estado |
|--------|--------|--------|-----------|------|--------|
| `application_new` | Nueva postulación | Recibiste una nueva postulación en **{job_title}**. | `POST /jobs/{id}/apply` | `/dashboard/company?tab=applications&job={job_id}` | ⚠️ falta |
| `company_verified` | ¡Tu empresa fue verificada! | Ya podés publicar búsquedas laborales en BBJobs. | admin aprueba | `/dashboard/company` | ✅ existe |
| `company_rejected` | Verificación rechazada | {motivo o "Contactá al administrador para más información."} | admin rechaza | `/dashboard/company` | ✅ existe |
| `company_suspended` | Tu empresa fue suspendida | Tu empresa fue suspendida por el equipo de BBJobs. Contactanos para más información. | admin suspende | `/dashboard/company` | ✅ existe |
| `company_reactivated` | Tu empresa fue reactivada | Ya podés volver a gestionar tus búsquedas laborales. | admin reactiva | `/dashboard/company` | ✅ existe |
| `job_takedown` | Búsqueda dada de baja | La búsqueda **{job_title}** fue dada de baja por incumplimiento de las políticas. | admin takedown | `/dashboard/company?tab=jobs` | ✅ existe |
| `skill_approved` | Habilidad aprobada | La habilidad **{skill_name}** que sugeriste fue aprobada. | admin aprueba skill | `/dashboard/company` | ⚠️ falta |
| `job_feature_active` | Tu búsqueda está destacada | **{job_title}** aparece destacada hasta el {fecha}. | webhook MP `approved` | `/dashboard/company?tab=jobs` | ⏳ pendiente MP |
| `job_feature_rejected` | El pago no se procesó | No pudimos activar el destaque de **{job_title}**. El pago fue rechazado. | webhook MP `rejected` | `/dashboard/company?tab=jobs` | ⏳ pendiente MP |
| `job_feature_expired` | Destaque vencido | El destaque de **{job_title}** venció. Podés volver a destacarla cuando quieras. | job programado de vencimiento | `/dashboard/company?tab=jobs` | opcional |

### 2.3. Admin (Talency) — **fan-out** (una notificación por cada admin)

| `type` | Título | Cuerpo | Disparador | Link | Estado |
|--------|--------|--------|-----------|------|--------|
| `admin_company_pending` | Nueva empresa pendiente | **{legal_name}** se registró y espera verificación. | `POST /auth/register/company` | `/dashboard/admin?tab=companies` | ⚠️ falta |
| `admin_company_reapplied` | Empresa volvió a solicitar verificación | **{legal_name}** editó sus datos y reaplicó tras un rechazo. | `POST /me/company/verification/reapply` | `/dashboard/admin?tab=companies` | ⚠️ falta |
| `admin_skill_suggested` | Nueva habilidad sugerida | Se sugirió la habilidad **{skill_name}**, esperando aprobación. | candidato/empresa sugiere skill | `/dashboard/admin?tab=skills` | ⚠️ falta |
| `admin_payment_received` | Nuevo pago de destaque | **{legal_name}** pagó un destaque para **{job_title}**. | webhook MP `approved` | `/dashboard/admin` | opcional |

> **Fan-out.** Los eventos de admin no tienen un único destinatario: se resuelven todos
> los `User(role=admin, is_active=true, deleted_at=null)` y se crea una `Notification` por
> cada uno. Encapsulado en `notify_all_admins(...)`.

---

## 3. Taxonomía de tipos (ícono + color)

> El `type` mapea, en el frontend, a un ícono (Heroicons, ya en uso) y a un color de acento.
> Agrupamos por **categoría** para no explotar en variantes visuales.

| Categoría | `type`s | Ícono (Heroicons) | Color acento |
|-----------|---------|-------------------|--------------|
| Postulación (positivo) | `application_new`, `application_in_process`, `application_contacted` | `BriefcaseIcon` / `InboxArrowDownIcon` | teal `#1E8EA3` |
| Postulación (neutro) | `application_discarded`, `job_closed_applied` | `InboxIcon` | muted `#64748B` |
| Verificación (positivo) | `company_verified`, `company_reactivated` | `CheckBadgeIcon` | teal `#1E8EA3` |
| Verificación (negativo) | `company_rejected`, `company_suspended`, `job_takedown` | `ExclamationTriangleIcon` | destructive `#EE4444` |
| Habilidad | `skill_approved`, `skill_rejected` | `SparklesIcon` | secondary `#D4B7A2` |
| Destaque / pago | `job_feature_active`, `job_feature_rejected`, `job_feature_expired`, `admin_payment_received` | `StarIcon` | secondary `#D4B7A2` |
| Admin — moderación | `admin_company_pending`, `admin_company_reapplied`, `admin_skill_suggested` | `BellAlertIcon` | teal `#1E8EA3` |

> Fallback: `type` desconocido → `BellIcon` + muted. Así, si se agrega un tipo nuevo en
> backend antes que el frontend lo mapee, no rompe.

---

## 4. Backend

### 4.1. Cambios en el modelo (`app/models/alerts.py`)

Agregar a `Notification`:

```python
type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="generic")
link: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

- `type` — VARCHAR (coherente con la decisión del proyecto de no usar enums PG).
- `link` — URL **relativa** interna (nunca absoluta) para el click-through.
- `server_default` en `type` para que las filas existentes queden válidas sin backfill.

### 4.2. Migración Alembic

Nueva revisión encadenada a `f4a2b8c3d1e9` (última aplicada):

```
add notification type and link
- add column notifications.type   VARCHAR(50)  NOT NULL DEFAULT 'generic'
- add column notifications.link    VARCHAR(500) NULL
```

Sin backfill de datos (el default cubre lo viejo). Reversible con `drop_column`.

### 4.3. Servicio central — `app/services/notifications.py` (nuevo)

Centraliza la creación y elimina los 5 usos inline de `admin.py`.

```python
async def create_notification(
    db: AsyncSession, *, user_id: UUID, type: str,
    title: str, body: str, link: str | None = None,
) -> Notification: ...

async def notify_all_admins(
    db: AsyncSession, *, type: str, title: str, body: str, link: str | None = None,
) -> None:
    # SELECT users WHERE role=admin AND is_active AND deleted_at IS NULL
    # crea una Notification por cada admin
```

- **No hace `commit`**: se suma a la transacción del endpoint que lo llama (así una
  postulación + su notificación viven en la misma unidad de trabajo — si falla una, falla todo).
- Punto único donde luego se enchufa el **envío de mail** (Resend/Brevo): `create_notification`
  puede aceptar `send_email: bool = False` y encolar sin bloquear.

### 4.4. Cableado de eventos faltantes

| Archivo | Función | Notificación a agregar |
|---------|---------|------------------------|
| `api/v1/applications.py` | `apply_to_job` | `application_new` → dueño de la búsqueda (resolver `company.user_id` vía `job.company_id`) |
| `api/v1/applications.py` | `update_application_status` | según `payload.status`: `in_process` / `contacted` / `discarded` → `candidate.user_id` |
| `api/v1/auth.py` | `register_company` | `notify_all_admins(admin_company_pending)` |
| `api/v1/companies.py` | reapply verificación | `notify_all_admins(admin_company_reapplied)` |
| `api/v1/skills` o `catalogs.py` | sugerir skill | `notify_all_admins(admin_skill_suggested)` |
| `api/v1/admin.py` | aprobar/rechazar skill | `skill_approved` / `skill_rejected` → `skill.created_by_user_id` |
| `api/v1/admin.py` (refactor) | verify/reject/suspend/reactivate/takedown | mismos textos, ahora vía `create_notification` con su `type` y `link` |
| `api/v1/payments.py` (cuando esté MP) | webhook | `job_feature_active` / `job_feature_rejected` + `admin_payment_received` |

> Para `application_new` hay que traer el `user_id` de la empresa dueña. `Application` →
> `JobPosting.company_id` → `CompanyProfile.user_id`. Un `join` o dos selects.

### 4.5. Endpoint nuevo

```
GET /me/notifications/unread-count  →  { "count": <int> }
```

Barato (un `COUNT` con índice sobre `user_id, is_read`). Lo consume el badge del navbar en
cada ciclo de polling sin traer la lista completa.

**Mejoras menores a los endpoints existentes:**
- `GET /me/notifications` — devolver también `type` y `link` en `NotificationResponse`.
- (Opcional) paginación `?limit=&offset=` en vez del `limit(50)` fijo, para el "cargar más".

### 4.6. Índice sugerido

```sql
CREATE INDEX ix_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
```

Sirve tanto al conteo de no-leídas como al listado ordenado. (Va en la misma migración.)

---

## 5. Frontend

### 5.1. Componentes nuevos

```
src/components/notifications/
├── NotificationBell.tsx     # campana + badge + dropdown (client component)
├── NotificationItem.tsx     # fila: ícono por type, título, cuerpo, tiempo relativo
└── notification-config.ts   # map type → { icon, color } + fallback
src/hooks/
└── useNotifications.ts       # fetch lista + unread-count, polling, marcar leídas
```

### 5.2. `useNotifications`

- Estado: `items`, `unreadCount`, `loading`, `open`.
- `fetchUnreadCount()` — llamado por el intervalo de **~45 s** (`setInterval`, limpiado en unmount) y al montar.
- `fetchList()` — al **abrir** la campana y al cambiar de ruta.
- `markRead(id)` / `markAllRead()` — optimistic update del badge.
- Solo activo si `isAuthenticated` (lee `useAuthStore`). Pausar polling si la pestaña está oculta (`document.hidden`) para no gastar en background.

> Se puede implementar como hook local o como slice de Zustand (coherente con `store/auth.ts`).
> Recomendación: hook local que use `api` de `lib/api.ts`; el estado de notificaciones no
> necesita ser global más allá del navbar.

### 5.3. `NotificationBell` — ubicación y estética

- Va en `components/layout/Header.tsx`, en el bloque `isAuthenticated`, **antes** de "Mi Panel".
- **Campana** (`BellIcon`, Heroicons ya instalado) con **badge** teal `#1E8EA3` arriba a la
  derecha mostrando el conteo (`9+` si > 9). Punto sutil con animación `pulse` si hay no-leídas.
- **Dropdown** alineado a la estética del navbar (glassmorphism):
  - `bg-white` con `border border-white` y `shadow-[...]` como el header; `rounded-2xl`.
  - Header del panel: "Notificaciones" + "Marcar todas como leídas".
  - Lista scrolleable (`max-h-[420px] overflow-y-auto`), ítems con:
    - ícono en círculo con el color de acento del `type`,
    - título en `#1C2230` semibold, cuerpo en `#64748B`,
    - **no-leída**: fondo `#E6F4F7` sutil + punto teal a la izquierda,
    - tiempo relativo en español ("hace 5 min", "ayer").
  - Click en ítem → `markRead(id)` + `router.push(link)` si hay `link`.
  - **Empty state**: ícono campana apagada + "No tenés notificaciones".
- **Mobile**: dentro del drawer hamburguesa, una entrada "Notificaciones" con el conteo.

### 5.4. Tiempo relativo

Helper propio en `es` (evitar dependencia pesada). Un `formatRelative(date)` con umbrales:
"recién", "hace N min", "hace N h", "ayer", "hace N d", si no fecha corta. (Revisar si el
proyecto ya tiene `date-fns`/`dayjs` antes de sumar dependencia.)

### 5.5. Deep-links en dashboards

Los paneles son SPAs con tabs. Para que el `link` (`?tab=applications&job=…`) funcione,
cada dashboard debe **leer `searchParams`** y seleccionar la tab / resaltar la entidad al
montar. Enhancement chico pero necesario para el click-through; si no se hace, el link
igual navega al panel (degradación aceptable).

---

## 6. Fases de implementación (checklist)

**Backend**
- [ ] Modelo: agregar `type` + `link` a `Notification`.
- [ ] Migración Alembic (columnas + índice) encadenada a `f4a2b8c3d1e9`.
- [ ] `services/notifications.py` con `create_notification` + `notify_all_admins`.
- [ ] Refactor de los 5 usos inline de `admin.py` → servicio (con `type` + `link`).
- [ ] Cablear eventos faltantes (apply, status, registro empresa, reapply, skills).
- [ ] `GET /me/notifications/unread-count`.
- [ ] Exponer `type` + `link` en `NotificationResponse`.

**Frontend**
- [ ] `notification-config.ts` (map type → ícono/color).
- [ ] `useNotifications` (fetch + polling 45 s + marcar leídas).
- [ ] `NotificationItem` + helper de tiempo relativo.
- [ ] `NotificationBell` en el Header (desktop + mobile drawer).
- [ ] Deep-links: leer `searchParams` en los 3 dashboards.

**Verificación**
- [ ] Postularse como candidato → la empresa ve el badge subir y la notificación.
- [ ] Cambiar estado de postulación → el candidato la recibe (menos en `seen`).
- [ ] Registrar empresa → todos los admins la reciben.
- [ ] Marcar leída / marcar todas → el badge baja y persiste tras refresh.

---

## 7. Fuera de alcance (Fase 2)

- **Tiempo real** (SSE/WebSocket) — en F1 es polling.
- **Envío por mail** acoplado — la estructura queda lista (`create_notification` es el punto
  de enganche), pero el disparo real espera la API key de Resend/Brevo.
- **Alertas de empleo** (`JobAlert`) por mail — job programado, ya modelado, es F2.
- **Preferencias de notificación** por usuario (silenciar categorías) — F2.
- **Notificaciones de tests psicométricos** — la UI de tests es F2.
- **Agrupación / digest** ("3 nuevas postulaciones") — F2 si el volumen lo pide.

---

## 8. Decisiones registradas

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Enriquecer modelo | `type` + `link` (VARCHAR) | Íconos por categoría + click-through, base de una campana funcional. |
| Enum vs varchar | VARCHAR | Coherente con el resto del proyecto (sin PG enums). |
| Entrega frontend | Polling ~45 s + al abrir/navegar | Simple y robusto para el MVP; real-time es F2. |
| Notificar `seen` | No | Vista automática y ruidosa; solo transiciones reales. |
| Notificaciones admin | Fan-out (1 por admin) | No hay inbox compartido; cada admin ve su badge. |
| Commit del servicio | No commitea | Vive en la transacción del endpoint (atomicidad evento+notificación). |
| Mail | Desacoplado, enganche listo | No bloquear in-app por falta de API key. |

---

*Documento del módulo de notificaciones — Paso 8.*
*Decisiones validadas con el usuario antes de redactar.*
