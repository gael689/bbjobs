# Mails + IA + Revisión de CV — reglas de negocio y plan v4

> **Documento de planificación, 04/10/2026. No se prende nada.** Complementa a
> `MODULOS-MAILS-IA-PLAN.md` (v3), que sigue siendo la fuente de verdad **técnica** de Resend,
> Gemini, el RAG y la auditoría. Esta v4 agrega lo que faltaba: **las reglas de negocio**, **la
> matriz completa de notificaciones**, **el nivel de automatización de cada cosa** y **un producto
> nuevo: la Revisión de CV** para postulantes.
>
> **Auditado el 04/10/2026 en `AUDITORIA-RAG-Y-MODULOS-2026-10-04.md`. Donde la auditoría
> contradice a este documento (umbral "rerank ≥ 80", filtros de zona y modalidad, rerank nocturno,
> modelo de embeddings), manda la auditoría.**
>
> Rama de trabajo: `feat/mails-ia` (trae todo lo de `claude/funny-mayer-9ldq55`, sin mergear a
> `main`).

## 0. Decisiones de Gael (04/10/2026)

| # | Decisión |
|---|---|
| 1 | **Psicométrica: no, por ahora.** Se mantiene el Anexo A de la v3 como está. |
| 2 | **IA = Gemini.** Cerrado. El diseño de `AIProvider` se conserva, pero ya no se construye el camino de Claude/Voyage. |
| 3 | **La cuenta de Resend es el último paso.** Todo el código se escribe y se prueba antes, sin cuenta: con un proveedor simulado. |
| 4 | **Automatizar lo más posible**, con una regla fija: la IA nunca envía ni decide sola (§1). |
| 5 | **Producto nuevo para postulantes: Revisión de CV.** Pago por Mercado Pago; le llega a Eugenia; ella contacta **por fuera** (WhatsApp o mail). La plataforma solo cobra y avisa (§6). |

---

## 1. Principio de automatización

Cada cosa del sistema cae en uno de tres niveles. Esto es lo que ordena todo el documento.

| Nivel | Qué significa | Ejemplos |
|---|---|---|
| **A · Automático total** | Lo dispara un evento o el reloj, sin que nadie lo apruebe. Es **determinístico**: mismo evento, mismo mail. | Avisos de estado, resúmenes, recordatorios, alertas, cobros, recomendaciones nocturnas |
| **B · Automático con compuerta humana** | El sistema prepara todo; **una persona aprueba con un clic** antes de que salga. | Campañas, texto redactado por IA, publicar una búsqueda |
| **C · Humano** | Decide y actúa una persona; el sistema solo ayuda. | Verificar empresas, contactar a un postulante por WhatsApp, devolver plata |

**Reglas que no se rompen** (vienen de la v3 §6 y del `CLAUDE.md`):

1. La IA **ordena, redacta borradores y explica**. No envía mails, no cambia estados, no aprueba ni descarta a nadie.
2. Un aviso transaccional **no usa IA para escribirse**: sale de una plantilla fija, siempre.
3. Todo lo automático tiene **tope, interruptor y dedupe**. Si algo falla, **no envía** (falla cerrado), nunca "envía de más".
4. Toda tabla nueva con datos personales se suma a `services/account_deletion.py`.
5. Toda consulta nueva de empresa filtra por `company_id` y tiene test de acceso cruzado. Toda consulta nueva de postulante filtra por `candidate_id` y tiene el equivalente.
6. WhatsApp es **asistido**: la plataforma arma el link `wa.me`, la persona aprieta enviar. Jamás se automatiza.

---

## 2. Motor de notificaciones: las reglas que valen para todo

Un solo embudo: `create_notification(...)` crea la notificación en la web y además **encola el mail**
(v3 §4.2). Entre el evento y el mail hay una **política** (`services/email/policy.py`) que decide,
para cada mail, una de tres cosas: `enviar ahora`, `diferir hasta X` o `omitir (motivo)`.

### 2.1 Reglas transversales

