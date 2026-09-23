# Modificaciones Eugenia — 23/09/2026

> Tres pedidos nuevos de Eugenia (Talency). Decisiones de Gael tomadas el 23/09/2026 (ver
> "Decisiones tomadas" al final); implementación en curso, un commit por bloque.
>
> Registro técnico: causa raíz con archivo y línea, qué se toca y por qué. La versión sin jerga
> para ella va en `NOVEDADES-EUGENIA-2026-09-23.md` cuando esté deployado (regla de doble
> documentación).

## Estado de implementación

- [ ] **Bloque 0 — Resolver a mano el caso real** (la persona que se registró como empresa)
- [ ] **Bloque A — La admin puede eliminar cuentas** (empresa y candidato)
- [x] **Bloque B — Elegir rol antes del registro** (23/09/2026)
- [x] **Bloque C — /contacto: teléfono obligatorio, mail opcional + panel de mensajes** (23/09/2026)

| Bloque | Horas estimadas | Migración |
|---|---|---|
| 0 | 0,5 h | — |
| A | 10–12 h | ninguna obligatoria (ver A.6) |
| B | 5–6 h | — |
| C | 2,5–3 h | `e2c8a4f1d7b3_contacto_telefono_obligatorio.py` |
| **Total** | **18–21,5 h** | |

**Orden sugerido: 0 → C → B → A.** C es chico, independiente y sale rápido. B va antes que A
porque es lo que **evita** que el caso se repita; A es lo que lo **arregla** cuando pasa, y es el
bloque más largo y el único con riesgo de borrar lo que no se debe. Mientras A no esté, el
Bloque 0 cubre el caso real a mano.

---

## Hallazgos que cambian el pedido (leer antes que los bloques)

1. **Ya existe un borrado de cuenta… y está roto para empresas.** `DELETE /me/account`
   (`backend/app/api/v1/account.py:26`) es auto-borrado (Ley 25.326), **ningún botón del frontend
   lo llama** (grep de `/me/account` en `frontend/src`: cero resultados). Y:
   - `_anonymize_company` (`account.py:112-134`) anonimiza el `CompanyProfile` y después hace
     `db.delete(user)`. Pero `company_profiles.user_id` es **`ON DELETE CASCADE`**
     (`models/company.py:18`, `e3d551f98668_initial_schema.py:168`): la base borra el perfil que
     se acaba de anonimizar. **La anonimización es código muerto.**
   - Ese mismo cascade sigue a `job_postings` (`d3f8a1c6e9b7_job_company_fk_cascade.py:22`) →
     `applications` de **otros** candidatos, `job_features`, `talent_credit_packs`,
     `talent_unlocks`, `subscriptions`. O sea: borra la historia de postulaciones de gente que no
     tiene nada que ver.
   - Y si la empresa tiene **un solo `Payment`**, el DELETE **explota**: `payments.company_id` es
     `ON DELETE RESTRICT` (`models/payment.py:156`, `initial_schema.py:434`). El endpoint
     devuelve 500 con la sesión ya a medio modificar.
   - Además, `_anonymize_company` pone `cuit = "00000000000"`, y `cuit` es `UNIQUE`
     (`models/company.py:20`): la **segunda** empresa anonimizada chocaría. Hoy no pasa sólo
     porque el cascade borra la fila antes.
   - En candidatos, "anonimizar applications" (`account.py:92-97`) también es muerto: el cascade
     de `candidate_profiles` → `applications` (`models/job.py:112`) las borra igual.

   **Conclusión:** no se puede reusar `account.py` tal cual para la admin. El Bloque A escribe un
   servicio de borrado nuevo y `account.py` pasa a usarlo también.

2. **El webhook `user.deleted` de Clerk deja el mail bloqueado para siempre.**
   `webhooks.py:315-320` sólo hace `is_active = False` + `deleted_at`. El `users.email` queda
   intacto y es `UNIQUE` (`models/core.py:17`). Si alguien borra un usuario **desde el dashboard
   de Clerk** (lo primero que uno haría para resolver el caso real), la persona se puede volver a
   registrar en Clerk, pero el onboarding la rebota con `409 email_collision`
   (`onboarding.py:34-51`) y el frontend la desloguea con "Ya existe una cuenta con ese email"
   (`onboarding/page.tsx:173-179`). **Exactamente lo contrario de lo que se busca.**

