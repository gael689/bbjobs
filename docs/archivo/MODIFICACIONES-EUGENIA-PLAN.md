# Modificaciones Eugenia — agosto 2026

> Plan de los 17 puntos del documento `bbjobs modificaciones.pdf` (recibido el 06/08/2026).
> Cubre lo que quedó **después** de `NOVEDADES-EUGENIA-2026-07-27.md`.
>
> Este archivo es el registro técnico: causa raíz de cada bug, migraciones, decisiones y su
> porqué. La versión sin jerga para Eugenia va en `NOVEDADES-EUGENIA-2026-08-06.md`, y se
> escribe recién cuando la tanda está deployada y verificada.

## Estado de implementación

- [x] **Bloque A — bugs que la bloquean** (06/08/2026): CV 401 resuelto con links firmados,
      "ver perfil" del postulante, descripción visible al aprobar, subidas fuera del event loop.
      Sin migración. El catálogo de habilidades vacío (A1) se cierra en el Bloque C.
- [x] **Bloque B — ajustes de flujo** (06/08/2026): migración `c3e7b1d5a92f` fusiona
      `requirements` dentro de `description` con backfill; el aviso es un solo campo en el
      wizard, en las dos pantallas de edición, en la preview y en el detalle público; la
      revisión del wizard muestra el aviso entero (se sacó el `line-clamp-3`); los 7 estados
      con notificación al candidato en todos; el % de perfil fuera de las **tres** vistas de
      empresa donde aparecía, más la tarjeta de promedio; validación de fechas completa;
      resize de imagen en el navegador (`lib/imagen.ts`), que cierra lo que faltaba de A5.
      **Las dos migraciones siguen sin aplicarse a producción.**
- [x] **Bloque C — habilidades** (06/08/2026): migración `f1a4c7e2b9d8` con el catálogo
      sembrado (16 blandas + 31 técnicas), tope 6+6 validado en el backend, `SkillPicker`
      compartido entre el perfil del candidato y el wizard de la empresa, idiomas y "Otra"
      desplegándose donde se eligen, y el flujo de sugerencias eliminado de punta a punta.
      **La migración todavía no se aplicó a producción.**
- [x] **Bloque D — estadísticas** (06/08/2026): migración `a8d2f6c1e534`
      (`educations.status` con graduado/en curso/abandonado + tabla `site_settings`).
      `applicant_stats` reescrito con franjas de edad y experiencia, nivel educativo con su
      estado, habilidades más declaradas y salario pretendido; de paso se eliminó el N+1 que
      hacía 2 queries por candidato. Gráficos en SVG propio, sin librería. `PanelEstadisticas`
      compartido entre empresa y candidato — al candidato se le resaltan sus franjas.
      Interruptores de publicación en el panel de Talency y bloque de mercado en la home.
- [x] **Bloque E — destacado manual** (06/08/2026): `PATCH /admin/jobs/{id}/feature`, sin crear
      `Payment` ni `JobFeature` (no hubo plata: meter filas falsas ensuciaría el reporte de
      facturación) y con registro en `audit_logs`. Rechaza quitar un destacado **pago** activo.
      Más los dos arreglos de seguridad de MP (ver abajo).
      **Falta la integración final de MP: sigue en sandbox, depende de Talency.**

Entrega: **todo junto en un solo deploy** (decisión de Gael, 06/08/2026 — se evaluó entregar
el Bloque A primero para destrabar a Eugenia y se descartó).

Cabeza de migraciones al arrancar: `4b8f2c1a6e33`. Al cierre del Bloque B: `c3e7b1d5a92f`
(dos migraciones nuevas, `f1a4c7e2b9d8` → `c3e7b1d5a92f`, ninguna aplicada todavía).

---

## Decisiones tomadas (06/08/2026)

