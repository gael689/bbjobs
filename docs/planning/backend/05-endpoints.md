# Paso 5 — Endpoints del backend

> Listado de endpoints HTTP necesarios para Fase 1, agrupados por dominio.
> Convenciones:
> - Método HTTP + ruta + qué hace + autorización (quién puede llamarlo).
> - Autorización: `public` | `candidate` | `company` (verified salvo aclaración) | `admin` | `any-auth` (cualquier usuario autenticado).
> - Paths bajo `/api/v1`.
> - Las respuestas usan JSON. CV y documentos suben/bajan vía URLs presignadas o multipart (decisión técnica de almacenamiento en Paso 6).
> - **Endpoints marcados [F2-DEFERRED]** quedan documentados pero no se implementan en F1.

---

## 1. Auth

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| POST | `/api/v1/auth/register/candidate` | Registra un candidato (crea User + CandidateProfile vacío). Dispara email de verificación. | public |
| POST | `/api/v1/auth/register/company` | Registra una empresa (crea User + CompanyProfile en `pending` + Subscription Free). Dispara email de verificación. | public |
| POST | `/api/v1/auth/login` | Login con email + password. Devuelve **access token** (en respuesta JSON) + setea **refresh token** en cookie httpOnly secure. | public |
| POST | `/api/v1/auth/logout` | Invalida el refresh token (revocación o rotación; mecanismo concreto en Paso 6). Limpia la cookie. | any-auth |
| POST | `/api/v1/auth/refresh` | Lee el refresh token de la cookie y devuelve un nuevo access token. Rota el refresh token. | public (con cookie) |
| POST | `/api/v1/auth/verify-email` | Confirma el `EmailVerificationToken`. | public |
| POST | `/api/v1/auth/verify-email/resend` | Reenvía mail de verificación. | any-auth (no verificado) |
| POST | `/api/v1/auth/password/forgot` | Genera `PasswordResetToken` y envía mail. | public |
| POST | `/api/v1/auth/password/reset` | Resetea password con el token. | public |
| GET  | `/api/v1/auth/me` | Devuelve el usuario actual con su perfil (candidato o empresa). | any-auth |

---

## 2. Candidatos — perfil propio

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/me/candidate` | Perfil completo del candidato logueado. | candidate |
| PATCH  | `/api/v1/me/candidate` | Actualiza datos personales, expectativas, zona, modalidades, summary. | candidate |
| POST   | `/api/v1/me/candidate/cv` | Sube/reemplaza CV (PDF, máx 5 MB). | candidate |
| DELETE | `/api/v1/me/candidate/cv` | Elimina el CV actual. | candidate |
| GET    | `/api/v1/me/candidate/cv` | Descarga / obtiene URL del CV. | candidate |
| GET    | `/api/v1/me/candidate/experiences` | Lista experiencia laboral. | candidate |
| POST   | `/api/v1/me/candidate/experiences` | Agrega una experiencia. | candidate |
| PATCH  | `/api/v1/me/candidate/experiences/{id}` | Edita una experiencia. | candidate |
| DELETE | `/api/v1/me/candidate/experiences/{id}` | Elimina una experiencia. | candidate |
| GET    | `/api/v1/me/candidate/educations` | Lista formación. | candidate |
| POST   | `/api/v1/me/candidate/educations` | Agrega formación. | candidate |
| PATCH  | `/api/v1/me/candidate/educations/{id}` | Edita formación. | candidate |
| DELETE | `/api/v1/me/candidate/educations/{id}` | Elimina formación. | candidate |
| GET    | `/api/v1/me/candidate/skills` | Lista skills del candidato. | candidate |
| POST   | `/api/v1/me/candidate/skills` | Agrega skill (debe ser `status=active`). | candidate |
| PATCH  | `/api/v1/me/candidate/skills/{id}` | Cambia nivel de una skill. | candidate |
| DELETE | `/api/v1/me/candidate/skills/{id}` | Quita una skill. | candidate |
| POST   | `/api/v1/me/candidate/skills/suggest` | **Sugerencia de skill nueva al catálogo** (acción consciente, distinta de agregar una skill existente). Crea `Skill(status=pending, created_by_user_id)`. La sugerencia queda asociada al candidato pero invisible hasta aprobación. Al aprobarse, se vincula automáticamente al perfil del candidato que la sugirió (creación automática de `CandidateSkill`). | candidate |
| GET    | `/api/v1/me/candidate/languages` | Lista idiomas. | candidate |
| POST   | `/api/v1/me/candidate/languages` | Agrega idioma. | candidate |
| PATCH  | `/api/v1/me/candidate/languages/{id}` | Edita idioma. | candidate |
| DELETE | `/api/v1/me/candidate/languages/{id}` | Quita idioma. | candidate |
| GET    | `/api/v1/me/candidate/export` | **Exportación de datos (Ley 25.326).** Devuelve JSON con todos los datos del candidato (perfil, postulaciones, tests, historial) + descarga del CV. Requisito legal previo al hard delete. | candidate |
| DELETE | `/api/v1/me/candidate` | **Hard delete (Ley 25.326)** — borra perfil, CV, anonimiza Applications. Requiere confirmación con password. | candidate |

### Postulaciones del candidato

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/me/candidate/applications` | Lista todas las postulaciones del candidato con estado. | candidate |
| GET    | `/api/v1/me/candidate/applications/{id}` | Detalle de una postulación. | candidate |

