# Paso 2 — Diagrama de entidades (BBJobs Fase 1)

> Modelo de datos completo del backend, contemplando las decisiones críticas del [02a-decisiones-criticas.md](./02a-decisiones-criticas.md).
> Convención: **[F1]** = Fase 1 (se implementa). **[F2]** = Fase 2 (documentado, no se implementa).

---

## Decisiones de modelado base

- **Separación `User` ↔ `CompanyProfile` / `CandidateProfile`.** Auth es JWT propio. `User` centraliza credenciales + rol. Perfiles cuelgan según rol. Habilita multi-usuario por empresa en Fase 2 con una tabla pivot `CompanyMember`, sin tocar lo existente.
- **`Plan` como catálogo configurable** vs **`Subscription` como instancia** (ver decisiones 3 y 4).
- **`PsychometricTest` como catálogo** vs **`TestSubmission` como instancia**.
- **CV vivo** (no snapshot, ver decisión 1).
- **`company_legal_name_snapshot` en JobPosting** (ver decisión 2).
- **Catálogo curado de skills con sugerencias** (ver decisión 5).
- **Payments inmutables** (ver decisión 6).

---

## Entidades Fase 1

### Núcleo de identidad y auth

#### `User` [F1]
- `id` (uuid, PK)
- `email` (único)
- `password_hash`
- `role` (`admin` | `company` | `candidate`)
- `is_active`, `email_verified_at`
- `created_at`, `updated_at`, `deleted_at` (soft delete)

Relaciones: `1—1` con `CompanyProfile` (si role=company), `1—1` con `CandidateProfile` (si role=candidate).

#### `AdminProfile` [F1]
- `user_id` (FK, PK)
- `full_name`, `created_by_admin_id`

#### `PasswordResetToken` [F1]
- `id`, `user_id`, `token_hash`, `expires_at`, `used_at`

#### `EmailVerificationToken` [F1]
- `id`, `user_id`, `token_hash`, `expires_at`, `used_at`

---

### Empresa

#### `CompanyProfile` [F1]
- `id` (uuid, PK)
- `user_id` (FK único → User)
- `legal_name` (razón social)
- `cuit` (único)
- `industry_id` (FK → Industry)
- `responsible_full_name`, `responsible_phone`, `responsible_email`
- `website`, `description`, `logo_url`
- `verification_status` (`pending` | `verified` | `rejected` | `suspended`)
- `verification_notes` (motivo de rechazo opcional)
- `verified_at`, `verified_by_admin_id`
- `is_anonymized` (bool, default false) — ver decisión 6
- `created_at`, `updated_at`, `deleted_at`

#### `CompanyVerificationDocument` [F1]
- `id`, `company_id` (FK)
- `file_url`, `file_name`, `mime_type`, `uploaded_at`

---

### Candidato

#### `CandidateProfile` [F1]
- `id` (uuid, PK)
- `user_id` (FK único → User)
- `first_name`, `last_name`, `phone`, `photo_url` (opcional)
- `birth_date`, `gender` (opcional)
- `location_zone_id` (FK → Zone)
- `expected_salary_min`, `expected_salary_max` (privadas), `currency`
- `summary` (texto libre)
- `cv_file_url`, `cv_uploaded_at` (un único CV activo; nuevo reemplaza)
- `accepts_remote`, `accepts_hybrid`, `accepts_onsite` (booleans)
- `created_at`, `updated_at`, `deleted_at`

#### `Experience` [F1]
- `id`, `candidate_id` (FK)
- `company_name`, `role_title`, `start_date`, `end_date` (nullable = actual)
- `description`

#### `Education` [F1]
- `id`, `candidate_id` (FK)
- `institution`, `degree`, `level` (`secundario` | `terciario` | `universitario` | `posgrado`)
- `start_date`, `end_date`, `in_progress` (bool)

#### `CandidateSkill` [F1] (pivot)
- `candidate_id`, `skill_id`, `level` (`básico` | `intermedio` | `avanzado` | `experto`)

#### `Language` [F1]
- `id`, `candidate_id`, `language_name`, `level` (`básico` | `intermedio` | `avanzado` | `nativo`)

---

### Catálogos compartidos

#### `Industry` [F1]
- `id`, `name`, `slug`, `is_active`

