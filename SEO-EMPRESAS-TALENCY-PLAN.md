# SEO para empresas: selección de personal de Talency y publicar empleo (09/10/2026)

Hasta ahora el SEO de BBJobs apuntaba sólo a candidatos (`/trabajo-en/[zona]`,
`/empleos-de/[rubro]`, Frente 4 de `MAILS-SEO-IA-OCTUBRE-PLAN.md`). Esta tanda suma la pata de
empresas: quien busca **personal** en Bahía Blanca, para publicar por su cuenta o para que Talency
se encargue de la búsqueda. Rama `feat/seo-empresas`.

Regla dura que se respetó: **nada inventado**. Los pasos del servicio son los del banner de la home;
lo que se dice de publicar sale del código. Todo dato que fortalecería las páginas y no tenemos
quedó abajo como **pendiente de Talency**, no en la página.

## 1. Búsquedas objetivo

| Búsqueda | Intención | Página que la atiende |
|---|---|---|
| selección de personal Bahía Blanca | Empresa que quiere tercerizar la búsqueda | `/seleccion-de-personal` |
| consultora de recursos humanos Bahía Blanca | Busca a la consultora (Talency) | `/seleccion-de-personal` (Service con provider Talency) |
| búsqueda de personal Bahía Blanca | Mixta: publicar o tercerizar | `/seleccion-de-personal` y `/publicar-empleo` (se enlazan entre sí) |
| reclutamiento de personal (Bahía Blanca) | Tercerizar | `/seleccion-de-personal` |
| publicar aviso de empleo Bahía Blanca / publicar empleo gratis | Publicar por su cuenta | `/publicar-empleo` |
| bolsa de trabajo Bahía Blanca | Mixta (más candidatos que empresas) | home y `/empleos` para candidatos; `/publicar-empleo` para empresas |
| selección de personal para logística / industria / comercio / gastronomía / construcción / administración (Bahía Blanca) | Tercerizar, con un sector concreto | `/seleccion-de-personal/<sector>` |

## 2. Páginas y por qué

- **`/seleccion-de-personal`** (hub): H1 "Selección de personal en Bahía Blanca", párrafo citable
  para LLMs, el proceso en 6 pasos (los del banner), para quién es, comparación honesta
  "publicás vos / Talency se encarga" (costo del servicio: "a consultar"), sectores, formulario de
  consulta (`#consulta`) y 7 preguntas frecuentes. JSON-LD: `Service` (serviceType "Selección de
  personal", provider Talency, broker BBJobs, areaServed Bahía Blanca + región, ServiceChannel al
  formulario) + `FAQPage` + `BreadcrumbList`; el `Organization`/`WebSite` del layout siguen igual.
  Estática, siempre indexable.
- **`/seleccion-de-personal/[rubro]`**: sólo **6 sectores** — industria, logística, comercio,
  gastronomía, construcción y administración — cada uno con texto propio: contexto, perfiles que
  suelen buscarse, qué conviene evaluar, una o dos preguntas del sector, el formulario con el sector
  ya elegido y hasta 6 búsquedas activas del sector como prueba de actividad. Enlaces hermanos y
  cruzados con `/empleos-de/<sector>`.
  - **Criterio anti-puertas:** los otros 5 sectores (educación, marketing, recursos humanos, salud,
    tecnología) **no se generan** (404, `dynamicParams = false`). Para escribir algo propio y
    verdadero de esos sectores hace falta saber si Talency hace búsquedas ahí; sin eso, serían
    páginas de plantilla. Los links de esos sectores van al hub (`seleccionHref` en
    `lib/seo/indice.ts`).
  - **Siempre indexables**, a diferencia de las de candidatos: su contenido es el servicio en ese
    sector, no el listado. Sin búsquedas activas el bloque de búsquedas simplemente no aparece.
  - Para sumar un sector: texto en `SELECCION_RUBROS` (`lib/seo/seleccion.ts`) + slug en
    `SELECCION_INDICE` (`lib/seo/indice.ts`). Sitemap, llms.txt, hub y enlaces se actualizan solos.
- **`/publicar-empleo`**: para la empresa que publica por su cuenta. Todo verificado en el código:
  verificación manual y gratis (`/planes`), publicar gratis con búsquedas y postulaciones sin límite
  (`/planes`), Talency revisa cada búsqueda antes de publicarse (`moderation_status=pending_review`
  en `jobs.py`), duración hasta 20 días (`MAX_JOB_DURATION_DAYS`), etapas de la postulación
  (`APP_STATUS_LABEL`), sueldo opcional, destacar = pago único por búsqueda y Base de Talento paga
  (sin precios en la página: link a `/planes`). Bloque "¿Preferís que Talency se encargue?" → hub.
  JSON-LD: `FAQPage` + `BreadcrumbList`.
