# Auditoría del sistema — 2026-07-15

> Relevamiento técnico hecho al iniciar esta sesión de trabajo (comando `/init`, revisión de
> `CLAUDE.md`, y planeamiento de la Fase 1.5 tras la reunión con Eugenia). Sirve como punto de
> referencia para hacer seguimiento de lo que cambia a partir de hoy.

---

## 1. Estado del repo al momento de la auditoría

**`CLAUDE.md` estaba desactualizado.** Describía un backend "planeado pero no implementado" con
JWT propio + Cloudflare R2 + Resend, cuando en realidad:

- El **backend está completamente implementado**: FastAPI + PostgreSQL + SQLAlchemy 2.x async +
  Alembic (8 migraciones aplicadas), ~18 routers bajo `/api/v1`.
- **Auth migrada a Clerk** — no existe router de login/refresh propio. `app/api/deps.py` verifica
  el JWT de sesión de Clerk y resuelve el `User` local por `clerk_user_id`; si no existe, exige
  onboarding (`POST /me/onboarding/candidate` o `/company`) para crearlo (JIT). Documentado
  también en `docs/planning/backend/09-migracion-clerk-auth.md` (el único doc de planning que
  sí estaba al día).
- **Storage migrado a Cloudinary** — `integrations/r2.py` fue eliminado; CVs (PDF) y logos van a
  Cloudinary.
- **Sin proveedor de email** — `services/email.py` e `integrations/resend_client.py` fueron
  eliminados y **nada los reemplazó**. `.env.example` y `ESTADO.md` todavía mencionan
  `RESEND_API_KEY`, pero ningún código lo consume. No hay verificación de cuenta ni recupero de
  contraseña por mail (tampoco hace falta: Clerk maneja credenciales).
- **Frontend**: login/registro son rutas catch-all de Clerk (`login/[[...rest]]`,
  `register/[[...rest]]`), no las páginas custom que describía el `CLAUDE.md` viejo. El cliente
  axios (`lib/api.ts`) ya no usa cookies de refresh — usa un `setTokenGetter` conectado a
  `useAuth().getToken()` de Clerk. El store de Zustand para auth (`store/auth.ts`) **ya no
  existe** (aunque `zustand` sigue en `package.json`, sin uso).
- Módulos nuevos no documentados: `contacto/` (público), `dashboard/admin/mensajes/` (bandeja de
  contacto), modelo/schema/router `contact.py`, migraciones de `contact_messages` y de cascada
  FK job↔company.
- **Sin suite de tests** — `backend/tests/__init__.py` existe pero vacío; `pytest` ni siquiera es
  dependencia declarada.

**Acción tomada:** se reescribió `CLAUDE.md` reflejando lo anterior (comandos reales de dev,
arquitectura de auth con Clerk + RLS, integraciones vigentes, estructura real del frontend). Se
dejó indicado que `FASE1-BBJOBS-REPASO.md` es la fuente de verdad de estado por sobre
`docs/planning/`, `ESTADO.md` y `README.md` (desactualizados en las partes de auth/storage/mail).

## 2. Funcionalidad "Skills sugeridas" — verificada como no conectada

Se auditó específicamente si el flujo de sugerencia de skills (admin aprueba/rechaza) estaba
implementado:

| Pieza | Estado |
|---|---|
| Modelo `Skill` (`status`, `created_by_user_id`, `approved_by_admin_id`) | ✅ existe |
| `POST /skills/suggest` (crea skill `pending`, notifica a todos los admins) | ✅ existe |
| `GET /admin/skills/pending` + `PATCH /admin/skills/{id}` (aprobar/rechazar) | ✅ existe |
| Página `dashboard/admin/skills/page.tsx` (lista + aprobar/rechazar) | ✅ existe y funciona |
| `POST /me/candidate/skills` / `DELETE .../{id}` (asignar skill del catálogo al perfil) | ✅ existe |
| **UI de selector de skills en el perfil del candidato** | ❌ no existe (cero referencias) |
| **UI de selector de skills al publicar búsqueda** (`company/publicar`) | ❌ no existe — manda `skills: []` hardcodeado |
| Cualquier llamado a `POST /skills/suggest` desde el frontend | ❌ no existe |

**Conclusión:** el circuito de aprobación del admin es funcional pero está **desconectado en
origen** — nadie puede sugerir ni asignar skills desde la UI, así que "Skills pendientes" siempre
está vacía y la sección "Habilidades" del perfil visto por la empresa nunca tiene datos.

**Decisión tomada con el usuario:** no se va a habilitar que un usuario sugiera skills nuevas
(si no está en el catálogo, va al CV o a la descripción personal). Se va a construir el selector
de skills **solo sobre el catálogo existente** (candidato y publicar búsqueda), y la pantalla
"Skills pendientes" del admin se **oculta/da de baja** por no tener flujo que la alimente. El
backend de sugerencias (`POST /skills/suggest`, `GET/PATCH /admin/skills/...`) no se toca por
ahora — queda sin uso, no roto.

## 3. Planeamiento derivado de la reunión con Eugenia (Fase 1.5)

A partir de los pedidos de la reunión (más filtros y datos para empresa/admin/candidato) se armó
`FASE1.5-FILTROS-PLAN.md` con:

- Nuevos datos demográficos y de disponibilidad en `CandidateProfile` (sexo, movilidad,
  disponibilidad full/part-time, disponibilidad inmediata) — **opcionales/progresivos**.