| # | Regla | Valor por defecto |
|---|---|---|
| R1 | **Prioridad de categorías** (si hay tope, pasa primero la de arriba) | `cuenta` > pagos > `postulaciones` > `busquedas` > `alertas` > `recordatorios` > `novedades` |
| R2 | **Franja de envío**: todo lo que no sea crítico se difiere si cae fuera de la franja | 08:00 a 21:00, hora de `America/Argentina/Buenos_Aires` |
| R3 | **Críticos**: salen siempre, a cualquier hora | `cuenta` (verificada, rechazada, suspendida), pagos, confirmación de borrado |
| R4 | **Tope por persona**: mails no críticos por día | 2. Lo que sobra se **junta en el resumen** en vez de perderse |
| R5 | **Tope de marketing** (`novedades`) por persona | 1 por semana, y solo con consentimiento (v3 §4.7) |
| R6 | **Dedupe**: la misma cosa no sale dos veces | `dedupe_key` = `<tipo>/<id>` (formato que pide Resend, v3 §3) |
| R7 | **Sin resumen vacío**: un digest solo sale si tiene al menos un ítem real | — |
| R8 | **Política de ocaso** (*sunset*): quien no interactúa deja de recibir lo no pedido | Sin actividad en 90 días → se cortan recordatorios y resúmenes. Las **alertas que creó la persona** siguen. Señal de actividad: `CandidateActivityLog` / postulaciones / ingreso |
| R9 | **Ventana de arrepentimiento** para noticias negativas ("No avanza") | Se difieren 24 h y se cancelan si el estado cambia antes (la empresa se equivocó de botón) |
| R10 | **Calentamiento del dominio** | `EMAIL_DAILY_CAP` creciente (v3 M3). Lo que pasa del tope se pospone, nunca se descarta |
| R11 | **Interruptor general y por categoría**; sin cuenta de Resend todo queda `skipped` | Ya existe `emails_automaticos_activos`. Se suma uno por categoría |
| R12 | **Auto-freno por salud de la cuenta**: si rebotes > 4 % o quejas > 0,08 % en 7 días, se **pausan solas las campañas y los recordatorios** (los transaccionales siguen) y se avisa al admin | — |
| R13 | **Auto-freno de IA**: si el gasto del día pasa el tope, la IA se apaga sola y las pantallas degradan | `AI_DAILY_BUDGET_USD` (nuevo), alerta al admin |
| R14 | **Modo simulación**: el dispatcher renderiza y guarda el mail pero no lo manda | Permite que Eugenia vea cómo queda cada aviso **antes** de que exista la cuenta de Resend |
| R15 | **Prohibido vender en un transaccional** (v3 M9) | La venta va por banner dentro de la plataforma o por campaña |

### 2.2 Cómo se implementa

- `services/email/catalog.py`: un diccionario `tipo → Regla(categoría, modo, demora, plantilla, dedupe, audiencia, activo_por_defecto)`. **Es la única fuente de verdad del catálogo.**
- `services/email/policy.py`: `decidir(usuario, regla, ahora) -> Enviar | Diferir(cuando) | Omitir(motivo)`. Función pura, con tests tabla (R1 a R15).
- `services/email/dispatcher.py`: cada 60 s toma de `email_outbox` con `FOR UPDATE SKIP LOCKED` (v3 §4.2).
- `services/email/digests.py`: arma resúmenes (candidato diario/semanal, empresa diario/semanal, equipo diario).
- `services/email/provider.py`: interfaz con dos implementaciones, **`ResendProvider`** y **`SimulatedProvider`** (guarda y loguea). La selección es por configuración; sin key, simulado.

---

## 3. Catálogo de notificaciones

Leyenda de la columna **Cuándo**: *ya* = inmediato · *dig* = va al resumen · *dif* = diferido por una regla. **In-app** = notificación en la web (casi todo ya existe). **Mail** = nuevo.

### 3.1 Candidato

| Aviso | Disparador | In-app | Mail | Cuándo | Cat. | Notas |
|---|---|---|---|---|---|---|
| Bienvenida | Termina el onboarding | — | ✅ | ya | `cuenta` | Único (`welcome/<user>`). Explica qué completar primero |
| Postulación enviada | `apply_to_job` | ✅ | ✅ | ya | `postulaciones` | **Solo la primera del día** manda mail; las demás, solo in-app (R4) |
| Perfil revisado (`seen`) | Estado → `seen` | ✅ | — | — | — | Poco valor: solo in-app y resumen |
| Contactado / En proceso | Estado → `contacted` / `in_process` | ✅ | ✅ | ya | `postulaciones` | |
| Finalista / Seleccionado | Estado → `finalist` / `selected` | ✅ | ✅ | ya | `postulaciones` | El más valioso: nunca se difiere |
| No avanza | Estado → `discarded` | ✅ | ✅ | **dif 24 h** | `postulaciones` | R9. Texto empático, y sugiere 3 búsquedas parecidas |
| Búsqueda cerrada con postulación pendiente | Se cierra/vence una búsqueda en la que no hubo respuesta | ✅ | ✅ | dig | `postulaciones` | Cierra la incertidumbre |
| Una empresa desbloqueó tu perfil | `talent_unlock` | ✅ | ✅ | dig (máx. 1/día) | `postulaciones` | Transparencia de la Base de Talento |
| Alerta de empleo | Entra una búsqueda que coincide con una alerta | — | ✅ | Según `frequency` de la alerta | `alertas` | `instant` = como mucho 1 mail por hora agrupando; `daily` 08:00; `weekly` lunes 08:00 |
| **Búsquedas para vos** | Lunes 08:00, a quien no tiene alertas | — | ✅ | dig | `alertas` | Top 5 por puntaje estructurado + embeddings, **sin llamar al modelo de texto**. R7: si no hay ninguna buena, no sale |
| Perfil incompleto | Ya existe (cada 7 días) | ✅ | ✅ | dif (R2) | `recordatorios` | **Se corta tras 3 recordatorios sin cambios** en el perfil |
| Reactivación | 60 días sin actividad y con CV | — | ✅ | dif | `recordatorios` | Una vez cada 90 días: "¿seguís buscando?" |
| Perfil en la Base de Talento | Da o retira consentimiento | ✅ | ✅ | ya | `cuenta` | Constancia del consentimiento |
| Cuenta eliminada | `account_deletion` | — | ✅ | ya | `cuenta` | Se encola **antes** de la lápida, al mail original |
| Revisión de CV (4 avisos) | Ver §6.6 | ✅ | ✅ | ya | `cuenta` | Son de un pago: críticos |

