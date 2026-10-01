# Mails (Resend) + IA (Gemini) — plan técnico v3

> **Documento de planificación. No se prende nada hasta que Gael lo apruebe.**
> Está commiteado en la rama `claude/funny-mayer-9ldq55` (01/10), **sin mergear a `main` y sin
> deployar.** Para retomar, empezar por §12.
>
> **Origen:** propuesta "Próximos módulos" que Gael le mandó a Eugenia el 23/09/2026
> (`BBJOBS-PROXIMOS-MODULOS-EUGENIA.pdf`).
>
> **Decisiones de Gael:**
> - 01/10: mails con **Resend**, IA con **Gemini**, y se arranca por el código porque todavía no
>   hay cuentas.
> - 01/10 (v2):
>   - **La psicométrica queda en pausa** hasta que Eugenia pase los links que faltan.
>   - El alcance es **IA + Resend**.
>   - Hay que evaluar si **la IA también puede encargarse de los envíos automáticos** (§6).
>   - Hay que **auditar** el plan: RAG, mails y SaaS (§7).

---

## 0-bis. Qué cambió en la v3 (01/10, tarde)

Decisiones de Gael y lo que salió de investigar fuentes oficiales.

Desde este entorno no se puede abrir la documentación web de Google, Railway ni Resend (acceso
bloqueado), pero sí sus repos públicos de GitHub. De ahí salen:

- las skills oficiales `google-gemini/gemini-skills` y `resend/resend-skills`, que ahora están
  **instaladas en el proyecto** (`.claude/skills/`, registradas en `skills-lock.json`);
- el SDK `googleapis/python-genai` 2.26.0;
- la documentación de Railway (`railwayapp/docs`);
- Presidio (`microsoft/presidio`).

| # | Cambio | Fuente |
|---|---|---|
| 10 | **El CV entra en la primera versión**, extraído y anonimizado en nuestro servidor antes de que salga nada hacia Google (§5.2-bis) | Decisión de Gael |
| 11 | **Campañas: cola propia, enviando por la API de Resend** (D9 cerrada) | Decisión de Gael |
| 12 | **La imagen estándar de Postgres de Railway NO trae pgvector.** Hay que verificar cuál tiene BBJobs (§5.6) | `railwayapp/docs`: *"Railway's standard Postgres image does not include pgvector. Use the pgvector template instead"* |
| 13 | **Gemini cambió de API.** `generateContent` pasa a ser legado; la API actual es **Interactions** (`POST /v1beta/interactions`, header `Api-Revision`). La familia `gemini-2.5-*` que puse por defecto quedó vieja | Skill oficial `gemini-api-dev` |
| 14 | **Interactions guarda pedido y respuesta por defecto** (55 días en el nivel pago, 1 día en el gratuito). Hay que mandar **`store: false`** siempre, porque son datos de candidatos | Skill oficial + `CreateModelInteraction.store` en el SDK |
| 15 | **Se usa el SDK oficial `google-genai` ≥ 2.26** en vez de `httpx` a mano. Lo escrito a mano ya quedó viejo una vez | El cliente de §3 se reescribe |


La v1 era un diseño razonable hecho de memoria. La v2 lo contrasta con tres fuentes:

- La **documentación actual de Resend**: sus skills oficiales `resend` y
  `email-best-practices`, leídas del repo público `resend/resend-skills`.
- **OWASP Top 10 for LLM Applications 2025**.
- Los **datos que el portal ya tiene**.

Los cambios que importan:

| # | Cambio | Por qué |
|---|---|---|
| 1 | **El RAG pasa a ser híbrido**: primero filtros y puntaje con datos estructurados, después embeddings, y la IA al final | Las búsquedas ya guardan habilidades del catálogo (obligatorias u opcionales), años mínimos, nivel educativo, zona y modalidad. Ignorarlo y confiar todo a embeddings era tirar la mejor señal, que además es gratis y explicable (§5) |
| 2 | **La IA ya no inventa un puntaje de 0 a 100**: evalúa requisito por requisito con evidencia citada, y el puntaje lo calcula el código | Un 0–100 que sale de un modelo no es reproducible ni comparable entre búsquedas, y no se puede auditar (§5.5) |
| 3 | **Edad, género y foto quedan fuera de todo lo que ve la IA** | La v1 mandaba "franja de edad". Ordenar candidatos por edad o género es discriminación (Ley 23.592) (§5.2) |
| 4 | **Hay una evaluación con datos reales antes de prender nada** | El portal ya tiene postulaciones marcadas como *finalista* y *seleccionado*: es un set de prueba gratis para medir si la IA ordena mejor que el orden de llegada (§5.8) |
| 5 | **Subdominios separados** para avisos y campañas, **calentamiento del dominio** con tope diario, y tracking apagado en los transaccionales | Resend: un dominio nuevo arranca en ~150 mails por día. La v1 habría mandado una campaña a 1.611 personas el primer día (§4.3) |
| 6 | **Hay que decidir: campañas con Broadcasts de Resend o con cola propia** | Resend tiene Broadcasts, Segments, Topics y Automations nativos. Cada camino tiene costos distintos (§4.6) |
| 7 | **Consentimiento para campañas** | Un candidato que se registró para buscar trabajo no aceptó recibir publicidad. Las alertas sí las pidió él (§4.7) |
| 8 | **Se mide el consumo de IA por empresa** (`ai_usage_log`) | Es la base para poner topes por plan y ver el gasto. En la v1 sólo se logueaba (§7.3) |
| 9 | **Psicométrica fuera de este lote** | Se sacaron su código y su migración. El diseño queda en el Anexo A para retomarlo |

---

## 1. Alcance de este lote

| Módulo | Qué es | Del PDF |
|---|---|---|
| **Mails** | Avisos automáticos, alertas de empleo y campañas | hojas 01–02 |
| **IA · Recomendados** | Ranking de postulantes y de la Base de Talento por búsqueda, con motivos | hojas 04–06 |
| **IA · Asistente de envíos** | La IA ayuda a redactar y segmentar. No envía sola (ver §6) | pedido nuevo del 01/10 |

Fuera de este lote: la evaluación psicométrica (Anexo A).

---

## 2. Lo que ya existe y condiciona el diseño

Relevado contra el código el 01/10/2026.

| Hallazgo | Dónde | Consecuencia |
|---|---|---|
| Todo evento que debería mandar mail ya pasa por `create_notification` / `notify_all_admins` (unas 25 llamadas) | `services/notifications.py` | El mail se engancha en ese único embudo y no hay que tocar las 25 llamadas |
| Las búsquedas tienen **datos estructurados**: habilidades del catálogo con `is_required`, `min_experience_years`, `min_education_level`, zona, modalidad y rubro | `models/job.py`, `JobPostingSkill` | Son la columna vertebral del ranking (§5) |
| Los candidatos tienen lo mismo: habilidades del catálogo, experiencias con fechas, nivel educativo, zona, modalidades que acepta, disponibilidad y pretensión | `models/candidate.py` | Se puede calcular cuánto encaja un candidato sin IA |
| Hay **historial de estados de postulación** (`finalist`, `selected`) | `application_status_history` | Es el set de evaluación del RAG (§5.8) |
| El **texto del CV no está en la base**: el PDF vive en Cloudinary y nadie lo lee | `cv_file_url` | El PDF a Eugenia promete que la ficha incluye "CV". Leerlo es un paso aparte y más delicado (§5.2) |
| Las tablas de alertas de empleo existen y no las usa nadie | `models/alerts.py` | Se completan |
| El mailer anterior (Resend) se borró | — | Se reconstruye limpio |
| Los mails de cuenta (verificación de mail, códigos) los manda **Clerk** | — | No se reemplazan |
| No hay RLS: el aislamiento entre empresas está 100% en la aplicación | `CLAUDE.md` | Cada query nueva filtra por `company_id` y necesita un test que lo pruebe (§7.3) |
| Los límites de los planes **no se aplican en ningún lado** | `BASE-TALENTO-Y-PLANES-PLAN.md` §2a | Si las recomendaciones dependen del plan, va a ser el primer límite que se aplique de verdad |
| Un solo proceso de uvicorn con APScheduler adentro | `Dockerfile`, `core/scheduler.py` | Sirve hoy. Con más réplicas las tareas se duplicarían (§7.3) |
| `account_deletion.py` borra a mano lo que cuelga de la persona | `services/account_deletion.py` | **Cada tabla nueva con datos personales se suma ahí**, o es un incumplimiento de la Ley 25.326 |