- Título alcanzado y años de experiencia **derivados** de `educations`/`experiences` (sin
  columnas nuevas).
- Filtros de postulantes y estadísticas en el panel empresa.
- Vencimiento de búsquedas a 20 días (editable a menos), con tarea de scheduler.
- **Moderación de TODAS las búsquedas por Talency — barrera dura**: nace `pending_review`, no
  aparece en el portal hasta aprobación de un admin. *(Cambia el guion de demo — pendiente
  actualizar `FASE1-BBJOBS-REPASO.md`/`REUNION-EUGENIA-FASE1.md`.)*
- Filtros de candidatos y drill-down empresa→búsquedas→postulaciones en el panel admin.
- Historial de postulaciones y de actividad del candidato (tablas nuevas).
- **% de perfil completo**: cálculo único en backend, anillo circular con color por umbral
  (rojo/ámbar/teal/verde a 100%), visible para candidato y empresa, con notificación de
  incentivo (throttled).
- Selector de skills de catálogo (candidato + publicar búsqueda) y descripción personal
  (`summary`, límite 300 caracteres) como reemplazo de "sugerir skills".
- Baja de la pantalla "Skills pendientes" (ver §2).

El detalle completo, con el orden de implementación sugerido (A→J), está en
`FASE1.5-FILTROS-PLAN.md`.

---

## 4. Bloque A implementado — 2026-07-15

**Backend**
- `app/models/candidate.py`: nuevos enums `Gender` (masculino/femenino/otro/no_declara) y
  `Availability` (full_time/part_time/ambos). `CandidateProfile.gender` pasa de texto libre a
  tipado por `Gender`. Nuevas columnas nullable: `has_own_transport` (bool), `availability`
  (Availability), `immediate_availability` (bool).
- `app/schemas/candidate.py`: `CandidateProfileUpdate`/`Response` suman los 3 campos nuevos +
  `gender` tipado. Se agregó `calculate_age()` (deriva edad de `birth_date`, no se persiste).
  `summary` ahora valida `max_length=300` a nivel Pydantic. `CandidateFullProfile` (vista
  empresa) suma `age`, `gender`, `has_own_transport`, `availability`, `immediate_availability`.
- `app/api/v1/applications.py`: `get_candidate_full_profile` calcula la edad y pasa los campos
  nuevos al armar `CandidateFullProfile`.
- Migración `c8f4b2a1d9e3_add_candidate_availability_fields` — **aplicada contra la base de
  Railway** (`alembic upgrade head` corrido y verificado con `alembic current`). Sin backfill:
  `gender` ya era texto libre y quedaba nullable, así que no hay filas que migrar.
- Verificado: `python -c "from app.main import app"` importa sin errores (22 rutas cargadas).

**Frontend**
- `dashboard/candidate/types.ts`: tipos `Gender`/`Availability`, labels (`GENDER_LABEL`,
  `AVAILABILITY_LABEL`), `SUMMARY_MAX_LENGTH=300`, y los campos nuevos en `CandidateProfile`.
- `dashboard/candidate/perfil/page.tsx`: nueva sección "Datos personales" (fecha de nacimiento,
  sexo, movilidad propia con tri-estado sí/no/sin especificar, disponibilidad, disponibilidad
  inmediata, descripción personal con contador 0/300) con guardado propio vía
  `PATCH /me/candidate/profile`.
- `dashboard/company/types.ts` + `dashboard/company/postulaciones/page.tsx`: el modal de perfil
  completo que ve la empresa ahora muestra badges de edad, sexo, movilidad y disponibilidad
  (disponibilidad inmediata destacada en el secundario `#D4B7A2` de la paleta).
- **Bug preexistente corregido de paso**: los selects de nivel educativo e idioma en el perfil
  del candidato mandaban valores en inglés (`"secondary"`, `"basic"`, etc.) que no matcheaban
  los enums Pydantic en español (`EducationLevel`/`LanguageLevel`) — el backend los habría
  rechazado con 422. Se corrigieron los `value` de los `<option>` y los estados default/reset
  a los valores reales (`secundario`, `básico`, etc.). También se sacó la opción "Primario", que
  no existe en `EducationLevel` del backend.
- Verificado: `tsc --noEmit` sin errores, `npm run lint` sin errores nuevos (solo 2 warnings
  preexistentes de `<img>` sin relación).

**No incluido en este bloque (queda para bloques siguientes del plan):**
selectores de skills, anillo de % de perfil completo, filtros de postulantes por parte de la
empresa, historial de actividad.

---

## 5. Bloque B implementado — 2026-07-15

**Backend**
- `app/services/profile_completion.py` (nuevo): `compute_profile_completion()` — 13 ítems de
  igual peso (foto, fecha de nacimiento, sexo, zona, movilidad, disponibilidad, descripción
  personal, preferencia de modalidad, CV, experiencia, educación, skills, idiomas) →
  `{percent, missing}`. `compute_profile_completion_for_candidate()` resuelve los booleanos con
  queries `LIMIT 1` (sin traer las listas completas) para los llamadores que no las necesitan.
  `should_send_completion_reminder()` — throttle de `REMINDER_MIN_INTERVAL_DAYS = 7`.
- `app/models/candidate.py`: columna `last_completion_reminder_at` (nullable).
- Migración `e1a9c7d4f2b8_add_candidate_completion_reminder` — aplicada contra Railway.
- `app/schemas/candidate.py`: `ProfileMissingItem`, `CandidateProfileResponse` suma
  `completion_percent`/`missing_fields`, `CandidateFullProfile` suma `completion_percent`.