### 3.2 Empresa

| Aviso | Disparador | In-app | Mail | Cuándo | Cat. | Notas |
|---|---|---|---|---|---|---|
| Verificada / Rechazada / Suspendida / Reactivada | Decisión del admin | ✅ | ✅ | ya | `cuenta` | Crítico, no se apaga |
| **Guía de arranque** | Verificada y sin búsquedas a los 2 días; otra a los 7 | — | ✅ | dif | `recordatorios` | Máximo 2 en toda la vida; se corta apenas publique |
| Búsqueda aprobada / rechazada / dada de baja / reactivada / eliminada | Decisión del admin | ✅ | ✅ | ya | `busquedas` | |
| Búsqueda por vencer / vencida | Ya existe (3 días antes) | ✅ | ✅ | ya | `busquedas` | Con botón de **reabrir** |
| **Postulaciones nuevas** | Hay ≥ 1 nueva desde el último resumen | ✅ | ✅ | **dig diario 08:00** | `postulaciones` | R7. Incluye "la que más encaja" (§4) |
| **Postulaciones sin revisar** | ≥ 5 en estado `new` hace más de 7 días | — | ✅ | dif | `recordatorios` | Máximo 2 por búsqueda. Mejora la experiencia del candidato |
| **Búsqueda sin postulaciones** | 7 días activa y 0 postulaciones | — | ✅ | dif | `recordatorios` | Consejos para mejorar el aviso. **Sin ofrecer destacar** (R15) |
| Candidato recomendado | §4.4 | ✅ | ✅ | dig | `postulaciones` | Tope 3 por búsqueda por semana |
| **Resumen semanal de la empresa** | Lunes 08:00 | — | ✅ | dig | `alertas` | Vistas, postulaciones, estado del embudo |
| Pago acreditado / rechazado (destacado y pack) | Webhook de MP | ✅ | ✅ | ya | `cuenta` | Crítico |
| **Pack casi agotado** | Quedan ≤ 2 contactos | ✅ | ✅ | ya (1 vez por pack) | `cuenta` | Aviso de servicio, no promo (R15) |

### 3.3 Admin (Eugenia y el equipo)

**Principio:** lo que cuesta plata o tiene un humano esperando sale **al instante**; el resto va a **un solo resumen diario** en vez de diez mails sueltos.

| Aviso | Disparador | In-app | Mail | Cuándo |
|---|---|---|---|---|
| Pago recibido (destacado, pack, **revisión de CV**) | Webhook de MP | ✅ | ✅ | **ya** |
| **Revisión de CV pagada** | Webhook de MP | ✅ | ✅ | **ya**, con el WhatsApp del postulante y el CV (§6) |
| Revisión de CV sin contactar | 24 h y 48 h hábiles sin pasar a "en curso" | ✅ | ✅ | ya |
| Empresa nueva o que reintenta | Registro | ✅ | — | dig |
| Búsqueda para revisar | Publicación | ✅ | — | dig. **Escala a "ya"** si lleva más de 24 h sin revisar |
| Mensaje de contacto | Formulario | ✅ | — | dig. Escala a "ya" si lleva más de 24 h |
| **Resumen diario del equipo** (08:30) | Reloj | — | ✅ | Pendientes de todo lo anterior + salud de mails (rebotes, quejas) + gasto de IA + revisiones de CV abiertas |
| Alerta de salud | R12 / R13 | ✅ | ✅ | ya |

---

## 4. Recomendaciones: reglas de negocio

La arquitectura está en la v3 §5 (híbrido: estructurado → embeddings → rerank con evidencia). Acá van **las reglas que faltaban**.

### 4.1 Quién ve qué

| Quién | Qué ve | Regla |
|---|---|---|
| Empresa verificada | Sus postulantes **ordenados por afinidad**, con puntaje y motivos | Gratis, para todas las verificadas. La empresa **siempre ve a todos**: ordenar no es descartar |
| Empresa verificada | **3 perfiles ciegos** de la Base de Talento por búsqueda | Gratis. Desbloquear un perfil gasta un contacto del pack, **igual que hoy** |
| Empresa con pack | Hasta 10 perfiles ciegos por búsqueda | El tope sale de una función `entitlement(company, feature)`. Es el primer límite real del sistema |
| Candidato | "Búsquedas para vos" (resumen + panel) | Sin modelo de texto: puntaje estructurado + embeddings |
| Admin | Gasto de IA, rendimiento y 👍/👎 | `ai_usage_log` |

### 4.2 Cuándo corre (todo automático, nivel A)

