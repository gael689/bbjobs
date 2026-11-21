# Fase 1.5 — Filtros, datos demográficos y seguimiento

> Plan acordado tras la reunión con Eugenia. Amplía filtros y datos en los tres paneles
> (empresa, admin/Talency, candidato), con impacto transversal en notificaciones y en la
> capa visual (paleta BBJobs).

## Estado de implementación
- [x] **Bloque A — Fundación de datos del candidato** (2026-07-15): modelo, schemas, migración
      `c8f4b2a1d9e3` aplicada, UI de "Datos personales" en el perfil, badges nuevos visibles en
      el modal de la empresa. Detalle en `AUDITORIA-2026-07-15.md`.
- [x] **Bloque B — perfil completo** (2026-07-15): `compute_profile_completion` (13 ítems, peso
      igual), migración `e1a9c7d4f2b8` (`last_completion_reminder_at`), anillo
      `ProfileCompletionRing` en perfil candidato + lista y modal de la empresa, notificación
      `profile_incomplete` con throttle de 7 días tras postularse. El % en las listas del panel
      admin se sumó en el Bloque H.
- [x] **Bloque C — skills de catálogo** (2026-07-15): nuevo `GET /me/candidate/skills` (faltaba
      un endpoint para listar), selector de skills en perfil candidato (sin botón "sugerir") y
      selector real (requisito/deseable) en "Publicar búsqueda" (antes mandaba `skills: []`
      hardcodeado). El límite de 300 car. de `summary` ya había quedado resuelto en el Bloque A.
- [x] **Bloque D — ocultar "Skills pendientes"** (2026-07-15): sacado del nav admin y la ruta
      `dashboard/admin/skills/page.tsx` eliminada. Backend de sugerencias intacto, sin uso.
- [x] **Bloque E — filtros+stats empresa** (2026-07-15): `GET /me/company/jobs/{id}/applications`
      suma filtros (edad, sexo, movilidad, disponibilidad) vía join (elimina el N+1 que traía el
      candidato aparte); nuevos `GET /me/company/jobs/{id}/applications/stats` y
      `GET /me/company/applications/stats` (agregado global) con `compute_applicant_stats`
      (edad promedio, años de experiencia promedio, distribución de títulos, movilidad).
      Barra de filtros + panel de stats en `postulaciones`, agregado global en `estadisticas`.
- [x] **Bloque F — vencimiento de búsquedas** (2026-07-15): `JobPosting.duration_days`
      (1-20, default 20) + `expires_at`, migración `f7b3d8a2c1e5` con backfill (jobs existentes
      = 20 días desde `published_at`, si no desaparecían del portal). Nuevo estado `expired`
      (terminal, igual que `closed`). Tarea horaria `expire_jobs()` en el scheduler + notificación
      a la empresa. Selector de duración (slider) en "Publicar búsqueda", editable después vía
      `duration_days` en el update. Badge de cuenta regresiva (`ExpiryBadge`: teal >5d, ámbar
      ≤5d, rojo vencida) en `estadisticas` (empresa) y `busquedas` (admin).
- [x] **Bloque G — moderación admin (barrera dura)** (2026-07-15): `JobPosting.moderation_status`
      (pending_review/approved/rejected, ortogonal a `status`) + `moderation_notes`/
      `moderated_by_admin_id`/`moderated_at`. Migración `a2c9e4f1b6d3` con backfill (jobs
      existentes = `approved`, si no desaparecían del portal con este mismo deploy). Toda
      búsqueda nueva nace `pending_review` y notifica a los admins; `/jobs`, `/jobs/{id}`,
      `/jobs/suggest` y `POST /jobs/{id}/apply` exigen `moderation_status==approved` (el perfil
      público de empresa hereda el filtro porque reusa `/jobs`). Nuevo
      `PATCH /admin/jobs/{id}/moderate` (approve/reject + notas) con notificación a la empresa y
      `AuditLog`. `pending_jobs` sumado a `/admin/dashboard`. UI: pestaña de pendientes +
      aprobar/rechazar en `dashboard/admin/busquedas` (mismo patrón que verificación de
      empresas); "Publicar búsqueda" avisa que queda pendiente de revisión; `estadisticas`
      (empresa) muestra el badge de estado. **Cambia el guion de demo** — ver nota abajo.
- [x] **Bloque H — filtros+drill-down admin** (2026-07-15): `GET /admin/candidates` suma filtros
      (texto, edad, sexo, movilidad, disponibilidad, zona, tiene CV, título alcanzado derivado) y
      `completion_percent` (quedaba pendiente del Bloque B). Refactor: `get_candidate_full_profile`
      partido en un `build_candidate_full_profile()` reusable — lo llama tanto la empresa (con su
      chequeo de "se postuló a mi búsqueda") como el nuevo `GET /admin/candidates/{id}` (sin
      restricción). Nuevos `GET /admin/companies/{id}/jobs` y `GET /admin/jobs/{id}/applications`
      (reusa los schemas de `applications.py`). UI: barra de filtros + anillo de % en
      `admin/candidatos` (con modal de perfil completo); fila de empresa expandible en
      `admin/empresas` → sus búsquedas → sus postulantes.
