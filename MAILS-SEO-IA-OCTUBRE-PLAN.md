# Mails de Eugenia, SEO/GEO, cookies, buscador e IA — plan (08/10/2026)

Origen: `bbjobs mails auomaticos.pdf` (Eugenia, textos de los mails) + pedido de Gael del 08/10:
llevar los mails a la vista previa, exprimir Gemini, que cada empleo lo lean Google y los LLMs
como lo hace un portal tipo LinkedIn, cookies de medición, SEO masivo estilo ACA/Palazzo, y un
buscador que funcione. Rama `feat/mails-ia`.

Reglas que no cambian: todo lo nuevo que la gente ve va detrás de `MODULOS_NUEVOS_ACTIVOS`
(salvo los arreglos: canónicas, JobPosting, buscador sin tildes, que salen normal); la IA nunca
manda mails ni cambia estados sola; nunca edad/género; toda tabla con datos personales entra en
`account_deletion.py`; toda consulta de empresa filtra por `company_id`.

---

## Frente 1 — Mails automáticos con los textos de Eugenia

### 1.1 Qué pidió (PDF) → cómo se resuelve

| # PDF | Aviso | `type` | Asunto |
|---|---|---|---|
| C1 | Bienvenida | `welcome_candidate` | Bienvenido/a a BBJobs |
| C2 | Postulación confirmada | `application_sent` | Postulación confirmada: {puesto} |
| C3 | Perfil revisado (manual o "Vieron tu CV") | `application_seen` | Tu perfil fue revisado: {puesto} |
| C4 | En proceso | `application_in_process` | Tu postulación avanzó: {puesto} |
| C5 | Seleccionado | `application_selected` | ¡Fuiste seleccionado/a para {puesto}! |
| C6 | No avanza – revisión de perfil | `application_discarded` | Novedades sobre tu postulación a {puesto} |
| C7 | No avanza – después de entrevistas (**estado nuevo**) | `application_discarded_interview` | Novedades sobre tu postulación a {puesto} |
| C8 | Una empresa vio tu perfil (Base de Talento) | `talent_profile_unlocked` | Una empresa vio tu perfil en BBJobs |
| C9 | Perfil incompleto | `profile_incomplete` | Tu experiencia merece un perfil completo |
| C10 | Una semana sin entrar | `candidate_reactivation` | ¿Seguís buscando trabajo? Explorá oportunidades en BBJobs |
| C11 | Resumen semanal | `digest_para_vos` | Las nuevas oportunidades de la semana en BBJobs |
| E1 | Registro de empresa | `welcome_company` | Recibimos el registro de {empresa} en BBJobs |
| E2 | Empresa verificada | `company_verified` | {empresa} ya puede publicar búsquedas en BBJobs |
| E3+ | (vacío en el PDF) | resto de avisos a empresas | **propuestos** con la misma voz (§1.5) |

### 1.2 Diseño

- **`services/email/copy.py`** (nuevo): el texto del mail por `type`, separado del texto corto de la
  campanita. Cada entrada: asunto, título (la línea en negrita de Eugenia), párrafos, botón y link.
  Variables `{nombre}`, `{puesto}`, `{empresa}`, `{porcentaje}`, `{mensaje_empresa}`. Si un `type`
  no tiene copy, sigue saliendo como hoy (título + cuerpo de la notificación).
- `create_notification(..., email_vars={...})`: quien dispara el aviso pasa los datos; `{nombre}`
  lo completa la cola con el primer nombre del usuario (perfil de candidato o `responsible_full_name`
  de la empresa). Sin nombre: "¡Hola!" (Eugenia: "si no se puede, no pasa nada").
- `render_email`: saludo arriba del título, `**negrita**` en el texto fijo (las variables se limpian
  de asteriscos antes de sustituir, así un título de búsqueda no puede meter formato), y el pie
  nuevo: "**BBJobs. El talento de Bahía, más cerca.** / Una iniciativa de Talency." + "Administrar
  notificaciones" (link a la página de preferencias) + la baja de un clic donde corresponde.
- Las plantillas editables del panel de Talency (`email_templates`) siguen pisando asunto y texto, y
  ahora aceptan también `{{nombre}}`, `{{puesto}}`, `{{empresa}}`.
- La nota visible de la empresa viaja dentro del mail del estado (como hoy), como un párrafo
  "Mensaje de la empresa: …".

### 1.3 Estados de la postulación

- **Se sacan del desplegable** "Contactado" y "Finalista" (pedido de Eugenia). Los valores siguen
  existiendo para las postulaciones viejas: si una postulación ya está en uno de ellos, el
  desplegable lo muestra como opción actual (no se migra nada, no se pierde historial).