| Momento | Qué hace |
|---|---|
| Al **aprobarse** una búsqueda | Extrae requisitos y arma el embedding |
| Al entrar una **postulación** | Reordena los postulantes de esa búsqueda, **como mucho 1 vez por hora** |
| **03:00** (barrido nocturno) | Re-indexa fichas nuevas o cambiadas y las compara con las búsquedas activas. Va por `service_tier` barato (v3 §3) |
| Al abrir "Recomendados" | Lee el resultado cacheado. Si está viejo, "todavía calculando" y la búsqueda funciona igual |
| Refrescar a mano | Máximo **10 por empresa por día** (v3 §7.2, LLM10) |

### 4.3 Reglas de calidad y justicia

- **Nunca** se usan edad, género, foto, nombre ni estado civil.
- `sin_datos` **no cuenta como `no`**: no se penaliza a quien no cargó algo.
- Si dos candidatos empatan, desempata el **orden de llegada**, no la IA.
- **Pesos por defecto** (Eugenia los puede cambiar sin tocar código; recalcular no vuelve a llamar a la IA): obligatorias 30 · experiencia 25 · semántica 20 · deseables 10 · educación 10 · disponibilidad 5.
- Cada recomendación tiene 👍/👎. Con eso se arma el set de evaluación (v3 §5.8). **Antes de prender: evaluación obligatoria** y decidir entre híbrido solo y híbrido + rerank.
- Cada motivo cita evidencia **literal**; si no, se degrada a `sin_datos` (v3 §5.5).

### 4.4 Aviso "candidato nuevo que encaja"

Se avisa a la empresa **solo si** se cumplen todas:

1. Puntaje híbrido sobre el umbral **y** rerank ≥ 80 (o híbrido ≥ 0,8 si el rerank está apagado).
2. La búsqueda está activa y tiene 3 días o más (evita avisar con un aviso recién publicado).
3. No se avisó ya por ese par (`notified_at`).
4. Tope: **3 por búsqueda por semana** y **1 mail por empresa por día** (R4).
5. Viaja en el resumen diario, **no** como mail suelto.

### 4.5 La IA en las campañas (nivel B)

- **Redactora:** Eugenia describe la idea → la IA devuelve asunto, preheader, cuerpo y botón, más 2 o 3 variantes de asunto. Se edita, se manda una prueba y **se aprueba a mano**.
- **Audiencia en lenguaje natural:** se traduce a un filtro JSON de esquema cerrado, **nunca a SQL**, y el panel muestra el filtro y **cuántas personas son** antes de confirmar.
- **Campaña mensual con borrador automático:** el día 1 de cada mes el sistema arma un borrador con datos reales (búsquedas nuevas, postulaciones, empresas) y le avisa a Eugenia: *"Tu borrador de novedades está listo, revisalo y aprobalo"*. Un clic y queda programado. **Sin aprobación no sale** (R12 y regla 1).

---

## 5. Lo que no cambia de la v3

Resend con dos subdominios, cola propia para campañas, CV anonimizado en el servidor, vectores con numpy si Railway no trae pgvector, auditoría OWASP, `store=False` en Gemini, SDK `google-genai`. Todo sigue vigente.

**Ajustes de la v3 que hay que hacer ya** (los encontré al leer el código):

- `core/config.py`: `GEMINI_GENERATION_MODEL` quedó en `gemini-2.5-flash-lite`, que la v3 declara vieja. Debe ser `gemini-3.5-flash-lite`.
- El cliente de Gemini sigue sobre `httpx` y `generateContent` (legado): se reescribe sobre `google-genai` (v3 §3).
- El cliente de Resend necesita las claves `<evento>/<id>` y tratar el 409 como permanente (v3 §3).
- Faltan tests de `tokens.py` y `render.py`.

---

## 6. Producto nuevo: Revisión de CV (postulantes)

### 6.1 Qué es

Un servicio **pago, de una sola vez**, para postulantes. El candidato paga por Mercado Pago, le llega el aviso a Eugenia, y **ella lo contacta por fuera de la plataforma** (WhatsApp o mail) para revisar el CV o darle la devolución.

**La plataforma solo hace tres cosas:** cobrar, avisar y llevar el registro. **No hay chat, no hay mensajes, no hay archivos que viajen por la plataforma, y no interviene la IA.** El CV que revisa Eugenia es el que el candidato ya tiene cargado.

### 6.2 Reglas de negocio

