# Lanzamiento BBJobs — estado y plan (actualizado el 20/11/2026, noche)

Documento único del lanzamiento. Lo que hay que **probar a mano** está en
[`CHECKLIST-PRUEBAS-MANUALES.md`](CHECKLIST-PRUEBAS-MANUALES.md). Los planes viejos que este
reemplaza están en `docs/archivo/`; el diseño que sigue valiendo, en `docs/referencia/`.

## Estado en una línea

**El código está terminado y probado en local, con 799 tests y 20 corridas seguidas sin fallas.
No se hizo push.** Para lanzar faltan cuentas y DNS (Fase 3), el push y el encendido de a poco
(Fases 4 a 8).

| | Estado |
|---|---|
| Código (backend + frontend) | ✅ terminado en `main` **local**, sin push. Son 14 commits sobre `origin/main`, con 2 migraciones nuevas (`a1c3e5b7d9f2`, `b2d4f6a8c0e3`) |
| Tests | ✅ 799 pasan; 20 corridas seguidas sin fallas. `tsc`, `eslint` y `next build` limpios (con la compuerta prendida y apagada) |
| IA con Gemini real | ✅ simulacro de punta a punta con datos inventados: requisitos, evaluador y revisor andan; ~USD 0,014 por búsqueda de 10 candidatos con Revisor |
| Auditorías | ✅ dos auditorías independientes; todo lo importante corregido, con tests que fallan sin el arreglo |
| Producción (verificado sólo lectura con el token de Railway) | Postgres 18.6 con pgvector; migración `f1b3d5e7a9c2`; compuerta cerrada; logs limpios |
| Falta de Gael | Fase 3 (clave paga de Gemini, Resend con DNS, Clerk en producción), las pruebas manuales y el OK para el push |

**Dónde corre cada cosa:**
- **Backend + Postgres:** Railway, proyecto `bbjobs`. Se accede con `direnv exec . railway …`.
- **Frontend:** Vercel.
- **DNS de `bbjobs.com.ar`:** **Vercel DNS**. La raíz no tiene MX y el DMARC está en `p=none`.

### Qué se hizo el 20/11 (para no buscarlo en el historial)

**Arreglos que habrían roto producción:**
- Con el SDK nuevo, **Gemini real fallaba en toda llamada de texto**. Se fijó la API `v1beta`.
- El Revisor no aceptaba `thinking_level=minimal`: ahora tiene su propio nivel.
- Con `svix 2.x`, los webhooks de Resend y de Clerk se rompían.

**IA:**
- Tachado de contactos en avisos y en el buscador antes de mandarlos a Gemini.
- Clave de caché que incluye los requisitos.
- Un 429 por cuota diaria ya no se reintenta.
- **Modo sombra** (`ia_recomendaciones_visibles`), incluido el mail diario de la empresa.
- Controles de observación en la pestaña Agentes.
- Los resúmenes que no pasan la validación ya no se vuelven a pagar cada noche.

**Mails:**
- Respuestas entrantes (sin adjuntos).
- Solo los rebotes duros suprimen una dirección.
- Freno de la cuenta también para la prospección.
- **Casillas de prospección** con reparto del cupo y freno por casilla.
- Admin → **Mails**: Respuestas, Enviados, Casillas y Salud.

**Portal (mejoras de la investigación de portales):**
- Compartir el aviso por WhatsApp.
- Aviso de que postularse es gratis.
- Filtro "Sólo con sueldo publicado".

**Tests:**
- Se arreglaron 5 fuentes de tests intermitentes: datos que quedaban de otros archivos, catálogos que nunca se vaciaban y vectores al azar.
- Hay un guard que aborta si los tests apuntan a una base que no es local.

**Repositorio:**
- Raíz ordenada; `.envrc` (token de Railway) en el `.gitignore` del repo.
- `CLAUDE.md` y `README` al día.

---

## Decisión (Gael, 20/11/2026): la prospección sale por Resend