3. **El selector de rol antes del registro ya existe — a medias.** `/register` tiene un toggle
   Candidato/Empresa arriba del widget de Clerk (`register/[[...rest]]/page.tsx:66-78`), y casi
   todos los CTAs ya pasan `?type=` (Header, Footer, home, /empresas, /nosotros, /contacto). El
   problema es otro:
   - **Sin `?type`, el default es "candidato" en silencio** (`register/page.tsx:22-23`).
   - **Dos CTAs de empresa van a `/register` pelado:** `/planes` (`planes/page.tsx:167`) y "Crear
     cuenta de empresa" en `/planes/base-de-talento` (`base-de-talento/page.tsx:284`). Una empresa
     que entra por ahí queda como candidata sin darse cuenta.
   - El toggle es chico y está preseleccionado: quien viene de "Publicar un empleo" ve "Empresa"
     marcado y no lo mira. Después, el onboarding de empresa acepta **"CUIT / DNI"**
     (`onboarding/page.tsx:285`), así que una persona física lo completa con su DNI sin fricción.
     Es muy probable que el caso real haya sido este.
   - El respaldo en `localStorage` (`bbjobs_signup_role`) sólo se borra al enviar el onboarding
     (`onboarding/page.tsx:137`). Si alguien abandona, el valor viejo queda y contamina el próximo
     alta en ese navegador (sobre todo por Google, donde el `unsafeMetadata` puede no llegar).

4. **El panel de mensajes ya muestra todo lo que guarda el formulario.** El form manda nombre,
   email, teléfono, empresa (sólo en `/empresas`), tema y mensaje (`ContactForm.tsx:26-33`), y
   `admin/mensajes/page.tsx:86-128` muestra los seis más la fecha. No falta ningún campo. Lo que
   falta es: la **hora** (sólo muestra el día), el teléfono como dato **principal** (hoy es un
   gris chico que ni aparece si no lo dejaron) y el botón de WhatsApp.

---

## Bloque 0 · Resolver el caso real a mano — 0,5 h

La persona está esperando y el Bloque A lleva días. Se resuelve hoy **sin** pasar por el
dashboard de Clerk primero (por el hallazgo 2).

1. Identificarla y medir qué tiene colgado, **contra producción y sólo lectura** (`backend/.env`
   apunta a Railway producción — ver memoria del repo):
   ```sql
   SELECT u.id, u.email, u.clerk_user_id, c.id AS company_id, c.legal_name, c.cuit,
          (SELECT count(*) FROM payments p WHERE p.company_id = c.id)          AS pagos,
          (SELECT count(*) FROM job_postings j WHERE j.company_id = c.id)      AS busquedas
   FROM users u JOIN company_profiles c ON c.user_id = u.id
   WHERE u.email = '<mail>';
   ```
2. Si `pagos = 0` y `busquedas = 0` (lo esperable en un alta equivocada): `DELETE FROM users
   WHERE id = '<id>'` en una transacción, mirando antes el conteo que va a arrastrar el cascade.
3. **Recién después**, borrar el usuario en Clerk (dashboard o `clerk` CLI). El webhook
   `user.deleted` llega, no encuentra el `User` local y no hace nada.
4. Avisarle a Eugenia que la persona ya puede registrarse con el mismo mail.

Si tiene pagos o búsquedas, **no** borrar a mano: esperar al Bloque A.

---

## Bloque A · La admin puede eliminar cuentas — 10–12 h

### A.1 Qué cuelga de cada cuenta (verificado contra modelos y migraciones)

**Empresa** (`users` → `company_profiles`, CASCADE):

| Tabla | FK | Al borrar la empresa |
|---|---|---|
| `company_verification_documents` | CASCADE | se borra (PDFs en Cloudinary quedan huérfanos) |
| `subscriptions` | CASCADE | se borra |
| `job_postings` | CASCADE (`d3f8a1c6e9b7`) | se borran **todas**, y con ellas ↓ |
| ↳ `applications` | CASCADE | se borran postulaciones **de candidatos ajenos** |
| ↳ `application_status_history` | CASCADE | se borra |
| ↳ `job_features` | CASCADE | se borra (historial de destacados) |
| ↳ `job_alert_notifications` | CASCADE | se borra |
| `talent_credit_packs` | CASCADE | se borra… |
| `talent_unlocks` | CASCADE (company) / **RESTRICT** (pack) | carrera de cascadas: puede fallar según el orden |
| **`payments`** | **RESTRICT** | **bloquea todo el DELETE** |
| `notifications` | CASCADE (sobre `users`) | se borran |
| `audit_logs.admin_user_id`, `verified_by_admin_id`, etc. | SET NULL | sin efecto (apuntan a admins) |

