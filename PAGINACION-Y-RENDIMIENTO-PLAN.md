# Paginación y rendimiento — plan técnico (v2, corregido)

> Pedido de Gael, 19/08/2026: *"quiero que hagas más paginación... que se optimicen recursos
> para postulantes, empresas, admin y visitantes comunes, y funcione todo fluidamente"*.
>
> **v2 — reescrito el 19/08 tras una auditoría contra el código y la base de producción.**
> La v1 tenía cinco afirmaciones falsas y se perdía el N+1 más grande de la app. Lo que se
> corrigió está marcado con ⚠️ para que quede el rastro y no se repita el error.

---

## 1. Diagnóstico, con los números reales

Volumen de producción hoy:

| Tabla | Filas |
|---|---|
| `candidate_activity_log` | **1.057** ← la más grande |
| `candidate_profiles` | 143 (128 en la Base de Talento) |
| `application_status_history` | 82 |
| `applications` | 70 |
| `job_postings` | **12** |
| `company_profiles` | 9 |

⚠️ **Corrección importante sobre la v1.** La v1 decía que los índices faltantes eran 🔴 alta
gravedad y "lo que más rinde". **Es falso.** Con 12 búsquedas y 143 candidatos, Postgres elige
*seq scan* porque **es el plan correcto** — la búsqueda pública corre en **0,168 ms**. Cualquier
índice que agreguemos hoy el planner lo va a ignorar.

Los índices son **un seguro a futuro**, no una mejora de hoy. Lo que sí cuesta recursos **ahora
mismo** es el N+1.

| # | Problema | Cuesta hoy | Riesgo de romper algo |
|---|---|---|---|
| **A** | N+1 de consultas (5 lugares) | 🔴 sí, mucho | ninguno — no cambia interfaces |
| **B** | Fan-out HTTP del frontend | 🔴 sí | bajo |
| **C** | Paginación ausente | 🟡 todavía no | medio — cambia contratos |
| **D** | Índices faltantes | 🟢 no | ⚠️ **puede dejar el server sin levantar** |

**El orden se invierte respecto de la v1: primero el N+1, los índices al final.**

---

## 2. Problema A — Los cinco N+1

### A0 · `GET /admin/candidates` — **716 consultas para una pantalla** 🔴

⚠️ *La v1 no lo detectó. Es el peor de todos.*

`backend/app/api/v1/admin.py:520-530`. Por **cada** candidato: 1 consulta de `educations`
(`:522`) **más** `compute_profile_completion_for_candidate` (`:530`), que hace 4 consultas
(`services/profile_completion.py:74-86`). Son **5 por candidato × 143 = 716**.

### A1 · Postulantes de una búsqueda — en **dos** archivos

- Empresa: `applications.py:289`
- Admin: `admin.py:661` ⚠️ *la v1 sólo vio el primero. Arreglar uno y no el otro deja el
  trabajo a la mitad.*

Mismo `compute_profile_completion_for_candidate` dentro del `for`.

### A2 · Buscador de la Base de Talento

`talent.py:188-290` (`_armar_perfil`): 4 consultas + zona + mail = **6 por perfil**. Con
`limit=50`, **300 por página**.

Y ⚠️ (corrección): `talent.py:440` trae **todos** los perfiles y `:469` corta en memoria
**siempre**, no sólo cuando vienen los filtros de experiencia como decía la v1.

### A3 · El recordatorio automático de perfil — el que no se arregla paginando

⚠️ *La v1 no lo detectó.*

`backend/app/core/scheduler.py:112-116`. `send_profile_reminders()` levanta **todos** los
candidatos y llama a la misma función uno por uno: **573 consultas cada 24 horas**. Con 5.000
candidatos serían **20.001 en una sola corrida**. Acá no hay pantalla que paginar: la única
salida es batchear.

### La solución, que es una sola para los cuatro

Una función nueva en `services/profile_completion.py`:

```python
async def compute_profile_completion_bulk(db, profiles) -> dict[UUID, Completion]
```

Resuelve la existencia de experiencia, educación, habilidades e idiomas para **todos** los
candidatos de una vez, con 4 consultas `WHERE candidate_id IN (…) GROUP BY`, y calcula los
porcentajes en memoria. Pasa de `4N+1` a **5 consultas fijas**, sin importar cuántos sean.

Los cuatro lugares pasan a usarla. `compute_profile_completion_for_candidate` queda sólo para
el caso de **un** candidato suelto.

Para A2 se agrega además `_armar_perfiles(db, perfiles)`, que trae experiencias, educaciones,
habilidades e idiomas de toda la página con `IN (…)`, y resuelve las zonas con un diccionario
(el catálogo tiene 6 filas).

---

## 3. Problema B — El fan-out del frontend

⚠️ *La v1 no lo detectó, y es el peor caso medido de punta a punta.*

`frontend/src/app/dashboard/company/estadisticas/page.tsx:31-35` dispara **un
`GET /me/company/jobs/{id}/applications` por cada búsqueda** de la empresa, en `Promise.all`.
Y cada uno de esos requests dispara adentro el N+1 de A1. O sea:

```
búsquedas × postulantes × 4 consultas, todo en paralelo contra la misma base
```

**Y es redundante:** la línea 39 del mismo archivo ya pide `/me/company/applications/stats`,
que trae los agregados calculados en batch (`services/applicant_stats.py:198-224`, ya sin N+1).

**Qué se hace:** sacar el `Promise.all` y usar el agregado que ya se está pidiendo. No es
paginar: es **borrar** requests que no hacían falta.

---

## 4. Problema C — La paginación

### El inventario real

⚠️ La v1 decía "30 endpoints, 4 paginan". Son **35**, y **sólo 2 paginan de verdad**:

| Endpoint | Estado real |
|---|---|
| `GET /jobs` | ✅ `page` + `page_size` + `total` |
| `GET /me/company/talent` | ✅ `limit` + `offset` |
| `GET /companies/verified` | ❌ `limit` **sin offset** — es un **truncamiento** |
| `GET /admin/talent/unlocks` | ❌ ídem, tope 500 sin offset |
| `GET /me/notifications` | ❌ `.limit(50)` fijo |

**El truncamiento es peor que no paginar, porque no se ve.** Hoy la empresa n.º 101 **no se
puede ver nunca** desde `/empresas`, y el registro de "quién accedió a los datos de un
candidato" se corta en 500 sin avisar — justo el que existe para poder responderle a alguien
que pregunta por sus datos.

### El contrato

Se adopta el de `GET /jobs`, que ya funciona y el frontend ya sabe consumir:

```jsonc
{ "items": [...], "total": 137, "page": 1, "page_size": 20 }
```

Con un `Paginated[T]` genérico en `app/schemas/common.py`.

### Prioridad

**Tanda 1** — `/me/company/jobs/{id}/applications`, `/admin/jobs/{job_id}/applications`,
`/admin/candidates`, `/admin/companies`, `/admin/jobs`, `/me/company/talent`.

**Tanda 2** — `/me/candidate/applications`, `/me/company/jobs`, `/admin/contact-messages`,
`/admin/features`, `/me/company/features`, `/admin/talent/packs`,
`/admin/talent/unlocks` y `/companies/verified` (los dos truncamientos), `/me/notifications`,
y ⚠️ **`/admin/candidates/{id}/activity`**, que la v1 había descartado por error: sale de
`candidate_activity_log`, la tabla más grande de la base (1.057 filas), que crece con **cada**
edición de perfil y **cada** postulación (9 puntos de escritura).

**Tanda 3, no se tocan** — catálogos (alimentan `<select>`), y lo que cuelga de una sola
postulación: `application_status_history` tiene 82 filas y ~7 estados por postulación, está
acotado de verdad.

---

## 5. El frontend

