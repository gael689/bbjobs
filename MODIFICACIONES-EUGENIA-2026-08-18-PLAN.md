# Modificaciones Eugenia — 18/08/2026

> Continuación de `MODIFICACIONES-EUGENIA-2026-08-14-PLAN.md`.
> Acá se registra lo que **destrabó la respuesta de Eugenia del 18/08** y lo que sigue abierto.
>
> Registro técnico: causa raíz con archivo y línea, qué se toca y por qué.
> La versión sin jerga para ella va en `NOVEDADES-EUGENIA-2026-08-18.md` cuando esté deployado.

---

## Lo que confirmó Eugenia el 18/08

| # | Tema | Respuesta | Efecto |
|---|------|-----------|--------|
| P1 | Industria / Sector | **Lectura A confirmada.** "Industria" es una **opción nueva** de la lista, y el campo pasa a llamarse **"Sector"**. | ✅ **Implementado hoy** |
| P2 | Base de Talento | La quiere **paga**: la empresa paga y accede a la base de candidatos. | Dirección definida, **faltan 5 decisiones de producto** (abajo) |

Siguen sin respuesta: las credenciales de Mercado Pago (P3) y la maqueta del hero (C1).

---

## Verificado hoy contra el código (lo que Gael preguntó)

Todo esto **ya está escrito** — es el código del 14/08 que sigue sin commitear ni probar en
el navegador. Lo confirmé leyendo los diffs, no de memoria:

| Pedido de `bbjobs2.pdf` | Estado | Dónde |
|---|---|---|
| Ver toda la info de la empresa en "Ver perfil" | ✅ escrito | `admin.py` (`CompanyAdminResponse` + `industry_name`), `admin/empresas/page.tsx:472-482` |
| La empresa ve la foto del postulante | ✅ escrito | `photo_url` en `CandidateSummary` (`applications.py:57`) y en `CandidateFullProfile` (`applications.py:422`) |
| El candidato puede cargar la foto | ✅ **ya andaba de antes** | `POST /me/candidate/photo` (`candidates.py:176`), UI en `candidate/perfil/page.tsx:206` |
| Filtrar postulantes por **posición** | ✅ escrito | `applications.py:216` — `EXISTS` con `ILIKE` sobre `work_experiences.role_title` |
| Filtrar postulantes por **experiencia** | ✅ escrito | `applications.py:218-219` + fusión de tramos superpuestos en `applicant_stats.py` |
| Gráficos en Estadísticas de empresa | ✅ escrito | `company/estadisticas/page.tsx` — `PanelEstadisticas` + selector "Todas mis búsquedas" / por búsqueda |

`PanelEstadisticas` grafica exactamente lo que ella pidió: **edad en franjas** (dona),
**años de experiencia** (franjas) y **educación** — los mismos tres que ve el candidato,
con el mismo componente (`components/stats/PanelEstadisticas.tsx:82-92`). Y el selector de
búsqueda cubre su ejemplo textual ("para la posición de comercial").

⚠️ **Nada de esto está commiteado ni probado en el navegador.** 28 archivos modificados en el
working tree desde el 14/08. Es el primer bloqueante para cerrar la tanda.

---

## P1 · Industria → Sector — **implementado hoy**

**Migración nueva:** `b5c9e0a3f712_industria_como_sector.py` (`down_revision: a8d2f6c1e534`).
Inserta la fila `Industria` / slug `industria` en `industries`.

Dos detalles que no son obvios:

1. **El INSERT es idempotente** (`WHERE NOT EXISTS` por slug). El catálogo de producción **no**
   se sembró con `seed.py` — se nota porque "Otro" aparece en la captura de Eugenia y **no está
   en `seed.py:33-36`**. O sea que el contenido real de la tabla no es el que dice el seed, y
   una migración que asuma lo contrario explota o duplica.
2. **El `downgrade` desactiva antes de borrar.** `job_postings.industry_id` y
   `company_profiles.industry_id` son `RESTRICT` (el DELETE fallaría), pero
   `job_alerts.industry_id` es **`CASCADE`** (`models/alerts.py:15`): un borrado ciego le
   vaciaría la alerta a un candidato sin avisarle. El downgrade pone `is_active = false` y sólo
   borra la fila si nadie la referencia.

**Etiquetas renombradas** a "Sector" — las cuatro, no sólo la del wizard:

| Archivo | Antes | Por qué también |
|---|---|---|
| `company/publicar/page.tsx:225` | "Industria *" | Es la que pidió textualmente |
| `empleos/page.tsx:217` | "Industria" | Mismo catálogo: el candidato filtraría por un campo "Industria" con una opción "Industria" adentro |
| `onboarding/page.tsx:295` | "Industria" | Ídem, en el alta de la empresa |
| `admin/empresas/page.tsx:477` | "Rubro sin completar" | Era un **tercer** nombre para el mismo campo, en el panel de ella |

La tabla sigue llamándose `industries` y ninguna columna cambia: es sólo el texto que ve el
usuario. **Verificado:** `tsc --noEmit` limpio, y `b5c9e0a3f712` queda como cabeza única de
migraciones.

---

## P2 · Base de Talento paga — **lo que falta decidir**

Eugenia definió el **modelo de negocio** (la empresa paga), que era la pregunta grande. Pero
para construirlo faltan cinco definiciones, y ninguna es técnica: son de producto y de precio.

**Lo que ya está construido** (del 06/08, no hay que rehacerlo): el candidato da o niega
consentimiento explícito con fecha (`visible_in_talent_pool`, `talent_pool_asked_at`,
`talent_pool_decided_at` — `models/candidate.py:65-71`), con rastro auditable de cada cambio
y default en **no aparecer**. La parte legalmente delicada está lista.

**Lo que no existe:** ningún endpoint ni pantalla que consulte esa base. Hoy nadie la ve.

### Las cinco decisiones

| # | Decisión | Opciones | Mi recomendación |
|---|---|---|---|
| 1 | **Cómo se cobra** | (a) suscripción mensual con acceso libre · (b) pago por candidato desbloqueado · (c) bolsa de créditos | **(b) por candidato desbloqueado.** Es el que menos promete: si la base tiene 40 personas, una suscripción "acceso ilimitado" se siente cara y vacía. Pagar por contacto escala con el valor real y no envejece mal cuando la base es chica. |
| 2 | **Qué se ve sin pagar** | (a) nada · (b) **perfil ciego** (edad, zona, años de experiencia, educación, disponibilidad — sin nombre, contacto ni CV) | **(b) perfil ciego.** Sin vidriera nadie paga; con nombre y teléfono a la vista nadie paga tampoco. El perfil ciego es lo que hace que el desbloqueo valga. |
| 3 | **Quién puede acceder** | (a) toda empresa verificada · (b) sólo con plan pago | **(a) verificada, obligatorio.** Son datos personales de gente real. La verificación ya existe y es el filtro correcto; el pago es otra cosa. |
| 4 | **Cuánto sale** | — | A definir con ella. Referencia: el destacado está en **$5.000** (`schemas/payment.py:10`). |
| 5 | **Registro de accesos** | — | **Sí, obligatorio.** Quién miró a quién y cuándo. Si mañana un candidato pregunta "¿quién vio mis datos?", hay que poder responder. |

**Costo estimado:** es una funcionalidad nueva completa — buscador con filtros, pantalla de la
empresa, cobro por MP, control de acceso y auditoría. **Se cotiza aparte, no entra en esta tanda.**
Y depende de que MP esté cobrando de verdad (P3): sin eso no hay con qué cobrarla.

---

## P3 · Mercado Pago — **error corregido en el instructivo**

El plan del 14/08 daba esta URL de notificaciones:

```
https://bbjobs.com.ar/api/v1/webhooks/mercadopago     ❌ MAL
```

Está mal **por partida doble**:

1. **El host.** `bbjobs.com.ar` es el frontend en Vercel. La API vive en `api.bbjobs.com.ar`
   (Railway) — ver `DEPLOY-PLAN.md:294-298`.
2. **La ruta.** El endpoint real lleva guion: `@router.post("/webhooks/mercado-pago")`
   (`backend/app/api/v1/webhooks.py:152`).

```
https://api.bbjobs.com.ar/api/v1/webhooks/mercado-pago    ✅ BIEN
```

Con la URL vieja, MP habría mandado **todos** los avisos de pago a un 404: la empresa pagaba,
la plata entraba, y el aviso nunca se destacaba. El instructivo del 14/08 quedó corregido con
una nota que explica el error, y `DEPLOY-PLAN.md:515` ya la tenía bien.

### Corrección al plan del 14/08: no faltan credenciales

Aquel documento daba por bloqueante que Talency consiguiera las credenciales productivas.
**No es así: Gael ya las tiene** — prueba, producción y clave secreta (confirmado el 18/08).
Lo único que falta es **registrar el webhook en el panel de MP** y hacer la prueba real.

Dos cosas que salieron de revisar el código hoy, y que no estaban en ningún plan:

1. **El webhook se registra en el panel, no en el código.** `create_preference`
   (`integrations/mercado_pago.py:20-36`) **no manda `notification_url`**: MP sólo sabe a dónde
   avisar por lo que diga la configuración del panel. Panel vacío = ningún aviso, por más que
   las credenciales estén perfectas.
2. **Hay dos secrets, uno por modo, y mezclarlos rompe todo en silencio.** El panel guarda
   configuraciones separadas para prueba y producción, cada una con su clave secreta. Y la
   firma es **obligatoria** apenas hay un secret cargado
   (`webhook_signature_required()`, `mercado_pago.py:46-52`). Access token de producción +
   secret de prueba = **todos** los avisos rebotan con `401` (`webhooks.py:168-172`) y ningún
   pago se acredita nunca. Falla sorda: MP reintenta, se rinde, y sólo quedan unos 401 en un
   log que nadie mira.

Además: `verify_signature` **nunca corrió contra una firma real** — hasta hoy fue siempre un
no-op porque el secret estaba vacío (`MERCADOPAGO-DESTACAR-PLAN.md:58`). Por eso el sandbox
va primero aunque tengamos las productivas: es la única forma de ejercitar el manifest de la
firma (`mercado_pago.py:84`) sin mover plata.

El paso a paso completo está en `INSTRUCTIVO-MERCADOPAGO-TALENCY.md`.

### Credenciales verificadas contra la API real (18/08)

Gael cargó las credenciales de prueba en `backend/.env` (gitignoreado, nunca commiteado —
verificado con `git log --all`). Comprobado contra `api.mercadopago.com`, no asumido:

| Chequeo | Resultado |
|---|---|
| `GET /users/me` | `200` |
| Cuenta | `TESTUSER4912995372853432878`, `tags: […, test_user, …]`, mail `@testuser.com` |
| `create_preference` (Checkout Pro) | ✅ devuelve `init_point` real en `www.mercadopago.com.ar` |
| `verify_signature` | ✅ **10/10 casos**, incluidos headers malformados |

**Son credenciales de un *usuario de prueba* de MP**, no de la cuenta productiva. Por eso
empiezan con `APP_USR-` y no con `TEST-`: los usuarios de prueba son cuentas MP completas y sus
credenciales tienen el formato normal. El token trae embebido el id `3560381736` (el del usuario
de prueba), distinto del User ID `2691117435` que figura en el panel (la cuenta real de Talency,
dueña de la aplicación). Eso es lo esperado, no un error.

Lo importante: **`create_preference` anda**, así que el label "Producto integrado: Checkout API /
API integrada: API Orders" de la aplicación **no impide** usar la API de Preferencias, que es la
que usa el código (`mercado_pago.py:39`).

Y `verify_signature` **dejó de ser un no-op**: con el secret cargado se ejercitó por primera vez.
Valida la firma correcta, rechaza v1 alterado, request-id distinto, data.id distinto, header sin
`=`, header vacío y `ts` sin `v1`; y tolera el orden invertido, los espacios y el `data.id` en
mayúsculas. El manifest (`mercado_pago.py:84`) coincide con el que documenta MP.

### ⚠️ La trampa que queda: suscribir el webhook a "Pagos", no a "Órdenes"

La aplicación figura en el panel como **API Orders**. Pero el handler
(`_es_notificacion_de_pago`, `webhooks.py:126-136`) acepta **sólo** notificaciones cuyo `type` o
`action` empiece con `payment`. Una notificación de orden cae en:

```python
if not _es_notificacion_de_pago(payload):
    return {"status": "ignored", "topic": topic}
```

O sea: **se descarta con un `200 ignored` y el pago nunca se acredita.** Si al registrar el
webhook se tilda "Órdenes" en lugar de "Pagos", el circuito falla exactamente igual que con la
URL mal escrita, y con la misma falta de síntoma. En el instructivo está marcado, pero es el
punto donde hay que mirar dos veces.

### Lo que todavía falta para el end-to-end

1. **Registrar el webhook en el panel de MP** con la URL correcta y el evento "Pagos". Sigue sin
   hacerse.
2. **Cargar las variables en Railway.** Hoy las credenciales están sólo en el `.env` local, y MP
   **no puede notificar a `localhost`**: la prueba de punta a punta necesita que
   `api.bbjobs.com.ar` tenga `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` y `MP_WEBHOOK_SECRET`.
3. **Decidir cuándo**, porque tiene un costo: mientras producción tenga las credenciales del
   usuario de prueba, una empresa real que apriete "destacar" va a un checkout de mentira. Hoy
   está igual de roto por otro motivo (sin credenciales, `create_preference` devuelve una URL
   simulada — `mercado_pago.py:17-18`), así que no se rompe nada que ande; pero la ventana de
   prueba conviene que sea corta y avisada.
