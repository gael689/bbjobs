# Avisos por acción y notas de la empresa — plan (04/10/2026)

Pedido de Gael: que el postulante se entere solo de lo que pasa con su postulación —la empresa
vio su CV, lo pasó a "En proceso", lo descartó— sin que nadie lo haga a mano, y que la empresa
pueda dejar una **nota** eligiendo si la ve el postulante o queda **privada** (hay rechazos con
nota interna que el postulante no tiene que ver).

Vive detrás de la compuerta `MODULOS_NUEVOS_ACTIVOS` como el resto de los módulos nuevos: en
producción no cambia nada hasta el lanzamiento.

## 1. Lo que ya está automatizado (no se toca)

| Acción de la empresa | Aviso en la web | Mail |
|---|---|---|
| Cambia a **Contactado / En proceso / Finalista / Seleccionado** | Al momento | Al momento (franja 8–21, tope 2/día) |
| Cambia a **No avanza** | Al momento | **24 h después**; se cancela si la empresa lo cambia en el medio |
| Cambia a **Perfil revisado** a mano | Al momento | No (sólo web) — con §2 pasa a uno por día, como "Vieron tu CV" |
| Abre la ficha completa desde la **Base de Talento** | Al momento | Sí, uno por día como máximo |

`api/v1/applications.py::update_application_status` → `create_notification(ref_id=app.id)` →
catálogo (`services/email/catalog.py`) → cola → dispatcher.

## 2. Nuevo: "Vieron tu CV" (automático)

Hoy abrir el perfil o el CV de un postulante **no deja rastro**: el estado sigue en "Nueva" y el
postulante no se entera. Cambia así:

- **Disparadores:** `GET /me/company/candidates/{id}` (ficha completa) y
  `GET /me/company/candidates/{id}/cv/link` (CV). Sólo empresa verificada dueña de la búsqueda
  (el chequeo `_assert_candidate_applied_to_company` ya existe).
- **Qué postulación:** el frontend manda `?application_id=` cuando abre desde una postulación
  (postulaciones y búsquedas). Si no viene, se toman las postulaciones del candidato **en estado
  Nueva** a búsquedas de esa empresa. Nunca las de otra empresa.
- **Sólo la primera vez:** si `seen_at` está vacío. Pasa a **Perfil revisado** (`seen`), se
  completa `seen_at`, queda en el historial con `changed_by_user_id` = la empresa y la marca
  `automatico=True`. Si ya estaba más adelante (Contactado, etc.), sólo se completa `seen_at`,
  sin aviso.
- **Aviso:** `application_seen` en la web, y el mail pasa de "sólo web" a **uno por día**
  (`once_per_day`): si tres empresas lo ven el mismo día, le llega un mail y el resto queda en
  la campanita.
- **Lo que no dispara:** que lo abra un admin de Talency, que lo abra otra vez la misma empresa,
  que el candidato se haya dado de baja de "postulaciones".
- **Costo de la consulta:** un `UPDATE … WHERE seen_at IS NULL RETURNING id` (atómico: dos
  pestañas abiertas a la vez no avisan dos veces).

## 3. Nuevo: notas de la empresa, privadas o para el postulante

### Modelo

Tabla `application_notes`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `application_id` | FK `applications` ON DELETE CASCADE | |
| `company_id` | FK `company_profiles` | redundante a propósito: el filtro por empresa no depende de un JOIN |
| `author_user_id` | FK `users` SET NULL | quién de la empresa la escribió |
| `body` | text, máx. 1000 | |
| `visible_to_candidate` | bool, **default false** | privada salvo que se marque |
| `status_at_time` | varchar(50) null | el estado con el que se escribió (si fue junto a un cambio) |
| `notified_at` | timestamptz null | cuándo se le avisó al postulante |
| `created_at`, `deleted_at` | | borrado lógico |

Una nota privada no se puede volver visible después (evita mostrar por error algo escrito
pensando que era interno). Una visible no se edita (el postulante ya la pudo leer); se puede
borrar de la vista, pero el mail ya enviado no vuelve.

### API

- `PATCH /me/company/applications/{id}/status` acepta además `note` (opcional, ≤1000) y
  `note_visible` (bool, default false). Así el caso típico —"No avanza" + motivo— es un solo
  paso.
