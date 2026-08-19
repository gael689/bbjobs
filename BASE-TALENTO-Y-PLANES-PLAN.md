# Base de Talento + Planes — plan técnico

> Decisión de Eugenia del 18/08/2026 (WhatsApp 11:35–11:36) y pedido de Gael del 19/08.
> **Documento de planificación: no se ejecuta nada hasta que esto se apruebe.**
>
> Registro trazable: qué existe, qué falta, qué cuesta y qué hay que decidir antes de tocar código.

---

## 1. Lo que decidió Eugenia

| Punto | Decisión |
|---|---|
| Precio | **$49.900** |
| Qué da | **15 créditos de desbloqueo** |
| Alcance | **No** es acceso libre |
| Qué ve | Perfiles como **CV ciegos**, en gris |
| Qué desbloquea | La empresa **elige cuáles**, hasta agotar los 15 |

> **Corrección del 19/08 (Gael).** La primera versión de este plan leyó "suscripción mensual"
> literalmente y planificó cobro recurrente por MP. **No es eso.** Es un **pack cerrado**:
> se paga una vez y se reciben 15 créditos, que se usan con quien y cuando se quiera.
>
> El cambio es enorme a favor: **el pack se cobra exactamente igual que el destacado de
> $5.000**, con la preferencia de Checkout Pro que ya está construida y probada. Se cae toda la
> integración de suscripciones (preapproval), su webhook nuevo y sus estados de fallo — que era
> el único bloque de riesgo alto del módulo. Ver §5.

Queda entonces un catálogo de **dos productos pagos, ambos de pago único**:

| Producto | Precio | Qué entrega | Estado |
|---|---|---|---|
| Destacar una búsqueda | $5.000 | Un aviso destacado mientras dure | ✅ Construido, en prueba |
| Pack Base de Talento | $49.900 | 15 créditos de desbloqueo | ❌ A construir |

**Mismo mecanismo de cobro para los dos.** Es la decisión que hace que este módulo sea
abordable.

---

## 2. Lo que ya está construido (no se rehace)

Más de lo que parece. Verificado en código, no asumido:

| Pieza | Dónde | Estado |
|---|---|---|
| Consentimiento del candidato, con fecha | `models/candidate.py:65-71` — `visible_in_talent_pool`, `talent_pool_asked_at`, `talent_pool_decided_at` | ✅ |
| Rastro auditable de cada cambio de decisión | evento `talent_pool_consent` | ✅ |
| Default en **no aparecer**, casilla destildada | `onboarding.py:76-86`, `candidates.py:88-129` | ✅ |
| Modelo `Plan` (precio mensual, límites, features) | `models/payment.py:10-31` | ✅ |
| Modelo `Subscription` (estado, período, `mp_subscription_id`) | `models/payment.py:39-54` | ✅ |
| ABM de planes para el admin | `api/v1/plans.py` | ✅ |
| Cobro por Mercado Pago (pago único) | `payments.py`, `webhooks.py`, `mercado_pago.py` | ✅ |

### Dos hallazgos que importan

**a) Los límites del Plan no se aplican en ningún lado.**
`max_active_job_postings`, `max_visible_applications_per_posting`,
`includes_psychometric_results`, `includes_observatory_full`,
`included_featured_per_month` aparecen **sólo** en el modelo y en el schema de respuesta
(`schemas/payment.py:19-23`). Ningún endpoint los lee. Verificado con un grep sobre todo
`backend/app` y `frontend/src`.

Consecuencia buena: **crear suscripciones no va a activar restricciones ocultas.** Consecuencia
a tener presente: el campo que usemos para el tope de 15 hay que **implementarlo**, no alcanza
con cargarlo.

**b) El consentimiento vigente ya cubre el cobro.**
El texto que acepta el candidato (`dashboard/candidate/page.tsx:85`) dice:

> *"las empresas verificadas van a poder encontrar tu perfil y tu CV en la Base de Talento de
> BBJobs y contactarte por oportunidades laborales, aunque no te hayas postulado"*