| # | Tema | Decisión | Por qué |
|---|------|----------|---------|
| 1 | Descripción y requisitos | **Se elimina `requirements`.** Un solo campo grande. Migración que concatena los requisitos actuales al final de `description`. | Es literal lo que pidió. Dejarlo opcional hacía que los avisos ya publicados siguieran mostrando dos bloques separados — justo lo que le molesta. |
| 2 | Nivel por habilidad | **Se elimina.** El candidato tilda hasta 6 blandas y 6 técnicas. Se pierde el nivel ya cargado. | Autoevaluarse "experto en trabajo en equipo" no informa nada, y son 12 selectores más en un formulario que Eugenia ya vio trabarse en el celular. |
| 3 | CV con 401 | Se decidió habilitar la entrega de PDF en Cloudinary **y** servir el CV con sesión. **La primera mitad quedó sin efecto**: la prueba contra la cuenta real mostró que ni siquiera una URL firmada se entrega, así que se fue por el endpoint de descarga firmado y no hay que tocar la consola. Ver bloque A2. | Hoy el CV de una persona es accesible para cualquiera que tenga la URL, sin login, y ese link viaja por mail y WhatsApp. Son datos personales. |
| 4 | Orden de los estados | **Se respeta el orden de Eugenia** (Nueva → Perfil revisado → Contactado → En proceso → Finalista → Seleccionado → No avanza). | Gael lo dejó a criterio. El orden que escribió ella ya es el embudo correcto: primero se contacta, después la persona entra al proceso de entrevistas. No había nada que corregir. |
| 5 | Notificaciones al candidato | **Los 7 cambios de estado le llegan al candidato**, incluido "No avanza". | Decisión de Gael. Hoy sólo notificaban 3 de 5. |
| 6 | Idiomas | **Va dentro de las técnicas**, tal cual lo pidió Eugenia: al elegir "Idiomas" se abre el selector de idioma + nivel. Ocupa uno de los 6 cupos técnicos. | Gael: "hacelo tal cual me lo pidió Eugenia". Los datos se siguen guardando en la tabla `languages` (con nivel) — cambia la puerta de entrada en la UI, no el modelo. |
| 7 | "Otra" habilidad | **Texto libre con límite de caracteres**, guardado en el perfil. **Se elimina** todo el flujo de sugerencia con aprobación del admin. | Ver "Deuda técnica encontrada" abajo: el flujo estaba a medio desmantelar y la notificación llevaba a un 404. |
| 8 | Habilidades en el wizard de la empresa | Mismo catálogo agrupado y mismo tope 6+6, manteniendo el marcado Requisito/Deseable. | Eugenia no se pronunció sobre este punto; Gael lo dejó a criterio. Mismo catálogo de los dos lados es lo único que hace comparable un aviso con un perfil. |
| 9 | Salario pretendido en las estadísticas | **Se muestra siempre**, sin umbral mínimo. | El sistema todavía no salió al mercado: está en corrección final, no hay usuarios reales a los que el número pueda confundir. |
| 10 | Nivel educativo "Abandonado" | **Se agrega** al perfil del candidato. | Lo pidió Eugenia (captura de Bumeran, pág. 4). |
| 11 | Umbral de privacidad en las estadísticas | **No se bloquea por umbral.** En su lugar, Eugenia ve **siempre** todas las estadísticas desde su panel y decide con un interruptor cuáles se publican (a los candidatos y en la home). | Idea de Gael, y es mejor que el umbral automático: el sistema queda construido y ella lo habilita cuando el volumen lo justifique, sin tocar código. |
| 12 | Destacado manual | **Talency puede destacar un aviso desde el panel de admin**, sin pago. | Decisión de Gael. Habilita canjes y cortesías. |
| 13 | Nombres de estado para el candidato | **Ve los mismos 7 nombres** que la empresa, incluido "No avanza". | Respuesta de Gael el 06/08/2026. |
| 14 | Educación en curso | **No se permite fecha de egreso futura.** Si está "en curso", queda sin fecha de fin y punto. | Respuesta de Gael el 06/08/2026. Evita el campo "fecha estimada" que nadie mantiene actualizado. |
| 15 | Edad mínima | **18 años cumplidos.** Se evaluó 16 (edad laboral mínima en Argentina) y se descartó. | Definición final de Gael el 06/08/2026. |
| 16 | Idiomas en el % de perfil | **Cuenta como ítem propio, además de existir como habilidad técnica** — "que esté en los 2 lados". Vuelve a 13 ítems. | Definición de Gael el 06/08/2026, revirtiendo la simplificación del Bloque C. Efecto conocido y aceptado: para sumar el ítem hay que cargar un idioma, y para eso hay que tildar la habilidad "Idiomas", que ocupa uno de los 6 cupos técnicos. |

