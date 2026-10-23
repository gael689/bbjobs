# Buscador y estrella de postulantes, para empresas y admin: plan (22/10/2026)

Pedido de Eugenia, por Gael: dentro de **cada búsqueda**, un buscador de postulantes (edad, nombre,
apellido, puesto, experiencia, empresa donde trabajó; ej. "técnico electromecánico"), con
paginación de verdad e índices/caché donde haga falta. Y poder **marcar con una estrella** al
postulante que le gustó, para no tener que volver a encontrarlo, y filtrar por la estrella y por
el estado. Lo mismo para el admin, en los postulantes de cada búsqueda.

Plan armado leyendo el código (solo lectura) sobre `origin/main` (`ad784aa`, producción). Amplía
y reemplaza el §4.1 (M1) de `MEJORAS-Y-MAILS-EMPRESAS-OCTUBRE-PLAN.md` y suma P5 de ese plan
(marca de "visto" del admin). **No depende de los mails**, que siguen sin salir.

## Decidido (Gael, 22/10/2026)

- **Solo la estrella**, sin una lista de etiquetas. Se suman más si hacen falta.
- **La estrella no le avisa al postulante** y el postulante nunca la ve.
- **Filtrar por estado:** sí.
- **Admin:** dentro de cada búsqueda, con los mismos filtros y la estrella. Por ahora no va una
  pantalla global de "Postulaciones".
- **Cada lado tiene su estrella:** la de la empresa no la ve Talency y la de Talency no la ve la
  empresa.
- **Marca de "visto" del admin (P5 de Eugenia):** va en este mismo trabajo.

---

## 1. Lo que hay hoy en producción

| Pieza | Estado | Dónde |
|---|---|---|
| Lista de postulantes de una búsqueda (empresa) | Paginada en el servidor (`page`/`page_size`, orden estable `created_at desc, id desc`). Filtros: edad, género, movilidad, disponibilidad, zona, "posición" y años de experiencia | `api/v1/applications.py:212-340`, `dashboard/company/postulaciones/page.tsx` |
| Buscar por texto | Solo `position`: `ILIKE '%x%'` sobre `Experience.role_title`. Sin tildes, sin nombre/apellido, sin empresa, sin AND entre palabras. "tecnico electromecanico" **no** encuentra "Técnico Electromecánico" | `applications.py:259-266` |
| Años de experiencia | Se filtran **en memoria**: con ese filtro se trae la búsqueda entera y se pagina en Python | `applications.py:273-305` |
| Lista de postulantes (admin) | Paginada, **sin ningún filtro** | `api/v1/admin.py:713-762`, `dashboard/admin/busquedas/page.tsx:98` |
| Panel "Búsquedas" de la empresa | Vistazo de 6 postulantes; el link manda a Postulaciones | `company/busquedas/page.tsx:69-76` |
| Seguimiento | Solo el **estado**, y **cada cambio le avisa al postulante** (`applications.py:596+`). No se puede filtrar la lista por estado. El admin no puede marcar nada | `models/job.py:94-107` |
| "Ya lo vi" | `applications.seen_at` existe y viaja al front, pero la pantalla no lo muestra (M3). Desde el admin no se marca nada | |
| Texto sin tildes y trigramas | `f_unaccent`, `pg_trgm` y `services/job_search.py` (`parse_query`, variantes, sinónimos) **ya están en producción**, pero solo se usan para avisos | migración `c7d1e5f9a2b4` |
| Bug chico | `status_updated_at` está en el schema pero el listado no lo completa | `applications.py:316-322` |

Volumen (auditoría 04/10): mediana de 62 postulantes por búsqueda, máximo 666; ~2.000 candidatos.

## 2. Por qué la estrella no es un estado

El "me gustó, lo quiero tener a mano" **no puede ser el estado**: cada cambio de estado le avisa
al postulante. Si Eugenia lo pasa a "En proceso" solo para encontrarlo después, al postulante le
llega un aviso. Así que:

- **Estado** (oficial, lo ve el postulante): queda como está; lo nuevo es filtrar por él.
- **Estrella** (privada): no avisa, no deja rastro en el historial del postulante y no la
  devuelve ningún endpoint de candidato.

## 3. Modelo (una migración)

Columnas nuevas en `applications`: una estrella por lado y por postulación. El filtro es un
`WHERE` sin JOIN, y la fila ya está protegida por el filtro de `company_id` de siempre.

| Columna | Tipo | Para qué |
|---|---|---|
| `company_starred_at` | `timestamptz null` | Estrella de la empresa (con fecha: sirve para ordenar "las últimas que marqué") |
| `admin_starred_at` | `timestamptz null` | Estrella de Talency |
| `admin_starred_by` | FK `users` ON DELETE SET NULL | Quién de Talency la puso |
| `admin_seen_at` | `timestamptz null` | "Ya lo vi" de Talency (P5). Una para todo el equipo, no por admin |

- Un timestamp en lugar de un booleano: `IS NOT NULL` es la estrella, y la fecha sale gratis.
- **Índices** en la misma migración (sin `CONCURRENTLY`, por lo explicado en `c1b7e4a90d52`):
  trigramas GIN sobre `f_unaccent(lower(first_name || ' ' || last_name))`,
  `experiences.role_title` y `experiences.company_name`. Dentro de una búsqueda no hacen falta
  (≤ 666 filas, ya entra por `ix_applications_job_posting_id`); sirven para `/admin/candidates`,
  que busca entre todos. No va índice por estado ni por estrella: sobre 666 filas no hace falta.
  Confirmar con `EXPLAIN ANALYZE` en la base local.
- `services/account_deletion.py`: al borrar al candidato, las dos estrellas a `NULL` junto al
  `cover_letter` (`:178`).
- **Cadena de migraciones:** cuelga del head de producción (`a9e3f1c5b7d2`). Al mergear `main` en
  `feat/mails-ia`, la primera migración de feat (`b1e4c7a2d905`) pasa a colgar de esta. Probar ida
  y vuelta con `backend/scripts/probar_local_mails.ps1` (`backend/.env` es producción).

## 4. Backend

### 4.1 `services/applicant_search.py` (nuevo)

Una sola función que arma los filtros, usada por empresa y admin:
`aplicar_filtros(db, query, filtros, *, lado) -> query`.

- **`q` (texto).** Reusa `parse_query`, `norm()` y las variantes de `job_search.py` (tildes,
  singular/plural, masculino/femenino: "electromecánico" encuentra "Electromecánica").
  - Es **AND entre palabras y OR entre variantes**.
  - Cada palabra tiene que aparecer en alguno de estos campos: nombre, apellido o nombre
    completo; puesto, empresa o descripción de una experiencia (EXISTS); título o institución de
    la educación; habilidades; `summary` u `other_skill`.
  - Los errores de tipeo se cubren con `word_similarity >= 0.5` sobre el puesto y la empresa.
  - Devuelve una `coincidencia` corta ("Experiencia: Técnico electromecánico en Profertil").
- **Edad:** `age_min` y `age_max`, como hoy.
- **Años de experiencia en SQL, no en memoria.** `range_agg` fusiona los tramos superpuestos,
  igual que `_years_of_experience`:
  ```sql
  (SELECT coalesce(sum(upper(r) - lower(r)), 0) / 365.25
     FROM unnest((SELECT range_agg(daterange(e.start_date,
                         greatest(e.start_date, coalesce(e.end_date, current_date))))
                  FROM experiences e WHERE e.candidate_id = candidate_profiles.id)) AS r)
  ```
  - Así la paginación vuelve a ser siempre `LIMIT/OFFSET`.
  - Requiere Postgres ≥ 14: verificar `SHOW server_version` en Railway.
  - Lleva un test de paridad contra la función de Python.
  - Plan B: una columna cacheada `candidate_profiles.experience_years`.
- **Estado:** `status` múltiple (`?status=in_process&status=selected`). Las opciones son las del
  desplegable vigente y suman Contactado/Finalista solo si en esa búsqueda hay postulaciones
  viejas con esos estados.