- `app/api/v1/candidates.py`: `GET/PATCH /me/candidate/profile` y `POST /me/candidate/cv`
  devuelven el % vía un helper común `_build_profile_response`.
- `app/api/v1/applications.py`: `get_candidate_full_profile` (vista empresa) y
  `list_job_applications` (lista de postulantes, `CandidateSummary.completion_percent`) exponen
  el mismo %. `apply_to_job` dispara la notificación `profile_incomplete` (con throttle) cuando
  el candidato se postula con el perfil incompleto.
- Verificado: import de la app OK, migración en `head`.

**Frontend**
- `components/ui/ProfileCompletionRing.tsx` (nuevo): anillo SVG reutilizable, color por umbral
  (rojo <40%, ámbar 40-69%, teal 70-99%, verde 100%).
- `dashboard/candidate/perfil/page.tsx`: card con el anillo grande + mensaje ("¡Perfil
  completo!" en verde al 100%, o checklist de lo que falta + aviso de que las empresas ven el
  perfil incompleto) arriba de "Datos personales".
- `dashboard/company/postulaciones/page.tsx`: anillo chico en cada fila de postulante y anillo
  mediano en el modal de perfil completo (con nota "Perfil X% completo" si es <100%).
- `components/notifications/notification-config.ts`: ícono/color para `profile_incomplete`.
- Verificado: `tsc --noEmit` y `npm run lint` sin errores nuevos.

**No incluido todavía:** el % en las listas del panel admin (se suma en el Bloque H, cuando se
construya el drill-down admin→candidatos, para no duplicar trabajo).

---

## 6. Bloques C y D implementados — 2026-07-15

**Bloque C — skills de catálogo**

- **Gap encontrado y cerrado:** no existía ningún endpoint para que el candidato viera sus
  propias skills cargadas (`POST`/`DELETE /me/candidate/skills` ya estaban, pero no el `GET`).
  Se agregó `GET /me/candidate/skills` (`app/api/v1/candidates.py`), con un schema inline
  `CandidateSkillWithName` que hace join con `Skill` para devolver el nombre (el
  `CandidateSkillResponse` original sólo tenía `skill_id` + `level`, sin nombre).
- `dashboard/candidate/perfil/page.tsx`: nueva sección "Habilidades" — selector sobre el
  catálogo (`GET /skills`, sólo activas), sin botón "sugerir"; texto explícito: *"¿No encontrás
  tu habilidad? Contala en tu descripción personal o en el CV."* Alta vía
  `POST /me/candidate/skills`, baja vía `DELETE .../{skill_id}`.
- `dashboard/company/publicar/page.tsx`: reemplazado el `skills: []` hardcodeado por un picker
  real sobre `GET /skills`, con toggle por skill entre "Requisito" y "Deseable"
  (`JobPostingSkillCreate.is_required`, ya soportado por el backend).
- El límite de 300 caracteres en `summary` (descripción personal) ya había quedado resuelto en
  el Bloque A — no requirió cambios acá.

**Bloque D — baja de "Skills pendientes"**

- `dashboard/admin/layout.tsx`: sacado el ítem de navegación "Skills pendientes".
- `dashboard/admin/skills/page.tsx`: **eliminado** (era código muerto sin flujo que lo
  alimentara — ver §2). Confirmado con `git status` que el archivo estaba trackeado, así que la
  baja es reversible vía git si hiciera falta.
- **No se tocó el backend**: `POST /skills/suggest`, `GET /admin/skills/pending`,
  `PATCH /admin/skills/{id}` y las notificaciones `admin_skill_suggested`/`skill_approved`/
  `skill_rejected` siguen existiendo, simplemente sin nada que los llame desde el frontend.
  Decisión pendiente para más adelante: eliminarlos del todo o reusarlos como gestor de catálogo
  para el admin (ver checklist en §7).

**Verificación:** `tsc --noEmit` y `npm run lint` sin errores (sólo los 2 warnings preexistentes
de `<img>`, sin relación); `python -c "from app.main import app"` importa las 22 rutas sin
error; `alembic current` en `head` (`e1a9c7d4f2b8`).

---

## 7. Pendientes de seguimiento para próximas sesiones

- [x] Implementar bloque A (datos del candidato) del plan Fase 1.5 — ver §4.
- [x] Implementar bloque B (% de perfil completo) — ver §5.
- [x] Implementar bloque C (skills de catálogo + descripción personal) — ver §6.
- [x] Ocultar/dar de baja la pantalla "Skills pendientes" en el admin (bloque D) — ver §6.
- [x] Implementar bloque E (filtros + estadísticas de postulantes en el panel empresa) — ver §8.
- [x] Implementar bloque F (vencimiento de búsquedas a 20 días) — ver §9.
- [x] Implementar bloque G (moderación de búsquedas por Talency — barrera dura) — ver §10.
- [x] Implementar bloque H (filtros + drill-down en el panel admin, incluye el % de perfil
      completo en las listas de candidatos del admin, pendiente desde el bloque B) — ver §11.
- [x] Implementar bloque I (historial de postulaciones y de actividad del candidato) — ver §12.
- [x] Implementar bloque J (pulido visual/notificaciones restante) — ver §13. **Plan Fase 1.5
      completo (A→J).**
- [x] Actualizar `FASE1-BBJOBS-REPASO.md` y `REUNION-EUGENIA-FASE1.md` con la moderación de
      búsquedas (barrera dura, bloque G) — ver §10.