La política de Resend prohíbe el mail en frío (queja < 0,08 %, rebote < 4 %, o la cuenta "puede
cerrarse sin aviso"). Gael lo decidió con conocimiento: **se prospecta por mail con la misma cuenta
de Resend** ("queda como regla que sí"). Se mantienen las protecciones que no cuestan nada: freno de
la cuenta por salud (4 % / 0,08 %), freno por casilla, baja con un clic y respuesta "no me escriban",
y nada a empresas suprimidas o dadas de baja.

---

## Diseño de dominios y casillas (propuesta de Claude)

Como en centro-nuevo: **nunca se envía desde `bbjobs.com.ar`**, cada tipo de envío en su
subdominio (si uno se quema, los demás siguen), y las respuestas entran por un subdominio `r.`
propio con el MX de Resend, sin tocar la raíz.

| Subdominio | Cuenta Resend | Qué sale | Remitente(s) | Seguimiento |
|---|---|---|---|---|
| `avisos.bbjobs.com.ar` | BBJobs (Pro) | Transaccionales: postulaciones, verificación, pagos, Revisión de CV | `BBJobs <avisos@avisos.bbjobs.com.ar>` (fijo) | apagado |
| `novedades.bbjobs.com.ar` | BBJobs (Pro) | Alertas, resúmenes, campañas a usuarios registrados | `BBJobs Empleos <empleos@novedades.bbjobs.com.ar>` (fijo) | prendido |
| `contacto.bbjobs.com.ar` | BBJobs (Pro) | Prospección a empresas | **casillas**: `eugenia@` y `hola@` al arrancar | apagado |
| `r.bbjobs.com.ar` | BBJobs (Pro) | **Recepción** de respuestas a avisos y novedades | `Reply-To: hola@r.bbjobs.com.ar` | — |
| `r.contacto.bbjobs.com.ar` | BBJobs (Pro) | **Recepción** de respuestas a prospección | `Reply-To: <casilla>@r.contacto.bbjobs.com.ar` | — |

**Una sola cuenta de Resend (Pro, ya paga) para todo** — decisión de Gael del 20/11, reemplaza la
DP1 ("otra cuenta para prospección"). El código ya lo soporta sin cambios: si
`PROSPECT_RESEND_API_KEY` está vacía usa `RESEND_API_KEY` (`prospect_dispatch.py:68`), y los dos
webhooks comparten el mismo manejo (`emails.py:200`), así que alcanza con **un solo webhook**
(`/api/v1/webhooks/resend`) y dejar vacías las `PROSPECT_RESEND_*`.

**El riesgo de una sola cuenta:** Resend mide quejas y rebotes **por cuenta**. Si la prospección
junta quejas, puede pausar la cuenta entera y dejar de salir también los avisos a postulantes y
empresas. Los subdominios separan la reputación ante Gmail/Outlook, no ante Resend. Por eso:
- **Freno de cuenta para la prospección:** si en los últimos 7 días las quejas de prospección pasan
  el **0,1 %** o los rebotes el **3 %**, se pausa sola toda la prospección (los avisos siguen) y
  avisa a Talency por `admin_email_health`.
- Prospección con tope bajo (`PROSPECT_DAILY_CAP` 20 → subir de a poco), sólo a direcciones
  validadas, baja en un clic y en el pie.
- Si algún día la prospección crece mucho, se reconsidera una segunda cuenta.

Por qué así:
- **Casillas sólo en prospección.** Los avisos tienen que salir siempre del mismo remitente
  (confianza, filtros de los usuarios); la rotación sirve donde hay volumen a gente que no nos
  conoce. Si la prospección crece, se suma un segundo dominio (`talento.bbjobs.com.ar`) a la
  misma cuenta y se reparten las casillas.
- **Topes:** casillas de prospección 40/día cada una al arrancar (2 casillas = 80, por encima del
  `PROSPECT_DAILY_CAP` de 20 → subir de a poco); avisos con `EMAIL_DAILY_CAP=150` y subir por semana.
- **Pausa automática** de una casilla (o del dominio) con rebote > 3 % sobre los últimos 100, o
  3 rebotes con menos de 30; una queja = baja para siempre. Igual que centro-nuevo.
- **Raíz:** `v=spf1 -all` en `bbjobs.com.ar` (nunca envía).
- **DMARC:** `_dmarc.bbjobs.com.ar` sigue en `p=none` con `rua=mailto:dmarc@r.bbjobs.com.ar` (se
  filtra de Respuestas) las
  primeras 2–4 semanas; después `p=quarantine`. Los subdominios lo heredan.
- **Clerk** (cuando pase a producción) agrega sus propios CNAME (`clerk.`, `accounts.`,
  `clkmail.`, `clk._domainkey`, `clk2._domainkey`): no chocan con nada de lo de arriba.
- Opcional: reenviar lo que llega a `hola@r.` al mail real de Talency, además de verlo en el admin.

---

## Costos de IA — decisión después de la auditoría (20/11/2026)

Se propuso "la mayoría gratis, partiendo cada tarea en parte gratis y parte paga". Una auditoría
independiente contra el código (verificada) lo dio vuelta:

1. **El nivel gratuito ahorra centavos por mes.** Con los prompts reales, todo lo que iría gratis
   (Requisitos, Buscador, Redactores, Audiencias, Moderador) cuesta ~USD 0,02–0,50 por mes en pago.
   El gasto está en el Evaluador, que lee CVs y nunca podría ir gratis.
2. **Y tiene un costo legal.** En el gratuito Google puede leer y usar lo que se manda. Los avisos
   traen nombres, mails y teléfonos de quien recluta (la ley 25.326 protege también a empresas) y
   las frases del buscador pueden traer datos sensibles ("tengo 52 años", "soy celíaco"); hoy
   `requirements.py` y `search_interpret.py` no tachan nada. La privacidad 3.0
   (`PrivacidadV3.tsx:194-195`, `:269-272`) dice que Google procesa "por cuenta nuestra" y "no lo
   usa para entrenar": eso sólo es cierto en el nivel pago.
3. **Partir agentes ahorraba menos de lo pensado:** los 2 fragmentos por requisito ya existen
   (`pipeline.py:64`), el Preparador agregaría ~600–1.200 tokens a cada llamada paga, el Evaluador
   corre cada 10 min (no de noche, así que el lote no aplica) y Flex (mitad de precio) ya está en
   el cliente sin usar.

**Decisión:** en producción, **todo por el nivel pago con un modelo barato**. La clave gratis queda
para **desarrollo y pruebas con datos inventados**. Costo esperado: **USD 2–3 por mes** con 20
búsquedas activas, más ~USD 1,3 una vez para pasar a vectores los 1.781 CVs actuales.

| Agente | Modelo | Nota |
|---|---|---|
| Evaluador | `3.5-flash-lite` (se mide `2.5-flash-lite`) | ~3.500 tokens por candidato; el 90 % del gasto |
| Revisor | `3.8-flash` (se mantiene) | +USD 0,4–0,9/mes, pero decide justo la franja 60–79 que define si se avisa al candidato |
| Requisitos, Resumidor, Habilidades, Buscador, Redactores, Audiencias | `3.5-flash-lite` | centavos |
| Lector de CV, Moderador | `embedding-001` | |

Arreglos que salieron de la auditoría (Fase 1):
- **Tachar mails y teléfonos** de los avisos y de las frases del buscador antes de mandarlos.
- **Bug de caché:** si Requisitos falla una vez, el Evaluador evalúa contra requisitos de respaldo
  y `same_inputs` (`pipeline.py:462`) reutiliza esa evaluación aunque después lleguen los
  requisitos buenos. Agregar el hash de la lista de requisitos a la comparación.
- **429:** distinguir cuota por minuto (reintentar) de cuota del día (no reintentar).
- **Flex** para lo que no es en vivo (mitad de precio, ya implementado, sólo se conecta).
- **Reevaluaciones:** cambiar una coma de `evaluador.md` reevalúa toda la base (~USD 2). Reevaluar
  de a poco (las búsquedas activas primero) para no chocar el tope de USD 1 por día.
- **Tope:** `AI_DAILY_BUDGET_USD=1`, `+` tope mensual en Google (USD 10).
- Sin cambiar la política de privacidad: con todo pago ya es correcta.

Queda para después, como experimento medido (no antes del lanzamiento): Preparador, resolver
requisitos con campos del perfil, Diccionario de habilidades, modelo más barato para el Evaluador.

### Observar primero (cómo se prende la IA)

1. **Modo sombra, 2 semanas:** la IA calcula, pero sólo el admin ve su orden, al lado del orden sin
   IA. Interruptor nuevo `ia_recomendaciones_visibles`, aparte de `ia_recomendaciones_activas`.
   Empresas no ven nada; aviso al candidato apagado.
2. **Pestaña Agentes, con alertas:**
   - respuestas sin cita válida > **15 %**;
   - JSON inválido > **2 %**;
   - el Revisor cambia el veredicto del Evaluador en > **30 %** (el Evaluador es flojo);
   - costo por búsqueda > **2×** el estimado;
   - candidatos que pasan el 70 sólo por la IA;
   - 429 por día.
3. **Revisión humana:** Eugenia etiqueta 3 búsquedas de 20 candidatos. Meta: **7 de cada 10** de
   los primeros 10 bien puestos y **ninguno** con un excluyente que no cumple. Cada semana, 10 citas
   al azar: tienen que tener sentido en el **90 %**.
4. Si pasa: se prende para las empresas. Si después de 2 semanas más sigue bien: el aviso al
   candidato.
5. Un modelo más barato sólo después de correr los dos en sombra con los mismos datos: **90 %** de
   coincidencia y nunca "sí" contra "no" en un excluyente.

## Orden

Primero se termina y se prueba todo en esta Mac (fases 1 y 2). Las cuentas, Railway y Resend son
el último paso (fase 3), cuando Gael dé el acceso.

## Fase 1 — Lo que faltaba construir ✅ (hecho el 20/11)

0. **IA, arreglos de la auditoría** (sección "Costos de IA"): tachado en avisos y buscador, bug de
   caché de `same_inputs`, 429 por minuto vs. por día, Flex en lo que no es en vivo, reevaluación
   escalonada, modo sombra (`ia_recomendaciones_visibles`) y alertas en la pestaña Agentes. Tests.
1. **Agentes a `main`**: merge de `feat/mails-ia` (`5752e16`) con la batería completa contra
   Postgres local descartable. Sin push hasta el OK de Gael.
2. **Casillas** (copiando el modelo de centro-nuevo):
   - Modelo `Casilla` (dirección, nombre visible, cuenta `avisos|prospeccion`, límite diario,
     rampa, estado `activa|pausada|inactiva` + motivo, `frenos_desde`) + migración.
   - El envío de prospección elige casilla por cupo restante y rota; `Reply-To` a `r.contacto.`.
   - Frenos por rebote/queja por casilla, por dominio y total; aviso `admin_email_health`.
   - Al activar, chequeo contra Resend `GET /domains`: dominio no verificado → queda inactiva con el motivo.
3. **Recepción**: `email.received` en los dos webhooks → se guarda la respuesta (cuerpo vía
   `GET /emails/receiving/{id}`), se asocia al envío/prospecto por `In-Reply-To`, y se avisa al admin.
   Una respuesta tipo "no me escriban más" en prospección = baja (regla simple por palabras; sin IA
   en esta fase). Entra en `services/account_deletion.py` y en la retención de 90 días.
4. **Vistas fáciles en el admin** (hoy no existe ninguna pantalla de mails enviados):
   - **Mails → Casillas**: tabla con estado, enviados hoy / tope, rebotes, botón pausar/activar.
   - **Mails → Enviados**: últimos envíos con filtro por tipo, estado (enviado, entregado, rebotó,
     queja) y destinatario; sin mostrar el cuerpo de mails a candidatos.
   - **Mails → Respuestas**: bandeja de lo que llegó a `r.` y `r.contacto.`, marcar como atendida.
   - **Mails → Salud**: entregados / rebotes / quejas por dominio en 14 días, y si cada dominio
     está verificado en Resend.
   - Ya existen y no se tocan: Centro de IA (Panorama, Agentes), Módulos, Campañas, Empresas
     potenciales, Revisiones de CV.
4b. **Freno de cuenta para la prospección** (sección de dominios) + **arreglos de mails (auditoría):** sólo los rebotes **permanentes** suprimen la dirección y
   cuentan para los frenos (hoy `emails.py:180` suprime cualquiera); las respuestas se asocian con
   un token en el Reply-To (`hola+<token>@r.…`, respaldo: el remitente), no con `In-Reply-To`;
   `email.received` se guarda una vez por `email_id`, se ignoran respuestas automáticas y **nunca se
   guardan adjuntos** (los candidatos responden con su CV). Arrancar con 1–2 casillas; Salud va
   dentro de la pantalla Casillas.
5. Tests: casillas (rotación, topes, frenos), recepción (firma svix, asociación, baja), cruce entre
   empresas donde aplique, borrado de cuenta, migración ida y vuelta. Todo en `EMAIL_MODE=simulate`.
6. Prueba local de la **IA con la clave real**: tarea nocturna, aviso "candidatos que encajan",
   tope de gasto, Panorama y Agentes.

## Fase 2 — Pruebas en local ✅ (hecho el 20/11; las pruebas a mano están en el checklist)

Criterio de terminado: todo esto pasa sin tocar ninguna cuenta real.

- [ ] Batería completa contra Postgres local descartable con pgvector + migración ida y vuelta.
- [ ] Simulacro (`scripts/simulacro_local.py`) con la clave gratis de desarrollo y **sólo datos
      inventados**: recomendados de punta a punta, modo sombra, alertas de la pestaña Agentes.
- [ ] Comparar en sombra `3.5-flash-lite` vs. `2.5-flash-lite` para el Evaluador (sólo para saber;
      no se cambia antes del lanzamiento).
- [ ] Vectores comparables: el mismo texto con la clave de desarrollo y con la de producción da
      coseno ≥ 0,999 (se corre en la Fase 3, cuando exista la clave paga).
- [ ] Mails en `EMAIL_MODE=simulate`: cada aviso del catálogo renderiza; casillas rotan y frenan;
      un `email.received` simulado aparece en Mails → Respuestas.
- [ ] Revisión de CV con Mercado Pago **sandbox**.
- [ ] Sincronización desde el centro contra el backend local.
- [ ] Recorrido por las pantallas del admin (Casillas, Enviados, Respuestas, Salud, Centro de IA)
      en 1366 y 390 px; `tsc`, `eslint` y `next build` con la compuerta apagada y prendida.
- [ ] Merge de todo a `main` en local. **Sin push.**

## Fase 3 — Cuentas y accesos (Gael, el último paso antes de producción)

- [ ] Gemini: proyecto `bbjobs-prod` con facturación, **tope mensual USD 10** y DPA aceptado;
      clave restringida a "Generative Language API". La clave del 20/11 queda para desarrollo.
- [x] Railway: Postgres 18.6 con pgvector 0.8.6 **ya instalado** (verificado el 20/11, sólo lectura).
- [ ] Resend (Pro, ya pago, **una sola cuenta**): clave con *Full access* (la pantalla de casillas
      lee `GET /domains`). Aceptar el DPA. No pegar la clave en el chat: directo a Railway.
- [ ] Acceso a Railway (cuenta de BBJobs) y a Vercel (variables y DNS).
- [ ] Mercado Pago: credenciales de producción confirmadas (ya en uso para destacados).

## Fase 4 — Código a producción, compuerta cerrada

**Verificado el 20/11 con el token de Railway (sólo lectura):** producción ya está en la migración
`f1b3d5e7a9c2`, que es el `head` actual: el código de mails e IA **ya está desplegado** con
`MODULOS_NUEVOS_ACTIVOS=false`. Lo que falta subir son los commits locales (agentes, arreglo de
svix 2.x, arreglos de la auditoría, modo sombra, casillas…), **sin migraciones nuevas** salvo que
la Fase 1 agregue la de casillas. Los logs de producción están limpios.

- [ ] Backup de la base de Railway justo antes del push (el único paso que no se puede deshacer
      solo es una migración; con la de casillas, sí hace falta).
- [ ] `GEMINI_API_KEY` **de un proyecto con facturación** (ver Fase 3). La clave del 20/11 es de
      desarrollo y no se sube a producción mientras no se confirme que su proyecto es de pago.
- [ ] Variables nuevas (`--skip-deploys`): `AI_DAILY_BUDGET_USD=1`, `LEADGEN_SYNC_SECRET`.
- [ ] Push de `main` → deploy → (migración de casillas si corresponde).
- [ ] Verificar: sitio igual, `/admin/settings` sin módulos nuevos, rutas nuevas → 404.

## Fase 5 — IA en producción (no necesita mails)

- [ ] `MODULOS_NUEVOS_ACTIVOS=true` (Railway) y `NEXT_PUBLIC_MODULOS_NUEVOS=true` (Vercel).
      Con `emails_automaticos_activos` apagado no sale ningún mail.
- [ ] `LEGAL_V3_VIGENTE_DESDE` / `NEXT_PUBLIC_LEGAL_V3_VIGENTE_DESDE` con la fecha de ese día.
- [ ] "Candidatos recomendados con IA" en **modo sombra** (sólo admin). 2 semanas mirando la pestaña
      Agentes + etiquetado de Eugenia (metas en "Observar primero").
- [ ] Si pasa: visible para las empresas. Después "Buscador inteligente" y "Asistentes con IA".
- [ ] Aviso "candidatos que encajan" al final, con 2 semanas más sin alertas; backfill de embeddings; mirar Panorama y gasto.
- [ ] Unos días de uso propio → mostrárselo a Eugenia (Centro de IA → Agentes).

## Fase 6 — Mails de avisos y novedades

- [ ] Resend BBJobs: dominios `avisos.`, `novedades.` y `r.` → registros en **Vercel DNS**
      (SPF/DKIM/MX de rebotes en `send.*`, MX de recepción en `r.`). Tracking apagado en `avisos.`.
- [ ] Webhook `/api/v1/webhooks/resend` creado por API → `RESEND_WEBHOOK_SECRET` en Railway.
- [ ] `RESEND_API_KEY`, `RESEND_REPLY_TO=hola@r.bbjobs.com.ar`, `EMAIL_DAILY_CAP=150`.
- [ ] Prueba real sólo a mails de Gael (`EMAIL_MODE=real` + destinatarios de prueba), ver
      `email.delivered` y una respuesta como `email.received` en Mails → Respuestas.
- [ ] Prender "Mails automáticos": 1–2 semanas sólo transaccionales, subir el tope por semana.
- [ ] Después: alertas y resúmenes; mail único "¿querés recibir novedades?" a la base (D10); campañas.
- [ ] DMARC a `p=quarantine` cuando los reportes estén limpios.

## Fase 7 — Revisión de CV

- [ ] Prueba con Mercado Pago sandbox (pendiente desde octubre).
- [ ] Texto de "qué incluye" de Eugenia en la pantalla de compra → prender "Venta de revisión de CV".

## Fase 8 — Prospección (lo último)

- [ ] En la misma cuenta: `contacto.` y `r.contacto.` en Vercel DNS, tracking apagado. Sin
      variables nuevas (usa `RESEND_API_KEY` y el mismo webhook). Freno de cuenta probado.
- [ ] Casillas `eugenia@` y `hola@` desde Mails → Casillas (`talency@` si hace falta); rampa 10/20/40 por semana.
- [ ] Talency: inscripción AAIP, Registro No Llame, rubros/zonas y textos (DP3, DP4).
- [ ] Sincronización real desde el centro; `PROSPECT_DAILY_CAP` 20 → subir de a poco.

## Fase 9 — Cierre

- [ ] Clerk a producción (instancia live + CNAMEs en Vercel DNS) y borrar los 3 usuarios de prueba.
- [ ] Eugenia etiqueta 3 búsquedas → calibrar el orden de recomendados y la franja del Revisor.
- [ ] Actualizar `PENDIENTES-BBJOBS.md` y los PDFs para Eugenia.

---

## Después del lanzamiento: mejoras que salieron de revisar otros portales (20/11/2026)

Investigación sobre Bumeran, Computrabajo, Indeed, Welcome to the Jungle, InfoJobs, el portal
municipal `empleo.bahia.gob.ar` y la documentación de Google. Ya hecho: JSON-LD `JobPosting` con
`validThrough`, `baseSalary` y `directApply`; vencimiento visible; compartir por WhatsApp; aviso de
postulación gratis; filtro de sueldo. En orden de impacto local ÷ esfuerzo:

1. **"Esta empresa suele responder en N días"** y cierre automático de postulaciones sin movimiento
   con un aviso amable (contra el *ghosting*, la queja número uno según una encuesta de
   Computrabajo). Ya existen el historial de estados y "Vieron tu CV": es una métrica más una tarea
   programada. (M)
2. **Preguntas de filtro por aviso** (1 a 3 de sí/no: "¿Tenés registro?", "¿Vivís en Punta
   Alta?"), como Indeed Smart Screening. Con postulación de un clic llegan muchos CVs que no
   sirven. (M)
3. **Página de confirmación después de postularse:** qué pasa ahora, activar la alerta de ese rubro
   y 3 avisos parecidos. Es el momento de mayor intención. (S)
4. **Postulación espontánea a una empresa**, aunque no tenga avisos: evita perfiles de empresa
   vacíos al principio. (S-M)
5. **Perfil de empresa con fotos y "cómo es trabajar acá".** (S-M)
6. **Canal de WhatsApp de BBJobs** con los avisos nuevos del día (manual al principio). (S)
7. **Búsqueda por localidades cercanas** (Punta Alta, Ing. White, Monte Hermoso, Médanos). (S)
8. **Alianza con el portal municipal** `empleo.bahia.gob.ar`: es el competidor local real. (gestión)
9. **Postulación liviana** (CV + mail primero, la cuenta después). Medir antes cuánta gente
   abandona entre "Postularme" y el registro: si son pocos, no vale la pena. (M-L)
10. **Google Indexing API** para avisos nuevos y vencidos (la segunda semana; el sitemap alcanza
    para el primer día). (S)

**No hacer por ahora:**
- Reseñas anónimas de empresas: en una ciudad chica el anonimato no existe, y espantaría a las
  empresas, que son el lado escaso.
- Traer avisos de otros portales para "llenar": rompe la promesa de empresas verificadas.
- App nativa, mensajería interna u observatorio salarial con poca muestra.