**Candidato** (`users` → `candidate_profiles`, CASCADE): `experiences`, `educations`,
`candidate_skills`, `languages`, `job_alerts` (+ notificaciones), `test_submissions` (+
answers), `applications` (+ history), `candidate_activity_log`, `talent_unlocks`,
`notifications`. Todo CASCADE — el borrado anda sin errores. **Pero** ver A.3 sobre
`talent_unlocks`.

**Cloudinary:** `candidate_profiles.photo_url`, `cv_file_url`; `company_profiles.logo_url`;
`company_verification_documents.file_url`. **Hoy nada los borra nunca**: `delete_file`
(`integrations/cloudinary_client.py:136`) existe pero no lo llama ningún endpoint.

### A.2 Estrategia: dos modos según lo que tenga la cuenta

| Modo | Cuándo | Qué hace |
|---|---|---|
| **Borrado total** | Candidato siempre (salvo A.3). Empresa **sin pagos y sin búsquedas con postulaciones**. | `DELETE FROM users` y que la base cascadee. Es el caso del pedido: alta equivocada. |
| **Baja con conservación** ("lápida") | Empresa con `payments` o con búsquedas que tienen postulaciones. | Se conserva la fila de `users` y de `company_profiles` para que los pagos y la historia sigan referenciando algo, pero se liberan los identificadores y se borran los datos personales. |

**Lápida de empresa** (sin migración — todas las columnas ya existen):
- `users.email` → `eliminado+<user_id>@bbjobs.invalid` (libera el UNIQUE; `.invalid` es TLD
  reservado, nunca recibe mail). `clerk_user_id` → `NULL`. `is_active = False`,
  `deleted_at = now()`.
- `company_profiles`: `is_anonymized = True`, `legal_name = "Empresa eliminada"`,
  `responsible_*` vacíos/lápida, `logo_url`/`website`/`description = NULL`, `deleted_at = now()`.
- **`cuit`**: ver decisión D3. Nunca el `"00000000000"` fijo de hoy (choca en la segunda).
- Búsquedas: soft-delete (`deleted_at`, como ya hace `DELETE /admin/jobs/{id}`,
  `admin.py:1019-1063`) + `end_active_feature_for_job` si estaban destacadas. **No** se borran:
  las postulaciones de los candidatos quedan en su historial.
- Packs de talento activos: `status = canceled` (no se reembolsa nada automáticamente).
- `payments`, `job_features`, `talent_unlocks`: **intactos** (registro contable).

**Por qué dos modos y no siempre lápida:** para el caso real (cuenta vacía creada por error) la
lápida deja basura permanente en la tabla y en los listados del admin sin ningún motivo. Y por
qué no siempre borrado total: con pagos es **imposible** (RESTRICT), y aunque se forzara, se
perdería el comprobante de algo que Talency cobró.

### A.3 El detalle de los créditos de la Base de Talento

Los créditos usados **no se guardan en un contador**: se cuentan desde `talent_unlocks`
(`models/payment.py:92-94`, `talent.py:178`, `611-613`). Si se borra un candidato que alguna
empresa desbloqueó, el CASCADE borra el `talent_unlock` y **esa empresa recupera el crédito**. Y
si el pack estaba `exhausted`, queda `exhausted` con créditos disponibles — inconsistente.

→ **Decisión D2.** Recomendación: candidato con `talent_unlocks` → también lápida (se conserva
`candidate_profiles` anonimizado: nombre "Candidato eliminado", teléfono vacío, sin foto ni CV,
`visible_in_talent_pool = False`; se borran experiencias, educación, skills, alertas, tests). La
empresa pagó por un contacto; que el candidato se vaya no debería devolverle ni quitarle nada.

### A.4 Backend

**Servicio nuevo `backend/app/services/account_deletion.py`** — una sola implementación para
admin y para auto-borrado:

```python
async def plan_deletion(db, user) -> DeletionPlan        # qué modo corresponde + conteos
async def delete_account(db, user, *, actor) -> DeletionResult
```

`plan_deletion` devuelve los conteos (búsquedas, postulaciones recibidas/enviadas, pagos,
desbloqueos) para que la UI se los muestre a la admin **antes** de confirmar.

