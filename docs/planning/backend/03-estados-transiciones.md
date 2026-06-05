# Paso 3 — Estados y transiciones

> Estados posibles y transiciones válidas para cada entidad de Fase 1 con ciclo de vida no trivial.
> Las entidades puramente CRUD (Industry, Zone, ContractType, Experience, Education, Language, etc.) no figuran porque no tienen máquina de estados.

---

## 1. `User`

Estados simples (no es una máquina de estados pura, sino flags):

- `is_active = true | false` — el admin o el propio usuario pueden desactivar la cuenta.
- `email_verified_at = null | timestamp` — sin verificar / verificado.
- `deleted_at = null | timestamp` — soft-deleted.

**Transiciones.**
- Registro → `is_active=true`, `email_verified_at=null`.
- Verificación de email → `email_verified_at=now()`.
- Desactivación por admin → `is_active=false`.
- Reactivación → `is_active=true`.
- Solicitud de baja → `deleted_at=now()` (soft delete del User; los perfiles asociados se desactivan en cascada).
- Hard delete (Ley 25.326, bajo solicitud) → el User puede borrarse físicamente; los `Payment` quedan vinculados al `company_id` (que pasa a anonimizado).

**Regla:** un User con `deleted_at` o `is_active=false` no puede loguearse. Los tokens emitidos previamente deben rechazarse (mecanismo a definir en Paso 6: blacklist o claim de versión).

---

## 2. `CompanyProfile` — verificación

Estados de `verification_status`:

```
pending ──aprobar──▶ verified
   │                    │
   │                    ├──suspender──▶ suspended
   │                    │                   │
   │                    ◀──reactivar────────┘
   │
   └──rechazar──▶ rejected ──reaplicar──▶ pending
```

**Transiciones permitidas.**

| Origen | Destino | Acción | Quién |
|--------|---------|--------|-------|
| `pending` | `verified` | aprobar verificación | admin |
| `pending` | `rejected` | rechazar verificación (con `verification_notes` opcional, se notifica por mail) | admin |
| `rejected` | `pending` | la empresa edita datos y vuelve a solicitar verificación | empresa |
| `verified` | `suspended` | el admin detecta irregularidades | admin |
| `suspended` | `verified` | reactivación | admin |

**Restricciones operativas por estado.**
- `pending`, `rejected`, `suspended` → la empresa **no puede** publicar búsquedas ni ver postulaciones. Las búsquedas existentes en `active` se pausan automáticamente al pasar a `suspended` (efecto colateral documentado en `JobPosting`).
- `verified` → operación normal.

**Levantamiento de suspensión.** Cuando una empresa pasa de `suspended` a `verified`, las búsquedas que fueron pausadas automáticamente **NO se reactivan**. Quedan en `paused` y la empresa decide manualmente cuáles republicar. Decisión consciente: evita resucitar búsquedas viejas que ya no aplican.

---

## 3. `CompanyProfile` — ciclo de vida (delete / anonimización)

Independiente de `verification_status`:

```
active ──soft delete──▶ soft-deleted ──recuperar──▶ active
   │                        │
   │                        └──hard delete excepcional──▶ anonimizada
   │
   └──hard delete excepcional (Ley 25.326)──▶ anonimizada
```

- **Activa:** `deleted_at = null`, `is_anonymized = false`.
- **Soft-deleted:** `deleted_at` no nulo, `is_anonymized = false`. Datos intactos, recuperable por admin.
- **Anonimizada:** `is_anonymized = true`, campos identificatorios reemplazados por placeholders. Irrecuperable. La fila persiste para mantener FK desde `Payment`.

**Impacto en otras entidades al anonimizar.**
- `JobPosting.company_id` puede setearse a NULL en búsquedas históricas (alternativamente, se mantiene la FK pero la UI muestra "Empresa no disponible" usando `company_legal_name_snapshot`).
- `Payment` se mantiene intacto (decisión 6).

---

## 4. `JobPosting`

```
        ┌────────┐
        │ draft  │
        └───┬────┘
            │ publicar
            ▼
        ┌────────┐  pausar   ┌────────┐
   ┌───▶│ active │──────────▶│ paused │
   │    └───┬────┘           └───┬────┘
   │ reanudar  │ cerrar           │ cerrar
   └───────────┴──────────────┐   │
                              ▼   ▼
                          ┌────────┐
                          │ closed │  (terminal)
                          └────────┘
```

**Transiciones.**