- **"No avanza" se divide en dos**: `discarded` → "No avanza – revisión de perfil" y el nuevo
  `discarded_interview` → "No avanza – después de entrevistas". Los dos salen a las 24 h y se
  cancelan si la empresa cambia el estado en el medio. La columna es `String(50)`: sin migración.
- **Vista previa del mensaje al cambiar el estado** (pedido en rojo del PDF): el cuadro de "Cambiar
  estado" muestra el mail que le va a llegar al postulante (asunto + texto, con el puesto y el
  nombre reales), y la nota visible si la escribe. Lo arma el backend
  (`GET /me/company/applications/{id}/status-preview?status=…`) con el mismo `copy.py`: una sola
  fuente de verdad. Con la compuerta cerrada, el cuadro avisa "le va a llegar un aviso al
  postulante" (la campanita existe igual).

### 1.4 Disparadores que cambian

- **C10, "una semana sin entrar"**: hoy es 60 días sin actualizar el perfil. Se agrega
  `users.last_seen_at` (lo actualiza `get_current_user` como mucho una vez por hora; migración nueva)
  y la reactivación pasa a: 7 días sin entrar, como mucho cada 30 días, y nunca más de 3 sin que
  vuelva (si no vuelve nunca, dejamos de escribirle — política anti-spam R8).
- **C2, una confirmación por postulación** (no una por día): cada confirmación nombra un puesto
  distinto. Sigue sujeta al tope de 2 no críticos por día; lo que sobra se difiere a la mañana.
- **C11** es el "Búsquedas para vos" de los lunes con el texto de Eugenia, el ítem "puesto /
  localidad · modalidad · empresa" y el link "Administrar notificaciones".

### 1.5 Mails a empresas (propuestos — Eugenia dejó el "3" vacío)

Misma voz (saludo, línea en negrita, 2–3 párrafos, botón, firma). Quedan marcados **"Propuesto"**
en la vista previa para que Eugenia los apruebe o corrija:

- Resumen diario de postulaciones · Búsqueda aprobada / necesita cambios / dada de baja / reactivada
- Búsqueda sin postulaciones a los 7 días (con 3 consejos concretos) · Por vencer (3 días) · Vencida
- Publicá tu primera búsqueda (a los 2 y 7 días de verificada) · Verificación rechazada
- Candidatos recomendados nuevos (IA, de noche) · Destacado activo / vencido · Pack de contactos
- **Nuevo, propuesto:** "Tu búsqueda cerró: ¿avisamos a los que no quedaron?" — al cerrar una
  búsqueda con postulantes todavía en "Nueva/Perfil revisado", recordarle a la empresa que les dé
  una respuesta (la experiencia del candidato es el diferencial frente a los portales grandes).
- **Nuevo, propuesto:** resumen mensual de la empresa (visitas a sus búsquedas, postulaciones,
  tiempo promedio de respuesta) — necesita las métricas del Frente 3.

### 1.6 Vista previa para Eugenia

`scripts/generar_vista_previa.py` pasa a armar cada muestra con `copy.py` (los mismos textos que
saldrían), y la página gana: la marca "Propuesto"/"Texto de Eugenia" por mail, y el nuevo
desplegable de estados con el mensaje que ve la empresa.

---

## Frente 2 — Que Google y los LLMs lean cada empleo (estilo LinkedIn/Indeed)

Estado hoy (medido): la ficha del empleo tiene JSON-LD `JobPosting`, pero **el cuerpo del aviso no
viene en el HTML** (se carga por axios en el navegador), la localidad está fija en "Bahía Blanca",
falta `employmentType`/`identifier`/`directApply`, no hay `metadataBase`, y **el sitemap y las
canónicas apuntan a `bbjobs.com.ar`, que redirige 308 a `www`** (señal cruzada para Google).
`/empleos`, la home y `/empresas` son 100 % cliente: el HTML inicial no trae ningún empleo.

1. **Dominio canónico `https://www.bbjobs.com.ar`** en `metadataBase`, `SITE_URL`, sitemap, robots
   y JSON-LD.
2. **URL con slug**: `/empleos/vendedor-a-bahia-blanca-<uuid>`; la URL vieja (sólo uuid) redirige
   301 a la nueva. Sin cambios en el backend (el uuid sigue siendo la clave).
3. **Ficha renderizada en el servidor**: el título, la empresa, la descripción y los requisitos
   vienen en el HTML (Google exige que el contenido del JobPosting esté visible en la página).
4. **JobPosting completo** según la guía de Google for Jobs: `title`, `description` (HTML),
   `datePosted`, `validThrough`, `employmentType` (FULL_TIME/CONTRACTOR/INTERN/TEMPORARY desde el
   tipo de contrato), `hiringOrganization` (nombre, `sameAs` a su ficha, logo), `jobLocation` con
   la zona real (Bahía Blanca, Punta Alta, Monte Hermoso, Coronel Suárez; "Zona Norte/Sur" →
   Bahía Blanca), `applicantLocationRequirements` para remoto, `baseSalary` sólo si es visible,
   `identifier`, `directApply: true`, `industry`, `experienceRequirements`,
   `educationRequirements`. Búsqueda vencida o cerrada → 404 (Google la saca del índice).