---

## Deuda técnica encontrada (no estaba en el PDF)

**El flujo de "sugerir habilidad" está a medio desmantelar.** El backend está vivo
(`POST /skills/suggest` en `app/api/v1/skills.py:17`, `GET /admin/skills/pending` y
`PATCH /admin/skills/{id}` en `app/api/v1/admin.py:849-910`), pero la pantalla
`dashboard/admin/skills/` se eliminó en julio (Bloque D de `FASE1.5-FILTROS-PLAN.md`) y no está
en el menú. La notificación `admin_skill_suggested` sigue configurada
(`frontend/src/components/notifications/notification-config.ts:84`) y **apunta a
`/dashboard/admin/skills`, ruta inexistente → 404**.

Se elimina entero en el Bloque C: endpoint de sugerencia, endpoints de moderación, tipo de
notificación y su entrada de configuración. `SkillStatus` queda sin los estados `pending`,
`rejected` y `merged`, que sólo servían a este flujo.

---

## Bloque A — Bugs (causa raíz confirmada en código)

### A1 · No se despliegan habilidades — empresa y candidato
`backend/seed.py` siembra rubros, zonas y tipos de contrato: **nunca sembró una habilidad**.
`GET /skills` (`app/api/v1/skills.py:15`) filtra por `status == active` sobre una tabla vacía.
El desplegable no está roto — no hay nada que mostrar. Se resuelve junto con el Bloque C.

### A2 · CV: `HTTP 401` — RESUELTO
El archivo sube bien; Cloudinary se niega a **entregarlo**. Es el default de las cuentas nuevas
(entrega de PDF/ZIP restringida). Afecta por igual al admin ("ver cv"/"descargar cv"), al
candidato ("ver mi cv") y —esto no estaba en el PDF— a la **documentación de verificación de
empresas en PDF**, que sube por la misma función. **Es un solo bug, en tres pantallas.**

**Probado contra la cuenta real** (`scratchpad/probe_cloudinary*.py`, 06/08/2026):

| Vía | Resultado |
|-----|-----------|
| PDF público recién subido, URL de CDN | **401** ← descarta que sea culpa nuestra |
| URL de CDN **firmada** | **401** ← la restricción es a nivel cuenta, firmar no la esquiva |
| `private_download_url` (endpoint de descarga firmado) | **200** |

Dos conclusiones que cambiaron el plan:
1. El proxy que se había planeado **no habría funcionado**: nuestro propio backend también
   recibe 401 al pedir la URL de entrega. Había que ir por el endpoint de descarga.
2. **Ya no hace falta que Gael toque la consola de Cloudinary.** La vía firmada esquiva la
   restricción por completo.

Implementado: `signed_document_url()` en `app/integrations/cloudinary_client.py` genera un link
firmado que vence a los 5 minutos (`SIGNED_LINK_TTL_SECONDS`), y los PDF nuevos se suben como
`type="private"` para que nunca se entreguen por CDN aunque se habilite el PDF más adelante.
El tipo de entrega se deduce de la URL guardada (`_RAW_URL_RE`) en vez de agregar una columna:
los CV viejos son `upload` y los nuevos `private`, y firmar con el type equivocado da 404.

Tres endpoints nuevos, uno por rol, cada uno con su propio control de acceso:
`GET /me/candidate/cv/link`, `GET /me/company/candidates/{id}/cv/link` (reusa
`_assert_candidate_applied_to_company`) y `GET /admin/candidates/{id}/cv/link`. Devuelven JSON
`{url}` y no un 302, porque el frontend manda el token de Clerk por header con axios y un
`<a href>` no lo llevaría (helper `frontend/src/lib/cv.ts`).

**Verificado contra los CV reales**: los 13 CV cargados daban 401 con la URL guardada y los 13
devuelven 200 con el link firmado. No hubo que re-subir nada.