⚠️ **El patrón ya existe: no se escribe de cero.** `frontend/src/app/empleos/page.tsx:90-137`
ya implementa el armado de parámetros y un `loadMore()` que acumula
(`setJobs(prev => [...prev, ...r.data.items])`) contra el contrato `{items, total}`.
**Se extrae de ahí**, no se reinventa.

### Los 9 archivos de la tanda 1

| Endpoint | Archivo | Línea |
|---|---|---|
| `/me/company/jobs/{id}/applications` | `company/postulaciones/page.tsx` | 57 |
| | `company/busquedas/page.tsx` | 72 |
| | `company/estadisticas/page.tsx` | 31-35 — **se rehace, no se pagina** (§3) |
| `/admin/jobs/{id}/applications` | `admin/busquedas/page.tsx` | 88 |
| | `admin/empresas/page.tsx` | 133 |
| `/admin/candidates` | `admin/candidatos/page.tsx` | 53 |
| `/admin/companies` | `admin/empresas/page.tsx` | 43 |
| | `admin/talento/page.tsx` | 57 |
| `/admin/jobs` | `admin/busquedas/page.tsx` | 62 |
| `/me/company/talent` | `company/talento/page.tsx` | 109-113, 119, 128 |

### El detalle que se olvida siempre

Al cambiar un filtro, **volver a la página 1**. Si estás en la página 4 y filtrás, lo más
probable es que el resultado tenga una sola página y la pantalla quede vacía sin explicación.
Va en el hook, no en cada pantalla.

---

## 6. Problema D — Índices (últimos, y sin `CONCURRENTLY`)

### ⚠️ El error de la v1 que habría roto el deploy

La v1 decía usar `CREATE INDEX CONCURRENTLY` con `op.execute("COMMIT")`. **Está mal:**
`alembic/env.py:47-54` usa `async_engine_from_config` sobre **asyncpg**, y ese truco es de la
era psycopg2 síncrono — con SQLAlchemy 2.x + asyncpg desincroniza el estado de transacción del
driver.

**Decisión: no se usa `CONCURRENTLY`.** Sobre tablas de 12 a 1.057 filas, un `CREATE INDEX`
normal tarda milisegundos y no bloquea nada perceptible. `CONCURRENTLY` no compra nada acá y
trae el riesgo real: si falla a medias deja un índice `INVALID`, el reintento tira
"already exists", y como el Dockerfile arranca con `alembic upgrade head && uvicorn`,
**el servidor no levanta**.

### Los índices, corregidos

```
ix_experiences_candidate_id        experiences(candidate_id)
ix_educations_candidate_id         educations(candidate_id)
ix_languages_candidate_id          languages(candidate_id)
ix_applications_job_posting_id     applications(job_posting_id)
ix_job_postings_company_id         job_postings(company_id)
ix_job_postings_publicas           job_postings(status, moderation_status,
                                     is_featured DESC, published_at DESC)
                                     WHERE deleted_at IS NULL
ix_candidate_profiles_zone         candidate_profiles(location_zone_id)
ix_company_profiles_verificacion   company_profiles(verification_status, verified_at DESC)
ix_job_features_payment_id         job_features(payment_id)
ix_payments_company_type           payments(company_id, type)
ix_contact_messages_pendientes     contact_messages(resolved, created_at DESC)
```

⚠️ Tres correcciones sobre la v1:

1. **El compuesto de la búsqueda pública estaba mal armado.** La v1 ponía
   `(status, moderation_status, published_at DESC)`. El código real (`jobs.py:200-204, 248`)
   ordena por `is_featured DESC, published_at DESC` y filtra `deleted_at IS NULL`. Sin
   `is_featured` en el índice, Postgres mete un `Sort` igual y la tercera columna no sirve.
2. **Se cae el índice parcial de la Base de Talento.** La v1 lo justificaba diciendo que "la
   mayoría no dio consentimiento". Es al revés: **128 de 143 (90%)** sí dieron. Un índice
   parcial que cubre el 90% de la tabla no ahorra nada.