**Endpoints en `backend/app/api/v1/admin.py`:**

```
GET    /admin/users/{user_id}/deletion-preview   → modo + conteos + email de login
DELETE /admin/users/{user_id}                    body: { "confirm_email": "..." }
```

Por `user_id` y no por `company_id`/`candidate_id`: los dos listados ya lo exponen
(`CompanyAdminResponse.user_id`, `CandidateAdminResponse.user_id`, `admin.py:60,92`), y es
un solo endpoint para los dos roles.

**Guardas (todas server-side, además de la UI):**
- `target.role == admin` → 403. Admins no se borran por acá (y un admin borrando a otro admin es
  un vector de toma de cuenta).
- `target.id == admin.id` → 403 (redundante con lo anterior, pero explícito).
- `confirm_email.strip().lower() != target.email.lower()` → 400. Es la confirmación fuerte: se
  valida en el backend, no sólo en el botón.
- `target.deleted_at is not None` → 404.

**Orden de las operaciones y qué pasa si falla una:**

1. Leer el `User`, validar guardas, calcular el modo.
2. Hacer los cambios locales en la sesión y **`flush()`** (sin commit). Si la base rechaza algo
   (una FK que no previmos), se hace rollback y se devuelve 409 con el motivo: **no se tocó
   Clerk todavía**.
3. Borrar en Clerk: `delete_clerk_user(clerk_user_id)` (`integrations/clerk_client.py:64`).
   - Si Clerk devuelve **404** (ya no existía): seguir — el objetivo ya se cumple.
   - Cualquier **otro error**: rollback local y 502 "No se pudo eliminar en el proveedor de
     login, no se modificó nada". Queda todo como estaba; la admin reintenta.
4. `commit()`.
5. Después del commit, **best-effort** (errores sólo se loguean): borrar en Cloudinary foto, CV,
   logo y documentos de verificación. Ojo con `delivery_type` — CVs viejos son `upload` y los
   nuevos `private` (ver plan del 18/08, D1); hay que parsearlo de la URL como hace
   `signed_document_url` o el archivo queda vivo sin error.
6. `AuditLog(action="account_delete", target_entity="users", target_id=…, notes=…)`, dentro de
   la misma transacción del paso 4. Ver decisión D4 sobre qué va en `notes`.

**Por qué Clerk entre el flush y el commit:** es el orden que deja la ventana de inconsistencia
más chica y la única que se autorrepara. El caso malo es "Clerk borró, el commit falló" (muy
improbable: el flush ya validó las constraints). Queda un `User` local apuntando a un Clerk que no
existe → la persona se registra de nuevo y el onboarding choca por email. **Por eso el paso A.5
(webhook) es parte de este bloque y no un extra:** cuando llega el `user.deleted` de ese mismo
borrado, el webhook aplica la lápida y libera el mail. El orden inverso (commit primero, Clerk
después, como `account.py:48-54`) deja el caso opuesto — cuenta local borrada y login de Clerk
vivo — que es peor: la persona sigue pudiendo entrar a un onboarding con su mail "libre" pero sin
saber que se le borró todo.

**Refactor de `account.py`:** `DELETE /me/account` pasa a llamar al mismo servicio (con
`actor = el propio usuario`). Se borra `_delete_candidate` / `_anonymize_company`. No cambia el
contrato del endpoint.

**Respuestas del listado:** sumar `account_email: str` (el `users.email`, que es el mail de
login) a `CompanyAdminResponse` y `CandidateAdminResponse` (join con `User`). Hoy la empresa sólo
expone `responsible_email`, que **puede ser distinto** del mail con el que se registró — y la
admin tiene que tipear el de login.

**Listados:** filtrar `users.deleted_at IS NULL` (o `company_profiles.is_anonymized = False`) en
`GET /admin/companies` y `GET /admin/candidates`, para que las lápidas no aparezcan. Revisar
también los listados públicos de empresas (`companies.py`) por el mismo filtro.

### A.5 Webhook de Clerk

`webhooks.py:315-320` (`user.deleted`): en vez de sólo `is_active = False`, aplicar el **mismo
servicio en modo lápida-o-borrado** sin llamar a Clerk (ya está borrado allá). Así, si alguien
borra desde el dashboard de Clerk, el mail queda libre igual. Idempotente: si el `User` ya no
existe o ya tiene `deleted_at`, no hace nada.