Que la empresa además pague es un acuerdo entre Talency y la empresa: **no amplía quién ve los
datos, los restringe** (verificada *y* suscripta). Y el CV ciego muestra *menos* que lo
consentido, no más.

**No hay que volver a pedir consentimiento** — hacerlo perdería los que ya están cargados.
Sí conviene sumar un párrafo a `/privacidad` explicando que el acceso de empresas es un
servicio pago, para que la finalidad quede escrita. Es higiene, no un bloqueante.

---

## 3. Lo que falta definir con Eugenia

Con el modelo de créditos ya confirmado, quedan **dos** preguntas (antes eran cuatro).

### P1 · ~~¿15 por mes o 15 en total?~~ — **RESUELTO (19/08)**

Son **15 créditos por pack**, sin ciclo mensual. Se compra el pack, se usan cuando se quiera.

### P2 · Qué muestra exactamente el CV ciego — **falta confirmar**

Propuesta, campo por campo:

| Se ve (en gris) | No se ve hasta desbloquear |
|---|---|
| Edad, zona, disponibilidad, movilidad | Nombre y apellido |
| Nivel educativo y título | Foto (va difuminada) |
| Años de experiencia (total) | Mail y teléfono |
| Puestos ocupados y duración | **Nombre de las empresas** |
| Habilidades e idiomas | Archivo del CV |
| Resumen del perfil | |

**El punto delicado son los nombres de las empresas.** En Bahía Blanca, "Vendedor en [comercio
local], feb 2026 – oct 2027" identifica a la persona sin ninguna dificultad. Si se muestran, el
CV ciego no es ciego.

> **Corrección al implementar (19/08).** Este plan decía "mostrar el rubro en lugar del nombre".
> **No se puede**: `Experience` (`models/candidate.py:81-89`) guarda `company_name` como texto
> libre y **no tiene rubro**. Para mostrarlo habría que sumarle un campo y pedírselo al
> candidato en el formulario — invasivo y para todos los perfiles ya cargados quedaría vacío.
>
> Lo implementado es **omitir el empleador**: se muestra puesto y duración, y el nombre aparece
> recién al desbloquear. Se omite por lo mismo la `description` de cada experiencia (suele
> nombrar al empleador), la `institution` de los estudios, y el **resumen del perfil** — que lo
> escribe el candidato con sus palabras y muy seguido arranca con su nombre.

Además, el candidato se identifica con una **referencia corta derivada de su UUID** (`#A3F91C`),
no con un número correlativo: un contador filtraría cuánta gente hay en la base y en qué orden
se cargó.

### P3 · ~~¿El pack vence?~~ — **RESUELTO (19/08)**

**No vence.** Los 15 créditos duran hasta que se usen, sin plazo.

La columna `expires_at` queda igual, en `NULL`: si algún día se quiere un pack con vencimiento
(una promo, un plan distinto), es cargarle una fecha y no migrar la tabla.

### Ya decidido, no hace falta preguntar

- **Sólo empresas verificadas** pueden comprar el pack y ver la base. El pago no reemplaza a la
  verificación: son datos personales de gente real.
- **Lo desbloqueado queda desbloqueado para siempre.** Lo pagó.
- **Sólo aparecen candidatos con `visible_in_talent_pool = true`**, que ya funciona hoy.

---

## 4. El módulo: qué se construye

Respuesta a la pregunta de Gael — *"¿sería un módulo nuevo en todos lados?"*: **sí, pero menos
invasivo de lo que suena.** No toca nada de lo que ya funciona; se agrega al costado.

### 4.1 Base de datos

**Dos tablas nuevas** y dos columnas en `payments`:

```
talent_credit_packs
  id, company_id
  credits_total          -- 15
  status                 -- pending_payment | active | exhausted | canceled
  purchased_at, activated_at
  expires_at             -- NULL = no vence (ver P3)
  granted_by_admin_id    -- para regalar un pack sin cobrar (canje, prueba)

talent_unlocks
  id, company_id, candidate_id, pack_id
  unlocked_at
  UNIQUE (company_id, candidate_id)
```