3. **`candidate_skills` no lleva índice**: su PK ya es `(candidate_id, skill_id)`.

### ⚠️ Lo que los índices NO van a arreglar

Todos los buscadores por texto son `ILIKE '%…%'`: `jobs.py:218-222`, `admin.py:498`,
`applications.py:257`, `talent.py:426`. **Ningún índice B-tree sirve para eso.** Haría falta
`pg_trgm` + GIN, y la extensión **no está instalada**. No entra en esta tanda, pero queda
dicho: la v1 prometía "de Seq Scan a Index Scan" para el filtro más usado del portal, y era
falso.

---

## 7. Riesgos de contrato — lo que se rompe si no se mira

1. **`/me/company/talent` devuelve `results`, no `items`** (`talent.py:124-127`), y además
   `credits_available`, que la pantalla usa para saber si puede desbloquear. **Ese campo tiene
   que sobrevivir al refactor**: si se migra al genérico a ciegas, se pierde.
2. **`/admin/companies` tiene dos consumidores**, y uno alimenta un `<select>`
   (`admin/talento/page.tsx:57`, con `?status=verified`). Si se pagina, el selector se queda
   con las primeras 20 empresas y no hay forma de elegir el resto. Necesita `page_size` alto
   explícito o un endpoint de catálogo aparte.
3. **`/me/company/jobs` alimenta cuatro pantallas**, dos como `<select>`. Mismo problema
   cuando le toque en la tanda 2.
4. Fuera de `frontend/src` **no hay otros consumidores**: los tests son unitarios sin HTTP y
   `seed.py` va directo a la base. Verificado.

---

## 8. Orden de ejecución

1. **`compute_profile_completion_bulk`** y los 4 llamadores (A0, A1 ×2, A3).
2. **`_armar_perfiles`** en la Base de Talento (A2) + corte de página en SQL.
3. **El fan-out de `company/estadisticas`** (§3) — borrar requests, no paginar.
4. **Índices** (§6), sin `CONCURRENTLY`, verificando con `EXPLAIN` antes y después.
5. **`Paginated[T]`** + tanda 1, backend y frontend **en el mismo deploy** (cambia el contrato).
6. **Tanda 2.**

Los pasos 1 a 4 **no tocan el frontend ni cambian ninguna interfaz**: se pueden deployar
sueltos y sin coordinar.

---

## 9. Cómo se verifica

1. **Contar consultas por request.** Meta: **< 10** en Postulantes y en `/admin/candidates`,
   sin importar cuántos haya.
2. **`EXPLAIN ANALYZE`** antes y después de los índices. Con el volumen actual es esperable que
   el planner los siga ignorando — eso **no** es un fracaso, es la confirmación de que son un
   seguro y no una mejora de hoy.
3. Las 9 pantallas cargan, filtran, pasan de página y vuelven.

---

## 10. Fuera de alcance, pero anotado

- **`GET /admin/applications/stats`** (`admin.py:600-621`): sin `job_id` levanta a memoria
  todos los candidatos con postulaciones y sus datos. Está bien batcheado, pero es una lectura
  sin techo que tarde o temprano hay que bajar a agregados SQL.
- **Caché de `/public/landing-stats`** (`landing.py:100`): 4 `COUNT(*)` en **cada visita a la
  home**, que es la página más visitada y no depende de ningún usuario. La v1 descartaba la
  caché de plano; acá sí tiene sentido, porque no hay ningún N+1 que esconder.
- **El scheduler corre por instancia** (`main.py:33`). Si Railway escala a 2 réplicas, los
  recordatorios se mandan duplicados.
- **`CLAUDE.md` está desactualizado**: dice que la app se conecta como superusuario `postgres`.
  En producción ya es `app_user`, con `rolsuper = false`.
- **`pg_trgm` + GIN** para los buscadores por texto.