#### `Zone` [F1]
- `id`, `name`, `slug`, `is_active`
- Valores iniciales: Bahía Blanca, Monte Hermoso, Punta Alta, Coronel Suárez, etc.

#### `ContractType` [F1]
- `id`, `name` (Relación de dependencia, Monotributo, Freelance, Pasantía, etc.)

#### `Skill` [F1] — ver decisión 5
- `id`
- `name` (único entre las activas)
- `status` (`active` | `pending` | `rejected` | `merged`)
- `merged_into_id` (FK → Skill, nullable)
- `created_by_user_id` (FK → User, nullable)
- `approved_by_admin_id` (FK → User, nullable)
- `created_at`, `updated_at`

---

### Búsquedas y postulaciones

#### `JobPosting` [F1]
- `id`, `company_id` (FK, **nullable** — ver decisión 2)
- `company_legal_name_snapshot` (string fijo al momento de publicación)
- `title`, `description`, `requirements`
- `industry_id`, `zone_id`, `contract_type_id` (FKs)
- `modality` (`presencial` | `remoto` | `híbrido`)
- `min_experience_years`
- `min_education_level` (enum: `secundario` | `terciario` | `universitario` | `posgrado`)
- `salary_min`, `salary_max`, `salary_currency`, `salary_visible` (bool)
- `benefits` (texto)
- `status` (`draft` | `active` | `paused` | `closed`)
- `is_featured` (bool, derivado del `JobFeature` activo más reciente)
- `featured_until` (timestamp, cache de la fecha de fin del destacado activo)
- `published_at`, `closed_at`
- `created_at`, `updated_at`, `deleted_at`

#### `JobPostingSkill` [F1] (pivot)
- `job_posting_id`, `skill_id`, `is_required` (bool)

#### `Application` [F1]
- `id`, `candidate_id` (FK), `job_posting_id` (FK)
- `cover_letter` (texto libre, opcional)
- `status` (`new` | `seen` | `in_process` | `discarded` | `contacted`)
- `seen_at`, `status_updated_at`
- `created_at`, `updated_at`, `deleted_at`

**Constraint único:** `(candidate_id, job_posting_id)` — no se permite doble postulación.

**Nota:** sin `cv_snapshot_url` — el CV se accede vivo desde `CandidateProfile.cv_file_url` (ver decisión 1).

---

### Planes y monetización

#### `Plan` [F1] — ver decisión 4
- `id`, `code` (`free` | `pro` | `premium`), `name`, `description`
- `monthly_price`, `currency`
- `max_active_job_postings` (nullable = ilimitado)
- `max_visible_applications_per_posting` (nullable = ilimitado)
- `includes_psychometric_results` (bool)
- `includes_observatory_full` (bool)
- `included_featured_per_month` (int, default 0)
- `features_json` (JSONB, extensibilidad sin migración)
- `is_active` (bool)
- `created_at`, `updated_at`

#### `Subscription` [F1] — ver decisión 3
- `id`, `company_id` (FK), `plan_id` (FK)
- `status` (`active` | `past_due` | `canceled` | `expired`)
- `current_period_start`, `current_period_end`
- `cancel_at_period_end` (bool)
- `mp_subscription_id` (id externo en Mercado Pago, nullable para Free)
- `created_at`, `updated_at`

Regla: cada empresa tiene exactamente una `Subscription` (Free al nacer, cambia de `plan_id` en upgrades/downgrades).

#### `JobFeature` [F1]
- `id`, `job_posting_id` (FK)
- `payment_id` (FK → Payment, nullable hasta confirmar pago)
- `starts_at`, `ends_at`
- `status` (`pending_payment` | `active` | `expired` | `canceled`)
- `created_at`

#### `Payment` [F1] — ver decisión 6 (inmutable)
- `id`, `company_id` (FK, preservado aún si la empresa se anonimiza)
- `type` (`subscription` | `job_feature`)
- `amount`, `currency`
- `mp_payment_id` (único), `mp_preference_id`, `mp_status`
- `related_subscription_id` (nullable, FK)
- `related_job_feature_id` (nullable, FK)
- `paid_at`, `created_at`