| Origen | Destino | Acción | Quién |
|--------|---------|--------|-------|
| (nuevo) | `draft` | crear sin publicar | empresa |
| `draft` | `active` | publicar | empresa (si verified + dentro del límite del plan) |
| `active` | `paused` | pausar | empresa |
| `paused` | `active` | reanudar | empresa |
| `active` | `closed` | cerrar | empresa o admin (takedown) |
| `paused` | `closed` | cerrar | empresa o admin |

**Reglas.**
- `closed` es **terminal**. Para republicar, la empresa crea una nueva búsqueda.
- Si la empresa pasa a `suspended` → todas sus búsquedas `active` se pasan a `paused` automáticamente.
- El listado público (`GET /jobs`) solo muestra `status=active`.
- Una búsqueda con `JobFeature` activo que sea pausada o cerrada no extiende ni reembolsa el destacado (se documenta en términos y condiciones).

---

## 5. `JobFeature` (destacado pago)

```
pending_payment ──pago confirmado──▶ active ──vencimiento──▶ expired
       │                                 │
       │                                 └──refund/cancel admin──▶ canceled
       │
       └──pago rechazado / expirado──▶ canceled
```

**Transiciones.**

| Origen | Destino | Trigger |
|--------|---------|---------|
| (nuevo) | `pending_payment` | empresa solicita destacar; se crea preferencia en MP |
| `pending_payment` | `active` | webhook MP confirma `approved` (job: setea `starts_at=now()`, `ends_at=now()+duration`) |
| `pending_payment` | `canceled` | webhook MP confirma `rejected` o expira sin pago (timeout configurable) |
| `active` | `expired` | proceso programado cuando `now() > ends_at` |
| `active` | `canceled` | acción manual del admin (caso excepcional) |

**Efecto en `JobPosting`.**
- Al pasar `JobFeature` a `active`: `JobPosting.is_featured=true`, `featured_until=ends_at`.
- Al pasar a `expired`/`canceled`: si no hay otro `JobFeature` activo, `is_featured=false`.

---

## 6. `Application`

```
new ──ver──▶ seen ──avanzar──▶ in_process ──┬──▶ contacted
                                            └──▶ discarded

  cualquier estado ──▶ discarded
  in_process / contacted ──▶ in_process (volver atrás permitido)
```

**Transiciones.**

| Origen | Destino | Acción | Quién |
|--------|---------|--------|-------|
| (nuevo) | `new` | el candidato se postula | candidato |
| `new` | `seen` | la empresa abre el detalle de la postulación (automático) | empresa (auto) |
| `seen` | `in_process` | la empresa marca "en proceso" | empresa |
| `in_process` | `contacted` | la empresa marca como "contactado" | empresa |
| cualquier estado salvo `discarded` | `discarded` | empresa descarta la postulación | empresa |
| `contacted` | `in_process` | la empresa retrocede el estado (corrección manual) | empresa |

**Reglas.**
- El candidato no controla el estado de su `Application`. Solo ve el estado actual.
- `discarded` no es terminal: la **empresa puede revertirlo** desde su propio panel (error humano normal — clic equivocado, evaluación apresurada). Todo cambio de estado se registra en `AuditLog` (quién, cuándo, de qué a qué) para trazabilidad interna.
- No se permite eliminar `Application` por la empresa; solo cambiar de estado.
- Si el candidato hace hard delete (Ley 25.326): la `Application` se anonimiza, no se borra.

---

## 7. `Subscription`

```
                ┌─── upgrade/downgrade ───┐
                │                          │
active ──renueva──▶ active                 │
   │                                       │
   │ falla cobro                           │
   ▼                                       │
past_due ──pago ok dentro de 7d──▶ active ◀┘
   │
   │ 7 días sin pagar
   ▼
expired ──pago manual/upgrade──▶ active (vuelta a Free implícito si nada se hace)

active ──cancel_at_period_end=true──▶ active (hasta fin de período) ──▶ canceled
canceled ──reactivar / nuevo upgrade──▶ active
```

**Transiciones.**

| Origen | Destino | Trigger |
|--------|---------|---------|
| (nuevo: empresa creada) | `active` (plan=free) | creación de empresa |
| `active` (free) | `active` (pro/premium) | upgrade tras pago MP confirmado |
| `active` (pro/premium) | `active` (free) | downgrade al fin del período (si `cancel_at_period_end=true`) |
| `active` | `past_due` | webhook MP indica fallo de cobro de renovación |
| `past_due` | `active` | pago resuelto dentro de 7 días |
| `past_due` | `expired` | 7 días sin resolver |
| `expired` | `active` (free) | job programado degrada a Free automáticamente |
| `active` | `canceled` | usuario cancela al final del período → al cerrar, vuelve a Free |