| # | Regla | Valor |
|---|---|---|
| C1 | **Precio**: pago único, en pesos, por revisión | **A definir con Eugenia.** Se carga como variable `CV_REVIEW_PRICE` con un valor de partida de **ARS 12.000** (provisorio) |
| C2 | **Quién puede comprar** | Candidato con perfil, **CV cargado** y **teléfono** (ya es obligatorio en el perfil) |
| C3 | **Una revisión abierta por candidato** a la vez | Índice único parcial sobre estados abiertos. Si abandona el checkout, **se reutiliza** la orden y se genera un link nuevo |
| C4 | **Qué se revisa** | El CV cargado **al momento del pago**: se guarda la URL y la fecha del CV para que no cambie en el medio |
| C5 | **Canal de contacto** | Elige WhatsApp o mail. Por defecto, su teléfono y su mail de cuenta, editables. **Consentimiento explícito** a que Talency lo contacte por ahí |
| C6 | **Qué cuenta el postulante** | Un campo corto: "¿para qué puesto o rubro querés tu CV?" (hasta 500 caracteres) |
| C7 | **Plazo de contacto** | Objetivo: **48 h hábiles**. Si no pasa a "en curso" a las 24 h y 48 h, el sistema avisa a Eugenia |
| C8 | **Devolución** | Si no se puede prestar el servicio, se devuelve **a mano desde el panel de Mercado Pago** y se marca la orden como `refunded`. No se automatiza el reembolso |
| C9 | **Pago duplicado** | Si entra un segundo pago aprobado sobre la misma orden, se marca y se avisa al admin para devolver (mismo criterio que el pack de la Base de Talento) |
| C10 | **Orden vencida** | `pending_payment` por más de 24 h → `canceled` (lo hace el reloj) |
| C11 | **Quién cambia el estado** | **Solo el admin**, a mano. El webhook solo lleva de `pending_payment` a `paid` |
| C12 | **Qué no promete** | Ninguna garantía de empleo ni de entrevistas. Los **términos** lo dicen y se actualizan antes de lanzar |
| C13 | **Cómo se ofrece** | Banner dentro del panel del candidato y en `/planes`. **No** en mails transaccionales (R15); sí en una campaña, con consentimiento |

### 6.3 Estados

```
pending_payment ──(webhook: approved)──► paid ──(admin)──► in_progress ──(admin)──► delivered
       │                                  │                      │
       └─(24 h / rechazado)► canceled     └──────(admin)─────────┴──► refunded
```

- `paid` = **en cola de Eugenia**. Es el estado que dispara los avisos.
- El paso `paid → in_progress` lo hace Eugenia con un botón cuando toma el caso.
- `delivered` = ya hizo la devolución por WhatsApp o mail (afuera). El botón existe para cerrar el caso y mandar el aviso de cierre.

### 6.4 Modelo de datos (una migración)

**`payments` hoy solo admite empresas** (`company_id` es `NOT NULL` y `RESTRICT`). Cambios:

- `payments.company_id` pasa a **nullable**.
- `payments.candidate_id` nuevo: FK a `candidate_profiles`, `ON DELETE RESTRICT` (igual que el desbloqueo de talento: borrar al candidato no puede perder el registro contable).
- `CHECK (num_nonnulls(company_id, candidate_id) = 1)`: un pago es de una empresa **o** de un candidato, nunca de ambos ni de ninguno.
- `PaymentType.cv_review` nuevo.
- `payments.related_cv_review_id` (FK con `use_alter`, como el pack).

**Tabla nueva `cv_review_orders`:**

| Campo | Para qué |
|---|---|
| `id`, `candidate_id` (RESTRICT) | Dueño |
| `status` | Los estados de §6.3 |
| `cv_file_url_snapshot`, `cv_uploaded_at_snapshot` | El CV que se pagó (C4) |
| `objective` | Texto del candidato (C6) |
| `contact_channel`, `contact_value` | Dónde lo contacta Eugenia (C5) |
| `contact_consent_at` | Constancia del consentimiento |
| `paid_at`, `taken_at`, `delivered_at`, `refunded_at`, `canceled_at` | Línea de tiempo |
| `taken_by_admin_id`, `admin_note` | Quién la tomó y notas internas |
| `reminder_24h_sent_at`, `reminder_48h_sent_at` | Para que el aviso salga una sola vez |
| `created_at` | |

**Índice único parcial:** `(candidate_id)` donde `status IN ('pending_payment','paid','in_progress')`.

### 6.5 Endpoints

**Candidato** (`require_candidate`; todo filtra por `candidate_id`):

- `GET  /me/candidate/cv-review`: precio, si puede comprar (y por qué no: "falta cargar el CV"), y su historial.
- `POST /me/candidate/cv-review/checkout`: valida C2/C3, crea orden + `Payment` + preferencia de MP (`external_reference = payment.id`, igual que hoy) y devuelve `init_point`.
- `GET  /me/candidate/cv-review/{id}/status`: para el *polling* al volver de MP.

**Admin** (`require_admin`):

- `GET   /admin/cv-reviews?status=`: la cola, con nombre, WhatsApp, objetivo y antigüedad.
- `PATCH /admin/cv-reviews/{id}`: transición de estado + nota. Valida que la transición exista en §6.3.
- `GET   /admin/cv-reviews/{id}/cv`: link firmado al CV (reusa `cloudinary_client`, que vence en 5 minutos).

**Webhook:** una rama nueva `_procesar_revision_cv()` en `webhooks.py`, **calcada de `_procesar_pack_de_talento`**: `payment.paid_at` es el candado de idempotencia, y es el webhook —nunca el frontend— el que lleva la orden a `paid`.

### 6.6 Avisos de este producto