#### `MercadoPagoWebhookEvent` [F1]
- `id`, `mp_event_id` (único), `topic`, `raw_payload` (JSONB)
- `processed_at`, `processing_error`, `received_at`

---

### Tests psicométricos

#### `PsychometricTest` [F1]
- `id`, `name`, `description`, `slug`
- `scoring_method` (`sum` | `average` | `scale`)
- `is_active`, `created_at`

#### `TestQuestion` [F1]
- `id`, `test_id` (FK)
- `text`, `order`
- `question_type` (`single_choice` | `likert`)

#### `TestQuestionOption` [F1]
- `id`, `question_id` (FK), `text`, `value` (numérico), `order`

#### `TestSubmission` [F1]
- `id`, `candidate_id` (FK), `test_id` (FK)
- `status` (`in_progress` | `completed`)
- `score` (calculado al completar)
- `started_at`, `completed_at`

#### `TestAnswer` [F1]
- `id`, `submission_id` (FK), `question_id` (FK), `selected_option_id` (FK)

---

### Alertas

#### `JobAlert` [F1]
- `id`, `candidate_id` (FK)
- `industry_id` (nullable), `zone_id` (nullable), `modality` (nullable)
- `is_active`, `last_sent_at`, `created_at`

#### `JobAlertNotification` [F1]
- `id`, `alert_id`, `job_posting_id`, `sent_at`
- Constraint único `(alert_id, job_posting_id)`.

---

### Observatorio Laboral

No requiere tablas dedicadas. Vistas SQL agregadas sobre `JobPosting`, `Application`, `Industry`, `Zone`. La granularidad pública vs Pro/Premium se controla a nivel endpoint/permisos.

---

### Auditoría e infraestructura mínima

#### `AuditLog` [F1]
- `id`, `admin_user_id`
- `action` (`verify_company` | `reject_company` | `suspend_company` | `takedown_posting` | `merge_skill` | ...)
- `target_entity`, `target_id`, `notes`, `created_at`

---

## Entidades Fase 2 (documentadas, no implementadas)

| Entidad | Para qué | Impacto en F1 |
|--------|----------|---------------|
| `CompanyMember` | Multi-usuario por empresa con roles internos (owner/recruiter/viewer). | En F2 se agrega esta tabla pivot. El owner actual de F1 se migra como `CompanyMember(role=owner)`. |
| `UserReport` | Reportes de usuarios sobre búsquedas o empresas. | Sin impacto en F1. |
| `Conversation` / `Message` | Mensajería interna empresa↔candidato. | Sin impacto en F1; estados de `Application` cubren el flujo externo. |
| `InAppNotification` | Centro de notificaciones in-app. | Sin impacto en F1 (solo mail). |
| `AIInterpretation` | Interpretación IA de tests psicométricos. | `TestSubmission` ya guarda respuestas crudas y score básico; F2 agrega esta tabla. |
| `CandidateMatchScore` | Scoring IA candidato↔búsqueda. | Tabla nueva, no modifica F1. |
| `ApplicationUnlockPurchase` | Pago por desbloquear postulaciones extra. | `Plan.max_visible_applications_per_posting` ya está en F1; F2 agrega tabla + endpoint de compra. |

---

## Diagrama de relaciones (resumen visual)

```
User 1—1 CompanyProfile 1—N JobPosting 1—N Application N—1 CandidateProfile 1—1 User
                  |                |                                |
                  |                +— 1—N JobPostingSkill            +— 1—N Experience
                  |                +— 1—N JobFeature N—1 Payment     +— 1—N Education
                  |                                                  +— 1—N CandidateSkill N—1 Skill
                  +— 1—N CompanyVerificationDocument                 +— 1—N Language
                  +— 1—1 Subscription N—1 Plan                       +— 1—N TestSubmission N—1 PsychometricTest
                  +— 1—N Payment                                     +— 1—N JobAlert
                                                                     +— 0—1 cv_file (CandidateProfile.cv_file_url)

PsychometricTest 1—N TestQuestion 1—N TestQuestionOption
TestSubmission   1—N TestAnswer

Industry, Zone, ContractType, Skill → catálogos referenciados por varias entidades.
```

---

*Documento del modelo de entidades — Paso 2.*
*Validado por el usuario antes del Paso 3.*