- [x] **Bloque I — historial** (2026-07-15): tablas nuevas `application_status_history` y
      `candidate_activity_log` (migración `d5e8f3a7c2b1`, sin backfill posible — arrancan vacías).
      Se registra en `apply_to_job`/`update_application_status` (postulaciones) y en
      `update_my_candidate_profile`/`upload_cv`/`add_experience`/`add_education`/`add_skill`/
      `add_language` (actividad del candidato). Nuevos `GET /me/candidate/applications/{id}/history`
      (candidato), `GET /admin/candidates/{id}/activity` y `GET /admin/applications/{id}/history`
      (admin). UI: timeline expandible por postulación en "Mis postulaciones"; sección "Actividad
      reciente" en el modal de perfil de `admin/candidatos`.
- [x] **Bloque J — pulido visual/notificaciones** (2026-07-15): cerró el único ítem pendiente de
      notificaciones (`job_expiring_soon`, mencionado como "opcional" en el Bloque F) — columna
      `expiring_soon_notified_at` (migración `b4c7e1a9f3d6`) + tarea horaria
      `notify_expiring_soon()` en el scheduler, aviso único cuando faltan ≤3 días. Revisión de
      consistencia de paleta en las ~15 páginas tocadas durante la Fase 1.5: sin colores fuera de
      los tokens oficiales.

## Plan Fase 1.5 completo (A→J) — 2026-07-15

Los diez bloques del plan quedaron implementados, verificados (`tsc`, `lint`, import de FastAPI,
migraciones aplicadas contra Railway) y documentados en `AUDITORIA-2026-07-15.md`. Pendientes
reales que **no** forman parte de este plan pero surgieron durante la implementación:
- Definir si se elimina del todo el backend de sugerencia de skills (`POST /skills/suggest` y
  afines) o se reusa como gestor de catálogo (ver §7b).
- Hablar con Eugenia sobre la cadencia de revisión de la cola de búsquedas pendientes (Bloque G).

## Decisiones tomadas
1. **Moderación de búsquedas: barrera dura.** Toda búsqueda nueva nace pendiente y NO
   aparece en el portal hasta que un admin la apruebe. → Cambia la demo: actualizar
   `FASE1-BBJOBS-REPASO.md` y `REUNION-EUGENIA-FASE1.md` (ya no "aparece al instante").
2. **Título y años de experiencia: derivados.** No se agregan columnas; se calculan desde
   `educations` (nivel máximo) y `experiences` (suma de períodos).
3. **Datos nuevos del candidato: opcionales/progresivos.** Todo nullable, sin fricción en
   onboarding, sin migrar perfiles existentes. Filtros tratan "sin dato" aparte. Indicador
   de % de perfil completo para incentivar la carga.
4. **Skills: sin sugerencias de usuario, solo catálogo.** Lo que no esté en el catálogo va al
   CV o a la descripción personal. → **La pantalla admin "Skills pendientes" se oculta/da de
   baja** (confirmado, no es una decisión pendiente): sin flujo que la alimente, dejarla visible
   solo genera la falsa impresión de que hay algo para revisar. Ver §7b.

---

## 0. Fundación de datos — `CandidateProfile` (`models/candidate.py`) ✅ implementado 2026-07-15
| Campo | Tipo | Nota |
|---|---|---|
| `gender` | enum `Gender` (masculino/femenino/otro/no_declara) | hoy `String(50)` libre → normalizar |
| `birth_date` | ya existe | fuente de la **edad** (se deriva, no se guarda el número) |
| `has_own_transport` | `bool \| None` | movilidad SÍ/NO/(sin dato) |
| `availability` | enum `Availability` (full_time/part_time/ambos) `\| None` | |
| `immediate_availability` | `bool \| None` | disponibilidad inmediata |

- **NO** se agrega `highest_education_level` (se deriva de `educations`).
- Reflejar en `schemas/candidate.py` (`CandidateProfileUpdate`/`Response`/`CandidateFullProfile`),
  onboarding (`schemas/onboarding.py` opcional) y UI de perfil.
- Edad = date-math sobre `birth_date` (cutoffs de fecha para rangos, no `date_part` por fila).