### A.6 Migración

**Ninguna obligatoria.** La lápida usa columnas que ya existen (`users.deleted_at`,
`company_profiles.is_anonymized`/`deleted_at`). Opcional, si Gael quiere blindar el caso de A.3
a nivel base: cambiar `talent_unlocks.candidate_id` de CASCADE a RESTRICT
(`<rev>_talent_unlocks_candidate_restrict.py`), de modo que un borrado total de un candidato
desbloqueado **falle** en vez de devolver créditos en silencio. Lo recomiendo: el servicio ya
elige lápida en ese caso, y la FK es la red por si alguien más borra a mano.

### A.7 Frontend

**Componente nuevo `frontend/src/components/dashboard/DeleteAccountModal.tsx`**, usado por los
dos listados:
1. Al abrir, `GET /admin/users/{user_id}/deletion-preview`.
2. Muestra qué se va a hacer, en castellano: "Se va a borrar la cuenta de **Fulano** y todos sus
   datos" o, en lápida, "Esta empresa tiene 2 pagos registrados. Se va a dar de baja y borrar sus
   datos de contacto, pero los pagos quedan guardados para la contabilidad."
3. Conteos concretos (búsquedas, postulaciones, desbloqueos).
4. Input "Para confirmar, escribí el mail de la cuenta: `x@y.com`". El botón rojo "Eliminar
   cuenta" queda deshabilitado hasta que coincida (comparación sin mayúsculas ni espacios).
5. Mensaje final: "Listo. Ya puede registrarse de nuevo con el mismo mail." y se saca la fila.

**Dónde va el botón:**
- `dashboard/admin/empresas/page.tsx`: **dentro del modal "Ver perfil"** (`:439` en adelante),
  al pie, como zona de peligro separada — no en la fila de acciones (`:286-347`), que ya tiene
  Aprobar/Rechazar/Suspender/Reactivar/Ver perfil/Búsquedas y donde un click de más es fácil.
- `dashboard/admin/candidatos/page.tsx`: ahí "Ver perfil" abre `CandidateProfileModal`
  (`:282`), que es **compartido con la empresa** (`CandidateProfileModal.tsx`). No meter el
  botón en ese componente: pasarle una prop opcional `footerAction` (o renderizar el botón en la
  página, debajo de la fila, en `:249-263`). Recomiendo la prop, para que quede en el mismo lugar
  que en empresas.

`frontend/src/app/dashboard/admin/types.ts`: sumar `account_email` a los tipos de empresa y
candidato.

### A.8 Verificación a mano

1. Base local (Postgres nativo, **no** la de `backend/.env`, que es producción). Clerk en modo
   test.
2. Crear una empresa de prueba por el flujo normal → borrarla desde el panel → confirmar en el
   dashboard de Clerk que el usuario no está → **registrarse de nuevo con el mismo mail, como
   candidato**, y completar el onboarding. Es la prueba que importa.
3. Empresa con un `Payment` insertado a mano → el preview dice "lápida" → borrar → el pago sigue
   en `/dashboard/admin/pagos`, la empresa no aparece en el listado, el mail se puede volver a
   usar.
4. Empresa con una búsqueda con postulantes → lápida → el candidato sigue viendo su postulación
   en su historial.
5. Candidato con CV y foto → borrado total → en Cloudinary el CV (probar uno `private` y uno
   `upload`) y la foto ya no existen.
6. Candidato desbloqueado por una empresa → lápida → el saldo de créditos de la empresa **no**
   cambia.
7. Intentar borrar a un admin y a uno mismo (por API, con curl) → 403. Mail mal tipeado → 400.
8. Webhook: borrar un usuario desde el dashboard de Clerk → el mail queda libre en la base
   (probar con `clerk` CLI o el panel de Clerk apuntando a un túnel al backend local).
9. Simular Clerk caído (clave inválida en local) → 502, y la cuenta sigue intacta en la base.

---

## Bloque B · Elegir rol antes del registro — 5–6 h

### B.1 Diseño

**Un solo lugar, `/register`, con dos estados:**

| URL | Qué se ve |
|---|---|
| `/register` (sin `type`) | **Selector**: dos tarjetas grandes, "Busco trabajo — Como postulante" y "Quiero publicar búsquedas — Como empresa", con una línea de qué incluye cada una. Sin widget de Clerk. |
| `/register?type=candidate` / `?type=company` | **Confirmación arriba** ("Te estás registrando como **empresa** · Cambiar") + widget de Clerk. "Cambiar" vuelve al selector (conservando `next`). |