- [ ] Revisar si conviene eliminar del todo el backend de sugerencia de skills
      (`POST /skills/suggest`, `GET/PATCH /admin/skills/...`) o reusarlo como gestor de catálogo.
- [ ] Hablar con Eugenia sobre la cadencia de revisión de la cola de búsquedas pendientes —
      quedó anotado en `REUNION-EUGENIA-FASE1.md` como algo a definir con ella.

---

## 8. Bloque E implementado — 2026-07-15

**Backend**
- `app/services/applicant_stats.py` (nuevo): `compute_applicant_stats(db, candidate_ids)` —
  agregado sobre un conjunto de postulaciones (cuenta postulaciones, no candidatos únicos, mismo
  criterio que el resto del panel de estadísticas). Devuelve `ApplicantStats`: `total`, `avg_age`,
  `avg_experience_years` (suma de períodos de `Experience` / 365.25), `education_distribution`
  (nivel máximo por candidato, mismo ranking que usa el buscador público en `jobs.py`), `mobility`
  (`yes`/`no`/`unknown`), `availability`, `immediate_availability_count`.
- `app/api/v1/applications.py`:
  - `GET /me/company/jobs/{id}/applications` — sumó filtros `age_min`, `age_max`, `gender`,
    `has_own_transport`, `availability`, `immediate_availability`. Se reescribió con un
    `join(Application, CandidateProfile)` en la query principal, eliminando el SELECT-por-cada-
    postulación que traía el candidato aparte (N+1 preexistente). Filtro de edad implementado
    contra `birth_date` con una función `_birth_date_cutoff()` que corrige el caso 29/feb en años
    no bisiestos. `CandidateSummary` (el objeto anidado) ahora expone `age`, `gender`,
    `has_own_transport`, `availability`, `immediate_availability` además del `completion_percent`
    del Bloque B.
  - Nuevo `GET /me/company/jobs/{id}/applications/stats` (una búsqueda) y
    `GET /me/company/applications/stats` (todas las búsquedas de la empresa) — ambos delegan en
    `compute_applicant_stats`.
- Verificado: import de la app OK (22 rutas).

**Frontend**
- `dashboard/company/types.ts`: `ApplicantFilters`, `ApplicantStats`, `EDUCATION_LEVEL_LABEL`, y
  los campos demográficos nuevos en `Application.candidate`.
- `dashboard/company/postulaciones/page.tsx`: barra de filtros (edad mín/máx, sexo, movilidad,
  disponibilidad, disponibilidad inmediata) sobre la lista de postulantes de la búsqueda
  seleccionada, con botón "Filtrar"/"Limpiar" (aplica al enviar, no en cada tecla); badges
  demográficos compactos por fila; panel colapsable "Ver estadísticas" con edad promedio,
  experiencia promedio, disponibilidad inmediata, distribución de título (mini-barras en teal) y
  desglose de movilidad.
  - **Refactor durante la verificación:** el primer diseño reseteaba filtros y disparaba fetches
    con `setState` síncrono dentro de un `useEffect` sobre `selectedJobId` — lint de React
    (`react-hooks/set-state-in-effect`) lo marcó como error. Se resolvió moviendo esa lógica a un
    handler explícito `selectJob()` invocado desde el `onChange` del select y desde el callback
    de carga inicial de búsquedas, sin efecto derivado.
- `dashboard/company/estadisticas/page.tsx`: nueva card "Perfil de postulantes (todas las
  búsquedas)" con el agregado global (`GET /me/company/applications/stats`), mismo formato visual
  que el panel por búsqueda.
- Verificado: `tsc --noEmit` sin errores; `npm run lint` sin errores (2 warnings preexistentes de
  `<img>`, sin relación) — limpio recién después del refactor del `useEffect` mencionado arriba.

**Nota de escala:** `compute_applicant_stats` hace 2 queries por candidato (educations +
experiences) además del fetch de perfiles — aceptable al volumen de Fase 1 (postulaciones por
búsqueda/empresa), pero si el volumen crece convendría agregar en SQL en vez de en Python.

---

## 9. Bloque F implementado — 2026-07-15

**Backend**
- `app/models/job.py`: nuevo valor `expired` en `JobPostingStatus` (columna `String`, sin
  migración de tipo). Columnas nuevas: `duration_days` (int, default 20, not null),
  `expires_at` (datetime, nullable).
- `app/schemas/job.py`: `MAX_JOB_DURATION_DAYS = 20`. `JobPostingCreate.duration_days`
  (`Field(default=20, ge=1, le=20)`), `JobPostingUpdate.duration_days` opcional (mismo rango),
  `JobPostingResponse` suma `duration_days`/`expires_at`.
- `app/api/v1/jobs.py`:
  - `create_job_posting`: `expires_at = published_at + timedelta(days=duration_days)`.
  - `update_job_posting`: el terminal-check ("closed is terminal") ahora también cubre
    `expired`. Si `duration_days` viene en el payload, se recalcula `expires_at` contra
    `published_at` (no contra "hoy") — permite que la empresa achique (o vuelva a ampliar,
    dentro del máximo de 20) el plazo. La transición a `expired` sigue sin estar en la
    whitelist de `allowed_transitions`, así que una empresa no puede autoasignarse ese estado
    manualmente vía `PATCH` — sólo lo pone el scheduler.