### Alertas del candidato

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/me/candidate/alerts` | Lista alertas configuradas. | candidate |
| POST   | `/api/v1/me/candidate/alerts` | Crea alerta (industry, zone, modality opcionales). | candidate |
| PATCH  | `/api/v1/me/candidate/alerts/{id}` | Edita alerta o activa/desactiva. | candidate |
| DELETE | `/api/v1/me/candidate/alerts/{id}` | Borra alerta. | candidate |

### Tests psicométricos (candidato)

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/tests` | Lista tests disponibles (`is_active=true`). | candidate |
| GET    | `/api/v1/tests/{id}` | Detalle del test (sin respuestas correctas). | candidate |
| POST   | `/api/v1/tests/{id}/start` | Inicia un `TestSubmission(in_progress)`. Valida cooldown 30 días. | candidate |
| POST   | `/api/v1/tests/submissions/{id}/answers` | Registra una respuesta. | candidate |
| POST   | `/api/v1/tests/submissions/{id}/complete` | Cierra el intento, calcula `score`. | candidate |
| GET    | `/api/v1/me/candidate/tests/submissions` | Historial de submissions del candidato. | candidate |
| GET    | `/api/v1/me/candidate/tests/submissions/{id}` | Detalle de una submission propia. | candidate |

---

## 3. Empresas — perfil propio

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/me/company` | Perfil de la empresa logueada (incluye `verification_status`). | company |
| PATCH  | `/api/v1/me/company` | Edita datos del perfil (no edita `verification_status`). | company |
| POST   | `/api/v1/me/company/logo` | Sube/reemplaza logo. | company |
| GET    | `/api/v1/me/company/verification/documents` | Lista documentación adjunta. | company |
| POST   | `/api/v1/me/company/verification/documents` | Sube documento. | company |
| DELETE | `/api/v1/me/company/verification/documents/{id}` | Elimina documento. | company (solo si está en `pending`/`rejected`) |
| POST   | `/api/v1/me/company/verification/reapply` | Si está `rejected`, vuelve a solicitar verificación → `pending`. | company |
| GET    | `/api/v1/me/company/export` | **Exportación de datos (Ley 25.326).** Devuelve JSON con todos los datos de la empresa, búsquedas y pagos + descarga de documentación adjunta. Requisito legal previo al hard delete. | company |
| DELETE | `/api/v1/me/company` | Hard delete excepcional: anonimiza la empresa (Ley 25.326). Requiere confirmación con password. | company |

---

## 4. Búsquedas (JobPostings)

### Público

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/jobs` | Listado público de búsquedas en `active`, destacadas primero. Filtros: `industry`, `zone`, `modality`, `contract_type`, `min_education`, `salary_min`, `salary_max`, `q` (texto). Paginado. | public |
| GET    | `/api/v1/jobs/{id}` | Detalle público de una búsqueda activa. | public |

