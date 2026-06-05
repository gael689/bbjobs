# Paso 2a — Decisiones críticas del modelo de datos

> Seis decisiones que condicionan el modelo de entidades de la Fase 1.
> Todas validadas con el usuario antes de avanzar al Paso 3.

---

## 1. CV: referencia viva, no snapshot

**Decisión.** La empresa siempre ve el CV actualizado del candidato. No se guarda snapshot por postulación.

**Razón.** Refleja la realidad del proceso: si el candidato mejora su CV durante la selección, la empresa quiere la versión más reciente.

**Implicancias UX (deben implementarse).**
- En el perfil del postulante visto por la empresa: mostrar "CV actualizado hace N días".
- Cuando el candidato actualiza su CV: aviso "Las empresas a las que ya te postulaste verán tu CV actualizado".

**Cumplimiento legal (Ley 25.326).**
- Hard delete del candidato → se borra el archivo de CV.
- Las postulaciones del candidato se **anonimizan** (no se eliminan).
- La empresa ve "Candidato eliminado" en su listado histórico de postulaciones.

**Impacto en el modelo.** `Application` NO necesita columna `cv_snapshot_url`. La empresa accede al CV vía `CandidateProfile.cv_file_url`.

---

## 2. Snapshot del nombre legal de la empresa en JobPosting

**Decisión.** `JobPosting` guarda `company_legal_name_snapshot` (string fijo al momento de publicación) además del FK `company_id`.

**Razón.** Permite mantener integridad histórica del Observatorio Laboral incluso si la empresa se da de baja o se anonimiza.

**Reglas de exposición pública.**
- Empresa activa → se muestra el nombre actual de la empresa.
- Empresa soft-deleted → se muestra "Empresa dada de baja".
- Empresa hard-deleted / anonimizada → se muestra "Empresa no disponible".

**Impacto en el modelo.**
- `JobPosting.company_id` es FK nullable (acepta NULL si la empresa hizo hard delete excepcional).
- `JobPosting.company_legal_name_snapshot` se persiste y nunca se actualiza después de la publicación.
- Para el Observatorio Laboral, los datos agregados pueden seguir computándose aunque `company_id` sea NULL.

---

## 3. Plan Free implícito vs explícito

**Decisión.** Toda empresa nace con una `Subscription` activa al plan Free (opción explícita).

**Razón.** Uniformidad. Siempre hay una `Subscription` vigente → toda la lógica de permisos consulta `subscription.plan` sin casos especiales.

**Implicancias.**
- Al crear una empresa: se crea automáticamente una `Subscription(plan_id=free, status=active, current_period_end=null o "infinito")`.
- Upgrade a Pro/Premium: se actualiza `plan_id` y se setea ciclo de cobro.
- Downgrade desde Pro/Premium al final del período: vuelve a Free (no se cancela la `Subscription`, solo cambia el `plan_id`).
- Cancelación: marca `cancel_at_period_end=true`; al cerrar el período, transición a Free.

---

## 4. Planes configurables desde panel admin

**Decisión.** Talency define los límites y beneficios de cada plan desde el panel admin. Sin hardcodear en código.

**Aún no definido (lo define Talency más adelante).**
- Cantidad de búsquedas activas / mes en Free y Pro.
- Cantidad de postulaciones visibles por búsqueda en Free.
- Cantidad de destacados incluidos en Pro/Premium.
- Precios mensuales finales.

**Estructura sugerida del modelo `Plan`.** Columnas tipadas por feature conocida en Fase 1, más un `features_json` (JSONB) para extensibilidad futura sin migraciones.

```
Plan
- id, code (free|pro|premium), name, description
- monthly_price, currency
- max_active_job_postings (nullable = ilimitado)
- max_visible_applications_per_posting (nullable = ilimitado)
- includes_psychometric_results (bool)
- includes_observatory_full (bool)
- included_featured_per_month (int)
- features_json (JSONB) — para features nuevas sin migrar
- is_active (bool)
```

**Implicancia.** La lógica de chequeo de permisos lee del row de `Plan` actualmente activo para la empresa. Cambios en el panel impactan inmediatamente sin deploy.

---

## 5. Skills: catálogo cerrado curado + sugerencias del candidato

**Decisión.** Catálogo cerrado curado por Talency. El candidato puede proponer skills nuevas que entran en estado `pending`. Talency aprueba, rechaza o fusiona.

**Razón.** Catálogo limpio sin duplicados ("React" vs "ReactJS" vs "react.js"), autonomía del candidato, crecimiento orgánico según demanda real del mercado bahiense.

**Modelo de `Skill`.**

```
Skill
- id
- name (único entre las activas)
- status (active | pending | rejected | merged)
- merged_into_id (FK → Skill, nullable; si fue fusionada apunta a la canónica)
- created_by_user_id (FK → User, nullable; null si la cargó Talency directo)
- approved_by_admin_id (FK → User, nullable)
- created_at, updated_at
```

**Flujo de fusión.**
- Talency marca una skill como `merged` con `merged_into_id` apuntando a la canónica.
- Todos los `CandidateSkill` y `JobPostingSkill` que apuntan a la skill fusionada se reapuntan a la canónica (transacción de migración interna).
- Las skills `rejected` o `merged` no aparecen en autocompletes.

**Frontend candidato.** Autocomplete contra skills `status=active`. Si no encuentra: "¿No la encontraste? Sugerí una".

---

## 6. Payments inmutables (jamás se borran)

**Decisión.** Los registros de `Payment` nunca se eliminan, ni siquiera bajo hard delete excepcional de una empresa.

**Razón.** Trazabilidad fiscal y contable.

**Mecanismo para hard delete de empresa.**
- Se introduce un estado adicional: **empresa anonimizada** (distinto de soft-deleted recuperable).
- `CompanyProfile` agrega flag `is_anonymized` (bool).
- Al anonimizar: se nullean / reemplazan por placeholders los campos identificatorios (`legal_name`, `cuit`, `responsible_*`, `website`, `logo_url`, `description`).
- El row de `CompanyProfile` sigue existiendo para mantener la FK desde `Payment`.
- En el panel admin / reportes financieros: se muestra "Empresa anonimizada (ID: NNN)".

**Estados resultantes de `CompanyProfile`.**
- Activa (verified)
- Soft-deleted (deleted_at no nulo, datos intactos, recuperable)
- Anonimizada (`is_anonymized=true`, datos placeholder, irrecuperable, FK preservada)

---

*Documento de decisiones críticas — Paso 2a*
*Validado por el usuario antes del Paso 3.*