Se mantiene el nombre de parámetro **`type` con valores `candidate`/`company`**, no `rol=empresa`:
ya lo usan los 16 CTAs existentes (Header, Footer, home, /empresas, /nosotros, /contacto) y el código de `register`/`onboarding`. Cambiarlo es tocar todo
para nada.

**Transporte del rol hasta el onboarding (se mantiene lo que ya hay, que funciona):**
`unsafeMetadata={{ role }}` en `<SignUp>` + respaldo en `localStorage` para OAuth. El backend
sigue sin confiar en eso (el rol real lo decide el endpoint de onboarding que se llame). No hace
falta redirigir a `/onboarding/company` — el onboarding ya es una sola página que lee el rol.

### B.2 La trampa de las subrutas de Clerk

`<SignUp routing="path" path="/register">` navega a subrutas propias
(`/register/verify-email-address`, `/register/continue`, `/register/sso-callback`), y **no hay
garantía de que conserve `?type=`**. Si el selector se muestra "cuando no hay `type`", en la
pantalla de verificación del mail la persona vería el selector en lugar del campo del código y
**el alta quedaría trabada**.

Regla: el selector se muestra **sólo** si `usePathname() === "/register"` **y** no hay un alta
en curso (`useSignUp()` → `signUp?.id` vacío). En cualquier subruta se renderiza siempre el
widget, con el rol tomado de `?type` → `localStorage` → `"candidate"`. Leer
`node_modules/next/dist/docs/` para `usePathname`/`useSearchParams` en Next 16 antes de
escribirlo (ver `frontend/AGENTS.md`).

### B.3 Archivos

- `frontend/src/app/register/[[...rest]]/page.tsx` — selector + banner de confirmación; sacar el
  toggle chico (`:66-78`) y el default silencioso a candidato (`:22-23`). Al elegir: escribir
  `localStorage` y `router.replace("/register?type=…" + next)`.
- `frontend/src/app/planes/page.tsx:167` → `/register?type=company`.
- `frontend/src/app/planes/base-de-talento/page.tsx:284` → `/register?type=company`.
- `frontend/src/app/login/[[...rest]]/page.tsx:27` — si `redirect_url` empieza con `/empleos`
  (el flujo "postularme sin cuenta"), el link a registro lleva `type=candidate`; si no, va al
  selector.
- `frontend/src/app/onboarding/page.tsx`:
  - Si **no** hay rol ni en `unsafeMetadata` ni en `localStorage` (ej. alta por Google desde
    `/login`, que Clerk transfiere a sign-up sin pasar por nuestro selector), mostrar el mismo
    selector de dos tarjetas en vez de caer a candidato (`:76-81`).
  - Cambiar el link chico "¿Sos una empresa? Cambiar…" (`:226-232`) por un encabezado visible:
    "Te estás registrando como **empresa** · Cambiar". Es la red para corregir si algo falló.
  - En la vista de empresa, una línea bajo el título: "¿Buscás trabajo? Esta cuenta es para
    empresas que publican búsquedas" con el cambio a un click.
  - Borrar `bbjobs_signup_role` también al montar el selector de `/register` (no sólo al enviar
    el onboarding), para que un intento abandonado no contamine el siguiente.
- Componente compartido `frontend/src/components/auth/RoleChooser.tsx` (lo usan `/register` y
  `/onboarding`), para no escribir las tarjetas dos veces.

Los CTAs de Header/Footer/home/empresas/nosotros/contacto **no se tocan**: ya pasan `?type=`
correcto y con el nuevo banner la preselección queda confirmada en pantalla, que es lo que pidió
Eugenia.

### B.4 Riesgos

- **Subrutas de Clerk** (B.2): el único punto donde esto puede romper el alta. Probarlo con
  email+código **y** con Google.
- **OAuth sin `unsafeMetadata`**: ya cubierto por el respaldo de `localStorage`, pero si la
  persona elige "empresa" en un navegador y termina el alta en otro (link de verificación
  abierto en el celular), llega sin rol → ahora ve el selector en el onboarding en vez de caer a
  candidato. Mejor que hoy.
- "CUIT / DNI" en el onboarding de empresa: no se toca sin preguntar (decisión D6).

### B.5 Verificación a mano