### Empresa (gestión de sus propias búsquedas)

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/me/company/jobs` | Lista las búsquedas de la empresa (todos los estados). | company |
| POST   | `/api/v1/me/company/jobs` | Crea una búsqueda en `draft`. Guarda `company_legal_name_snapshot`. | company verified |
| GET    | `/api/v1/me/company/jobs/{id}` | Detalle de una búsqueda propia. | company verified |
| PATCH  | `/api/v1/me/company/jobs/{id}` | Edita campos editables (descripción, requisitos, etc.). | company verified |
| POST   | `/api/v1/me/company/jobs/{id}/publish` | Transición `draft → active`. | company verified |
| POST   | `/api/v1/me/company/jobs/{id}/pause` | Transición `active → paused`. | company verified |
| POST   | `/api/v1/me/company/jobs/{id}/resume` | Transición `paused → active`. | company verified |
| POST   | `/api/v1/me/company/jobs/{id}/close` | Transición → `closed` (terminal). | company verified |
| DELETE | `/api/v1/me/company/jobs/{id}` | Soft delete (solo permitido si estaba `draft`). | company verified |

---

## 5. Postulaciones (Applications)

### Candidato → postular

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| POST   | `/api/v1/jobs/{id}/apply` | Postula a una búsqueda con `cover_letter` opcional. Valida constraint único. | candidate |

### Empresa → ver y gestionar postulaciones recibidas

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/me/company/jobs/{id}/applications` | Lista postulaciones de una búsqueda propia. Filtros por estado. | company verified |
| GET    | `/api/v1/me/company/applications/{id}` | Detalle de una postulación (incluye perfil completo del candidato, CV vivo, tests psicométricos del candidato). **Marca `seen_at = now()` automáticamente si todavía es null** (solo cuando lo abre el rol empresa; el admin auditando NO dispara este efecto). | company verified |
| PATCH  | `/api/v1/me/company/applications/{id}/status` | Cambia estado: `seen → in_process | discarded`, `in_process → contacted | discarded`, `contacted → in_process`, `discarded → in_process`. Registra en `AuditLog`. | company verified |

---

## 6. Destacar búsqueda (único flujo de pago real en F1)

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| POST   | `/api/v1/me/company/jobs/{id}/feature` | Crea `JobFeature(pending_payment)` + `Payment(pending)` + preferencia MP. Devuelve URL de checkout. | company verified |
| GET    | `/api/v1/me/company/jobs/{id}/feature` | Estado del `JobFeature` activo o pendiente para esta búsqueda (usado por el frontend para polling post-checkout). | company verified |
| GET    | `/api/v1/me/company/features` | Histórico de destacados de la empresa. | company verified |

### Webhook de Mercado Pago

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| POST   | `/api/v1/webhooks/mercadopago` | Recibe eventos de MP. Valida firma. Persiste `MercadoPagoWebhookEvent`. Procesa según `topic` (`payment` en F1). Idempotente por `mp_event_id`. | public (firmado por MP) |

### Pagos (lectura propia)

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/me/company/payments` | Historial de pagos de la empresa (solo destacados en F1). | company |

---

## 7. Observatorio Laboral

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/observatory/summary` | Vista resumida pública: cantidad de búsquedas activas, top 5 rubros, rangos salariales promedio últimos 30 días. | public |
| GET    | `/api/v1/observatory/detailed` | Vista detallada: filtros por rubro, zona, nivel educativo, períodos personalizables, comparativas mes a mes. | `includes_observatory_full` del plan actual de la empresa **o** admin. *En F1: como no hay distinciones de plan implementadas, queda abierto para empresas verificadas y admin.* |