## 1. Panel Empresa ✅ implementado 2026-07-15
- **Filtros de postulantes** en `GET /me/company/jobs/{id}/applications`: `age_min`, `age_max`,
  `gender`, `has_own_transport`, `availability`, `immediate_availability`. Implementar con
  `join` Application→CandidateProfile (elimina el N+1 actual, `applications.py` L131-135).
- Enriquecer `ApplicationWithCandidateResponse` con edad/sexo/movilidad/disponibilidad → badges por postulante + barra de filtros.
- **Estadísticas**: nuevo `GET /me/company/jobs/{id}/applications/stats` + agregado global en
  `dashboard/company/estadisticas`: promedio de edad, distribución de títulos (derivada de
  educations), promedio de años de experiencia (derivado de experiences), reparto por
  movilidad/disponibilidad. Mini-barras/donut en paleta teal.

## 2. Vencimiento de búsquedas (20 días) ✅ implementado 2026-07-15
- `JobPosting`: `expires_at` (+ opcional `duration_days`). `JobPostingCreate.duration_days`
  rango **[1,20], default 20**. `expires_at = published_at + duration_days`. Editable a menos.
- Nuevo valor `expired` en `JobPostingStatus` (campo `String`, sin enum de DB).
- Scheduler: `expire_jobs()` horaria (calcar `check_expired_features`) → `expired` + notifica.
  Opcional: aviso "vence en 3 días". El listado público ya filtra `status==active`.
- Badge de cuenta regresiva (teal >5d, ámbar ≤3d, rojo vencido) en panel empresa y admin.

## 3. Panel Admin (Talency)
- **Moderación (barrera dura) ✅ implementado 2026-07-15** — columna `moderation_status` (pending_review/approved/rejected)
  + `moderation_notes`/`moderated_by_admin_id`/`moderated_at`, ortogonal a `status`.
  - Crear búsqueda → `pending_review` + `notify_all_admins`.
  - Visibilidad pública requiere `moderation_status==approved`: tocar `/jobs`, `/jobs/{id}`,
    `/jobs/suggest` y jobs del perfil público de empresa.
  - `PATCH /admin/jobs/{id}/moderate` {approve/reject, notes} → notifica a la empresa + `AuditLog`.
  - Métrica `pending_jobs` en dashboard + pestaña/filtro en `dashboard/admin/busquedas`.
- **Filtros de candidatos y drill-down ✅ implementado 2026-07-15** en `GET /admin/candidates`:
  demográficos + título (derivado) + zona + tiene CV + texto. `CandidateAdminResponse` enriquecido
  + barra de filtros en `admin/candidatos`.
- **Drill-down**: `GET /admin/companies/{id}/jobs`, `GET /admin/jobs/{id}/applications`,
  `GET /admin/candidates/{id}` (perfil completo; el historial queda para el Bloque I). UI: empresa
  expandible → búsquedas → postulantes en `admin/empresas`.

## 4. Historial del candidato (tablas nuevas) ✅ implementado 2026-07-15
- **`application_status_history`** (application_id, from_status, to_status, changed_by, created_at)
  — escribir en `update_application_status`. Timeline en "Mis postulaciones" y detalle admin.
- **`candidate_activity_log`** (candidate_id, event_type, resumen, created_at) — escribir al
  editar perfil / subir CV / agregar experiencia·educación·skill·idioma / postularse. Detalle admin
  (y opcional vista propia del candidato).
- El `AuditLog` actual queda para acciones de admin.

## 5. Notificaciones (nuevos tipos)
- A admins: `job_pending_review`.
- A empresa: `job_approved`, `job_rejected`, `job_expiring_soon`, `job_expired`.
- A candidato: `profile_incomplete` (recordatorio de completar perfil — ver §7).
- Actualizar mapa tipo→ícono/color en `NotificationItem.tsx`.

## 6. Capa visual (paleta)
- Badges reutilizables: sexo, disponibilidad (Inmediata en secundario `#D4B7A2`), movilidad, edad,
  nivel educativo, estado de moderación (ámbar/verde/rojo estilo `VERIF_CLS`), cuenta regresiva.
- Barras de filtro consistentes (`border-[#DDE3EC]`, `rounded-xl`, focus `#1E8EA3`).
- Extender `dashboard/admin/types.ts` con enums/labels/clases nuevos.
- Indicador de % de perfil completo en panel candidato.

## 7. Perfil completo del candidato — incentivo a completar ✅ implementado 2026-07-15
**Un solo cálculo en el backend** (fuente de verdad, para que candidato y empresa vean lo mismo).

- **Helper** `compute_profile_completion(profile, experiences, educations, skills, languages)`
  → `{ percent: int, missing: [ {key, label, link} ] }`. Ítems ponderados, ej.:
  básicos (nombre/apellido/teléfono, ya obligatorios), foto, fecha de nacimiento, sexo,
  zona, movilidad, disponibilidad, descripción personal (`summary`, ≤300), preferencia de
  modalidad, CV, ≥1 experiencia, ≥1 educación, ≥1 skill (del catálogo), ≥1 idioma.
  Ajustar pesos para que "básico + CV + 1 exp + 1 edu" ya dé un valor decente y el 100%
  exija todo.