1. `/register` pelado → selector, sin widget. Elegir empresa → URL con `?type=company`, banner
   "empresa", widget.
2. "Cambiar" → vuelve al selector; con `?next=` conservado.
3. Alta completa con email+código como empresa: en `/register/verify-email-address` **se sigue
   viendo el campo del código**, no el selector. Al terminar, el onboarding muestra el form de
   empresa.
4. Lo mismo con Google, como candidato.
5. Desde `/planes` y `/planes/base-de-talento` → llega con empresa preseleccionada.
6. En `/login`, "Registrarse" con Google usando un mail nuevo → onboarding muestra el selector.
7. Abandonar un alta como empresa, volver al día siguiente y registrarse como candidato → no
   aparece nada de empresa.
8. Header y Footer, desktop y mobile: cada CTA llega con el rol correcto y el banner lo dice.

---

## Bloque C · /contacto: teléfono obligatorio, mail opcional — 2,5–3 h

### C.1 Backend

**`backend/app/schemas/contact.py`:**
- `ContactMessageCreate.phone: str` obligatorio, con validador: `strip()`, al menos 8 dígitos
  contando sólo los dígitos, máximo 50 caracteres (el largo de la columna).
- `ContactMessageCreate.email: Optional[EmailStr] = None`, con un `field_validator(mode="before")`
  que convierte `""` en `None` (si no, `EmailStr` rechaza el string vacío que manda un input
  vacío).
- `ContactMessageResponse.email: Optional[str] = None`. `phone` sigue `Optional` en la respuesta
  por las filas viejas.

**`backend/app/models/contact.py`:** `email: Mapped[str | None] = mapped_column(String(255),
nullable=True)`. `phone` **sigue nullable en la base**.

**Por qué `phone` no pasa a NOT NULL:** las filas existentes sin teléfono. Para poner NOT NULL
habría que rellenarlas con un valor falso (`''` o `'sin dato'`), que en el panel se vería como un
teléfono roto con botón de WhatsApp a ningún lado. La obligación va en el schema de la API, que es
el único camino de entrada a esa tabla (`contact.py:13` es el único INSERT). Si Gael lo quiere
también a nivel base, la alternativa limpia es un `CHECK (phone IS NOT NULL) NOT VALID`, que se
aplica a filas nuevas y deja las viejas en paz — Postgres lo permite.

**Migración `backend/alembic/versions/e2c8a4f1d7b3_contacto_telefono_obligatorio.py`**
(`down_revision = "c1b7e4a90d52"`, que es la cabeza actual — verificado recorriendo la cadena):

```python
def upgrade():
    op.alter_column("contact_messages", "email", existing_type=sa.String(255), nullable=True)

def downgrade():
    # Filas nuevas pueden no tener email: sin esto el SET NOT NULL falla.
    op.execute("UPDATE contact_messages SET email = '' WHERE email IS NULL")
    op.alter_column("contact_messages", "email", existing_type=sa.String(255), nullable=False)
```

Se aplica sola en el deploy (`Dockerfile:25`, `alembic upgrade head && uvicorn …`).

**`backend/app/api/v1/contact.py`:** sin cambios de lógica. Opcional: sumar el teléfono al cuerpo
de la notificación a admins (`:34`), así Eugenia lo ve sin abrir el panel.

### C.2 Frontend

**`frontend/src/components/contact/ContactForm.tsx`** (lo usan `/contacto` **y** `/empresas`,
`empresas/page.tsx:171` — el cambio aplica a los dos; ver D7):
- Reordenar: Nombre + **Teléfono** (obligatorio, `type="tel"`, `inputMode="tel"`,
  `autoComplete="tel"`) en la primera fila; **Email (opcional)** abajo.
- `email: email.trim() || undefined` al enviar.
- Mensaje de error del 422: "Revisá el teléfono" si falla por teléfono.

**`frontend/src/app/dashboard/admin/types.ts:256`:** `email?: string`.

**`frontend/src/app/dashboard/admin/mensajes/page.tsx`:**
- Teléfono como dato principal, debajo del nombre y con tamaño normal, no gris chico
  (`:117-125` hoy).
- Dos botones: **WhatsApp** (`https://wa.me/<normalizado>`, `target="_blank"`) y **Llamar**
  (`tel:`). Es canal asistido: el link abre el chat, Eugenia escribe y aprieta enviar. Nada
  automático.