- **Acople con lo existente**
  - `/empleos-de/[rubro]` y `/trabajo-en/[zona]`: bloque "¿Buscás personal de <sector>?" / "¿Buscás
    personal en <zona>?" con "Publicar un empleo" → `/publicar-empleo` y "Que Talency se encargue" →
    página del sector o hub (`components/seo/BloqueEmpresas.tsx`).
  - Home: el botón del banner de Talency va a `/seleccion-de-personal`; talency.com.ar queda como
    link secundario "Conocer Talency".
  - Footer: columna "Para empresas" (Publicar un empleo, Selección de personal, Planes y precios);
    esos dos links salieron de "Plataforma" para no repetirlos.
  - `llms.txt`: sección "Selección de personal por Talency" (qué hace, para quién, diferencia con
    publicar, cómo consultar, links a las 7 páginas + `/publicar-empleo`).
  - Sitemap: hub, 6 sectores y `/publicar-empleo`.

## 3. Formulario de consulta (dentro de BBJobs)

Se reutilizó `components/contact/ContactForm.tsx` con `topic="seleccion"`: suma Empresa, Puesto a
cubrir, Sector (con el del rubro preseleccionado) y Vacantes, todos opcionales. Al enviarse dispara
`track("generate_lead", { topic: "seleccion" })` (no se tocó `lib/analytics.ts`).

Backend, cambio mínimo y compatible:
- `ContactTopic.seleccion` nuevo. La columna `topic` es `String(20)`, no un ENUM: **sin migración**.
- `ContactMessageCreate` acepta `puesto` (≤200), `sector` (≤100) y `vacantes` (1–999), opcionales.
  No tienen columna: `armar_mensaje()` los antepone al mensaje ("Puesto a cubrir: …\nSector: …\n
  Vacantes: …"), así Talency los ve en el panel de mensajes tal cual.
- La notificación al admin dice "Consulta por selección de personal".
- Panel `/dashboard/admin/mensajes`: etiqueta "Selección de personal" para esos mensajes.
- Test: `backend/tests/test_contact_seleccion.py` (schema + endpoint contra Postgres descartable).

## 4. Datos de Talency que harían más fuertes las páginas (pendientes, no inventar)

- Años de trayectoria de Talency y cantidad de búsquedas realizadas (hoy `/nosotros` dice "años de
  experiencia" sin número; no se repitió).
- **Sectores donde más trabajan** → confirma los 6 sectores elegidos y habilita los otros 5.
- Tiempo promedio de una búsqueda (de la consulta a la presentación de candidatos).
- Cómo se cobra el servicio (fee fijo, porcentaje del sueldo, por vacante) — hoy la página dice
  "a consultar".
- Si publican la búsqueda sólo en BBJobs o también en otros canales (el paso 2 dice "publica la
  búsqueda" sin nombrar dónde).
- Casos o testimonios de empresas con permiso para nombrarlas.
- Qué evaluaciones psicométricas usan (sin marcas, alcanza con el tipo).
- Garantía o reposición si la persona elegida no continúa, si la ofrecen.
- Google Business Profile de Talency/BBJobs con la categoría "Agencia de empleo" o "Consultora de
  recursos humanos" — ayuda mucho en "consultora de recursos humanos Bahía Blanca".

## 5. Cómo se mide

- **GA4 `generate_lead` con `topic = seleccion`**: consultas por el servicio (sólo con
  consentimiento de medición). Comparar con `topic = empresa` y `general`.
- **Mensajes con etiqueta "Selección de personal"** en el panel de admin: la cifra real, aunque la
  persona haya rechazado cookies.
- **Visitas** a `/seleccion-de-personal`, `/seleccion-de-personal/*` y `/publicar-empleo` (GA4 /
  Vercel Web Analytics), y clics de los bloques para empresas en las páginas de candidatos.
- **Search Console**: impresiones y posición para las búsquedas de la tabla 1. A los 60 días,
  sumar sectores (o combinaciones sector × zona) según las búsquedas reales que traigan
  impresiones.
- Registros de empresa que llegan desde `/publicar-empleo` (`/register?type=company`).