4. **Después, las credenciales productivas de Talency** (cuenta `2691117435`) y **el secret de
   producción, que es otro**. Los tres valores tienen que ser del mismo modo.

### Lo único que sí depende de Eugenia: el precio

`FEATURED_JOB_PRICE = 5000.0` (`schemas/payment.py:10`), **duplicado** en el frontend
(`dashboard/company/types.ts`). Si se cambia uno solo, la empresa ve un número y se le cobra
otro. Preguntarle si $5.000 sigue siendo el número y si lo quiere editable desde el panel.

---

## D1 · "Ver CV" deja la pantalla en blanco — **arreglado hoy**

**Lo reportado:** el botón **Ver CV** abre una pestaña en blanco y no muestra nada.
**Descargar CV** sí funciona.

### Lo primero: no era Cloudinary

Lo natural era sospechar del PDF privado — es lo que ya falló dos veces (el `401` de julio, la
firma metida adentro del `public_id` en agosto). **Se comprobó contra la cuenta real** en vez de
suponer, generando las dos URLs firmadas sobre un CV de producción:

| | HTTP | Content-Type | Content-Disposition | Bytes |
|---|---|---|---|---|
| **Ver** (`attachment=False`) | 200 | `application/pdf` | *(ninguno)* | `%PDF-` ✅ |
| **Descargar** (`attachment=True`) | 200 | `application/pdf` | `attachment; filename="file.pdf"` | `%PDF-` ✅ |

O sea: el backend y Cloudinary están **perfectos**. La URL de "ver" devuelve un PDF válido, con
el content-type correcto y **sin** `Content-Disposition` — exactamente lo que el navegador
necesita para renderizarlo en su visor. El problema estaba del otro lado.

*(De paso quedó confirmado que hay CVs viejos con `delivery_type=upload` y nuevos con
`private`, y que el parseo de los dos anda — era la duda que dejó el fix de la firma.)*

### La causa: `noopener` hace que `window.open()` devuelva `null`

`frontend/src/lib/cv.ts:21`:

```js
const pestana = descargar ? null : window.open("", "_blank", "noopener");
```

Por especificación, **cuando se pasa `noopener`, `window.open()` devuelve `null`** — es
justamente el punto de esa feature: que quien abre no se quede con una referencia a la ventana
nueva. Entonces:

1. La pestaña en blanco **se abre igual**… pero `pestana` vale `null`.
2. `if (pestana)` nunca se cumple, así que nunca se le asigna la URL del PDF.
3. Se cae al fallback del `<a target="_blank">`, que está pensado para cuando el bloqueador de
   popups mató la pestaña. Pero ese click ocurre **después del `await`**, o sea fuera del gesto
   del usuario — que es exactamente la condición en la que el bloqueador lo frena.
4. Y `pestana?.close()` del `catch` tampoco limpia nada, porque es `null`.

Resultado: **una pestaña en blanco garantizada, y el PDF que llega en el mejor de los casos a una
segunda pestaña que el navegador suele bloquear.** Coincide exactamente con lo reportado.

**Descargar andaba** porque con `descargar = true` no pasa por `window.open` en absoluto:
`pestana` es `null` desde la primera línea y se usa `window.location.href` (`cv.ts:30`), que no
es un popup y ningún bloqueador toca.

Lo irónico: el comentario que estaba arriba de esa línea explicaba bien por qué la pestaña se
abre antes del `await` — el razonamiento sobre el bloqueador de popups era correcto. El
`noopener` es lo que lo anulaba.

### El arreglo

Sacar `noopener` de la llamada, y cortar el vínculo con el opener a mano **antes** de navegar,
mientras la pestaña sigue siendo `about:blank` y del mismo origen (una vez que apunta a
Cloudinary es otro origen y tocarle propiedades se vuelve resbaladizo):

```js
const pestana = descargar ? null : window.open("", "_blank");
// …
pestana.opener = null;
pestana.location.href = url;
```

Se conserva la protección que daba `noopener` (que la página abierta no pueda manipular la
nuestra vía `window.opener`) sin el efecto de que `window.open` devuelva `null`.

**Alcance:** un solo archivo, `frontend/src/lib/cv.ts` — es el único `window.open` del proyecto
(verificado), y de él cuelgan los tres botones "Ver CV": panel de admin
(`admin/candidatos/page.tsx:257`), modal del candidato (`CandidateProfileModal.tsx:143`, el que
usan admin y empresa) y el perfil del propio candidato (`candidate/perfil/page.tsx:722`).