- **Exponer `completion_percent` (+ `missing`)** en `GET /me/candidate/profile` (con la lista
  de faltantes), y **solo `completion_percent`** en `CandidateFullProfile`/`CandidateSummary`
  (vista empresa) y en las respuestas admin.
- **Anillo circular** (SVG `stroke-dasharray`, número al centro), color por umbral:
  0-39% rojo (`#EF4444`), 40-69% ámbar (`#F59E0B`), 70-99% teal (`#1E8EA3`), **100% verde
  (`#16A34A`)**. Componente reutilizable `ProfileCompletionRing`.
- **Vista candidato** (`dashboard/candidate/perfil` + home del panel): anillo prominente +
  checklist de faltantes con links a cada sección + CTA "Completá tu perfil". Callout honesto:
  *"Las empresas ven que tu perfil está incompleto — completalo para destacar"*; al 100% pasa
  a estado verde positivo (*"¡Perfil completo!"*).
- **Vista empresa** (modal de perfil en `company/postulaciones`, listas admin): anillo/badge
  con el %; si <100%, nota sutil "Perfil X% completo".
- **Notificación de incentivo** `profile_incomplete`: recordatorio con los faltantes principales
  y link al perfil. Disparo contextual (ej. tras postularse si <100%) y/o tarea periódica en el
  scheduler, con **throttle** vía `last_completion_reminder_at` en `candidate_profiles` para no
  spamear (ej. máx. 1 cada X días; no enviar al 100%).

## 7b. Skills (solo catálogo) y descripción personal ✅ implementado 2026-07-15
Decisión: **se descarta que el usuario sugiera skills nuevas.** El candidato solo elige de las
skills ya cargadas (catálogo gestionado por admin/seed). Lo que no esté, va en el CV o en la
descripción personal.

- **Selector de skills (candidato)** en `dashboard/candidate/perfil`: busca en `GET /skills`
  (activas), elige con nivel → `POST /me/candidate/skills`; quitar → `DELETE /me/candidate/skills/{id}`.
  **Sin** botón "sugerir". (Backend ya listo — hoy no hay UI: falta implementarla.)
- **Selector de skills (publicar búsqueda)** en `company/publicar`: mismo picker alimentando el
  array `skills` (hoy va `[]` hardcodeado; el `create` del backend ya lo soporta).
- **Descripción personal** — reutiliza el campo `summary` (ya existe en `CandidateProfile`, ya se
  muestra a la empresa como "Sobre el candidato"). Textarea en el perfil con **contador y límite
  de 300 caracteres** (validar en Pydantic `max_length=300` y en la UI). Entra en el % de perfil.
- **Confirmado: ocultar "Skills pendientes".** Sin flujo de sugerencia, esa pantalla y las
  notificaciones `admin_skill_suggested`/`skill_approved`/`skill_rejected` quedan sin uso.
  Al implementar:
  - Sacar el ítem "Skills pendientes" de `dashboard/admin/layout.tsx` (nav) y la ruta
    `dashboard/admin/skills/page.tsx` (eliminar o dejar 410/redirect si se prefiere no romper
    bookmarks).
  - Quitar `pending_skills`-like de cualquier métrica del dashboard admin si se llegara a sumar.
  - **No** se toca el backend (`POST /skills/suggest`, `GET /admin/skills/pending`,
    `PATCH /admin/skills/{id}`, modelo `Skill.status/created_by_user_id/approved_by_admin_id`):
    nadie los llama desde el frontend hoy, así que no rompen nada al quedar sin uso; se
    eliminan en una limpieza aparte si en el futuro se confirma que no se van a reusar
    (ej. como gestor de catálogo para el admin).

## 8. Migraciones Alembic (con backfill crítico)
1. `candidate_profiles`: campos nuevos + normalizar `gender` + `last_completion_reminder_at`.
2. `job_postings`: `expires_at`, `moderation_status`, etc. → **backfill**: existentes = `approved`
   y `expires_at = published_at + 20d` (si no, desaparecen del portal).
3. Tablas `application_status_history`, `candidate_activity_log`.

## 9. Orden de implementación
A. Datos candidato → B. **perfil completo (anillo + cálculo + incentivo)** → C. skills (selector
candidato + publicar búsqueda) y descripción personal (300 car.) → D. ocultar "Skills pendientes"
→ E. filtros+stats empresa → F. vencimiento → G. moderación admin → H. filtros+drill-down admin →
I. historial → J. pulido visual/notificaciones.