5. **Avisar a los buscadores apenas se publica o se cierra**: IndexNow (Bing, Yandex, y lo que
   leen ChatGPT/Copilot vía Bing) sin cuentas; Google Indexing API (la única que Google permite
   para JobPosting) con una cuenta de servicio — **queda preparado detrás de una variable**; hace
   falta que Gael/Talency cree la cuenta de servicio y la sume como propietaria en Search Console.
6. `Organization` + `WebSite` con `SearchAction` (cuadro de búsqueda) en el layout; `Organization`
   en cada ficha de empresa (también server-rendered); `BreadcrumbList` en las fichas.
7. **`/llms.txt`** (route handler): qué es BBJobs, cómo funciona, y la lista viva de búsquedas
   activas con su link, por rubro y zona. `robots.txt` deja pasar GPTBot, ClaudeBot,
   PerplexityBot y Google-Extended.

## Frente 3 — Cookies de medición y métricas

Hoy no hay ninguna medición. La política de privacidad dice "no usamos cookies de seguimiento".

- **Vercel Web Analytics** (sin cookies: no necesita consentimiento): visitas, páginas, origen.
- **Google Analytics 4 con banner propio** (Aceptar / Rechazar / Configurar), Consent Mode v2 en
  "denegado" por defecto y GA cargado **sólo después de aceptar**. ID en `NEXT_PUBLIC_GA_ID` (sin la
  variable, no se carga nada). Eventos: `search`, `view_item` (ficha de empleo), `apply`
  (postulación), `sign_up` (alta candidato/empresa), `generate_lead` (contacto), `publish_job`.
- CSP de `proxy.ts` habilitada para Google Analytics; sección 11 de privacidad y página
  `/cookies` actualizadas; link "Configurar cookies" en el footer.
- Lo que hace falta de afuera: crear la propiedad GA4 de BBJobs (cuenta de Talency) y verificar
  Search Console (propiedad de dominio `bbjobs.com.ar`).

## Frente 4 — SEO masivo de Bahía y la zona (patrón ACA/Palazzo)

Con **10 búsquedas activas** hoy, cientos de páginas vacías serían "páginas puerta" (Google las
penaliza desde 2024). Patrón de ACA: pocas páginas fuertes, cada una con datos propios, y se
suman las que pida Search Console.

- **Datos tipados** en `frontend/src/lib/seo/`: `zonas.ts` (Bahía Blanca, Punta Alta, Monte
  Hermoso, Coronel Suárez, + Ingeniero White, General Cerri, Tornquist, Villarino como texto) y
  `rubros.ts` (los 11 sectores reales), cada uno con título ≤60, descripción, H1, párrafo citable
  para los LLMs, textos propios, preguntas frecuentes.