Efecto colateral buscado: el CV deja de ser accesible para cualquiera que tenga la URL. Antes
era un link público permanente a datos personales, y viajaba por mail y WhatsApp.

### A3 · "Ver perfil" del postulante → RESUELTO
`app/api/v1/applications.py:405-413`: el chequeo de acceso hace `scalar_one_or_none()` sobre un
`select(Application)` con JOIN que devuelve **una fila por postulación**. Si el mismo candidato
se postuló a dos búsquedas de la misma empresa, SQLAlchemy tira `MultipleResultsFound` → 500.
Talency tiene 2 búsquedas y candidatos de prueba en ambas.

✅ **Reproducido contra la base de producción** (06/08/2026, consulta de sólo lectura): hay
**2 pares candidato/empresa con 2 postulaciones cada uno**, los dos contra Talency. Uno es
`b39d752f-584b-431e-9a6b-453e175fabd0` — el mismo id que aparece en el nombre del PDF de la
captura del error que mandó Eugenia. Diagnóstico cerrado.

Fix: `.limit(1)` + `.first()`. El chequeo sólo necesita saber *si existe al menos una*.
Se extrajo a `_assert_candidate_applied_to_company()` porque ahora lo comparten el perfil
completo y el link al CV. Se auditó el resto del backend por el mismo patrón
(`scalar_one_or_none()` sobre un JOIN sin `limit`): el único otro caso filtra por PK y no puede
devolver dos filas.

### A4 · El admin no ve la descripción al aprobar
`frontend/src/app/dashboard/admin/busquedas/page.tsx` muestra título, empresa, badges, métricas
y postulantes — **nunca renderiza `description` ni `requirements`**. Sólo se ven entrando a
"Editar". Eugenia está aprobando a ciegas.

### A5 · La carga de foto "se tilda"
`app/api/v1/candidates.py:167` llama a `cloudinary.uploader.upload()`, que es **sincrónico,
dentro de un `async def`**: bloquea el event loop de FastAPI mientras dura la subida — o sea que
la API entera deja de responderle a todo el mundo, no sólo al que sube la foto. Suma que el tope
son 2 MB y una foto de celular pesa 4-6 MB.

Fix: `run_in_threadpool` en **las cinco** subidas, no dos — además de la foto y el CV del
candidato estaban el logo de la empresa y los dos caminos (PDF e imagen) de la documentación de
verificación, todos con el mismo bloqueo.

⏳ **Falta**: achicar la imagen en el navegador antes de mandarla. Sin eso el tope de 2 MB sigue
rebotando fotos de celular, que pesan 4-6 MB. Va con el Bloque B (perfil del candidato).

---

## Bloque B — Ajustes de flujo

### B1 · El aviso en un solo recuadro
Merge de `requirements` dentro de `description` (decisión 1). Toca modelo, schema, migración con
backfill, wizard de publicación, edición de la empresa, edición del admin, `JobPreviewPanel` y
`empleos/[id]/JobDetailClient.tsx`.

### B2 · Paso "Revisión": ver el aviso entero
`publicar/page.tsx:385` corta la descripción con `line-clamp-3` y no muestra requisitos.

### B3 · Estados de la postulación — de 5 a 7
`ApplicationStatus` (`app/models/job.py`) pasa a:

| Orden | Valor | Etiqueta | Antes |
|-------|-------|----------|-------|
| 1 | `new` | Nueva | Nueva |
| 2 | `seen` | Perfil revisado | Vista |
| 3 | `contacted` | Contactado | Contactado |
| 4 | `in_process` | En proceso | En proceso |
| 5 | `finalist` | Finalista | *(nuevo)* |
| 6 | `selected` | Seleccionado | *(nuevo)* |
| 7 | `discarded` | No avanza | Descartada |

La columna es `String(50)`, no un ENUM de Postgres: agregar valores **no necesita migración de
tipo**. Nada se pierde, los estados existentes se renombran. Hay que tocar las etiquetas en los
tres paneles (`company/types.ts:220`, `admin/types.ts:102`, `candidate/types.ts:129`) y las
notificaciones al candidato en `applications.py:447` — que pasan a cubrir **los 7 estados**
(decisión 5), no 3 como hoy.