| A quién | Aviso | Cuándo |
|---|---|---|
| Candidato | **"Recibimos tu pago"**: "Eugenia te va a contactar por WhatsApp/mail en las próximas 48 h hábiles" | Webhook aprobado |
| Candidato | "Tu pago no se acreditó, podés reintentar" | Webhook rechazado |
| Candidato | "Eugenia ya está revisando tu CV" | Admin → `in_progress` |
| Candidato | **"Cerramos tu revisión"**: "Si no recibiste nada por [canal], respondé este mail" | Admin → `delivered` |
| Eugenia | **"Nueva revisión de CV pagada"** + nombre, teléfono con botón `wa.me` (mensaje armado), objetivo, link al CV | Webhook aprobado |
| Eugenia | "Revisión sin contactar hace 24 h / 48 h" | Reloj |
| Eugenia | "Pago duplicado: devolver" | Webhook (C9) |
| Eugenia | Las abiertas, en el **resumen diario del equipo** | 08:30 |

**Sin cuenta de Resend** estos avisos funcionan igual **en la plataforma** (notificación web + cola en el panel), así que el servicio se puede lanzar antes de que exista el módulo de mails.

### 6.7 Pantallas

- **Candidato:** `/dashboard/candidate/revision-cv` (qué incluye, precio, formulario de objetivo y contacto, estado de la orden) + un banner en el perfil + una tarjeta "Para postulantes" en `/planes`.
- **Admin:** `/dashboard/admin/revisiones-cv`: tabla por estado con botones **Tomar**, **WhatsApp** (reusa el botón de los paneles, commit `3fe0e43`), **Descargar CV**, **Entregada**, **Devuelta**, y nota interna.
- `/dashboard/admin/pagos` hoy lista solo destacados: se amplía para incluir pack y revisiones, y las métricas de ingresos (`admin.py:212`) suman los tres tipos.
- `/terminos` y `/privacidad`: se agrega el servicio, el contacto fuera de la plataforma, la devolución y la ausencia de garantías.

### 6.8 Borrado de cuentas y privacidad

- `account_deletion.py`: el candidato con una orden pagada pasa a **lápida**, no a borrado total (hay un pago de por medio). En la lápida se **borran** `contact_value`, `objective`, `admin_note` y la URL del CV; queda el registro contable. `preview_deletion` suma el conteo de revisiones.
- El CV **no se copia**: solo se guarda la URL que ya existe. Si el candidato borra o cambia su CV, el snapshot de la orden se invalida y el admin lo ve ("el CV cambió").
- La IA **no participa**: ni el CV ni los datos del servicio salen hacia Gemini.

### 6.9 Pruebas obligatorias

- El webhook aprobado deja la orden en `paid` **una sola vez**, aunque MP reintente (idempotencia por `paid_at`).
- Un segundo pago aprobado sobre la misma orden **no** la reabre y avisa al admin.
- Un candidato **no puede** ver, pagar ni leer la orden de otro (acceso cruzado).
- Una empresa **no puede** llamar a los endpoints de candidato, y viceversa.
- El `CHECK` rechaza un `Payment` sin dueño o con dos.
- No se puede crear una segunda orden abierta; sí se reutiliza una `pending_payment`.
- Sin CV o sin teléfono, el checkout devuelve un error claro.
- Una transición inválida (`delivered → paid`) devuelve 400.
- Borrado de cuenta con orden pagada: lápida, datos personales vacíos, pago intacto.
- Una migración con ida y vuelta en Postgres local (**nunca contra producción**: `backend/.env` apunta ahí).

---

## 7. Plan de construcción

Todo se puede escribir y probar **sin ninguna cuenta**, con el proveedor simulado y datos sintéticos.

| Tanda | Qué | Depende de |
|---|---|---|
| **T0** | Ajustes de §5: modelo Gemini, idempotencia y 409 en Resend, tests de `tokens.py` y `render.py`. Interfaz `provider.py` + `SimulatedProvider` | nada |
| **T1** | **Motor de avisos**: `catalog.py`, `policy.py` (R1–R15 con tests), dispatcher, enganche en `create_notification`, preferencias, bajas firmadas, webhook de Resend (probado con firmas falsas) | T0 |
| **T2** | **Revisión de CV completa** (§6): migración, modelo, endpoints, webhook, scheduler (recordatorios y vencimiento), pantallas, términos | T1 para los mails; el resto, nada |
| **T3** | Alertas de empleo + resúmenes (candidato diario/semanal, empresa diario/semanal, equipo 08:30) + "búsquedas para vos" | T1 |
| **T4** | Campañas: cola propia, audiencia, editor, métricas, **campaña mensual con borrador automático**, redactora con Gemini | T1, `llm` |
| **T5** | IA: `llm.py` sobre `google-genai`, `ai_usage_log`, ficha + redactor, **medición de CVs** (script local), embeddings, requisitos, híbrido, rerank, endpoints, tests de aislamiento | T0 |
| **T6** | Evaluación offline (v3 §5.8) y decisión híbrido vs. rerank; aviso "candidato que encaja" | T5 + cuenta de Gemini |
| **T7** | Frontend de todo lo demás (preferencias, `/baja`, alertas, campañas, Recomendados, gasto de IA) | T1–T5 |
| **T8** | `account_deletion.py` para cada tabla nueva, retención de contenido (90 días), reglas R12/R13 | en cada tanda |
| **T9** | **Cuentas y prendido** (último paso): Resend, DNS, calentamiento, Gemini con facturación, legal | todo lo anterior |