---

## 8. Catálogos compartidos

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/catalogs/industries` | Lista rubros activos. | public |
| GET    | `/api/v1/catalogs/zones` | Lista zonas activas. | public |
| GET    | `/api/v1/catalogs/contract-types` | Lista tipos de contrato. | public |
| GET    | `/api/v1/catalogs/skills?q=...` | Autocomplete de skills activas. | any-auth |
| GET    | `/api/v1/catalogs/education-levels` | Niveles educativos (puede ser enum hardcodeado, pero se expone para el frontend). | public |

---

## 9. Admin (Talency)

### Empresas

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/admin/companies` | Lista todas las empresas con filtro por `verification_status`. | admin |
| GET    | `/api/v1/admin/companies/{id}` | Detalle de empresa con documentos. | admin |
| POST   | `/api/v1/admin/companies/{id}/verify` | Aprueba verificación. | admin |
| POST   | `/api/v1/admin/companies/{id}/reject` | Rechaza con `verification_notes`. Notifica por mail. | admin |
| POST   | `/api/v1/admin/companies/{id}/suspend` | Suspende. Pausa automáticamente búsquedas activas. | admin |
| POST   | `/api/v1/admin/companies/{id}/reactivate` | Quita suspensión (no republica búsquedas). | admin |

### Búsquedas (takedown)

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/admin/jobs` | Lista todas las búsquedas con filtros. | admin |
| GET    | `/api/v1/admin/jobs/{id}` | Detalle. | admin |
| POST   | `/api/v1/admin/jobs/{id}/takedown` | Cierra una búsqueda (`closed`) por incumplimiento. Notifica a la empresa. | admin |

### Skills (catálogo curado)

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/admin/skills` | Lista skills con filtro por `status`. | admin |
| POST   | `/api/v1/admin/skills` | Carga skill directa (`status=active`). | admin |
| PATCH  | `/api/v1/admin/skills/{id}` | Edita nombre / status. | admin |
| POST   | `/api/v1/admin/skills/{id}/approve` | `pending → active`. | admin |
| POST   | `/api/v1/admin/skills/{id}/reject` | `pending → rejected`. | admin |
| POST   | `/api/v1/admin/skills/{id}/merge` | Fusiona con otra skill canónica. Migra `CandidateSkill` y `JobPostingSkill` en transacción. | admin |

### Catálogos generales

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| POST/PATCH/DELETE | `/api/v1/admin/industries[/{id}]` | CRUD. | admin |
| POST/PATCH/DELETE | `/api/v1/admin/zones[/{id}]` | CRUD. | admin |
| POST/PATCH/DELETE | `/api/v1/admin/contract-types[/{id}]` | CRUD. | admin |

### Tests psicométricos (admin)

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/admin/tests` | Lista todos los tests. | admin |
| POST   | `/api/v1/admin/tests` | Crea test. | admin |
| PATCH  | `/api/v1/admin/tests/{id}` | Edita test (nombre, scoring_method, is_active). | admin |
| POST/PATCH/DELETE | `/api/v1/admin/tests/{id}/questions[/{qid}]` | CRUD de preguntas. | admin |
| POST/PATCH/DELETE | `/api/v1/admin/tests/questions/{qid}/options[/{oid}]` | CRUD de opciones. | admin |
| GET    | `/api/v1/admin/tests/{id}/submissions` | Reporte de submissions (anonimizadas o no, según decida Talency). | admin |

### Planes (configuración, sin flujo activo en F1)

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/admin/plans` | Lista planes. | admin |
| POST   | `/api/v1/admin/plans` | Crea plan (Free / Pro / Premium futuros). | admin |
| PATCH  | `/api/v1/admin/plans/{id}` | Edita atributos del plan (`features_json`, límites, precio, etc.). | admin |

