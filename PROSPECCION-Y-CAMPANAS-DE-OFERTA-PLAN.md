# Prospección de empresas y campañas de oferta — plan v2

> **Planificación, 04/10/2026. No hay código todavía.** Complementa a la v4
> (`MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md`) y a la auditoría. **Módulo en desarrollo:** en
> producción queda detrás de la compuerta `MODULOS_NUEVOS_ACTIVOS`, y en el panel de Eugenia se
> muestra como **"En desarrollo"** hasta el lanzamiento.

## 0. Decisiones de Gael (04/10/2026)

| # | Decisión |
|---|---|
| G1 | **No hay buscador ni scraper en BBJobs.** Se le ofrece a Talency **la base de empresas que Gael ya tiene** (`leadgen/data/leads.db`, ~7.800 empresas), **como muestra**, con filtros |
| G2 | La integración la origina **el centro**: él elige qué empresas pasan (selección masiva o todas) y las sincroniza con BBJobs |
| G3 | No se usa la API de Google desde BBJobs: "le damos lo que tenemos" |
| G4 | **Los mails a esas empresas salen con el dominio de BBJobs**, a nombre de Talency/BBJobs |
| G5 | Para Eugenia, en el panel de admin, con cartel "En desarrollo" hasta el lanzamiento |
| G6 | **No se redactan mensajes en esta etapa**: sólo la integración |
| G7 | **Pasan todas las empresas, sin importar la etapa con Gael** (también sus clientes y las que están en conversación). Para arrancar, una **muestra de 1.000 al azar** entre las que le sirven a Talency (con mail verificado o teléfono) |
| G8 | La cuenta de Resend para prospección (aparte o la misma) **se decide al final**, junto con las demás cuentas |

## 1. Lo que hay que saber de la base de `leadgen` (relevamiento del 04/10)

- `leads` (7.833 filas), PK `place_id`. Trae nombre, rubro y `categoria`, dirección y localidad,
  teléfono, WhatsApp, mail(s), web, redes, rating y lat/lng.
- Etapa de Gael: `nuevo` 2.543 · `calificado` 4.164 · `contactado` 696 · `respondio` 22 ·
  `reunion` 1 · `descartado` 407.
- **`no_contactar` (~257 empresas)** por baja, rebote, queja, sin MX o decisión manual. **Una
  empresa que le pidió la baja a Gael no puede recibir nada de BBJobs**: viaja como supresión.
- `dominios_correo` tiene el MX verificado de cada dominio (caché de 30 días).
- En `rubros.py` existe el rubro **"Consultoras y RRHH"**: son **competencia de Talency** y no
  se le pasan nunca.
- Filtros reutilizables de `leadgen/exclusiones.py`: `motivo_exclusion(nombre)` (cadenas, sector
  público, competencia) y `motivo_email_excluido(email)` (dominios de terceros, buzones
  automáticos).
- Todo es local (SQLite en la máquina de Gael). BBJobs está en Railway: **la base no se abre
  desde afuera**. El centro **empuja** a BBJobs; BBJobs nunca lee `leads.db`.

## 2. Arquitectura: el centro empuja, BBJobs recibe

```
centro (local, Gael)                                  BBJobs (Railway)
───────────────────                                   ────────────────
Pantalla "Pasar a BBJobs":
  filtros: rubro, localidad, con mail / con teléfono
  casillas + "seleccionar todas las que cumplen" + "N al azar" (primera muestra: 1.000, G7)
  previsualización: N empresas · M con mail · K suprimidas
        │
        │  POST /api/v1/integrations/leadgen/sync      (HTTPS, firmado con HMAC)
        │  lotes de 200, idempotente por place_id
        ▼
                                                      valida firma y lote
                                                      aplica filtros de BBJobs (§3)
                                                      upsert en prospects
                                                      supresiones → email_suppressions
                                                      responde: creadas / actualizadas / descartadas (con motivo)
```

- **Un solo sentido.** BBJobs no escribe en `leads.db`. Lo que Eugenia haga con una empresa
  (etapas, notas, respuestas) queda en BBJobs.
- **Autenticación máquina a máquina:** firma HMAC-SHA256 del cuerpo con un secreto compartido
  (`LEADGEN_SYNC_SECRET`, en Railway y en el `.env` del centro), más `timestamp` (se rechaza si
  tiene más de 5 minutos) y un `sync_id` idempotente. Mismo esquema que las firmas de los
  webhooks: no hace falta un usuario de Clerk para el centro.
- **Con la compuerta cerrada**, el endpoint devuelve 404 como el resto del módulo.
- **Re-sincronizar** actualiza datos de contacto, pero **nunca pisa** la etapa ni las notas que
  puso Eugenia, y **nunca saca una supresión**.