**Sobre el merge a `main`:** el `Dockerfile` corre `alembic upgrade head` en cada deploy. La rama tiene una sola cadena de migraciones (`f3b9c2d6a4e8` → `b1e4c7a2d905` → la de la Revisión de CV → las de IA). Mi recomendación: **un solo merge cuando T1 y T2 estén completos**, con los interruptores apagados. Así la Revisión de CV sale a producción **antes** de la cuenta de Resend, porque sus avisos viajan por la web y por el panel del admin. Si se prefiere sacar el servicio antes que los mails, la migración de CV se puede reordenar sobre `main`; hay que decidirlo antes de escribirla.

---

## 8. Decisiones abiertas

| # | Decisión | Quién | Default |
|---|---|---|---|
| D15 | **Precio de la Revisión de CV** | Eugenia | ARS 12.000 provisorio (`CV_REVIEW_PRICE`) |
| D16 | Plazo prometido de contacto | Eugenia | 48 h hábiles |
| D17 | ¿Se puede **volver a comprar** si no quedó conforme, con descuento? | Eugenia | No: cada revisión es una compra nueva |
| D18 | ¿Qué incluye exactamente? ¿Una llamada, un documento con mejoras, ambos? | Eugenia | Lo define ella; el sitio muestra un texto fijo editable |
| D19 | ¿Los mails de la Revisión de CV salen ya, o esperan al módulo de mails? | Gael | Salen por la web y el panel; el mail se suma con T1 |
| D20 | Tope de mails por persona y por día (R4), franja horaria (R2) | Eugenia | 2 por día; 08:00 a 21:00 |
| D21 | Ventana de arrepentimiento para "No avanza" (R9) | Eugenia | 24 h |
| D22 | Umbral del aviso "candidato que encaja" | Eugenia, con la evaluación | rerank ≥ 80 |
| D23 | Merge: una sola vez con T1 y T2, o separar la Revisión de CV sobre `main` | Gael | Una sola vez |
| D1–D14 | Siguen como en la v3 §9 (D9 y D11 ya cerradas; **D3 y las de psicométrica, en pausa**) | | |

## 9. Riesgos nuevos

- **Cobrar un servicio humano sin capacidad de atenderlo.** Si entran más órdenes de las que Eugenia puede revisar, el plazo se rompe. Mitigación: la regla de una orden abierta por candidato, los recordatorios de §3.3 y la posibilidad de **apagar la venta** con un interruptor (`cv_review_enabled` en `site_settings`).
- **Expectativa del cliente.** "Me revisan el CV" puede entenderse como "me consiguen trabajo". Los términos y el texto de la pantalla tienen que ser explícitos (C12).
- **Datos personales fuera de la plataforma.** Como el contacto es por WhatsApp o mail, queda fuera de nuestro control. Los términos lo aclaran y el consentimiento (C5) deja constancia.
- **Migración sobre `payments`.** Es una tabla contable y con datos reales: se prueba ida y vuelta en una base local y se mira cada consulta que une `payments` con `company_profiles` (`admin.py:838`, `account_deletion.py:114`) antes de mergear.
- **Exceso de mails.** Los topes R4/R5 y la política de ocaso R8 existen para esto; hay que medirlos en las primeras semanas con `EMAIL_DAILY_CAP` bajo.

## 10. Para retomar — estado al 04/10/2026 (noche)

**Todo el backend de este plan está escrito**, en la rama `feat/mails-ia`, detrás de la
compuerta `MODULOS_NUEVOS_ACTIVOS` (false en producción: rutas nuevas → 404; ver
`app/core/features.py`). Manda la auditoría (`AUDITORIA-RAG-Y-MODULOS-2026-10-04.md`).

| Tanda | Estado | Commit |
|---|---|---|
| Fix historial de estados + CUIT de suspendidas | ✅ en `main` local, **sin pushear** | `61ef319` |
| T0 base (Gemini SDK, Resend, tokens, render) | ✅ | `e04bf89` |
| T1 motor de avisos | ✅ (integración probada en local) | `906eacc` |
| Compuerta de módulos | ✅ | `0292787` |
| T2 Revisión de CV | ✅ | `b452ff5` |
| P1 Prospección (backend) | ✅ | `a15942b` |
| T5a núcleo RAG / T5b pgvector + endpoints | ✅ | `35f3267`, `632e18c` |
| T3 alertas y resúmenes | ✅ | `66df44a` |
| T4 campañas + prospección por canal propio + redactora IA | ✅ | `7492415`, `c4b9d4b` |
| Medición de CVs reales (script) | ✅ escrito, **falta correrlo** | `0a2d5e3` |
| P2 módulo "Pasar a BBJobs" del centro | ✅ escrito, **sin commitear en el centro** (convive con Plenia sin commitear) | — |
| T7 frontend (admin con "En desarrollo"; postulante/empresa ocultos sin `NEXT_PUBLIC_MODULOS_NUEVOS`) | ✅ eslint, tsc y `next build` OK | `c92060b` |
| Evaluación del RAG (script) y retención 90 días | ✅ | `88b3a15`, `085f4e1` |