### Parámetros del sistema

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/admin/settings` | Lee parámetros (precio destacado, duración destacado, etc.). | admin |
| PATCH  | `/api/v1/admin/settings` | Edita parámetros. | admin |

### Métricas y pagos

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/admin/metrics/dashboard` | Conteos generales: empresas activas/pendientes/verificadas, candidatos, búsquedas activas, postulaciones / mes, pagos / mes. | admin |
| GET    | `/api/v1/admin/payments` | Histórico completo de pagos (destacados en F1). | admin |
| GET    | `/api/v1/admin/audit-logs` | Consulta del AuditLog. | admin |

### Gestión de admins

| Método | Ruta | Qué hace | Quién |
|--------|------|----------|-------|
| GET    | `/api/v1/admin/admins` | Lista admins. | admin |
| POST   | `/api/v1/admin/admins` | Crea otro admin (alta directa, no se autoregistran). | admin |
| PATCH  | `/api/v1/admin/admins/{id}` | Edita admin (desactivar, cambiar nombre). | admin |

---

## 10. Endpoints diferidos a Fase 2 (no se implementan en F1)

Quedan listados para referencia. No entran al desarrollo.

| Endpoint sugerido | Para qué | Motivo de exclusión |
|-------------------|----------|---------------------|
| `POST /api/v1/me/company/subscription/upgrade` | Cambiar plan a uno superior. | Planes sin definir, sin flujo de cobro recurrente en F1. |
| `POST /api/v1/me/company/subscription/cancel` | Cancelar al fin de período. | Idem. |
| `POST /api/v1/me/company/subscription/downgrade` | Downgrade. | Idem. |
| `POST /api/v1/me/company/applications/{id}/unlock` | Pagar por desbloquear postulaciones extra. | No se cobra desbloqueo en F1. |
| `POST /api/v1/jobs/{id}/report` | Reportar búsqueda. | Sistema de reportes es F2. |
| `POST /api/v1/companies/{id}/report` | Reportar empresa. | Idem. |
| `GET /api/v1/me/conversations` | Mensajería interna. | Es F2. |
| `GET /api/v1/me/notifications` | Centro de notificaciones in-app. | F1 solo mail. |
| `POST /api/v1/me/candidate/cv/improve` | Agente IA para mejora de CV. | F2. |
| `GET /api/v1/me/company/jobs/{id}/recommendations` | Recomendación IA de candidatos. | F2. |
| `GET /api/v1/me/candidate/matches` | Match IA de búsquedas para el candidato. | F2. |

---

## 11. Headers, errores y convenciones

- **Auth header.** `Authorization: Bearer <jwt>`.
- **Errores estandarizados** (a definir formato exacto en Paso 6):
  - `400` validación de payload.
  - `401` no autenticado / token inválido.
  - `403` autenticado pero sin permiso (incluye empresa no verificada intentando publicar).
  - `404` recurso no existe / no es del usuario.
  - `409` conflicto de estado (postulación duplicada, transición ilegal, CUIT/email duplicado).
  - `422` reglas de negocio violadas (cooldown de test, datos inconsistentes).
  - `429` rate limit (Paso 6).
- **Paginación.** `?page=N&size=M`, respuesta con `items`, `total`, `page`, `size`.
- **Idempotencia de POST.** Para endpoints sensibles (publicar búsqueda, postular, crear preferencia MP), aceptar header `Idempotency-Key` opcional (decisión final en Paso 6).
- **Auditoría.** Todos los endpoints de admin que cambien estado registran en `AuditLog`.

---

*Documento de endpoints — Paso 5 (ajustado al alcance real de F1).*
*A validar por el usuario antes del Paso 6.*