- `app/core/scheduler.py`: nueva tarea horaria `expire_jobs()` (calco de `check_expired_features`)
  — busca `JobPosting` con `status=active` y `expires_at < now`, las pasa a `expired`
  (+ `closed_at`) y notifica a la empresa (`job_expired`). El listado público (`/jobs`) ya
  filtraba por `status==active`, así que una búsqueda vencida desaparece sola sin tocar ese
  endpoint.
- Migración `f7b3d8a2c1e5_add_job_expiry` — **con backfill crítico**: sin él, las ~búsquedas ya
  publicadas hoy hubieran quedado con `expires_at` NULL (nunca vencerían) o, peor, si se hubiera
  hecho al revés, habrían desaparecido del portal de inmediato. Se corrió
  `UPDATE job_postings SET expires_at = published_at + INTERVAL '20 days' WHERE published_at IS
  NOT NULL` — verificado manualmente con una query post-migración que el valor calculado es
  correcto.
- `app/api/v1/admin.py`: `JobAdminResponse` suma `expires_at` (para que el admin vea la cuenta
  regresiva también).

**Frontend**
- `components/ui/ExpiryBadge.tsx` (nuevo): teal si faltan >5 días, ámbar si ≤5, rojo si venció;
  no se muestra en `closed`/`expired` (el estado ya lo dice). El cálculo de días restantes está
  en una función aparte fuera del componente (mismo patrón que `formatRelativeTime` en
  `notification-config.ts`) — la primera versión llamaba `Date.now()` directamente en el cuerpo
  del componente y el lint de React (`react-hooks` con chequeo de pureza) lo marcó como error
  ("Cannot call impure function during render"); moverlo a una función separada lo resolvió.
- `dashboard/company/publicar/page.tsx`: slider de duración (1-20 días, default 20) con el
  texto explicando el vencimiento automático.
- `dashboard/company/types.ts`: `JobForm.duration_days`, `MAX_JOB_DURATION_DAYS`,
  `JobPosting.duration_days`/`expires_at`.
- `dashboard/company/estadisticas/page.tsx` y `dashboard/admin/busquedas/page.tsx`: `ExpiryBadge`
  junto al estado de cada búsqueda. El admin también suma el label "Vencida" para `expired` y
  oculta el botón "Dar de baja" en búsquedas ya `closed`/`expired`.
- `components/notifications/notification-config.ts`: ícono/color para `job_expired`.

**Verificación:** `alembic upgrade head` corrido y confirmado en `head` (`f7b3d8a2c1e5`); query
manual post-migración confirmando el backfill; `python -c "from app.main import app"` importa las
22 rutas; `tsc --noEmit` y `npm run lint` sin errores (2 warnings preexistentes de `<img>`).

---

## 10. Bloque G implementado — 2026-07-15