**Pendiente de verificar:** los tests de integración de T2, P1, T3, T4 y T5 (corren con
`backend/scripts/probar_local_mails.ps1`, que arma una base descartable con pgvector).

**Decidido por Gael (04/10, noche):** D15 = **ARS 12.000** (queda el valor del código) · DP1 =
**otra cuenta de Resend** para la prospección.

### Pasos que restan, en orden

**A. Verificar (sin cuentas)**
1. Correr `backend/scripts/probar_local_mails.ps1` (68 tests de integración + migraciones ida y vuelta). Corregir lo que falle.
2. Correr `backend/scripts/medir_cvs_reales.py --muestra 40` y revisar 30 a mano. Si hay fugas: ajustar `redact.py` (o sumar NER) antes de usar CVs.
3. Probar a mano en local con `MODULOS_NUEVOS_ACTIVOS=true`, `EMAIL_MODE=simulate`, `PROSPECT_MODE=simulate` y `NEXT_PUBLIC_MODULOS_NUEVOS=true`: cada pantalla del admin, Revisión de CV con MP sandbox, alertas, recomendados (con `GEMINI_API_KEY` de prueba o sin IA), una sincronización real desde el centro.
4. Push del fix de estados (`main`, `61ef319`) — independiente de todo lo demás.

**B. Centro**
5. Commitear el módulo "Pasar a BBJobs" (convive con Plenia sin commitear).
6. `bbjobs_sync_url` + `bbjobs_sync_secret` en `config.json`; el mismo secreto como `LEADGEN_SYNC_SECRET` en Railway.

**C. Eugenia**
7. Qué incluye la Revisión de CV y qué plazo promete (D16–D18); textos de la pantalla.
8. Avisos: cuáles sí y horarios (D1, D2, D20, D21).
9. Etiquetar 3 búsquedas (40 candidatos c/u) con `scripts/evaluacion_rag.py exportar` → decidir rerank sí/no con `medir` (R13).
10. Rubros/zonas a prospectar y servicios a ofrecer (DP3, DP4).
11. Escribir los textos de las campañas (o usar la redactora y aprobar).

**D. Legal**
12. Términos y privacidad: IA (orientativa, decide la empresa), CV procesado y anonimizado, subprocesadores (Resend, Google), Revisión de CV (por fuera, sin garantía de empleo), bajas, consentimiento de novedades (D10).

**E. Cuentas y DNS (último)**
13. Resend avisos (Pro) y **otra cuenta** de Resend para prospección. Dominios `avisos.`, `novedades.` y `contacto.bbjobs.com.ar` con SPF/DKIM/DMARC sin tocar los de Clerk; tracking sólo en `novedades.`.
14. Webhooks: `/api/v1/webhooks/resend` y `/api/v1/webhooks/resend-prospeccion` → secretos en Railway.
15. Gemini (AI Studio) con **facturación activada** y tope de gasto; confirmar el precio de `gemini-embedding-001`.
16. Variables en Railway: `RESEND_*`, `PROSPECT_*`, `GEMINI_API_KEY`, `LEADGEN_SYNC_SECRET`, `AI_DAILY_BUDGET_USD`, `EMAIL_DAILY_CAP=150`.

**F. Lanzamiento**
17. Merge `feat/mails-ia` → `main` (el deploy corre las migraciones; con la compuerta cerrada no cambia nada visible).
18. `MODULOS_NUEVOS_ACTIVOS=true` en Railway y `NEXT_PUBLIC_MODULOS_NUEVOS=true` en Vercel.
19. Prender desde "Mails e IA", en este orden: Revisión de CV → mails (calentamiento: `EMAIL_DAILY_CAP` 150 → subir por semana, 1–2 semanas sólo transaccionales) → IA (backfill de embeddings, evaluación) → campañas → prospección (`PROSPECT_DAILY_CAP` 20 → subir de a poco).
20. Mandar el mail único de "¿querés recibir novedades?" a la base existente (D10).

**Para el lanzamiento (T9):** cuentas (Resend avisos + prospección, Gemini con facturación),
DNS de `avisos.`, `novedades.` y `contacto.`, `MODULOS_NUEVOS_ACTIVOS=true` en Railway y
`NEXT_PUBLIC_MODULOS_NUEVOS=true` en Vercel, calentamiento (`EMAIL_DAILY_CAP`), y prender los
interruptores desde "Mails e IA".

Antes de tocar mails o Gemini, cargar las skills `resend`, `email-best-practices` y
`gemini-api-dev`. Probar migraciones **sólo** contra una base local descartable.