- **Estrella:** `starred=true|false`. Con `lado="empresa"` filtra `company_starred_at`; con
  `lado="admin"`, `admin_starred_at`.
- **Visto:** `seen=true|false` sobre `seen_at` (empresa) o `admin_seen_at` (admin).
- **Orden:** `orden=recientes` (como hoy) o `estrella` (las marcadas primero, por fecha de
  marca). Siempre con `id` como desempate.
- Los filtros demográficos que ya existen se mudan sin cambios.

### 4.2 Endpoints

- **`GET /me/company/jobs/{id}/applications`:**
  - suma `q`, `status`, `starred`, `seen` y `orden`;
  - `position` queda como alias de `q`;
  - devuelve `starred_at`, `match` y `status_updated_at` (esto arregla el bug).
- **`GET /admin/jobs/{job_id}/applications`:**
  - tiene los mismos filtros que la empresa;
  - devuelve la estrella y el visto de Talency, nunca los de la empresa.
- **`GET .../applications/counts`** (empresa y admin): devuelve cuántos hay por estado, con
  estrella y sin ver, para los chips. Es una consulta con `FILTER`/`GROUP BY`.
- **`PUT` / `DELETE /me/company/applications/{id}/star`:**
  - valida con el `JOIN` a `job_postings.company_id` y da 404 si es de otra empresa;
  - no crea notificación ni entrada en el historial.
- **`PUT` / `DELETE /admin/applications/{id}/star`:** solo admin; guarda `admin_starred_by`.
- **`admin_seen_at`:** se completa al abrir la ficha o el CV desde el admin
  (`GET /admin/candidates/{id}` y `/cv/link` con `?application_id=`). Es un
  `UPDATE … WHERE admin_seen_at IS NULL`, sin aviso a nadie.
- **`GET /admin/candidates`:** `q` pasa a usar el mismo servicio.

### 4.3 Caché

- **Los resultados no se cachean en el servidor ni en Vercel.** Son datos personales, distintos
  por empresa, y cambian con cada estrella.
- Las pantallas son cliente y le pegan a Railway: **cero impacto en la CPU de Vercel**.
- En el front:
  - la lista anterior queda visible mientras carga la nueva;
  - la búsqueda espera 300 ms de tipeo (`useListaPaginada` ya trae `debounceMs`);
  - al marcar la estrella se actualiza la fila al instante (`actualizarItems`) y se revierte si
    el servidor falla.

## 5. Frontend

Un componente compartido, `components/dashboard/postulantes/`, usado por las dos pantallas:
`BuscadorPostulantes` (buscador, chips y "Más filtros") y `FilaPostulante` (con prop `rol`).

- **Buscador ancho:**
  - texto de ayuda: "Buscar por nombre, puesto, empresa o estudio (ej.: técnico electromecánico)";
  - debajo, chips con conteo: **⭐ Con estrella (n)**, **Sin ver (n)** y uno por estado;
  - "Más filtros" despliega edad, años de experiencia, zona, movilidad y disponibilidad.
- **Cada fila:**
  - estrella a un clic, con el tooltip "Solo la ves vos. El postulante no recibe ningún aviso.";
  - el estado, como hoy;
  - la marca de visto;
  - la línea de coincidencia debajo del nombre.
  - Si se filtra por estrella y se la saca, la fila queda atenuada hasta la próxima carga en vez
    de desaparecer.
- **Los filtros viven en la URL** (`?busqueda=…&q=…&starred=true`): volver atrás, recargar
  o compartir el link conserva la búsqueda. Es lo que resuelve de verdad "tengo que volver a
  buscar el CV". En Next 16, `useSearchParams` pide un `<Suspense>`; leer
  `node_modules/next/dist/docs/` antes.
- **`company/postulaciones/page.tsx`:** reemplaza el campo "Posición".
- **`company/busquedas/page.tsx`:** el vistazo de 6 suma links "Ver todos" y "⭐ (n)", que van a
  Postulaciones con el filtro puesto.