- `POST /me/company/applications/{id}/notes` — nota suelta (sin cambio de estado).
- `GET /me/company/applications/{id}/notes` — todas (privadas y visibles), sólo de esa empresa.
- `DELETE /me/company/applications/{id}/notes/{note_id}`.
- `GET /me/candidate/applications/{id}/history` suma las notas **visibles** de su postulación.
  Las privadas **nunca** salen por ningún endpoint de candidato.

### Avisos

- **Nota visible junto a un cambio de estado:** va **dentro** del aviso de ese estado ("Mensaje
  de la empresa: …"), no en un mail aparte. Con "No avanza" viaja en el mail de las 24 h; si la
  empresa cambia el estado en el medio, el mail se cancela igual que hoy.
- **Nota visible suelta:** aviso nuevo `application_note` ("La empresa te dejó un mensaje sobre
  tu postulación a …"), categoría postulaciones, como máximo uno por día por postulación.
- **Nota privada:** no genera ningún aviso.
- El texto de la empresa es **no confiable**: se escapa en la web y en el mail (el render ya
  escapa todo), sin links clickeables.

### En el panel de la empresa

Al cambiar el estado se abre un cuadro opcional "Agregar una nota" con la casilla **"Que la vea
el postulante"** destildada. Si se tilda, debajo: "La va a leer el postulante. No incluyas
motivos como edad, género, estado civil o salud." (Ley 23.592: un motivo discriminatorio por
escrito expone a la empresa.) Las notas se ven en la ficha de la postulación con una etiqueta
**Privada** o **La ve el postulante**.

### Seguridad y datos personales

- Toda consulta filtra por `company_id` → test de que la empresa B no lee ni escribe notas de la
  empresa A (404, no 403, para no confirmar que existe).
- Test de que el candidato nunca recibe una nota privada (endpoint de historial, notificación y
  mail).
- `services/account_deletion.py`: al borrar el candidato, las notas de sus postulaciones se
  vacían (`body = NULL`) igual que hoy se vacía `cover_letter`. Al borrar la empresa: una
  empresa con postulaciones siempre queda en lápida (la fila sobrevive y el CASCADE no corre),
  así que las **privadas se borran** y las visibles quedan en la línea de tiempo del
  postulante, como el historial de estados.
- ¿Los admins de Talency ven las notas privadas? **Decidido (06/10/2026): no.** Las notas
  privadas sólo las lee la empresa que las escribió: ningún endpoint de admin las devuelve, los
  de notas son sólo de empresa (un admin recibe 403) y hay un test que lo garantiza
  (`tests/test_application_notes_db.py`). Junto a la casilla, el panel de la empresa lo dice:
  "Sin tildar, la nota es privada: sólo la ve tu empresa. No la ve el postulante ni el equipo
  de BBJobs y Talency."

## 4. Lo que decide Eugenia (decidido el 06/10/2026)

1. ¿Mail de "Vieron tu CV"? **Sí, uno por día como máximo** (`once_per_day`).
2. Las notas arrancan **privadas** y hay que tildar para que las vea el postulante. **Sí.**
3. ¿Talency puede leer las notas privadas de las empresas? **No** (era la propuesta "sí, sólo
   lectura"; quedó descartada). Ver §3.
4. ¿Hace falta un texto modelo para el motivo de "No avanza"? **No.**

## 5. Pasos de construcción

1. Migración `application_notes` + modelo + `automatico` en `application_status_history`.
2. Servicio `services/application_events.py`: `mark_seen(db, company, candidate_id,
   application_id)` y `add_note(...)`; el endpoint de estado delega ahí.
3. Endpoints (§3) detrás de `require_new_modules` los nuevos; el `PATCH` de estado ignora
   `note` con la compuerta cerrada.
4. Catálogo: `application_seen` → `once_per_day`; `application_note` nuevo; el render del aviso
   de estado suma la nota visible.
5. Frontend: cuadro de nota al cambiar estado, lista de notas en la ficha, notas visibles en la
   línea de tiempo del postulante, `application_id` al abrir perfil/CV.
6. Tests: primera vista avisa y la segunda no; admin no dispara; privada nunca llega al
   candidato; visible viaja con "No avanza" y se cancela si cambia el estado; cruce entre
   empresas; borrado de cuenta.
7. Actualizar `AVISOS-AUTOMATICOS-EUGENIA.pdf` con "Vieron tu CV" y "Mensaje de la empresa".