- Email: sólo si existe; si no, no se muestra nada (o "sin mail" en gris).
- Fecha **con hora** (`toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })`).
- Filas viejas sin teléfono: se muestran igual, sin los botones.

**Helper nuevo `frontend/src/lib/telefono.ts` → `waLink(phone): string | null`.** Normaliza al
formato internacional argentino que espera wa.me (`549` + área + número, sin `0` ni `15`):
quita todo lo que no sea dígito; si empieza con `54` lo respeta (y agrega el `9` si falta); si
empieza con `0`, lo saca; si trae el `15` después de un área de 3 dígitos de Bahía (`291`), lo
saca; si quedan 10 dígitos, antepone `549`. Si no puede con confianza, devuelve `null` y se
muestra sólo `tel:`. No hay un helper previo en el repo (grep de `wa.me`/`549`: sólo el número
fijo de Talency en `contacto/page.tsx:5`).

### C.3 Verificación a mano

1. `/contacto`: enviar sin teléfono → el navegador no deja. Por curl sin `phone` → 422.
2. Enviar sin email → se guarda (`email IS NULL` en la base), aparece en el panel sin mail.
3. Enviar con email inválido → 422 (el opcional no desactiva la validación).
4. `/empresas` → mismo comportamiento, con el campo Empresa.
5. En el panel: probar WhatsApp con `2914 123456`, `0291 15 4123456`, `+54 9 291 4123456` →
   los tres abren el chat al mismo número. Probar en el celular también.
6. Un mensaje viejo sin teléfono sigue viéndose bien.
7. `alembic upgrade head` y `alembic downgrade -1` en la base **local**.

---

## Decisiones tomadas (Gael, 23/09/2026)

| # | Decisión | Resuelto |
|---|---|---|
| D1 | Dos modos (borrado total / lápida) | **Dos modos**, el servicio elige solo según lo que tenga la cuenta. |
| D2 | Candidato desbloqueado en la Base de Talento | **Lápida**: la empresa conserva el contacto que pagó y no recupera el crédito. FK `talent_unlocks.candidate_id` a RESTRICT como red. |
| D3 | CUIT de una empresa en lápida | **Se libera si estaba pending/verified; se conserva si estaba suspended/rejected**, para que borrar no sirva para esquivar una suspensión. |
| D4 | Qué guarda el `AuditLog` | **Mail enmascarado** + rol + modo. |
| D5 | Cobro | No aplica: lo que Gael pide ya está cobrado. |
| D6 | "CUIT / DNI" en el alta de empresa | **Queda como está.** Tampoco se agrega DNI del responsable. |
| D7 | Teléfono obligatorio también en `/empresas` | **Sí** (mismo componente). |
| D8 | Auto-borrado del propio usuario | **Ahora**, con UI en "Mi cuenta" de empresa y candidato. |
| D9 | Confirmación en el panel de la admin | **Sin tipear el mail**: modal con nombre, mail y conteos + botón "Sí, eliminar". A Eugenia le alcanza con ver a quién borra. Se descarta el `confirm_email` de A.4/A.7. |
| D10 | "Me equivoqué de tipo de cuenta" | **Se agrega**: si la cuenta está vacía, el propio usuario borra su perfil y vuelve al selector de rol sin perder el login de Clerk. |

## Riesgos generales

- **`backend/.env` apunta a producción.** Todo lo de borrado se prueba contra el Postgres local;
  confirmar el `DATABASE_URL` antes de correr nada que escriba.
- **Rol de base de mínimo privilegio (`app_user`)**: si ya está aplicado (SEGURIDAD-PLAN bloque
  E), verificar que tenga `DELETE` sobre `users`, `company_profiles`, `candidate_profiles` y las
  tablas que el servicio borra explícitamente. Probarlo con ese rol, no con `postgres`.
- **Clerk con la clave de otra instancia**: si `CLERK_SECRET_KEY` de Railway no es la de la
  instancia productiva, Clerk contesta 404 y el servicio lo toma como "ya borrado" → borra lo
  local y deja vivo el login real. Mitigación: ante un 404, loguear `warning` con el
  `clerk_user_id` para revisarlo, y en la verificación post-deploy borrar una cuenta de prueba y
  confirmar en el dashboard de Clerk productivo que desapareció.
- **Nada de esto es reversible** una vez hecho en producción. El modal de confirmación y el
  preview con conteos son parte del alcance, no pulido.