**Regla operativa (invariante).** Una empresa **siempre** tiene exactamente una `Subscription` en estado `active` en todo momento. Cuando una `Subscription` transiciona a `canceled` o `expired`, un job de degradación **crea inmediatamente una nueva `Subscription` al plan Free** (con `plan_id=free`, `status=active`). La `Subscription` anterior queda en su estado terminal como histórico (no se borra).

**Por qué.**
- Simplifica permisos: la consulta siempre es "la `Subscription` activa de la empresa", sin fallback "si no hay, asumir Free".
- Histórico claro: queda registro temporal de los cambios de plan.
- Soporta futuras variantes (ej. múltiples planes Free con beneficios distintos) sin reescribir la lógica.

El job de degradación corre automáticamente cuando ocurre la transición a `canceled`/`expired`.

---

## 8. `Payment` (estado externo de Mercado Pago)

`Payment` no tiene una máquina de estados propia: replica el estado de MP en `mp_status`.

Valores típicos esperados de MP: `pending` | `approved` | `authorized` | `in_process` | `rejected` | `refunded` | `cancelled` | `charged_back`.

**Reglas.**
- Solo `approved` dispara efectos en negocio (activar `JobFeature`, activar/renovar `Subscription`).
- `refunded` / `charged_back` en una `subscription` → degrada al plan Free. En `job_feature` → pasa a `canceled` y se quita destacado.
- Todo cambio de `mp_status` se persiste; nunca se borra el row. Idempotencia por `mp_payment_id` único.

---

## 9. `Skill` (catálogo curado)

```
pending ──aprobar──▶ active
   │
   ├──rechazar──▶ rejected (terminal)
   │
   └──fusionar con X──▶ merged (apunta a X canónica, terminal)

active ──fusionar con Y──▶ merged
active ──desactivar admin──▶ rejected (caso excepcional)
```

**Transiciones.**

| Origen | Destino | Acción | Quién |
|--------|---------|--------|-------|
| (nuevo, sugerido por candidato) | `pending` | candidato propone | candidato |
| (nuevo, cargado por Talency) | `active` | alta directa | admin |
| `pending` | `active` | aprobar | admin |
| `pending` | `rejected` | rechazar | admin |
| `pending` | `merged` | fusionar con una skill canónica | admin |
| `active` | `merged` | fusionar tardíamente (con migración de `CandidateSkill` y `JobPostingSkill`) | admin |
| `active` | `rejected` | desactivar (caso raro) | admin |

**Reglas.**
- Solo `active` aparece en autocompletes.
- `merged` apunta a su canónica vía `merged_into_id`. La canónica debe estar `active`.
- Toda fusión dispara una migración interna: los pivots `CandidateSkill` / `JobPostingSkill` se reapuntan a la canónica (en transacción), evitando duplicados con `ON CONFLICT DO NOTHING`.

---

## 10. `TestSubmission`

```
in_progress ──completar──▶ completed (terminal)
```

**Transiciones.**

| Origen | Destino | Trigger |
|--------|---------|---------|
| (nuevo) | `in_progress` | el candidato inicia el test |
| `in_progress` | `completed` | el candidato envía la última respuesta. Se calcula `score` según `PsychometricTest.scoring_method` |

**Reglas.**
- Un candidato puede tener múltiples `TestSubmission` para el mismo test, pero con **cooldown de 30 días** entre intentos completados (se valida al iniciar un nuevo intento; intentos anteriores en `in_progress` deben cerrarse o descartarse antes).
- La **empresa ve solo el último intento `completed`**. No accede al historial.
- El **candidato ve su historial completo** en su panel (fecha de cada intento + score), para visualizar su evolución personal.
- `in_progress` sin actividad por N días puede expirarse (job de limpieza, política a definir en Paso 6).

**Razón del cooldown.** Sin restricción, el test pierde validez (se rehace hasta sacar el resultado deseado). Sin posibilidad de reintentar nunca, no refleja que las personas cambian y se desarrollan. 30 días es el balance.

---

## Reglas transversales

- **Todo cambio de estado se loguea** cuando lo dispara un admin (en `AuditLog`).
- **Toda transición valida el origen** en código: rechazar cambios de estado ilegales con error 409.
- **Triggers automáticos documentados** (no son acciones de usuario):
  - Suspensión de empresa → pausa de búsquedas activas.
  - Vencimiento de `JobFeature` → quita destacado de la búsqueda.
  - Fallo de cobro → `Subscription.past_due` + job de degradación a los 7 días.
  - Hard delete de candidato → anonimización de `Application`.

---

*Documento de estados y transiciones — Paso 3.*
*A validar por el usuario antes del Paso 4.*