**Este es el cambio de comportamiento más grande de toda la Fase 1.5**: las búsquedas dejan de
publicarse solas. A partir de ahora, toda búsqueda nueva pasa por revisión de un admin antes de
ser visible en el portal público — coincide con lo que se había decidido en la reunión ("barrera
dura", ver §3), pero recién ahora queda implementado y activo.

**Backend**
- `app/models/job.py`: nuevo enum `JobModerationStatus` (`pending_review`/`approved`/`rejected`).
  Columnas nuevas en `JobPosting`: `moderation_status` (default `pending_review`),
  `moderation_notes`, `moderated_by_admin_id` (FK a `users`), `moderated_at`. Diseñado **ortogonal**
  a `status` (el ciclo de vida propio de la empresa: draft/active/paused/closed/expired) — una
  búsqueda puede estar `status=active` (la empresa la ve activa en su panel) pero
  `moderation_status=pending_review` (invisible para el público) al mismo tiempo.
- Migración `a2c9e4f1b6d3_add_job_moderation` — **backfill crítico**: `UPDATE job_postings SET
  moderation_status = 'approved'` sobre todas las filas existentes. Sin esto, la única búsqueda
  que ya estaba publicada hubiera quedado con el default `pending_review` y habría desaparecido
  del portal público apenas se corriera esta migración. Verificado manualmente contando filas por
  `moderation_status` post-migración (1 en `approved`, 0 en cualquier otro estado).
- `app/api/v1/jobs.py`:
  - `create_job_posting`: nace `moderation_status=pending_review` + `notify_all_admins(type=
    "job_pending_review")`.
  - `list_public_jobs` (`GET /jobs`), `get_public_job` (`GET /jobs/{id}`), `suggest_jobs`
    (`GET /jobs/suggest`): suman `moderation_status == approved` a la condición existente
    `status == active`. El perfil público de empresa reusa `GET /jobs?company_id=...`, así que
    hereda el filtro sin tocar ese código.
- `app/api/v1/applications.py`: `apply_to_job` también exige `moderation_status == approved` —
  sin esto, alguien con el UUID de una búsqueda todavía no aprobada (o rechazada) podría
  postularse aunque no apareciera en ningún listado.
- `app/schemas/job.py`: nuevo `JobPostingCompanyResponse(JobPostingResponse)` con
  `moderation_status`/`moderation_notes` — **deliberadamente separado** de
  `JobPostingResponse`/`JobPostingPublicResponse` para que el motivo de un rechazo (posible
  información sensible/interna) nunca viaje en la respuesta pública de `/jobs`. Los tres
  endpoints de `/me/company/jobs` (crear, listar, actualizar) pasaron a usar este nuevo schema.
- `app/api/v1/admin.py`: nuevo `PATCH /admin/jobs/{job_id}/moderate` (approve/reject + notas) —
  mismo patrón que `verify_company`: notifica a la empresa (`job_approved`/`job_rejected`) y deja
  `AuditLog`. Rechaza con 400 si la búsqueda ya fue revisada (no se puede re-moderar). `GET
  /admin/jobs` suma filtro opcional `moderation_status`. `JobAdminResponse` suma
  `moderation_status`/`moderation_notes`. `DashboardMetrics` suma `pending_jobs`.
- Verificado con una query directa reproduciendo el filtro de `list_public_jobs`: la única
  búsqueda existente (backfillada a `approved`) sigue visible; no hay ninguna en
  `pending_review` (esperado, no se creó ninguna nueva en esta sesión).

**Frontend**
- `dashboard/admin/busquedas/page.tsx`: reescrita siguiendo el mismo patrón que
  `dashboard/admin/empresas/page.tsx` (banner de pendientes, botones aprobar/rechazar, modal de
  motivo de rechazo). Badge de estado de moderación junto al badge de ciclo de vida (`Activa`/
  `Pausada`/etc.) y al `ExpiryBadge` del Bloque F.
- `dashboard/admin/estadisticas/page.tsx`: tile "Búsquedas por revisar" con `pending_jobs`.
- `dashboard/company/publicar/page.tsx`: caja informativa antes del botón de submit avisando que
  Talency revisa toda búsqueda nueva; texto del botón pasa de "Publicar búsqueda" a "Enviar para
  revisión"; toast de éxito actualizado.
- `dashboard/company/estadisticas/page.tsx`: badge de estado de moderación junto al título de
  cada búsqueda en "Postulaciones por búsqueda" (sólo se muestra si no está `approved`, para no
  ensuciar la vista una vez aprobada).
- `components/notifications/notification-config.ts`: íconos/colores para `job_pending_review`
  (admin), `job_approved` (positivo, empresa), `job_rejected` (negativo, empresa).
- `dashboard/admin/types.ts` / `dashboard/company/types.ts`: tipos y labels de
  `moderation_status` en cada dashboard (duplicados intencionalmente — mismo patrón que el resto
  del proyecto, cada sección de dashboard mantiene su propio `types.ts` sin un módulo compartido).

**Documentación de cara al cliente actualizada** (pendiente marcado en auditorías anteriores):
- `FASE1-BBJOBS-REPASO.md`: sección 7 (publicación de búsquedas) ya no dice "de inmediato";
  sección 8 (moderación) ahora cubre búsquedas, no sólo empresas, y se sacó la mención a
  "aprobar habilidades sugeridas" (ese flujo se dio de baja en el Bloque D); sección 9
  (notificaciones) y 13 (recorrido de demo) actualizadas para incluir el paso de aprobar la
  búsqueda antes de que aparezca en el portal.
- `REUNION-EUGENIA-FASE1.md`: mismos ajustes en "Qué está terminado" y en el guion de demo
  (ahora son 8 pasos, no 7 — se insertó "aprobar la búsqueda" entre publicarla y gestionar
  postulaciones). Se agregó una aclaración nueva para Eugenia: la moderación de búsquedas es
  manual, así que hay que hablar con ella de cada cuánto alguien de Talency va a revisar la cola.

**Verificación:** `alembic upgrade head` corrido y confirmado en `head` (`a2c9e4f1b6d3`); query
manual reproduciendo el filtro de visibilidad pública; `python -c "from app.main import app"`
importa las 22 rutas; `tsc --noEmit` y `npm run lint` sin errores (2 warnings preexistentes).

---

## 11. Bloque H implementado — 2026-07-15

**Sin migración nueva** — este bloque es sólo endpoints/filtros nuevos y UI, ninguna columna
nueva en la base.

**Backend**
- `app/services/applicant_stats.py`: se agregó `get_highest_education_level` como alias público
  de `_highest_education_level` (ya existía desde el Bloque E) — ahora se reusa también desde
  `admin.py` para el filtro de "título alcanzado", en vez de duplicar la lógica de ranking.
- `app/api/v1/admin.py`:
  - `GET /admin/candidates` reescrito: antes era un `select(CandidateProfile)` sin filtros que
    devolvía las filas tal cual. Ahora acepta `q` (nombre/apellido), `age_min`/`age_max` (mismo
    criterio de corte por `birth_date` que en `applications.py`, duplicado localmente como
    `_birth_date_cutoff` — incluye el fallback de 29/feb), `gender`, `has_own_transport`,
    `availability`, `immediate_availability`, `zone_id`, `has_cv` y `education_level`. Este último
    es **derivado** (no existe como columna), así que se resuelve por candidato después del fetch
    principal y se filtra en Python — mismo patrón de tolerancia a N+1 que
    `compute_applicant_stats` del Bloque E, aceptable a la escala de Fase 1.
    `CandidateAdminResponse` ahora expone edad, sexo, movilidad, disponibilidad, título
    alcanzado y `completion_percent` (quedaba pendiente desde el Bloque B — ver nota en el
    Bloque B más arriba).
  - **Refactor para reuso**: `get_candidate_full_profile` en `applications.py` tenía ~80 líneas
    de lógica (fetch de experiencia/educación/skills/idiomas + cálculo de %) mezcladas con el
    chequeo de seguridad ("el candidato se postuló a una búsqueda de esta empresa"). Se extrajo
    todo lo que no es el chequeo de seguridad a una función nueva
    `build_candidate_full_profile(db, candidate_id)`, que ahora llaman **dos** endpoints: el de
    la empresa (con su chequeo de acceso sin cambios) y el nuevo `GET /admin/candidates/{id}`
    (sin restricción — el admin puede ver cualquier perfil). Evitó duplicar ~80 líneas.
  - Nuevos `GET /admin/companies/{id}/jobs` (reusa `JobAdminResponse`) y
    `GET /admin/jobs/{id}/applications` (reusa `ApplicationWithCandidateResponse`/
    `CandidateSummary` importados directamente desde `applications.py` — cross-import entre
    routers, aceptable porque ambos viven en `app.api.v1` y no hay dependencia circular).
- Verificado con queries directas contra la base real (no sólo import): cálculo de título
  alcanzado y % de perfil completo corridos sobre el único candidato existente (sin educación
  cargada → título `None`, completion 0%); drill-down empresa→job→applications confirmado
  contando 1 aplicación sobre 1 búsqueda de la única empresa existente.

**Frontend**
- `dashboard/admin/candidatos/page.tsx`: reescrita de punta a punta — antes sólo listaba
  nombre/teléfono/CV sin filtros. Ahora tiene barra de filtros (texto, edad, sexo, movilidad,
  disponibilidad, zona vía `GET /catalogs/zones`, título, CV, disponibilidad inmediata),
  `ProfileCompletionRing` por fila, badges demográficos compactos, y un modal de perfil completo
  (mismo patrón visual que el modal de la empresa en `postulaciones`, pero alimentado por
  `GET /admin/candidates/{id}`).
- `dashboard/admin/empresas/page.tsx`: fila de empresa ahora tiene un botón "Búsquedas" que
  expande la lista de búsquedas de esa empresa (`GET /admin/companies/{id}/jobs`, con badge de
  moderación y `ExpiryBadge` del Bloque F); cada búsqueda tiene a su vez un botón "Postulantes"
  que expande su lista de postulaciones (`GET /admin/jobs/{id}/applications`) con badge de
  estado. Dos niveles de expansión, cacheados por id para no re-fetchear al volver a abrir.
- `dashboard/admin/types.ts`: `CandidateFilters`, `CandidateFullProfile`, `AdminApplication`,
  `APP_STATUS_LABEL`, `EDUCATION_LEVEL_LABEL` y los enums/labels demográficos — duplicados
  respecto a `company/types.ts` y `candidate/types.ts` a propósito, siguiendo el patrón ya
  establecido de que cada sección de dashboard mantiene su propio `types.ts` independiente.

**Verificación:** `python -c "from app.main import app"` importa las 22 rutas; `alembic current`
sigue en `head` (`a2c9e4f1b6d3`, sin cambios porque este bloque no migra nada);
`tsc --noEmit` y `npm run lint` sin errores (2 warnings preexistentes); queries manuales contra
la base real confirmando filtros derivados y drill-down.

---

## 12. Bloque I implementado — 2026-07-15

**Backend**
- `app/models/history.py` (nuevo): `ApplicationStatusHistory` (application_id, from_status
  nullable, to_status, changed_by_user_id nullable, created_at) y `CandidateActivityLog`
  (candidate_id, event_type, summary, created_at). Registradas en `app/models/__init__.py` para
  que Alembic las vea.
- Migración `d5e8f3a7c2b1_add_history_tables` — **sin backfill posible**: son tablas nuevas, no
  hay forma de reconstruir retroactivamente el historial de postulaciones/actividad que ya
  ocurrió antes de este deploy (a diferencia de los bloques anteriores, donde el backfill evitaba
  romper algo existente). Arrancan vacías; el historial se registra desde ahora en adelante.
- `app/services/history.py` (nuevo): `log_application_status_change()` y
  `log_candidate_activity()` — sólo hacen `db.add()`, viajan en la misma transacción que el
  evento que las origina (mismo criterio que `create_notification`).
- `app/api/v1/applications.py`:
  - `apply_to_job`: **requirió un `await db.flush()` explícito** después de `db.add(app)` para
    poder usar `app.id` como FK del primer registro de historial (`from_status=None,
    to_status="new"`) — el UUID de `Application` es un default de columna, no se popula en el
    objeto Python hasta el flush (mismo patrón ya usado en `jobs.py::create_job_posting` con
    `job.id` antes de crear sus `JobPostingSkill`, que sirvió de referencia). También registra
    `CandidateActivityLog` ("Se postuló a '...'").
  - `update_application_status`: captura `previous_status` antes de mutar `app.status` y
    registra la transición con `changed_by_user_id=company.user_id`.
  - Nuevo `GET /me/candidate/applications/{application_id}/history` — valida que la postulación
    sea del candidato autenticado antes de listar su historial.
- `app/api/v1/candidates.py`: `update_my_candidate_profile` (sólo si `update_data` no está
  vacío), `upload_cv`, `add_experience`, `add_education`, `add_skill` (resuelve el nombre de la
  skill con una query a `Skill` para que el resumen sea legible, en vez de sólo un UUID) y
  `add_language` ahora registran actividad. **Las rutas de `delete_*` quedaron sin loguear** —
  coincide con el alcance que pedía el plan (sólo altas), no es un olvido.
- `app/api/v1/admin.py`: nuevos `GET /admin/candidates/{candidate_id}/activity` y
  `GET /admin/applications/{application_id}/history`, mismo patrón de acceso sin restricción que
  el resto del drill-down del Bloque H.
- `app/schemas/history.py` (nuevo): `ApplicationStatusHistoryResponse`,
  `CandidateActivityLogResponse` — compartidos entre `applications.py` y `admin.py`.
- **Verificado más allá del import**: se insertó, leyó y borró una fila de cada tabla nueva
  contra la base real de Railway (usando el `application`/`candidate` ya existentes) para
  confirmar que el flujo completo funciona de punta a punta, no sólo que el módulo importa.

**Frontend**
- `dashboard/candidate/postulaciones/page.tsx`: cada fila de postulación es ahora un botón que
  expande un timeline (fetch bajo demanda a `.../history`, cacheado por id) con el estado y la
  fecha/hora de cada transición.
- `dashboard/admin/candidatos/page.tsx`: al abrir el modal de perfil, además de
  `GET /admin/candidates/{id}` se dispara en paralelo `GET /admin/candidates/{id}/activity`;
  nueva sección "Actividad reciente" al final del modal.
- `dashboard/candidate/types.ts` / `dashboard/admin/types.ts`: `ApplicationHistoryItem` /
  `CandidateActivityItem` respectivamente.

**Verificación:** `python -c "from app.main import app"` importa las 22 rutas; `alembic current`
en `head` (`d5e8f3a7c2b1`); inserción/lectura/borrado manual contra Railway confirmando las dos
tablas nuevas; `tsc --noEmit` y `npm run lint` sin errores (2 warnings preexistentes).

---

## 13. Bloque J implementado — 2026-07-15 (cierre del plan Fase 1.5)

Este bloque tenía dos partes en el plan: notificaciones que quedaron pendientes de bloques
anteriores, y una revisión de consistencia visual. Con esto se cierran los diez bloques (A→J).

**Backend — `job_expiring_soon`**
- El Bloque F había dejado esto marcado como "opcional" (aviso "vence en 3 días"), pero quedaba
  como el único ítem de notificaciones del plan sin resolver, así que se completó acá.
- `app/models/job.py`: columna `expiring_soon_notified_at` (nullable) — throttle para que el
  aviso se mande una única vez por búsqueda, no en cada corrida horaria del scheduler mientras
  siga en la ventana de "por vencer".
- Migración `b4c7e1a9f3d6_add_job_expiring_soon_notified` — sin backfill (columna nueva,
  nullable, no afecta visibilidad ni datos existentes).
- `app/core/scheduler.py`: nueva tarea `notify_expiring_soon()` — busca búsquedas activas con
  `expires_at` dentro de los próximos `EXPIRING_SOON_WINDOW_DAYS = 3` días,
  `expiring_soon_notified_at is None` y todavía no vencidas; notifica a la empresa una vez y
  marca el timestamp. Registrada en `start_scheduler()` junto a `check_expired_features` y
  `expire_jobs` (mismo intervalo de 1 hora).
  - Nota de redacción: el primer borrador del mensaje decía "podés ampliar el plazo desde tu
    panel", pero como `duration_days` está topeado en `MAX_JOB_DURATION_DAYS=20` (Bloque F), una
    empresa que ya está en el máximo no puede ampliarlo más — se corrigió el texto para no
    prometer algo que el sistema no siempre puede cumplir.

**Frontend**
- `components/notifications/notification-config.ts`: nuevo estilo `WARNING` (ícono `ClockIcon`,
  ámbar) para `job_expiring_soon` — no encajaba en los estilos existentes (`TEAL`/`MUTED`/
  `DESTRUCTIVE`/`SECONDARY`), así que se agregó uno nuevo en vez de forzarlo en uno que no
  correspondía semánticamente.

**Revisión de consistencia visual**
- Se corrió `grep` de todos los colores hexadecimales usados en las ~15 páginas y componentes
  tocados durante toda la Fase 1.5 (`app/dashboard/**`, `components/ui/**`,
  `components/notifications/**`). Resultado: sólo aparecen los tokens oficiales de la paleta
  (`#1E8EA3`, `#187B8E`, `#E6F4F7`, `#9ED4DF`, `#D4B7A2`, `#FAFBFD`, `#1C2230`, `#64748B`,
  `#DDE3EC`) más los grises neutros ya presentes desde antes de esta sesión
  (`#F1F5F9`/`#EEF2F7`/`#94A3B8`/`#CBD5E1`/`#F8FAFC`, usados en `NotificationBell.tsx` original)
  y los tres colores semánticos del anillo de perfil completo que el plan pedía explícitamente
  (`#EF4444` rojo, `#F59E0B` ámbar, `#16A34A` verde). Ningún color suelto fuera de paleta.

**Verificación:** `python -c "from app.main import app"` importa las 22 rutas; `alembic upgrade
head` corrido y confirmado en `head` (`b4c7e1a9f3d6`); `tsc --noEmit` y `npm run lint` sin
errores (2 warnings preexistentes, sin relación).

---

## Cierre — Plan Fase 1.5 completo (A→J)

Los diez bloques acordados tras la reunión con Eugenia quedaron implementados en esta sesión
(2026-07-15), cada uno verificado contra la base real de Railway y documentado arriba (§4 a §13).
Quedan dos decisiones de producto abiertas, ninguna bloqueante:
1. Qué hacer con el backend de sugerencia de skills que quedó sin uso (§2, §6) — eliminarlo o
   reusarlo como gestor de catálogo.
2. Acordar con Eugenia la cadencia de revisión de la cola de búsquedas pendientes de moderación
   (§10) — quedó anotado en `REUNION-EUGENIA-FASE1.md`.

El detalle línea por línea de qué se implementó en cada bloque está en
`FASE1.5-FILTROS-PLAN.md` (sección "Estado de implementación").