**Migración:** ninguna. **Riesgo:** bajo. **Verificado:** `tsc --noEmit` y `eslint` limpios.
**Falta probarlo en un navegador real** — es un bug de comportamiento del navegador, así que el
typecheck no prueba nada acá. Probar en Chrome y en el celular, con los tres botones.

---

## Estado de la tanda

| Bloque | Estado |
|---|---|
| A (publicar sin verificar, búsqueda de cocina, mensajes de prueba) | Código escrito, **sin commitear, sin probar** |
| B (perfil de empresa, salario de mercado, foto, filtros, estadísticas) | Código escrito, **sin commitear, sin probar** |
| C (hero con foto) | Bloqueado — falta la decisión de Eugenia y la foto |
| P1 (Industria → Sector) | ✅ **Implementado hoy**, sin probar |
| D1 ("Ver CV" en blanco) | ✅ **Arreglado hoy**, falta probar en navegador |
| P2 (Base de Talento paga) | Dirección definida, 5 decisiones abiertas, se cotiza aparte |
| P3 (Mercado Pago) | **Desbloqueado** — Gael ya tiene las credenciales; falta registrar el webhook y probar |

### Los bloqueantes, en orden

1. **Probar en el navegador** todo lo del 14/08 + P1, contra la base real. Nunca se levantó
   `npm run dev` / `uvicorn` para esta tanda.
2. ~~**Aplicar las migraciones a producción.**~~ ✅ **Falso bloqueante — corregido el 18/08.**
   Ver abajo.
3. **Commitear.** 28 archivos + la migración nueva llevan 4 días en el working tree.
4. **Borrar los mensajes lorem ipsum** de producción, con la lista a la vista primero.

---

---

## Corrección importante: las migraciones NO estaban pendientes

Los planes del 06/08 y del 14/08 venían arrastrando esto como bloqueante:

> ⚠️ La cadena `f1a4c7e2b9d8` → `c3e7b1d5a92f` → `a8d2f6c1e534` sigue sin aplicarse a producción.

**Es falso, y lo fue desde el 07/08.** Lo que lo demuestra:

1. **El deploy corre las migraciones solo.** `backend/Dockerfile:25`:
   ```
   CMD python -m alembic upgrade head && uvicorn app.main:app …
   ```
   Es un `&&`: si `alembic upgrade head` falla, **uvicorn nunca arranca** y el contenedor muere.
   No hay forma de tener el backend respondiendo con migraciones sin aplicar.
2. **Las tres migraciones entraron en el commit `984c42d` (07/08 09:47)**, y después hubo
   deploys exitosos — el último, `320db97` (07/08 11:32), figura como `SUCCESS` en Railway.
3. **El servicio está `Online` y responde**: `/health` da `200` y
   `/catalogs/industries` devuelve el catálogo completo.

De 1 + 2 + 3 se sigue que `alembic upgrade head` corrió bien y la cabeza en producción es
`a8d2f6c1e534`. No hay ningún paso manual pendiente.

**Consecuencia para esta tanda:** `b5c9e0a3f712` (la de "Industria") **se va a aplicar sola en
el próximo deploy**, apenas se commitee. No hay que correr nada a mano.

El origen del error parece ser que el plan del 06/08 se escribió *antes* del deploy de ese
mismo día y la advertencia se copió de un documento al siguiente sin volver a verificarla.
Moraleja para los próximos planes: un bloqueante heredado se re-verifica antes de repetirlo.

### De paso, confirmado contra producción

`GET /catalogs/industries` devuelve **11 rubros**, entre ellos **"Otro"** — que **no está en
`seed.py:33-36`**. Confirma que el catálogo real se cargó por fuera del seed y que el INSERT
idempotente de `b5c9e0a3f712` era necesario, no una precaución de más. "Industria" todavía no
figura, como corresponde: la migración no está commiteada.

---

## Lo que sigue abierto para Eugenia

1. **Publicar sin verificar** — se le propone el alcance (publica sí, ve postulantes no) y se
   espera su ok. *(decisión ya tomada del lado nuestro, se le confirma)*
2. **Hero** — foto de fondo del título: qué imagen quiere, y si tiene una propia del puerto.
3. **Base de Talento** — las cinco decisiones de arriba.
4. **Precio del destacado** — ¿sigue siendo $5.000? ¿lo quiere editable desde el panel?

*(Mercado Pago ya no le pide nada: las credenciales están, falta trabajo nuestro.)*