- **`admin/busquedas/page.tsx`:** el mismo componente con `rol="admin"`. El estado es solo
  lectura y la estrella y el visto son los de Talency.
- **Paginación:** `Paginacion` + `useListaPaginada`, con selector de 20/50/100 por página.

## 6. Tests

Puros (`tests/test_applicant_search.py`) y con base (`tests/test_applicant_search_db.py`,
Postgres local descartable):

- "tecnico electromecanico" encuentra "Técnico Electromecánico" y "Técnica en Electromecánica";
- encuentra por nombre y apellido con y sin tilde, y por empresa ("profertil");
- AND: "soldador tornero" no trae a quien tiene solo una;
- los años de experiencia en SQL dan lo mismo que la función de Python (tramos superpuestos,
  abiertos, consecutivos);
- funcionan el filtro por estado múltiple, el de estrella y el de visto;
- **cruce:** la empresa B no lista ni marca postulaciones de A (404);
- la empresa nunca recibe la estrella ni el visto de Talency, y viceversa (aserción sobre el
  JSON);
- **marcar la estrella no crea notificación ni historial** y ningún endpoint de candidato la
  devuelve;
- abrir desde el admin completa `admin_seen_at`, no toca `seen_at` ni avisa;
- el borrado de cuenta deja las estrellas en `NULL`;
- la paginación es estable con filtros, y la migración va y vuelve.

## 7. Orden y ramas

Va en la **Tanda 1** del plan del 19/10: rama `feat/mejoras-postulantes` desde `origin/main`, a
producción sin esperar a `feat/mails-ia`.

| Parte | Qué incluye | Migración | Estimado |
|---|---|---|---|
| **1a** | `applicant_search.py`, `q`, filtro por estado, experiencia en SQL, filtros completos para el admin, conteos, filtros en la URL, componente compartido | No | ~2 días |
| **1b** | Estrella para los dos lados, `admin_seen_at` (P5), índices de trigramas | Sí | ~1 día |
| **Después** | Mergear `main` en `feat/mails-ia`: re-colgar `b1e4c7a2d905`; conflictos en `applications.py`, `postulaciones/page.tsx` y `company/types.ts` (quedarse con feat y sumar lo nuevo) | — | ~½ día |

**Listo cuando:**

- `pytest`, `npm run lint` y `next build` dan OK;
- en un preview, una empresa de prueba:
  - busca "tecnico electromecanico" y lo encuentra;
  - le pone la estrella, recarga, filtra por ⭐ y lo encuentra;
  - el postulante no recibió ningún aviso;
- el admin tiene los mismos filtros, con su propia estrella y su marca de visto.

## 8. Estado (23/10/2026)

Construido en la rama `feat/mejoras-postulantes` (desde `origin/main`, worktree
`../bbjobs-postulantes`), 1a y 1b juntas en un solo commit.

- Migración `b3f8d1e6a2c4` (cuelga de `a9e3f1c5b7d2`), probada ida y vuelta en un Postgres 18
  descartable.
- `tests/test_applicant_search_db.py` (14 tests): búsqueda por experiencia, estudios, nombre,
  empresa y tipeo; AND; años de experiencia en SQL igual que en Python; estado; estrella privada
  y separada por lado; visto; conteos; paginación; cruce entre empresas.
- **Diferencias con lo planeado:**
  - El admin no guarda los filtros en la URL: su pantalla elige la búsqueda dentro de una lista
    paginada por moderación. La estrella cubre el "volver a encontrarlo".
  - Los chips de estado son de a uno (el backend acepta varios).
  - El "visto" de la empresa se marca al abrir la ficha o el CV desde la postulación, sin
    cambiar el estado ni avisar (M3 del plan del 19/10). Al mergear con `feat/mails-ia`,
    `application_events.mark_seen` tiene que convivir con `_marcar_visto` (§4.2 de ese plan).
- **Antes de subir:** Railway corre Postgres 16 (lo dice la migración `c7d1e5f9a2b4`), así que
  `range_agg` funciona.