- **Páginas**: `/trabajo-en/[zona]` ("Trabajo en Bahía Blanca"), `/empleos-de/[rubro]` ("Empleos
  de logística en Bahía Blanca"), con las búsquedas activas server-rendered, FAQ (`FAQPage`), migas
  (`BreadcrumbList`), enlaces entre zonas y rubros, y CTA de alerta. **`noindex` automático si la
  página no tiene ninguna búsqueda activa** (se indexa sola cuando aparece una).
- Guías editoriales (evergreen, con datos propios de Talency): "Cómo armar un CV para Bahía
  Blanca", "Trabajos en el Polo Petroquímico y el puerto", "Primer empleo en Bahía Blanca",
  "Para empresas: cómo publicar una búsqueda" — redacta Talency con base nuestra.
- `/empleos` y la home: metadata propia + listado inicial en el HTML.
- Combinaciones rubro × zona: **sólo cuando haya ≥3 búsquedas activas** en la combinación.
- A los 60 días: Search Console → sumar páginas por las búsquedas reales que traigan impresiones.
- Google Business Profile de BBJobs (pendiente de Fase 1).

## Frente 5 — Buscador

Hoy es `ILIKE '%frase%'` sobre título y descripción: no tolera tildes ("tecnico" ≠ "Técnico"),
plurales, errores de tipeo ni palabras sueltas ("vendedor bahia" no encuentra "Vendedor en Bahía"),
no busca por empresa aunque el cuadro lo promete, y no ordena por relevancia.

1. **Arreglo (sale normal, sin compuerta)**: extensiones `unaccent` + `pg_trgm`, búsqueda por
   palabras (todas deben aparecer en título, descripción, empresa, sector, zona o habilidades),
   sin tildes, singular/plural, sinónimos del rubro (chofer↔conductor, mozo↔camarero,
   programador↔desarrollador…), tolerancia a errores de tipeo en el título (trigramas), y orden
   por relevancia cuando hay texto.
2. **Búsqueda inteligente con Gemini (compuerta + interruptor)**: si la frase es larga o en
   lenguaje natural ("algo de administración part time cerca de Punta Alta"), Gemini la traduce a
   filtros de una **lista cerrada** (zona, sector, modalidad, tipo de contrato, palabras clave) —
   nunca a SQL — y la pantalla muestra "Entendimos: Administración · Punta Alta" con la opción de
   sacarlo. Caché por frase, tope de gasto compartido con el resto de la IA.

## Frente 6 — Gemini: qué más se puede exprimir

Hoy: recomendados (puntaje + embeddings + rerank con evidencia), borrador de campañas, audiencia en
lenguaje natural. Propuesto, por valor/costo (todo detrás de la compuerta, nunca decide solo):

| Prioridad | Qué | Para quién | Costo aprox. |
|---|---|---|---|
| 1 | Buscador inteligente (Frente 5.2) | Candidatos | < USD 0,0003 por búsqueda, con caché |
| 2 | "Búsquedas para vos" ordenado por embeddings (sin LLM) | Candidatos (mail C11) | ~0 (vectores ya existen) |
| 3 | Asistente para redactar la búsqueda: la empresa escribe 3 líneas y Gemini propone título claro, tareas, requisitos excluyentes/deseables y **avisa si un requisito es discriminatorio** (edad, género, "buena presencia") | Empresas | ~USD 0,001 por búsqueda |
| 4 | Recomendados al aprobarse una búsqueda y al entrar una postulación (hoy sólo de noche y a pedido) | Empresas | igual que hoy |
| 5 | Sugerir habilidades del catálogo al completar el perfil a partir del CV | Candidatos | ~USD 0,0005 por CV |
| 6 | Resumen del candidato en 3 líneas en la ficha (con evidencia, anonimizado) | Empresas | ~USD 0,0005 |
| 7 | Detectar avisos duplicados o mal categorizados al moderar | Talency | ~0 (embeddings) |

**No**: IA escribiendo mails transaccionales, rechazando postulantes, o resumiendo a la persona con
datos sensibles. Lo que la IA genera para un candidato va en pantalla, no en mails automáticos.

## Orden de ejecución (esta sesión)

1. Frente 1 completo + vista previa (yo).
2. En paralelo: Frente 2 + 4 (agente SEO, frontend), Frente 3 (agente cookies), Frente 5 (agente
   buscador). Sin commits de los agentes; reviso y commiteo por frente.
3. Frente 6: punto 2 (para vos con embeddings) y punto 3 (asistente de redacción) si alcanza; el
   resto queda en este plan.
4. Documento para Eugenia sin jerga + vista previa actualizada.

---

## Estado (08/10/2026)

Commits en `feat/mails-ia`: `404c1a8` buscador · `8acedbd` mails · `5ca0dd7` SEO y cookies.
Suite backend 421 OK contra Postgres local; `next build` OK.

**Hecho:** Frente 1 completo (backend, estados, vista previa del mail en "Cambiar estado", vista
previa para Eugenia con pestaña de estados), Frente 2 (salvo el aviso a buscadores desde el backend),
Frente 3, Frente 4 (zonas y sectores; sin combinaciones ni guías), Frente 5 completo, Frente 6.1.
Documento para Eugenia: `NOVEDADES-MAILS-SEO-EUGENIA.pdf`.

**Falta:**
1. Lo que decida Eugenia sobre los mails propuestos y los tres detalles (semana sin entrar,
   resumen semanal, nombre de la empresa en la Base de Talento → línea en los términos).
2. IndexNow / Google Indexing API desde el backend al publicar y cerrar (necesita `INDEXNOW_KEY`
   y, para Google, una cuenta de servicio sumada en Search Console).
3. Links de los mails a la ficha con slug (hoy `/empleos/<uuid>`, funciona por la redirección 308).
4. Frente 6, puntos 2–7 (el orden semanal por embeddings y el asistente de redacción primero).
5. Afuera: propiedad GA4 + `NEXT_PUBLIC_GA_ID` en Vercel, activar Web Analytics en Vercel,
   Search Console con el sitemap de www, Google Business Profile; validar el texto legal de cookies.
6. Rate limit de `/jobs/interpret`: detrás del proxy de Railway, slowapi ve una sola IP (hoy el
   límite es global; lo que protege el gasto es el tope diario).
7. Las migraciones `c7d1e5f9a2b4` y `d8e2f6a0b3c5` corren solas en el deploy (Dockerfile).