En `payments`: `PaymentType.talent_pack` y `related_talent_pack_id`, espejando lo que ya
existe para `job_feature`.

Dos detalles que no son obvios:

- **El `UNIQUE (company_id, candidate_id)` es lo que evita el reclamo más previsible.** Sin él,
  entrar dos veces al mismo perfil consume dos créditos y la empresa se siente estafada con
  razón. Desbloquear algo ya desbloqueado tiene que ser gratis e idempotente.
- **Los créditos usados no se guardan como contador**, se cuentan desde `talent_unlocks`. Un
  contador se desincroniza; las filas son la fuente de verdad. Para que dos desbloqueos
  simultáneos no pasen el tope, el pack se bloquea con `SELECT … FOR UPDATE` al consumir.

`granted_by_admin_id` existe por lo mismo que existe el destacado manual (`admin.py:1035`):
Eugenia va a querer regalar un pack alguna vez, y si no está previsto termina cargándolo a mano
en la base.

### 4.2 Backend

| Endpoint | Qué hace |
|---|---|
| `GET /me/company/talent` | Buscador de perfiles ciegos, con filtros (los mismos que ya existen para postulantes: edad, experiencia, posición, educación, zona) |
| `GET /me/company/talent/{id}` | Ficha ciega de un candidato |
| `POST /me/company/talent/{id}/unlock` | Consume un cupo y revela los datos. Idempotente |
| `GET /me/company/talent/usage` | Cuántos de los 15 usó en el ciclo |
| `GET /admin/talent/subscriptions` | Quién está suscripto, desde cuándo, cuánto usó |
| `GET /admin/talent/unlocks` | Quién desbloqueó a quién y cuándo |

Reglas transversales: sólo candidatos con `visible_in_talent_pool = true`; sólo empresa
verificada **y** con `Subscription` activa; cada acceso queda registrado.

### 4.3 Frontend

- **Empresa** → sección nueva "Base de Talento": buscador, tarjetas ciegas, ficha, botón de
  desbloquear con confirmación (*"Te quedan 12 de 15 este mes"*), y "Mis desbloqueados".
- **Admin** → panel de suscripciones y registro de accesos.
- **Público** → `/planes` (ver §6).
- **Candidato** → mostrarle **cuántas empresas vieron su perfil**. No estaba pedido, pero es lo
  que convierte el consentimiento en algo que el candidato quiere dar en vez de tolerar.

### 4.4 Lo que NO se toca

Búsquedas, postulaciones, moderación, destacados, onboarding. El módulo es aditivo.

---

## 5. El cobro — se reusa lo que ya existe

**Ésta era la parte de riesgo y dejó de serlo.** Al ser un pack de pago único, el circuito es
idéntico al del destacado:

```
POST /me/company/talent/packs   →  crea Payment(type=talent_pack) + TalentCreditPack(pending_payment)
                                →  create_preference(...)  ← la misma de mercado_pago.py:14
                                →  init_point, la empresa paga
Webhook de MP                   →  acredita el pago y pasa el pack a `active`
                                →  la empresa tiene sus 15 créditos
```

Lo que hay que tocar del cobro, y es poco:

| Qué | Dónde |
|---|---|
| `PaymentType.talent_pack` | `models/payment.py:77-79` (hoy sólo `subscription` y `job_feature`) |
| `Payment.related_talent_pack_id` | `models/payment.py` — espeja `related_job_feature_id` |
| Activar el pack al acreditarse | `webhooks.py` — hoy sólo resuelve `JobFeature` |
| Precio y cantidad de créditos | `schemas/payment.py`, al lado de `FEATURED_JOB_PRICE` |

**Nada de preapproval, nada de webhook nuevo, nada de estados de tarjeta rechazada.** El webhook
sigue escuchando el mismo evento `payment` que ya configuramos.

### Sobre "mensual"

Eugenia lo llamó suscripción mensual. Con el pack de créditos, el vencimiento es **opcional** y
se decide aparte del cobro:

- **Sin vencimiento** (recomendado): los 15 créditos duran hasta usarlos. Cero fricción, cero
  reclamos, y la empresa recompra cuando necesita gente — que es cuando quiere pagar.
- **Con vencimiento**: alcanza con una columna `expires_at` en el pack. Es una línea, pero abre
  la única discusión fea que tiene el producto ("pagué y no llegué a usarlos").

El modelo se construye **con la columna `expires_at` presente y en `NULL`**, así la decisión se
puede cambiar después sin migración. Arranca sin vencer.

Si más adelante hace falta ingreso recurrente de verdad, el camino es **renovación asistida**:
avisarle a la empresa cuando le quedan pocos créditos, con un botón que dispara el mismo pago.
No requiere nada nuevo.

## 6. La página `/planes`

Hoy es un placeholder de 29 líneas que dice *"Todavía estamos definiendo los planes"*
(`frontend/src/app/planes/page.tsx:16`).

Pasa a mostrar los tres:

| | Publicar | Destacar | Base de Talento |
|---|---|---|---|
| Precio | **Gratis** | **$5.000** por aviso | **$49.900** / mes |
| Qué incluye | Publicar búsquedas, recibir postulaciones, ver perfiles y CV de quienes se postulan | El aviso arriba y resaltado mientras dure la búsqueda | Buscar en toda la base, 15 desbloqueos por mes |
| Requisito | Empresa verificada | Empresa verificada | Empresa verificada |

Tres cosas que la página tiene que decir bien:

1. **Que publicar es y sigue siendo gratis.** Es el argumento de entrada; una página de precios
   mal armada puede espantar a la empresa que todavía no publicó nunca.
2. **Qué es un CV ciego**, con un ejemplo visual. Nadie paga $49.900 por algo que no entiende.
3. **Que los candidatos dieron permiso explícito** para estar ahí. Es diferencial frente a
   comprar una base de datos, y es verdad.

---

## 7. La segunda cuenta de admin

**Se puede, y ya está construido.** No hay que programar nada.

- `POST /admin/users` (`admin.py:1002-1044`) crea el usuario en Clerk con contraseña
  (`create_clerk_user`, `clerk_client.py:42-61`, con `skip_password_checks=True`), le pone
  `role: admin` en el metadata, y crea el `User` + `AdminProfile` locales con
  `email_verified_at` ya seteado.
- Hay pantalla: `dashboard/admin/nuevo-admin`.

**Sobre "que no me pida código":** el alta crea el usuario **con contraseña**, así que el ingreso
sería mail + contraseña, sin código al mail. Pero eso depende de que la instancia de Clerk tenga
habilitada la estrategia **password** para iniciar sesión. Si está configurada como
*email code* solamente (passwordless), la contraseña no sirve para entrar y el código va a
seguir apareciendo.

**Hay que verificarlo en Clerk antes de crear la cuenta** — si no, queda un admin que igual pide
código y no resuelve nada. Es un chequeo de dos minutos.

Mail propuesto: `omegadistribuciones08@gmail.com`.

---

## 8. Riesgos y orden sugerido

| Riesgo | Mitigación |
|---|---|
| El CV ciego no es tan ciego (empresas identificables) | Mostrar rubro, no nombre de empresa — P2 |
| Vender una base chica y decepcionar | Decirle a la empresa **cuántos perfiles hay** antes de que pague |
| Estrenar dos integraciones de MP a la vez | Opción B primero |
| Cobrar y que el candidato se entere mal | Mostrarle al candidato quién vio su perfil |

**Orden sugerido:**

1. Responder P1–P4 con Eugenia.
2. Verificar la config de Clerk y crear la cuenta de admin *(chico, independiente, se puede hacer ya)*.
3. Tabla `talent_unlocks` + backend + control de cupos.
4. Pantallas de empresa y de admin.
5. `/planes`.
6. Cerrar el pago de prueba de MP del destacado (pendiente de la tanda anterior).
7. Más adelante: Opción A, cobro recurrente automático.

**Nada de esto entra en la tanda del 14/08**, que sigue sin commitear ni probar. Esto es trabajo
nuevo y se cotiza aparte.