---

## 3. Fundación común

**Ya escrita, sin commitear.**

- **Sin cuenta, no rompe ni acumula.**
  - Sin `RESEND_API_KEY` o con el interruptor apagado, el mail queda en la cola como `skipped`.
    No queda `pending`: si no, el día que se cargue la key saldría un aluvión de avisos viejos.
  - Sin `GEMINI_API_KEY`, la IA levanta `AIUnavailable` y la pantalla degrada (sin orden por
    IA ni motivos).
- **Interruptores** en `site_settings`, apagados por defecto: `emails_automaticos_activos` e
  `ia_recomendaciones_activas`.
- **Clientes** `resend_client.py` y `gemini_client.py`:
  - Sobre `httpx`, con errores clasificados en transitorios y permanentes.
  - Con idempotencia y detrás de la interfaz `AIProvider`, para poder cambiar a Claude.
  - 29 tests, sin red.
- **Gemini, cambios de la v3** (pendientes; el cliente actual y sus 16 tests se reescriben):
  - **SDK oficial `google-genai` ≥ 2.26** (`pip install google-genai`). La clase `AIProvider` se
    mantiene, así que el resto del sistema no se entera.
  - **Generación por la Interactions API:** `client.interactions.create(...)` con
    `system_instruction`, `response_format` (JSON schema nativo, que antes no se usaba por
    inestable) y `response_mime_type="application/json"`. Además:
    - **`store=False` siempre.**
    - `generation_config.thinking_level="minimal"` para extraer y evaluar.
    - **Sin `temperature`**: la guía de migración dice que se quitó en los modelos nuevos.
    - `labels` con `feature` y `company_id`, para atribuir costo por empresa en la factura de
      Google.
  - **Embeddings:** `client.models.embed_content(model="gemini-embedding-001", …)` con
    `task_type` y `output_dimensionality=768`. Confirmado en el SDK: el endpoint es
    `batchEmbedContents` con esos campos, igual que el cliente de la v1.
  - **Modelos por defecto**, configurables por variable:
    - `gemini-3.5-flash-lite` para extraer requisitos, evaluar y redactar ("lowest-cost …
      high-throughput" según la skill oficial).
    - `gemini-3.8-flash` sólo para la evaluación comparativa (§5.8).
  - **`service_tier`:** el SDK acepta `flex`, `standard`, `priority` y `deferred`. Para los
    barridos nocturnos, `flex` o `deferred` deberían ser más baratos. **Precio a confirmar.**
- **Ajustes que pide la auditoría a la fundación** (pendientes):
  - Las claves de idempotencia deben seguir el formato que recomienda Resend:
    `<evento>/<id>`, con un máximo de 256 caracteres y vigencia de 24 h.
  - Tratar el **409** de Resend (misma clave con otro contenido) como error permanente.
  - **Validar el lote completo antes de mandarlo**, porque Resend rechaza el lote entero si un
    solo mail falla la validación.

---

## 4. Mails (Resend)

### 4.1 Modelo de datos

**Ya escrito, sin commitear; migración `b1e4c7a2d905`, verificada.**

| Tabla | Qué guarda |
|---|---|
| `email_outbox` | La cola y el historial de cada mail (estado, intentos, `provider_message_id` y las marcas entregado / abierto / click / rebote / queja) |
| `email_templates` | Los cambios de texto que hace Talency sobre los defaults del código |
| `email_preferences` | Opt-out por usuario y categoría |
| `email_suppressions` | Espejo local de las supresiones |
| `email_campaigns` | Las campañas (§4.6) |
| `email_digest_state` | Hasta cuándo se contó en el último resumen |
| `job_alerts.frequency` | Frecuencia de cada alerta: `instant`, `daily` o `weekly` |

**Categorías:**

| Categoría | Ejemplos | ¿Se puede apagar? | Tipo |
|---|---|---|---|
| `cuenta` | Empresa verificada, rechazada o suspendida; pagos | **No** | Transaccional |
| `postulaciones` | Cambios de estado; postulaciones nuevas (resumen diario) | Sí | Transaccional |
| `busquedas` | Búsqueda aprobada, rechazada, dada de baja o por vencer | Sí | Transaccional |
| `alertas` | Alertas de empleo; resumen semanal | Sí | Pedido por el usuario |
| `recordatorios` | Perfil incompleto | Sí | Transaccional, en zona gris |
| `novedades` | Campañas de Talency | Sí, **y requiere consentimiento** (§4.7) | **Marketing** |
| `admin` | Avisos para el equipo de Talency | Sí | Interno |

### 4.2 Flujo

```
evento ─► create_notification ─► (misma transacción) INSERT email_outbox
                                      │
                         scheduler cada 60 s (FOR UPDATE SKIP LOCKED)
                                      │
             re-chequea supresión, preferencia y tope diario ─► Resend /emails/batch
                                      │
             Resend ─► POST /webhooks/resend (svix) ─► marcas + supresiones
```

### 4.3 Hallazgos de la auditoría de Resend que cambian el diseño

| ID | Hallazgo | Cambio |
|---|---|---|
| M1 | Conviene separar la reputación de los transaccionales y la del marketing | **Dos subdominios.** Los avisos salen de `avisos.bbjobs.com.ar` y las campañas de `novedades.bbjobs.com.ar`. Cada uno con su SPF, DKIM y DMARC. Así, si una campaña genera quejas, no se hunden los avisos de postulación |
| M2 | El tracking de aperturas y clicks puede disparar filtros de spam en los transaccionales. En Resend se configura **por dominio** | Tracking **apagado** en `avisos.` y **prendido** en `novedades.`. Es otra razón para separar subdominios |
| M3 | **Calentamiento:** un dominio nuevo arranca en ~150 mails/día y sube a ~2.000/día en una semana | Agregar el setting `EMAIL_DAILY_CAP`, que el dispatcher respeta: lo que pasa del tope queda para el día siguiente, con prioridad para `cuenta`. **La primera campaña a toda la base no puede salir en la primera semana.** Plan: 1–2 semanas sólo con transaccionales y después campañas por tandas |
| M4 | El batch es todo o nada, no admite adjuntos ni envío programado, y acepta hasta 100 mails | Validar antes de mandar. Ante un error permanente, reintentar de a uno para aislar el mail defectuoso (ya contemplado) |
| M5 | Resend **suprime solo** rebotes duros y quejas, y emite `suppression.added` / `email.suppressed` | No hace falta reimplementar la supresión. Se mantiene el **espejo local** alimentado por webhook, para no gastar cuota y para mostrarlo en el panel |
| M6 | Eventos a escuchar: `email.sent`, `delivered`, `delivery_delayed`, `bounced`, `complained`, `opened`, `clicked`, `failed`, `suppression.added` | Se amplía la lista de la v1. El webhook es **idempotente por `svix-id`**: Resend reintenta y el mismo evento puede llegar dos veces |
| M7 | Gmail, Yahoo y Microsoft exigen `List-Unsubscribe` + `List-Unsubscribe-Post` a quien manda en volumen. El POST de baja debe responder 200 o 202 y hacerse efectivo en menos de 48 h | En todas las campañas y en los resúmenes de alertas. Ya estaba previsto; se confirma |
| M8 | Usar `reply-to` real, no "no-reply" | `RESEND_REPLY_TO` debe ser un buzón real de Talency |
| M9 | Separar transaccional de promocional | **Prohibido** colar promociones ("destacá tu búsqueda") en un mail de estado de postulación. La venta va por campaña |
| M10 | Gmail recorta los mails de más de 102 KB; siempre conviene mandar versión en texto plano | Se cumple (layout liviano y texto alternativo) |
| M11 | Retención: logs ~90 días, contenido ~30 días, supresiones para siempre | Tarea nocturna que vacía `html` y `text` del outbox a los 90 días y deja los metadatos |
| M12 | Nunca probar con direcciones inventadas de Gmail: rebotan y queman la reputación | Probar con `delivered@resend.dev`, `bounced@resend.dev` y `complained@resend.dev` |
| M13 | Las claves de API se pueden restringir | La app usa una clave **sólo de envío** y restringida al dominio. La clave con acceso total queda para la configuración inicial |
| M14 | Métricas sanas: rebotes < 2–4% y quejas < 0,05–0,08% | Alerta en el panel admin si se superan. Por encima de esos números Resend puede pausar la cuenta |

### 4.4 Catálogo de avisos

Mapeo `tipo de notificación → categoría → inmediato / resumen`.

| Para quién | Avisos | Envío |
|---|---|---|
| **Candidato** | Cambios de estado (6), perfil incompleto, una empresa desbloqueó su perfil (nuevo), bienvenida (nuevo, sólo mail), postulación enviada (nuevo, sólo mail) | Inmediato |
| **Candidato** | Alertas de empleo, resumen semanal | Resumen |
| **Empresa** | Verificada, rechazada, suspendida o reactivada; búsqueda aprobada, rechazada, dada de baja, reactivada o eliminada; vence pronto o venció; pagos de destacado y de pack | Inmediato |
| **Empresa** | Postulaciones nuevas | **Resumen diario** |
| **Empresa** | Candidato recomendado (§5.7) | — |
| **Admin** | Empresa nueva o que reintenta, búsqueda para revisar, mensaje de contacto, pago recibido | Inmediato |

### 4.5 Alertas de empleo

Se mantiene la v1:

- Endpoints para el candidato.
- Matcher puro (rubro, zona, modalidad).
- `job_alert_notifications` para no repetir.
- Un solo mail con todas las búsquedas que coinciden.

**Mejora con IA** (§6): el resumen semanal suma la sección "**también te pueden interesar**".
Usa los mismos embeddings del RAG en la dirección inversa (candidato → búsquedas). Cuesta casi
cero y no llama al modelo de texto.

### 4.6 Campañas: ¿Broadcasts de Resend o cola propia? — **DECIDIDO: cola propia vía API de Resend (D9, 01/10)**

Queda una verificación: que la política de uso de Resend permita mandar marketing por la API
transaccional en el plan Pro. No se pudo leer desde este entorno (`resend.com` bloqueado). Se le
pregunta a Resend al crear la cuenta. Si dijera que no, el plan B (Broadcasts) reutiliza el mismo
`email_campaigns`.

La comparación que llevó a la decisión:

| | **A · Broadcasts de Resend** | **B · Cola propia sobre la API transaccional** (v1) |
|---|---|---|
| Página de baja y preferencias | Resuelto por Resend (`{{{RESEND_UNSUBSCRIBE_URL}}}`, Topics) | Hay que construirla (endpoint firmado + página `/baja`) |
| Métricas | Nativas (destinatarios por evento, links clickeados) | Desde nuestro outbox vía webhook |
| Audiencias ("rubro gastronomía y nunca publicó") | Los Segments son **listas estáticas**: hay que sincronizar contactos y pertenencias desde nuestra base con un job | Es una consulta SQL en el momento del envío. Siempre al día |
| Datos personales | Se **replican** todos los contactos en Resend. Al borrar una cuenta, también hay que borrarla allá | Resend sólo recibe a quién se le manda cada vez |
| Costo | Los Broadcasts y los contactos tienen **sus propios límites de plan** (el endpoint `/usage` de Resend informa contactos, segmentos y broadcasts por separado). Hay que confirmar si el Pro de USD 20 los cubre o si hace falta el plan de marketing. **El PDF prometió "sin costo extra"** | Entra en la cuota de mails del plan de envío |
| Editor para Eugenia | El de Resend (otra herramienta, otra cuenta) | El de nuestro panel |
| Política de uso | Es el camino que Resend recomienda para marketing | **Verificar** que Resend permita marketing por la API transaccional en el plan Pro |

**Recomendación: B, con dos condiciones.**

1. Usar el subdominio `novedades.` (M1).
2. Que Resend confirme por escrito que está permitido.

B mantiene la promesa de costo hecha a Eugenia y no replica la base de candidatos en un tercero.
Si Resend no lo permite, A es el plan de respaldo. El modelo de `email_campaigns` sirve igual en
los dos casos.

### 4.7 Consentimiento para campañas — **decisión abierta (D10)**

- **Empresas:** comunicación B2B con quien tiene relación comercial. Alcanza con baja fácil.
- **Candidatos:** se registraron para buscar trabajo, no para recibir publicidad.
  - **Propuesta:** casilla **destildada** "Quiero recibir novedades de BBJobs" en el registro y en
    "Mi cuenta", guardando fecha de alta y de baja (mismo criterio que el consentimiento de la Base
    de Talento).
  - A la base existente se le manda **una sola vez** un mail de "¿querés recibir novedades?".
  - Las alertas no necesitan nada de esto, porque las crea el propio candidato.
  - La Ley 25.326 (art. 27) admite publicidad con derecho a pedir la baja. Lo propuesto es más
    prudente que el mínimo legal y además mejora la entregabilidad (menos quejas). **Que lo
    confirme un abogado.**

### 4.8 Plantillas

En código, versionadas y testeadas. Talency puede pisar el asunto y el texto con variables
`{{nombre}}`, sin lógica.

- No se usan las Templates de Resend: atarían cada cambio de texto a otra herramienta y no se
  pueden testear junto con el código.
- Accesibilidad:
  - `lang="es"` y tablas `role="presentation"` (ya está).
  - Texto alternativo en imágenes.
  - Contraste del teal sobre blanco a verificar: `#1E8EA3` con texto blanco ronda 3,9:1, por
    debajo del AA para texto chico. Usar `#187B8E` en el botón.

---

## 5. IA · Candidatos recomendados — arquitectura RAG v2

### 5.1 Por qué cambia

La v1 era RAG "de manual": embedding de la ficha, top-20 por coseno y un LLM que pone un número.
Con los datos de BBJobs eso tiene cuatro problemas:

1. **Desperdicia la mejor señal.** "¿Tiene las habilidades obligatorias del aviso?" se contesta
   con una consulta exacta, gratis y explicable. Un embedding la aproxima peor.
2. **El puntaje del LLM no es estable.** El mismo candidato puede salir 78 en una llamada y 84 en
   otra, y un 80 en una búsqueda no significa lo mismo que en otra.
3. **No había forma de saber si funciona.** Faltaba la evaluación.
4. **Mandaba la edad a la IA**, lo que habilita a ordenar por edad.

### 5.2 La ficha

Lo que entra a la IA sale de **un solo constructor** con tests. Si un campo no está acá, no sale.

| Va | No va, nunca |
|---|---|
| Puestos ocupados y duración | Nombre, teléfono, mail, foto, URL del CV |
| Nivel educativo, título y estado | Nombre del empleador y de la institución (en Bahía Blanca identifican) |
| Habilidades del catálogo, "otra" e idiomas con nivel | **Edad y género**: anti-discriminación, no se usan para ordenar ni se le muestran a la IA |
| Zona, modalidades que acepta, disponibilidad, movilidad | Pretensión salarial: se usa sólo como filtro estructurado, fuera del texto |
| Resumen y descripciones de experiencia, **pasados por el redactor** (tacha mails, teléfonos, URLs, DNI/CUIT y el nombre y apellido del candidato) | |

- **Redactor:** las expresiones regulares cubren lo obvio (mails, teléfonos, URLs). Para el
  nombre se usa el nombre y apellido conocido del candidato. Igual queda texto libre que puede
  identificar ("trabajé 10 años en la panadería de mi viejo en Villa Mitre"). Ese es el riesgo
  residual y por eso la facturación de Gemini va activada (§5.9).
- **CV en PDF:** entra en la primera versión, extraído y anonimizado en nuestro servidor. Ver
  §5.2-bis.

### 5.2-bis El CV: extracción y anonimización — **entra en la primera versión** (decisión de Gael, 01/10)

Le cumple a Eugenia lo que dice el PDF (hoja 05: la ficha incluye el CV) **sin romper la otra
promesa** de la misma hoja: *"a la IA nunca se le manda el nombre, el teléfono, el mail ni la foto"*.

**Regla de oro: el PDF crudo nunca sale de nuestro servidor.** Gemini podría leer el PDF directo
(es multimodal), pero eso le mandaría a Google el CV entero con DNI, domicilio y foto. Se descarta.

```
CV nuevo o cambiado (cambió cv_file_url)
  │
  1. Descarga del PDF privado con link firmado (cloudinary_client, ya existe, vence en 5 min)
  2. Extracción local de texto (pypdf)
       └─ ¿no hay texto? → es un escaneo → estado `scanned`, no se usa (ver abajo)
  3. Recorte de la sección "Datos personales"
       └─ los CV argentinos la traen arriba: DNI, CUIL, fecha de nacimiento, edad, estado civil,
          nacionalidad, domicilio, hijos → se elimina del encabezado hasta el próximo título
          conocido (Experiencia, Formación, Educación, Estudios, Cursos…).
          Sólo se rescata "licencia de conducir" (y su categoría), que es requisito laboral real.
  4. Redacción en capas (Presidio + spaCy `es_core_news_md`, todo local):
       · Datos conocidos del propio candidato: nombre, apellido, teléfono, mail
       · Patrones argentinos, que Presidio no trae y se escriben como reconocedores propios:
         DNI (7–8 dígitos, con o sin puntos), CUIL/CUIT (XX-XXXXXXXX-X con dígito verificador),
         teléfonos AR (`phonenumbers` con región AR), mails, URLs (LinkedIn, etc.)
       · NER de spaCy: PERSONA y LUGAR (calles, barrios) → se reemplazan por [PERSONA] y [LUGAR]
       · Edad, fecha de nacimiento, estado civil y "hijos" fuera del bloque inicial → se tachan
         (anti-discriminación, igual que en §5.2)
  5. Recorte a ~1.500 palabras y guardado en `candidate_cv_texts`
       (texto redactado, hash del archivo, estado, métricas de qué se tachó, fecha)
  6. Ese texto se suma a la ficha (§5.2) → embedding y rerank
```

**Decisiones de diseño:**

- **Todo local.** Presidio y spaCy corren en el backend; no hay otra nube de por medio. La imagen
  de Docker crece unos 50–60 MB por el modelo `es_core_news_md`. Se descarga en el build, no en
  cada arranque.
- **Nombres de empleadores.** No se pueden borrar de un CV en texto libre de forma confiable, y a
  Google llegan (Google no es la empresa que contrata). El riesgo está en la salida: los motivos
  que ve una empresa de un candidato **ciego** de la Base de Talento no pueden nombrar
  empleadores, porque lo identificarían. Control de salida:
  - Se rechaza el motivo que contenga un nombre de `Experience.company_name` del candidato o una
    entidad de tipo ORGANIZACIÓN que detecte spaCy.
  - Si un candidato se queda sin motivos, se regenera una vez y, si sigue fallando, se muestra
    sin motivos.
- **El texto redactado del CV nunca se muestra a una empresa.** Es sólo entrada para la IA.
- **Escaneos (CV como imagen):** en la v1 quedan afuera. La ficha se arma con los datos del perfil
  y la pantalla dice "CV no legible". Un OCR local (Tesseract) agrega ~100 MB y otra fuente de
  errores; se decide después de medir cuántos hay.
- **Medición antes de construir** (script local, sin IA, sobre los CV que ya están cargados):
  - % con texto extraíble;
  - % con sección "Datos personales" detectada;
  - cuánto tacha cada capa;
  - **revisión manual de 30 CV redactados** elegidos al azar.
  - **Criterio de salida:** cero DNI, teléfono, mail o nombre propio del candidato en la muestra.
    Si no se cumple, no se usa el CV hasta corregir.
- **Transparencia (opcional, frontend):** el candidato puede ver "lo que lee la IA de tu CV" desde
  su panel. Es el mejor control de calidad que existe: si algo se escapó, lo ve el dueño del dato.
- **Borrado:** `candidate_cv_texts` se suma a `account_deletion.py`. Cuando cambia el CV, el texto
  viejo se reemplaza.
- **Legal:** términos y privacidad tienen que decir que el CV se procesa automáticamente y se usa
  anonimizado para recomendaciones (§8, legal).

### 5.3 La búsqueda: entender el aviso una vez

- La parte estructurada sale directo de la base: habilidades obligatorias y deseables, años
  mínimos, nivel mínimo, zona, modalidad y rubro.
- El aviso en texto libre suele traer requisitos que no están en esos campos ("licencia de
  conducir", "manejo de Tango", "disponibilidad fines de semana").
  - **Una llamada a Gemini por búsqueda**, cacheada por `job_hash`, los extrae a JSON validado:
    `[{requisito, tipo: excluyente|deseable, categoria}]`.
  - La descripción la escribe la empresa, así que es **texto no confiable**: si intenta inyectar
    instrucciones, no puede hacer más que agregar requisitos.
  - Admin y empresa **ven** los requisitos extraídos (transparencia).

### 5.4 Pipeline

```
INDEXACIÓN (nocturna; y al aprobar una búsqueda)
  candidato ─► ficha (5.2) ─► hash ─► ¿cambió? ─► embedding RETRIEVAL_DOCUMENT
  búsqueda  ─► requisitos (5.3) + texto ─► embedding RETRIEVAL_QUERY

RECUPERACIÓN (al abrir la pestaña "Recomendados")
  1. Universo:
     · postulantes de la búsqueda (todos), o
     · Base de Talento: consintió, no está borrado y no se postuló
  2. Filtros duros (SQL):
     · modalidad compatible
     · si es presencial, zona compatible
     · para la Base de Talento, que no haya pedido no aparecer
  3. Puntaje híbrido (código, sin IA):
       habilidades obligatorias cubiertas  ─┐
       habilidades deseables               │
       años de experiencia vs. mínimo      ├─► combinación ponderada (pesos D4) ─► 0..1
       nivel educativo vs. mínimo          │
       disponibilidad / modalidad          │
       similitud semántica (coseno)       ─┘
  4. Top-30 por puntaje híbrido ─► rerank con Gemini (5.5), de a 10 fichas por llamada
  5. Puntaje final = f(evaluación por requisito, híbrido), calculado en código
  6. Resultado cacheado por (job_hash, ficha_hash, versión de pesos, versión de prompt, modelo)
```

- Si una búsqueda tiene 150 postulantes, **todos** se ordenan por el híbrido, que es gratis.
  Sólo los 30 de arriba pasan por la IA. El resto queda ordenado igual, sin motivos redactados.
- **No se descarta a nadie.** La IA ordena; la empresa sigue viendo a todos (PDF hoja 06).

### 5.5 Rerank: la IA evalúa, el código puntúa

Por cada ficha, Gemini devuelve JSON validado con:

```json
{
  "ref": "#A3F91C",
  "requisitos": [
    {"requisito": "Licencia de conducir", "cumple": "si|parcial|no|sin_datos",
     "evidencia": "texto copiado de la ficha"}
  ],
  "motivos": ["…", "…"]
}
```

- **Puntaje en código:** excluyentes cumplidos pesan más que deseables, y `sin_datos` **no
  cuenta como `no`.
  - Es reproducible: la misma evaluación da siempre el mismo número.
  - Si Eugenia cambia los pesos, se recalcula **sin volver a llamar a la IA**.
- **Control de alucinaciones:** cada `evidencia` tiene que ser un fragmento literal de la ficha
  enviada. Si no lo es, ese ítem se degrada a `sin_datos` y se registra.
- **Validaciones de salida:**
  - Las `ref` devueltas tienen que ser exactamente las enviadas.
  - Los motivos no pueden tener mails, teléfonos ni URLs (escaneo por regex).
  - Máximo 3 motivos de 200 caracteres.
- **Lo que ve la empresa:** el puntaje, los motivos y la tabla de requisitos con ✓, ~, ✗ y "sin
  datos".

### 5.6 Dónde viven los vectores

**La documentación de Railway dice que su Postgres estándar no trae pgvector.** Hay que usar su
plantilla específica. Lo más probable es que BBJobs esté en la estándar, salvo que se haya creado
con esa plantilla.

**Cómo verificarlo** (cualquiera de los tres caminos sirve; los dos primeros no cambian nada):

1. **Panel de Railway** → servicio Postgres → *Settings* → *Source* / imagen:
   - `ghcr.io/railwayapp-templates/postgres-ssl` → estándar, **sin** pgvector;
   - algo con `pgvector` en el nombre → con pgvector.
2. **Consulta SQL**, desde la pestaña *Data* del servicio, con `railway connect Postgres` desde la
   CLI, o con `psql "$DATABASE_URL"`:
   ```sql
   SELECT name, default_version, installed_version
   FROM pg_available_extensions WHERE name = 'vector';
   ```
   - **0 filas** → no está disponible en ese servidor.
   - **1 fila con `installed_version` vacío** → está disponible y falta activarla. Se activa con
     `CREATE EXTENSION vector;` dentro de una migración de Alembic, que corre con el rol de
     `MIGRATIONS_DATABASE_URL`: el rol de la app no tiene permisos de DDL.
   - **1 fila con versión** → ya está activa.
3. **Desde el repo**, con el `.env` del backend apuntando a Railway (sólo lectura, no cambia nada):
   ```bash
   cd backend && python - <<'PY'
   import asyncio, asyncpg
   from app.core.config import settings
   async def main():
       conn = await asyncpg.connect(settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
       print(await conn.fetch("SELECT name, default_version, installed_version "
                              "FROM pg_available_extensions WHERE name = 'vector'"))
       await conn.close()
   asyncio.run(main())
   PY
   ```
   `[]` = no disponible; una fila = disponible (mirar `installed_version`).

**Ojo con el entorno local:** el `docker-compose.yml` usa `postgres:16-alpine`, que tampoco trae
pgvector. Si se adopta, en local se cambia a `pgvector/pgvector:pg16`.

**Qué hacer según el resultado:**

| Resultado | Camino |
|---|---|
| Está disponible | Columna `vector(768)` + búsqueda exacta en SQL (a esta escala no hace falta índice) |
| No está (lo más probable) | **numpy en memoria** (abajo). **No se migra la base por esto**: mover la base a la plantilla con pgvector es un dump/restore con corte de servicio y rehacer los roles (`create_app_user_role.py`) para ganar milisegundos con 1.600 perfiles. Recién conviene arriba de ~50.000 perfiles, o si la base se mueve por otro motivo |

- **numpy en memoria (si no hay pgvector):** matriz `float32` en memoria del proceso (~5 MB para
  1.600 perfiles), recargada cuando cambia un embedding. La v1 leía `REAL[]` como listas de Python
  en cada pedido, lo que significa ~30 MB y cientos de ms por consulta: se descarta.
- La interfaz `vector_search.top_k()` sigue siendo lo único que conoce el resto del código.
- **Modelo de datos de IA a escribir** (el borrador de la v1 se descartó):
  - `candidate_embeddings`: `candidate_id`, `ficha_hash`, vector (`vector(768)` o `REAL[]` según
    pgvector), modelo, dimensión y fecha.
  - `candidate_cv_texts` (§5.2-bis).
  - `job_ai_profiles`: requisitos extraídos, `job_hash`, embedding y modelo.
  - `job_recommendations`: `source`, `hybrid_score`, `criteria` (JSONB), `score`, `reasons`,
    `prompt_version`, `weights_version`, `notified_at`, con UNIQUE (`job`, `candidate`).
  - `ai_usage_log` (§7.3).
  - Todas las FK a candidato y búsqueda con `ON DELETE CASCADE`, y todas sumadas a
    `account_deletion.py`.

### 5.7 "Candidato nuevo que encaja"

Al final del barrido nocturno, cada ficha nueva o cambiada se compara con las búsquedas activas:

- Si el puntaje híbrido supera el umbral **y** el rerank da ≥ 80, se avisa a la empresa (in-app
  y mail, categoría `postulaciones`).
- `notified_at` evita repetir el aviso.
- Tope de **3 avisos por búsqueda por semana**, para no convertirlo en spam.

### 5.8 Evaluación antes de prender — **obligatoria**

Set de prueba con lo que ya hay en la base:

- Búsquedas cerradas que tengan postulantes marcados `finalist` o `selected`.
- Se suman las 2–3 búsquedas que elija Eugenia (PDF hoja 09).

| Métrica | Qué responde |
|---|---|
| **Recall@30 de la recuperación** | ¿Los finalistas reales sobreviven al corte antes de llegar a la IA? |
| **Posición media del seleccionado** | ¿Aparece arriba? |
| **NDCG@10** | Calidad del orden completo |

Se comparan tres variantes:

- (a) orden de llegada, que es lo de hoy;
- (b) sólo el híbrido, sin IA de texto;
- (c) híbrido + rerank.

**Si (b) empata con (c), se prende (b)** y la IA de texto queda sólo para redactar los motivos.
Es más barato y más predecible. Esta decisión se toma con números, no antes.

La evaluación corre con datos anonimizados (§5.2), y sólo después de activar la facturación de
Gemini (§5.9).

### 5.9 Privacidad y sesgo

- **Nivel gratuito vs. pago de Gemini.** Los términos de la API dicen que en el nivel gratuito
  Google puede usar lo enviado para mejorar sus productos. **Con perfiles reales, facturación
  activada desde el día uno**, aunque se vaya a gastar centavos. A confirmar en los términos
  vigentes al crear la cuenta.
- **Edad y género** no entran ni al puntaje ni a la IA (§5.2). La zona entra sólo si la búsqueda
  es presencial.
- **La decisión es humana:** la IA ordena y explica, y la pantalla lo dice. Botón 👍/👎 por
  recomendación para juntar señal y mejorar la evaluación (§5.8).
- **Transferencia internacional:** Resend y Google procesan en EE.UU.
  - La Ley 25.326 (art. 12) restringe las transferencias a países sin protección "adecuada".
  - Clerk y Cloudinary ya están en la misma situación.
  - Términos y privacidad tienen que nombrar a los subprocesadores, decir para qué se usa la IA y
    que la información sale anonimizada. **A revisar con un abogado.** Bloquea el prendido en
    producción.

### 5.10 Costo estimado (a verificar con precios vigentes)

| Operación | Volumen | Llamadas |
|---|---|---|
| Embeddings: backfill de 1.611 perfiles + ~50 búsquedas | una vez | ~17 lotes |
| Embeddings: cambios del día | ~20–50 perfiles | 1 lote |
| Extraer requisitos | 1 por búsqueda nueva o editada | ~6–20 por mes |
| Rerank | top-30 de 10 en 10 → 3 por búsqueda, más los avisos nocturnos | decenas por mes |

Con el CV, cada ficha pasa de ~300 a ~2.000 palabras: el rerank de 30 fichas son ~3 llamadas de
~25.000 tokens de entrada. Sigue en el orden del PDF (USD 3–6/mes) porque la IA mira 30 fichas y
no 150, y lo nocturno puede ir por `service_tier` `flex`/`deferred`.
**No se pudo consultar la página de precios de Gemini** (acceso bloqueado desde este entorno): los
números se confirman al crear la cuenta.

---

## 6. ¿Puede la IA encargarse de los envíos automáticos?

**Respuesta corta:** sí para **asistir**, no para **decidir ni enviar sola**.

| Idea | ¿Se hace? | Por qué |
|---|---|---|
| La IA **redacta en el momento** cada aviso transaccional (postulación, pago, verificación) | ❌ | Agrega demora, costo y fallas a mails que tienen que salir siempre. El texto puede variar o equivocarse en un mail de pago. Y si el contenido incluye texto de usuarios, hay riesgo de inyección. Los transaccionales tienen que ser **determinísticos** |
| La IA **decide sola** a quién y cuándo mandar una campaña | ❌ | Es "agencia excesiva" (OWASP LLM06): mandar a 1.600 personas con la marca de Talency sin que nadie lo apruebe. Un error es irreversible y quema el dominio (M14) |
| **Redactora de campañas** en el panel: Eugenia escribe "promo de destacados para gastronomía, tono cercano" y recibe asunto, preheader, cuerpo y CTA, con 2–3 variantes de asunto | ✅ | Ahorra tiempo y no corre riesgos: Eugenia edita, se manda una prueba y aprueba. Es lo que el PDF llama "vos lo escribís" |
| **Audiencia en lenguaje natural:** "empresas de gastronomía que nunca publicaron" | ✅ | La IA traduce a un **filtro JSON validado contra un esquema cerrado** (rol, rubro, zona, `never_published`…), nunca a SQL. El panel muestra el filtro y **cuántas personas son** antes de confirmar |
| **Mejorar el tono** de las plantillas de avisos (una vez, no en cada envío) | ✅ | Sugerencia que Talency acepta o descarta. Lo que se guarda es texto fijo |
| **"También te pueden interesar"** en el resumen semanal del candidato | ✅ | Búsquedas parecidas a su perfil usando los embeddings del RAG. Sin modelo de texto, casi gratis. Sube las postulaciones, que es el objetivo del módulo |
| **Resumen diario a la empresa con lo que más encaja:** "3 postulaciones nuevas en Administrativa; la que más encaja: #A3F91C (87)" | ✅ | Reusa el cache de §5. No genera nada en el momento |
| **Mejor horario de envío** por persona | ⏸️ | Con este volumen la señal es ruido. Fase posterior |
| IA que **lee y contesta las respuestas** que llegan al reply-to | ⏸️ | Requiere recepción de mails (Resend inbound) y es otra superficie de inyección. Fase posterior |

**Regla que sale de esto:** la IA trabaja **antes** del envío, como borrador o filtro que un humano
aprueba, o **con datos ya calculados** (embeddings, cache). Nunca dentro del camino crítico de un
transaccional, y nunca con poder de enviar.

---

## 7. Auditoría

### 7.1 Mails (skills oficiales de Resend)

Integrada en §4.3, hallazgos M1–M14.

### 7.2 IA (OWASP Top 10 for LLM Applications 2025)

| Riesgo | Dónde aparece en BBJobs | Mitigación en el plan |
|---|---|---|
| **LLM01 Inyección de prompt** | Resumen y experiencias del candidato; descripción del aviso; brief de campaña | Delimitadores con instrucción de "es dato"; salida JSON validada; evidencia literal (§5.5); la IA no tiene herramientas ni puede ejecutar acciones |
| **LLM02 Revelación de información sensible** | Fichas hacia Google; motivos hacia la empresa | Ficha anonimizada + redactor (§5.2); escaneo de la salida; facturación activada (§5.9) |
| **LLM05 Manejo inseguro de la salida** | Motivos en pantalla y en mails | La salida es dato, nunca HTML ni SQL. React escapa y el renderer de mails escapa. Largo y forma validados |
| **LLM06 Agencia excesiva** | Envíos automáticos | §6: la IA no envía ni cambia estados |
| **LLM07 Filtración del system prompt** | — | El prompt no tiene secretos ni datos de otros usuarios |
| **LLM08 Debilidades de vectores y embeddings** | Embeddings derivados de datos personales | Sólo de fichas anonimizadas; nunca se exponen por la API; las consultas siempre filtran por la búsqueda de la empresa dueña; se borran con la cuenta |
| **LLM09 Desinformación** | Motivos o requisitos inventados | Evidencia literal; `sin_datos` ≠ `no`; aviso de "orientativo" |
| **LLM10 Consumo sin límite** | Bucle en una tarea; empresa refrescando sin parar | Topes por corrida; **máximo 10 refrescos por empresa por día**; cache por hash; tope de gasto en la cuenta de Google; `ai_usage_log` + alerta |

### 7.3 Como SaaS (multi-empresa)

| Tema | Hallazgo | Plan |
|---|---|---|
| **Aislamiento entre empresas** | No hay RLS: todo depende del filtro en la app | Cada endpoint de recomendaciones exige `require_verified_company` y que la búsqueda sea de esa empresa. **Tests obligatorios de acceso cruzado** (empresa A pide recomendaciones de una búsqueda de B → 404) |
| **Medición** | En la v1 no se medía consumo por empresa | `ai_usage_log(feature, company_id, job_id, tokens_in, tokens_out, costo_estimado, created_at)`. Panel admin con el gasto de IA del mes por empresa. Para mails, `/usage` de Resend (consumo mensual vs. tope) |
| **Planes** | Ningún límite de plan se aplica hoy | Si D5 dice "recomendados sólo con plan", se crea un helper `entitlement(company, feature)` reutilizable. Será el primer límite real del sistema |
| **Tareas en segundo plano** | APScheduler dentro del único proceso web | Alcanza hoy. Si se agregan workers o réplicas: el outbox ya es seguro (SKIP LOCKED) y los barridos nocturnos se protegen con `pg_try_advisory_lock`. A futuro, separar un proceso worker |
| **Observabilidad** | — | Eventos de structlog por envío y llamada a la IA. Sentry ante fallas. En el panel: mails fallidos, tasa de rebote y queja, gasto de IA |
| **Borrado y retención** | `account_deletion.py` | Sumar `email_outbox` (vaciar mail y contenido), `email_preferences`, `email_digest_state`, embeddings, recomendaciones, `ai_usage_log` (soltar la referencia). **Antes de prender** |
| **Secretos** | — | Resend: clave sólo de envío, restringida al dominio. Gemini: clave restringida a la Generative Language API. Rotación documentada |
| **Subprocesadores** | Resend y Google se suman a Clerk, Cloudinary y Mercado Pago | Listarlos en `/privacidad` (§5.9) |

---

## 8. Pendientes que dependen de cuentas

### Resend
- [ ] Cuenta a nombre de Talency, plan Pro, invitar a Gael.
- [ ] **Confirmar con Resend:**
  - si está permitido mandar marketing por la API transaccional en el plan Pro;
  - si los Broadcasts y los contactos tienen costo aparte (D9).
- [ ] Dominios `avisos.bbjobs.com.ar` y `novedades.bbjobs.com.ar`:
  - Registros SPF, DKIM y DMARC (DMARC arranca en `p=none`).
  - Sumarlos a la zona DNS **sin pisar los de Clerk**.
  - Tracking apagado en `avisos.` y prendido en `novedades.`.
- [ ] Clave **sólo de envío** → `RESEND_API_KEY`. Remitentes y reply-to real.
- [ ] Webhook creado por API con los eventos de M6 → `RESEND_WEBHOOK_SECRET`.
- [ ] Calentamiento: 1–2 semanas sólo con transaccionales y `EMAIL_DAILY_CAP` creciente.
- [ ] Prueba con `delivered@`, `bounced@` y `complained@resend.dev`, y una revisión en
      mail-tester.com.

### Gemini
- [ ] Cuenta en AI Studio a nombre de Talency, **con facturación activada** y tope de gasto (el
      PDF sugiere USD 30).
- [ ] Clave restringida → `GEMINI_API_KEY`.
- [ ] Nombres de modelo y forma de la API: **ya verificados** contra la skill oficial y el SDK 2.26
      (§0-bis). **Precios** (incluido `flex`/`deferred`) y **retención de datos** del nivel pago:
      confirmar en la consola al crear la cuenta.
- [ ] Comprobar qué imagen de Postgres tiene Railway (§5.6, tres maneras; la más rápida es mirar
      *Settings → Source* en el servicio).
- [ ] Correr la evaluación (§5.8) y decidir entre (b) y (c).

### Legal
- [ ] Términos y privacidad: IA, subprocesadores, transferencia internacional, mails y bajas.
      **Bloquea el prendido.**
- [ ] Criterio de consentimiento para campañas a candidatos (D10).

---

## 9. Decisiones abiertas

Cada una tiene un default para no frenar el desarrollo.

| # | Decisión | Quién | Default |
|---|---|---|---|
| D1 | Qué avisos sí, cuáles no y cuáles faltan | Eugenia | Los de §4.4, apagados hasta confirmar |
| D2 | Nombre del remitente y reply-to | Eugenia | `BBJobs <avisos@avisos.bbjobs.com.ar>`, respuestas a un buzón real de Talency |
| D4 | Qué pesa más al ordenar | Eugenia | Habilidades obligatorias 30 · experiencia 25 · semántica 20 · deseables 10 · educación 10 · disponibilidad 5. **Sin edad ni género** |
| D5 | ¿Recomendados para todas las empresas o sólo con plan? ¿Cuántos de la Base de Talento? | Eugenia | Todas las verificadas ven sus postulantes ordenados; 3 de la Base de Talento por búsqueda |
| ~~D9~~ | ~~Campañas: Broadcasts de Resend o cola propia~~ | Gael | ✅ **Cola propia vía API de Resend** (01/10). Falta que Resend confirme que lo permite |
| D10 | Consentimiento de novedades para candidatos | Eugenia + abogado | Casilla destildada y un mail único a la base existente (§4.7) |
| ~~D11~~ | ~~¿Sale sin el CV?~~ | Gael | ✅ **El CV entra en la primera versión**, anonimizado localmente (§5.2-bis) |
| D13 | ¿Los CV escaneados (imagen) quedan afuera de la v1? | Gael, con la medición de §5.2-bis | Sí, con el aviso "CV no legible" |
| D14 | ¿El candidato puede ver "lo que lee la IA de tu CV"? | Eugenia | Sí (transparencia y control de calidad) |
| D12 | ¿Se prende el rerank con IA o sólo el híbrido? | Gael, con los números de §5.8 | Se decide al medir |

---

## 10. Estado real y orden

| Paso | Qué | Estado |
|---|---|---|
| 0 | Fundación: config, cliente Resend (13 tests), interruptores | ✅ escrito; falta el ajuste de idempotencia y 409 (§3) |
| 0 | Cliente Gemini | 🔁 **se reescribe** sobre el SDK `google-genai` + Interactions API + `store=False` (§3) |
| 0 | Skills oficiales instaladas en el proyecto (`resend`, `email-best-practices`, `gemini-api-dev`) | ✅ instaladas, sin commitear |
| A0 | Modelos de mails + migración `b1e4c7a2d905` | ✅ escrito y verificado (upgrade/downgrade en Postgres 16) |
| A0 | Links de baja firmados y renderer de mails | 🟡 escrito, **sin tests** |
| A1 | Catálogo, enganche en `create_notification`, dispatcher con tope diario, webhook, bajas | 📝 |
| A2 | Alertas + "también te pueden interesar" | 📝 |
| A3 | Campañas por cola propia + redactora IA + audiencia en lenguaje natural | 📝 |
| B0 | Modelos de IA + migración | 📝 **se escribe de cero** (§5.6, `candidate_cv_texts`, `ai_usage_log`). El borrador de la v1 (`c2f5d8b3e016`, `models/ai.py`) **se borró antes de commitear**, para que no llegue a ninguna base |
| B1 | Ficha + redactor + hash + barrido de embeddings | 📝 |
| B1-CV | **Medición de CV** (script local, sin IA) → extracción + recorte de "Datos personales" + Presidio/spaCy con reconocedores AR → revisión manual de 30 | 📝 **antes de usar CVs** |
| B2 | Requisitos del aviso + puntaje híbrido + rerank con evidencia + control de salida + endpoints + tests de aislamiento | 📝 |
| B3 | Evaluación offline (§5.8) | 📝 **antes de cualquier prendido** |
| B4 | Aviso "candidato nuevo que encaja" | 📝 |
| — | `account_deletion.py` + retención | 📝 **antes de prender** |
| F | Frontend: preferencias, `/baja`, alertas, panel de campañas y gasto, pestaña Recomendados, "lo que lee la IA" | 📝 |
| P | Cuentas, DNS, calentamiento, legal, prendido | ⏳ §8 |

Commiteado y pusheado el 01/10 en la rama `claude/funny-mayer-9ldq55` a pedido de Gael, para
retomar en otra sesión. **No está mergeado a `main` ni deployado.** Ver §12.

---

## 11. Qué resta, en una lista

### Lo que tenés que hacer o conseguir vos
1. **Ver qué Postgres tiene Railway** (§5.6). Son dos minutos y define si se usa pgvector o numpy.
2. **Crear las cuentas** (§8): Resend (Pro) y Gemini (con facturación), a nombre de Talency.
3. **Preguntarle a Resend** si se permite marketing por la API transaccional en el plan Pro.
4. **DNS:** subdominios `avisos.` y `novedades.` con SPF, DKIM y DMARC, sin tocar los de Clerk.
5. **Abogado:** términos y privacidad (IA, CV procesado automáticamente, subprocesadores en EE.UU.,
   bajas) y el criterio de consentimiento para campañas (D10).

### Lo que hay que pedirle o contarle a Eugenia
6. **D1, D2, D4, D5, D10, D14** (§9).
7. **Elegir 2–3 búsquedas cerradas** para la evaluación (§5.8).
8. **Contarle qué cambió respecto del PDF:**
   - el CV entra, pero anonimizado en el servidor;
   - las campañas a toda la base arrancan después de 1–2 semanas de calentamiento;
   - los candidatos eligen si reciben novedades;
   - la IA no usa edad ni género;
   - se suman la redactora de campañas y los "empleos recomendados" en el resumen semanal.
9. **Psicométrica:** los links o el material que falta (Anexo A).

### Lo que construyo yo (cuando apruebes), en este orden
10. Reescribir el cliente Gemini al SDK nuevo y ajustar el de Resend (idempotencia, 409).
11. Mails A1 → A2 → A3, que no dependen de nada de IA y se pueden probar con
    `delivered@resend.dev` apenas haya cuenta.
12. En paralelo:
    - **B1-CV:** la medición de CVs es local y no necesita cuenta de Gemini.
    - **B0/B1/B2:** se construyen y se prueban con datos sintéticos.
13. **B3, la evaluación:** recién con la facturación de Gemini activada.
14. `account_deletion.py`, retención y tests de aislamiento entre empresas.
15. Frontend.
16. Calentamiento, legal y prendido.

### Riesgos que siguen abiertos
- **La redacción de CVs nunca es perfecta.** El criterio de salida de §5.2-bis y la vista "lo que
  lee la IA" son las mitigaciones; el riesgo residual se acepta con facturación activada en
  Gemini.
- **Si Resend no permite marketing por la API transaccional**, las campañas pasan a Broadcasts.
  Eso cambia el costo prometido a Eugenia y obliga a replicar contactos en Resend.
- **Precios de Gemini** sin confirmar: el PDF dice USD 3–6/mes y la estimación de §5.10 va en esa
  línea, pero es estimación.

---

## 12. Cómo retomar (para la próxima sesión)

### 12.1 Dónde está todo

| Qué | Dónde |
|---|---|
| Este plan, fuente de verdad | `MODULOS-MAILS-IA-PLAN.md` |
| Lo que se le prometió a Eugenia | `BBJOBS-PROXIMOS-MODULOS-EUGENIA.pdf` (raíz del repo) |
| Config nueva (Resend, Gemini, topes) | `backend/app/core/config.py`, `backend/.env.example` |
| Interruptores del admin | `backend/app/models/settings.py` (`emails_automaticos_activos`, `ia_recomendaciones_activas`) y `admin.py` (`SiteSettingsResponse`) |
| Cliente Resend | `backend/app/integrations/resend_client.py` + `tests/test_resend_client.py` |
| Cliente Gemini v1 (httpx, **a reescribir**, §3) | `backend/app/integrations/gemini_client.py` + `tests/test_gemini_client.py` |
| Modelos de mails | `backend/app/models/email.py`; `job_alerts.frequency` en `models/alerts.py` |
| Migración de mails | `backend/alembic/versions/b1e4c7a2d905_email_module.py` (`down_revision = f3b9c2d6a4e8`) |
| Links de baja y renderer (sin tests todavía) | `backend/app/services/email/tokens.py`, `render.py` |
| Skills oficiales | `.claude/skills/resend`, `email-best-practices`, `gemini-api-dev`, registradas en `skills-lock.json`. **Cargarlas antes de tocar Resend o Gemini**: tienen la API vigente y las trampas conocidas |

### 12.2 Antes de mergear a `main` — importante

**El `Dockerfile` corre `alembic upgrade head` en cada deploy.** Mergear esta rama crea en
producción las tablas de mails (`b1e4c7a2d905`). Es inofensivo, porque todo queda apagado sin
keys y sin interruptores, pero conviene mergear recién cuando el módulo A esté completo, para no
tener que corregir esa migración con otra.

### 12.3 Entorno de prueba usado (sin tocar Railway)

```bash
# Python 3.12 (el proyecto lo exige; en el contenedor `python3` era 3.11)
python3.12 -m venv /tmp/venv && /tmp/venv/bin/pip install "backend/.[dev]"
cd backend && SECRET_KEY=x DATABASE_URL=postgresql+asyncpg://u:p@localhost/x /tmp/venv/bin/python -m pytest -q
# → 89 passed

# Postgres 16 descartable para probar migraciones (el contenedor tenía los binarios en
# /usr/lib/postgresql/16/bin; corre como usuario postgres)
initdb -D /var/tmp/pg -A trust && pg_ctl -D /var/tmp/pg -o "-p 5433" start
createdb -p 5433 -h 127.0.0.1 -U postgres bbjobs_scratch
DATABASE_URL=postgresql+asyncpg://postgres@127.0.0.1:5433/bbjobs_scratch SECRET_KEY=x alembic upgrade head
alembic downgrade f3b9c2d6a4e8 && alembic upgrade head   # verificado ida y vuelta
```

Ojo con `alembic revision --autogenerate`: contra la base de prueba **mezcla diferencias viejas**
(índices creados a mano en migraciones anteriores que los modelos no declaran). No usarlo a ciegas.
Las migraciones de este módulo se escribieron a mano.

### 12.4 Fuentes que se consultaron (y cómo, con egress restringido)

Las webs `ai.google.dev`, `docs.railway.com`, `resend.com` y `microsoft.github.io` estaban
bloqueadas desde el entorno remoto; **GitHub no**. Lo verificado salió de:

| Fuente | Qué se sacó |
|---|---|
| `github.com/resend/resend-skills` | Batch todo-o-nada, idempotencia `<evento>/<id>` por 24 h, eventos del webhook, supresión automática, calentamiento de dominio, subdominios, tracking por dominio, Broadcasts/Segments/Topics |
| `github.com/google-gemini/gemini-skills` | Modelos vigentes (`gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-embedding-001`), migración `generateContent` → Interactions, `store` por defecto, sin `temperature` |
| `github.com/googleapis/python-genai` (v2.26.0) | Campos de `interactions.create` (`store`, `response_format`, `labels`, `service_tier` flex/standard/priority/deferred, `thinking_level`) y de `batchEmbedContents` (`taskType`, `outputDimensionality`) |
| `github.com/railwayapp/docs` | El Postgres estándar de Railway no trae pgvector; hay plantilla aparte |
| `github.com/microsoft/presidio` | Español vía spaCy; sin reconocedores argentinos (hay que escribirlos) |

**Siguen sin verificar** (hacerlo con las cuentas creadas): precios de Gemini (y de `flex`/`deferred`),
la retención de datos del nivel pago, y la política de uso de Resend sobre marketing por la API
transaccional.

### 12.5 Por dónde seguir

La lista ordenada está en §11. En resumen:

1. Las respuestas de Gael: imagen de Postgres en Railway, cuentas, Resend.
2. Reescribir `gemini_client.py` sobre el SDK (cargar la skill `gemini-api-dev`).
3. Tests de `tokens.py` y `render.py`.
4. Mails A1 → A2 → A3.
5. Medición de CVs (B1-CV), en paralelo con B0–B2.

---

## Anexo A · Evaluación psicométrica (en pausa)

Queda para cuando Eugenia pase los links o el material que faltan. El diseño de la v1 se conserva
como punto de partida:

- **La IA no puntúa.** Los puntajes salen de una cuenta fija (Likert con ítems invertidos), y la IA
  sólo redacta el resumen, con una plantilla como respaldo.
- El cuestionario lo revisa la psicóloga de Talency antes de publicarse.
- Hay que corregir los bugs del endpoint actual (`api/v1/tests.py`):
  - No valida que las respuestas sean del test.
  - Acepta respuestas duplicadas.
  - Revienta si el candidato no tiene perfil.
- Cooldown: hoy 30 días; el PDF promete 180.
- Visibilidad: el candidato siempre ve su resultado; las empresas sólo en postulaciones propias y
  con su permiso.

Su código y su migración se sacaron de este lote para no mezclar alcances.