- **Del lado del centro** es un módulo nuevo (`centro/modulos/bbjobs_sync.py` + su vista). Toca
  otro repo: se hace con su propio commit allá, sin tocar el envío de `leadgen`.

## 3. Filtros (en los dos lados)

| Filtro | Dónde | Por qué |
|---|---|---|
| `no_contactar = 1` → **viaja sólo como supresión de la dirección**, no como prospecto | centro | Quien pidió la baja a Gael no recibe nada de nadie |
| Rubro "Consultoras y RRHH" fuera | centro y BBJobs | Competencia de Talency |
| `exclusiones.motivo_exclusion` (cadenas, sector público, competencia) | centro | Ya lo resuelve `leadgen` |
| `exclusiones.motivo_email_excluido` y MX inválido en `dominios_correo` | centro | Un mail que rebota quema el dominio de BBJobs |
| Ya registrada en BBJobs (mismo dominio de mail, mismo teléfono) | BBJobs | No se le "invita" a quien ya usa el portal: queda marcada `registrada` |
| Duplicados (mismo `place_id`, teléfono o dominio) | BBJobs | Una empresa, una ficha |

Filtros que usa Eugenia **dentro de BBJobs** sobre lo sincronizado: rubro, localidad, etapa,
con mail / con WhatsApp, nunca contactada, ya registrada, fecha de alta.

## 4. Modelo de datos en BBJobs (una migración)

| Tabla | Qué guarda |
|---|---|
| `prospects` | `external_id` (= `place_id`) UNIQUE, `source` (`leadgen`), nombre, rubro, localidad, dirección, teléfono, WhatsApp, web, redes, `stage`, `notes`, `company_profile_id` (si se registró), `do_not_contact` + motivo, `last_synced_at`, fechas |
| `prospect_emails` | Mails de cada empresa: dirección, principal, MX verificado |
| `prospect_events` | Historial: sincronización, cambio de etapa, nota, mail enviado / entregado / rebotado, respuesta, registro en BBJobs |
| `prospect_syncs` | Cada sincronización: `sync_id` UNIQUE, recibidas, creadas, actualizadas, descartadas por motivo |
| `prospect_campaigns` + `prospect_campaign_recipients` | Campañas a prospectos (§5) |
| `email_suppressions` (ya existe, T1) | **Una sola lista de supresión para todo el portal**, por dirección |

**Etapas en BBJobs:** `nueva` → `contactada` → `respondió` → `reunión` → `cliente` (de
selección de personal) · `registrada` (se dio de alta en el portal) · `descartada`. El pase a
`registrada` es **automático** al terminar el onboarding de una empresa con el mismo dominio o
teléfono, con un aviso a Eugenia.

**Privacidad:** son datos de empresas publicados por ellas mismas, pero algunos mails son de
personas (`juan@empresa.com`). Botón "borrar definitivamente" por prospecto; la baja deja sólo
la supresión.

## 5. Envío de las campañas a prospectos

**Decisión de Gael (G4): dominio de BBJobs.** Dato verificado en la fuente: la política de uso
de Resend dice *"You are prohibited from sending unsolicited messages of any kind, including
cold outreach, purchased lists, or scraped contact data"* y exige opt-in explícito
(resend.com/legal/acceptable-use, leída el 04/10/2026). El riesgo no es legal sino de
**suspensión de la cuenta**. Para que, si pasa, no se caigan los avisos del portal:

| Medida | Cómo |
|---|---|
| **Subdominio propio** | `contacto.bbjobs.com.ar`, aparte de `avisos.` (transaccionales) y `novedades.` (campañas a usuarios), con su SPF, DKIM y DMARC |
| **API key separada** | `PROSPECT_RESEND_API_KEY` distinta de `RESEND_API_KEY`. **Idealmente otra cuenta de Resend**: si suspenden la de prospección, la de los avisos sigue |
| **Envío intercambiable** | Interfaz `ProspectSender` con `ResendSender` y `SmtpSender`: si hiciera falta, se cambia a un buzón real sin tocar el resto |
| **Volumen bajo y calentamiento propio** | Tope diario aparte (`PROSPECT_DAILY_CAP`, arranca en 20) y sólo días hábiles, en franja de 9 a 12 (como `leadgen/agenda.py`) |
| **Baja de un clic** | `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) y link visible; se respeta al instante y para siempre (Resend pide 7 días) |
| **Salud** | Si los rebotes pasan el 4 % (el límite que tiene anotado `leadgen/salud.py`), se pausa sola la prospección y se avisa |

**Reglas (P):** P1 una empresa recibe como mucho 1 mail de prospección cada 30 días · P2 máximo 3
toques por campaña (2.º a los 7 días y 3.º a los 21, sólo si el anterior se entregó, como
`leadgen/seguimiento.py`) · P3 nunca a una empresa registrada, suprimida o competidora · P4
**todo envío lo aprueba Eugenia** viendo antes cuántas empresas lo van a recibir · P5 una
respuesta real crea una tarea para Eugenia; una baja suprime al instante.

**Respuestas:** van al reply-to (un buzón real de Talency). Se clasifican con la lógica de
`leadgen/respuestas.clasificar()` (baja / rebote / automática / respuesta), copiada como
función pura. Lectura por la API de recepción de Resend o por IMAP del buzón (decisión técnica
de P3).

**Legal (a confirmar con el abogado):** mail B2B a direcciones publicadas por la propia empresa,
diciendo quién escribe y por qué, con baja que se respeta. Ley 25.326, art. 27.

## 6. Campañas de oferta a usuarios de BBJobs

Usan las campañas de T4 (cola propia, Resend de BBJobs, subdominio `novedades.`): son personas
que **ya tienen relación** con el portal. Para postulantes, sólo con consentimiento de
novedades (D10); para empresas, comunicación B2B con baja.

**Audiencias predefinidas**, combinables con rubro y zona:

| Para | Audiencia | Oferta |
|---|---|---|
| Postulantes | Con CV cargado, que nunca compraron la revisión | Revisión de CV |
| Postulantes | Perfil por debajo del 60 % | Completar perfil + Revisión de CV |
| Empresas | Búsqueda activa sin destacar | Destacar |
| Empresas | Búsqueda activa con más de 50 postulantes | **Selección de personal de Talency** |
| Empresas | Nunca compraron un pack | Base de Talento |
| Empresas | Verificadas que nunca publicaron | Publicar la primera búsqueda |
| Empresas | Sin búsquedas hace más de 90 días | Volver a publicar + selección de personal |

Cada campaña tiene **un producto asociado** y se mide la **conversión real**: compra o
publicación en los 14 días siguientes, no sólo clics. Topes de la v4: 1 mail de marketing por
semana por persona (R5), nunca dentro de un transaccional (R15).

## 7. Pantallas

**En BBJobs (admin, con "En desarrollo"):**
- **Empresas a contactar:** tabla con los filtros de §3, casilla por fila, "seleccionar página"
  y "seleccionar las N que cumplen el filtro". Acciones en masa: agregar a campaña, cambiar
  etapa, descartar, exportar CSV.
- **Ficha:** datos, mails, historial, notas, WhatsApp asistido (`wa.me`, nunca automático),
  "llamada hecha".
- **Seguimiento:** contactadas sin respuesta hace más de N días, respuestas nuevas, tareas.
- **Sincronizaciones:** cuándo llegó cada lote y qué se descartó por qué.

**En el centro:** pantalla "Pasar a BBJobs", con filtros, selección masiva, previsualización
y botón de sincronizar (§2).

## 8. Tandas

| Tanda | Qué | Repo |
|---|---|---|
| **P1** | Migración + modelos + endpoint `/integrations/leadgen/sync` firmado e idempotente + filtros de BBJobs + supresiones + tests | BBJobs |
| **P2** | Módulo "Pasar a BBJobs" del centro: filtros, selección masiva, previsualización, firma, envío por lotes | centro |
| **P3** | Panel de BBJobs: tabla con selección masiva, ficha, etapas, seguimiento, sincronizaciones | BBJobs (frontend) |
| **P4** | `ProspectSender` + campañas a prospectos + baja + salud + clasificación de respuestas | BBJobs |
| **P5** | Audiencias predefinidas y conversión de las campañas de oferta (§6) | BBJobs (con T4) |
| **P6** | Mensajes, cuando se apruebe la integración | Eugenia |

## 9. Decisiones abiertas

| # | Decisión | Quién | Default |
|---|---|---|---|
| DP1 | ¿Cuenta de Resend aparte para prospección, o la misma cuenta con otra API key? | Gael, **al final** (G8) | Cuenta aparte |
| DP3 | Rubros y zonas que le interesan a Talency de la muestra | Eugenia | Todos menos consultoras de RRHH |
| DP4 | Servicios de Talency a ofrecer | Eugenia | Selección de personal + portal |

## 10. Aviso aparte (no es de BBJobs)

El relevamiento encontró que **`leadgen` hoy está enviando solo** (`envio_automatico=1`,
`modo_borrador=0`) con **tope de Google en 4.000 llamadas por mes** (por encima de las 1.000
gratis, hasta ~USD 105). El README del 15/08 dice que estaba en modo borrador. Si no es
intencional, conviene revisarlo en el centro.