### B4 · Sacar el % de perfil completo de la vista de empresa
Eugenia: *"la empresa puede pensar que es el % de ajuste a la posición y en realidad se trata de
cuán completo está el perfil del candidato"*. Se saca el anillo de la lista de postulaciones y
del modal de la empresa. **Se mantiene en el panel de admin** (Talency sabe qué mide) y en el
panel del candidato, donde es el motivador para completar el perfil.

### B5 · Fechas
`type="date"` sin `max` en todo el perfil del candidato. Se agrega tope, y el check
**"Trabajo actualmente acá"** en Experiencia (Educación ya tiene "en curso").

---

## Bloque C — Habilidades

Catálogo nuevo con las 16 blandas y las ~30 técnicas de las páginas 7-8 del PDF.

- Migración: `Skill.category` (`soft` / `technical`) + seed del catálogo.
- Tope de **6 blandas y 6 técnicas**, validado en el backend (el frontend solo no alcanza).
- Se elimina `CandidateSkill.level` (decisión 2) y todo el flujo de sugerencias (decisión 7).
- **"Idiomas"** es una habilidad técnica que abre el selector de idioma + nivel (decisión 6).
  Los datos siguen yendo a la tabla `languages`.
- **"Otra"** es texto libre con límite de caracteres, en el perfil del candidato.
- Impacta `compute_profile_completion` (`app/services/profile_completion.py`): hoy el ítem
  "Habilidades" se cumple con una sola habilidad, y el ítem "Idiomas" es independiente — con
  idiomas metido adentro de las técnicas hay que redefinir los dos.

---

## Bloque D — Estadísticas

Referencia: capturas de Bumeran en las páginas 3-4. Hoy existe un panel mínimo
(`app/services/applicant_stats.py`: edad promedio, experiencia promedio, distribución de
títulos, movilidad). Para el candidato **no existe nada**.

- **Empresa**: cantidad de postulaciones, salario pretendido promedio, edad (dona), años de
  experiencia (barras), nivel educativo con graduado/en curso/abandonado (barras), habilidades
  más frecuentes entre los postulados (donas de %).
- **Candidato**: los mismos gráficos, resaltando su franja con otro color — **sólo contra los
  postulantes de esa vacante**, nunca contra todo el portal.
- **Home**: gráficos públicos, apagados por defecto.
- **Interruptores en el panel de Talency** (decisión 11): Eugenia ve todo siempre desde su panel
  y decide qué se publica. Se extiende el patrón que ya existe para los indicadores de la landing
  (`app/models/landing.py`, con su flag `visible` y su pantalla en `dashboard/admin/indicadores`).

Sin librería de gráficos: son barras y donas, se hacen en SVG con la paleta del sitio. No
justifica sumar una dependencia al bundle.

---

## Bloque E — Destacar

**No hay nada roto en la lógica.** La empresa tilda la opción, paga por Mercado Pago, el webhook
(`app/api/v1/webhooks.py:64`) marca `is_featured` y el listado público ya ordena
`is_featured` primero (`app/api/v1/jobs.py:206`) — o sea que **ya queda fijado arriba**, que es
justo lo que pide. El destacado dura lo mismo que la búsqueda (`ends_at = job.expires_at`, no un
timer propio).

Falta:
- **Destacado manual desde el admin** (decisión 12), sin pago asociado.
- **Integración final de Mercado Pago**: hoy sigue en **sandbox** (confirmado por Gael el
  06/08/2026). Con `MP_ACCESS_TOKEN` de sandbox, `create_preference` devuelve una URL mock y
  **no se le acredita a nadie**. Requiere credenciales productivas de Talency.

---

## Pendiente de definición

Nada. Los tres puntos que estaban abiertos (nombres de estado que ve el candidato, fecha de
egreso futura y edad mínima) se resolvieron el 06/08/2026 — ver decisiones 13, 14 y 15.

Lo único bloqueado por un tercero son las **credenciales productivas de Mercado Pago**
(bloque E), que dependen de Talency.
