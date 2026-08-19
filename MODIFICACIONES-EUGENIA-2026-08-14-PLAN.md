# Modificaciones Eugenia — 14/08/2026

> Plan de los 12 puntos de `bbjobs2.pdf` (recibido el 14/08/2026).
> Cubre lo que quedó **después** de `MODIFICACIONES-EUGENIA-PLAN.md` (tanda del 06/08).
>
> Registro técnico: causa raíz de cada cosa con archivo y línea, qué se toca y por qué.
> La versión sin jerga para Eugenia se escribe recién cuando esté deployado y verificado.

## Estado de implementación (14/08/2026)

- [x] **Bloque A** — código listo: `moderate_job` reversible + `PATCH /admin/jobs/{id}/reopen`,
      panel de admin mostrando los dos estados con el botón de reabrir; `require_company` sin
      exigir verificación para publicar/editar (postulantes/CV siguen exigiéndola); endpoints
      de borrado para mensajes de contacto y notificaciones, con su UI.
      **Sin probar contra datos reales.** Falta correr la app localmente contra la base y
      confirmar en el navegador — no se levantó el `npm run dev` / `uvicorn` en esta sesión.
      **La limpieza de los mensajes lorem ipsum en producción NO se hizo** — son filas reales
      en la base de Railway (ver `.env`: `DATABASE_URL` apunta directo ahí, no hay staging
      separado) y borrar datos de producción sin mirarlos primero no correspondía hacerlo solo.
      Con el botón de borrar ya construido, se puede hacer desde el panel cuando se verifique.
- [x] **Bloque B** — código listo: B1 (perfil de empresa completo), B2 (`/admin/market-stats`
      con mediana), B3 (`photo_url` en los schemas y las 5 pantallas que muestran candidatos),
      B4 (filtro por posición/experiencia, con fix de paso al fusionar tramos de experiencia
      superpuestos en `applicant_stats.py` — afecta también los gráficos existentes, en el buen
      sentido), B5 (`PanelEstadisticas` + selector de búsqueda en `company/estadisticas`).
      **Sin probar contra datos reales**, mismo motivo que arriba.
- [ ] **Bloque C (hero)** — no se tocó. Necesita la foto real y la decisión de Eugenia entre
      las dos maquetas; no hay nada que programar todavía.
- [ ] **P1/P2/P3 (Industria-Sector, Base de Talento, credenciales MP)** — pendientes,
      dependen de que Eugenia responda. Ver la sección "Lo que hay que preguntarle" al final.

**Verificado sin levantar servidor**: `tsc --noEmit` y `eslint` del frontend limpios (0
errores); el backend importa sin `NameError` y genera el schema OpenAPI completo con las 4
rutas nuevas registradas. Eso confirma que el código es válido — no reemplaza probarlo en el
navegador.

**Migración**: ninguna nueva. La cadena `f1a4c7e2b9d8` → `c3e7b1d5a92f` → `a8d2f6c1e534` de la
tanda del 06/08 sigue sin aplicarse a producción — no se tocó hoy, sigue siendo un bloqueante
para cerrar *esa* tanda, no ésta.

Cabeza de migraciones al arrancar: **`a8d2f6c1e534`**. Sigue sin aplicarse a producción
la cadena `f1a4c7e2b9d8` → `c3e7b1d5a92f` → `a8d2f6c1e534` de la tanda del 06/08 — eso
se arrastra y hay que resolverlo antes o junto con esta tanda.

---

## Los 12 puntos, clasificados

| # | Pedido | Tipo | Bloque |
|---|--------|------|--------|
| 1 | "Ver perfil" de la empresa muestra casi nada | Datos que existen y no se muestran | B |
| 2 | Publicar búsqueda sin esperar la verificación | Cambio de flujo | **A** |
| 3 | ¿Dónde veo el salario promedio que ofrecen las empresas? | Existe a medias, sin pantalla | B |
| 4 | Búsqueda de cocina: aprobada pero no visible, sin salida | **Bug con callejón sin salida** | **A** |
| 5 | Foto del puerto / polo petroquímico en el hero | Opinión + diseño | C |
| 6 | "Estos msj son de prueba?" | Datos basura en producción | **A** |
| 7 | Foto del candidato visible para la empresa | Dato que existe y no se expone | B |
| 8 | Filtrar postulantes por posición o experiencia | Falta filtro | B |
| 9 | Estadísticas de empresa con los mismos gráficos | Existe, está en otra pantalla | B |
| 10 | Industria → Sector | **Ambiguo — se le pregunta a Eugenia** | — |
| 11 | Acceso de la empresa a la base de candidatos | **Pendiente — no se construye ahora** | — |
| 12 | Qué falta para cerrar Mercado Pago | Respuesta, no desarrollo | — |

---

## Decisiones tomadas (14/08/2026)

| # | Tema | Decisión | Por qué |
|---|------|----------|---------|
| 1 | Alcance de "publicar sin verificar" (punto 2) | La empresa sin verificar **publica y edita búsquedas**, y Eugenia las modera. **No** ve la lista de postulantes, ni el CV, ni el perfil del candidato hasta estar verificada. | Resuelve el problema real que plantea ("el tipo se enfría y sube la búsqueda a otro lado") sin entregarle datos personales a un CUIT que nadie comprobó todavía. El CV es el activo sensible, no el aviso. |
| 2 | Industria / Sector (punto 10) | **Se le pregunta a Eugenia antes de tocar nada.** Ver "Pendiente de definición". | La frase admite dos lecturas incompatibles y una de las dos implica un catálogo nuevo y una migración. Adivinar sale más caro que una pregunta. |
| 3 | Base de Talento para empresas (punto 11) | **Pendiente.** Se le responde qué existe hoy y qué falta; no se construye en esta tanda. | Es una funcionalidad nueva completa (buscador, filtros, control de acceso y una decisión de precio), no un ajuste. |
| 4 | Mensajes de prueba (punto 6) | Se borran de la base y **se agrega la forma de borrarlos desde el panel**, que hoy no existe. | Hoy un mensaje sólo se puede marcar "resuelto"; nunca desaparece. Con el portal ya en manos de Eugenia va a volver a pasar. |

---

# BLOQUE A — Lo que la está bloqueando ahora

## A1 · La búsqueda de cocina: aprobada pero invisible, y sin forma de arreglarlo

**Lo que ella ve:** rechazó sin querer una búsqueda, quiso arreglarlo, figura "Aprobada"
y no aparece en el portal. No sabe qué hacer. Tiene razón: **hoy no hay nada que pueda hacer.**

**Lo primero, que es un malentendido:** el "No visible" de la captura **no habla de la
búsqueda**. Es la tarjeta de *Salario*
(`frontend/src/app/dashboard/admin/busquedas/page.tsx:525-527`): dice que la empresa eligió
no mostrar el sueldo en el aviso. No tiene nada que ver con que el aviso se publique.

**Lo segundo, que es el bug de verdad.** Una búsqueda tiene **dos estados independientes**:

- `moderation_status` — la moderación de Talency: `pending_review` / `approved` / `rejected`.
- `status` — el ciclo de vida del aviso: `draft` / `active` / `paused` / `closed` / `expired`.

Para salir en el portal público hacen falta **los dos**
(`backend/app/api/v1/jobs.py:191-195`: `status == active` **y** `moderation_status == approved`).
Y el panel de admin **sólo muestra el primero**
(`busquedas/page.tsx:331-332`, badge "Aprobada"). O sea: el panel le está mostrando media
verdad. El aviso está aprobado y apagado al mismo tiempo, y la pantalla sólo le cuenta la
mitad buena.

**Los dos callejones sin salida**, los dos reales y confirmados en código:

| Callejón | Dónde | Qué pasa |
|---|---|---|
| Rechazar es irreversible | `backend/app/api/v1/admin.py:769-770` | `moderate_job` corta con `400 "La búsqueda ya fue revisada"` si `moderation_status != pending_review`. Una vez rechazada, **nunca más** se puede aprobar. El frontend además esconde los botones (`busquedas/page.tsx:437`), así que ni siquiera se ve el intento. |
| Dar de baja es irreversible | `admin.py:410-427` + `backend/app/services/job_status.py:8-13` | `takedown_job` pone `status = closed`. `closed` es **terminal** en la máquina de estados: no es clave del diccionario de transiciones, así que ni la empresa ni el admin pueden reactivarla. Y `update_job_admin` (`admin.py:835-839`) rechaza explícitamente cualquier cambio de estado. |

La captura (badge "Aprobada" + no sale en el portal) encaja con el **segundo**: el aviso
quedó `closed`, por baja del admin o porque la empresa lo pausó/cerró.

### Qué se hace

1. **Permitir revisar de nuevo.** `moderate_job` deja de exigir `pending_review`: pasa a
   aceptar aprobar una rechazada y rechazar una aprobada, registrando el cambio en
   `audit_logs` (ya se registra) y notificando a la empresa. Es el caso de uso literal que
   describe: se equivocó y quiere corregir.
2. **Poder reactivar una búsqueda dada de baja.** Endpoint nuevo
   `PATCH /admin/jobs/{id}/reopen`: `closed` → `active`, limpiando `closed_at` y recalculando
   `expires_at` contra `published_at`. Si ya venció el plazo, se le ofrece extenderlo en vez de
   revivir un aviso vencido. Sólo admin — la empresa sigue sin poder salir de `closed`, que es
   la regla de producto y está bien.
3. **Mostrar los dos estados en el panel.** El badge de moderación queda, y al lado va el
   estado del aviso (Activa / Pausada / Dada de baja / Vencida). Cuando los dos no coinciden
   con "visible en el portal", una línea que lo diga en castellano: *"Aprobada, pero no se ve
   en el portal porque está dada de baja"*, con el botón que lo arregla.
4. **Verificar contra la base cuál es el caso real** de la búsqueda de cocina, con una
   consulta de sólo lectura (`status`, `moderation_status`, `expires_at`, `deleted_at`), antes
   de tocar el registro. Los dos arreglos van igual: los dos callejones existen sin importar
   cuál pisó ella.

**Migración:** ninguna. **Riesgo:** bajo — se agregan transiciones, no se sacan.

---

## A2 · Publicar sin esperar la verificación

**Lo que pidió:** que una empresa sin verificar pueda subir la búsqueda; ella después mira y
aprueba (o no) la publicación **y** la verificación.

**Cómo está hoy:** `require_verified_company` (`backend/app/api/deps.py:74-87`) tira `403` si
`verification_status != verified`, y está puesto en **15 endpoints**:

| Archivo | Líneas | Qué protege |
|---|---|---|
| `jobs.py` | 67, 119, 131 | crear, listar y editar búsquedas |
| `applications.py` | 215, 283, 299, 431, 452, 467 | postulantes, estadísticas, CV, perfil, cambio de estado |
| `payments.py` | 28, 85, 119 | destacar y su historial |
| `subscriptions.py` | 14 | plan de la empresa |

El frontend además tapa el wizard entero (`company/publicar/page.tsx:135,155`).

### Qué se hace (según la decisión 1)

- **Se libera:** `jobs.py:67,119,131` — crear, listar y editar sus propias búsquedas. Pasan a
  usar una dependencia nueva `require_company` (misma búsqueda del perfil, sin el chequeo de
  verificación).
- **Sigue cerrado:** todo `applications.py` y `payments.py`. Una empresa sin verificar publica,
  recibe postulaciones y ve **cuántas** son, pero no abre ninguna hasta estar verificada.
- **La búsqueda de una empresa sin verificar es moderable.** Eugenia la ve en su panel con un
  cartel claro — *"Empresa sin verificar"* con acceso directo a la ficha — y decide. Si la
  aprueba, sale al portal. Es exactamente lo que pidió: ella ve todo y aprueba.
- **El wizard se abre**, y arriba queda un aviso: *"Podés publicar ahora. Para ver los datos de
  quienes se postulen necesitás la verificación —* pedila acá *."* Con el link a
  verificación. Es el gancho para que completen el trámite.
- **Notificaciones nuevas** para que ella no dependa de estar frente a la PC: cuando una
  empresa sin verificar publica, le entra el aviso de moderación **y** el de verificación
  pendiente juntos, no por separado.
- **Se revisa el estado inicial del aviso.** Hoy nace `status=active` + `pending_review`
  (`jobs.py:86,91`), así que el cambio no altera el ciclo de vida — sólo quién puede llegar
  a crearlo.

**Migración:** ninguna. **Riesgo:** medio. Es el punto que más hay que probar: una empresa sin
verificar tiene que poder publicar y **fallar con un mensaje claro** (no un 403 pelado) al
intentar abrir un postulante. Hay que revisar los mensajes de error del frontend en las tres
pantallas que consumen `applications.py`.

---

## A3 · Los mensajes de prueba

**Respuesta corta: sí, son de prueba.** "Sit quas libero nost", "Optio similique in",
"Et nihil non dolores" es texto de relleno latino — nadie escribió eso. Quedaron de una carga
de prueba anterior; no hay ningún generador de datos falsos en el código
(no hay `faker` ni nada parecido en el repo), así que son **filas en la base de producción**,
no algo que se regenere solo.

**El problema de fondo:** hoy no hay forma de borrarlos.

- `backend/app/api/v1/contact.py` tiene **un solo endpoint**: `POST /contact`. Del lado admin
  sólo se puede *listar* y *marcar resuelto* — nunca borrar.
- `backend/app/api/v1/notifications.py` tampoco tiene borrado: sólo marcar leída
  (líneas 60, 85). Las tres notificaciones de la captura se quedan ahí para siempre.

### Qué se hace

1. **Borrar las filas de prueba** de `contact_messages` y sus notificaciones, en producción,
   con la consulta acotada a esos registros y previa lista de lo que se va a borrar. Se le
   muestra a Gael antes de ejecutar.
2. `DELETE /admin/contact-messages/{id}` + botón de borrar en
   `frontend/src/app/dashboard/admin/mensajes/page.tsx`, con confirmación. Borrado real, no
   lógico: un mensaje de contacto spam no tiene por qué quedar archivado.
3. `DELETE /me/notifications/{id}` + descartar una notificación desde la campanita. Es lo que
   ella intuitivamente buscó y no encontró.

**Migración:** ninguna. **Riesgo:** bajo, pero el borrado en producción se hace con la lista
a la vista, no a ciegas.

---

# BLOQUE B — Lo que le falta ver

## B1 · "Ver perfil" de la empresa muestra casi nada

**Lo que pidió:** nombre de la persona, **puesto que ocupa en la empresa**, y la info que se
le pide completar al inicio.

**Causa raíz:** los datos **están cargados**. El formulario de alta los pide todos
(`backend/app/schemas/onboarding.py:14-25`) y el modelo los guarda
(`backend/app/models/company.py:29-32`): `province`, `city`, `employee_count`,
`responsible_position`. Lo que falla es el schema con el que el admin lee la empresa:
**`CompanyAdminResponse` (`backend/app/api/v1/admin.py:55-73`) no los incluye.** Nunca salen
del backend, así que el modal no tiene qué mostrar aunque quisiera. Y `industry_id` sale como
UUID crudo, sin el nombre del rubro.

Comparación, para que se vea el agujero:

| Campo | Se pide al inicio | Se guarda | Lo ve el admin |
|---|---|---|---|
| Razón social, CUIT | ✅ | ✅ | ✅ |
| Responsable: nombre, mail, teléfono | ✅ | ✅ | ✅ |
| **Puesto del responsable** | ✅ | ✅ | ❌ |
| **Provincia / Ciudad** | ✅ | ✅ | ❌ |
| **Cantidad de empleados** | ✅ | ✅ | ❌ |
| **Rubro (nombre)** | ✅ | ✅ | ❌ (sale el UUID) |
| Descripción, sitio web, logo | ✅ | ✅ | ✅ |

### Qué se hace

1. Agregar a `CompanyAdminResponse`: `responsible_position`, `province`, `city`,
   `employee_count`, y `industry_name` resuelto con un JOIN contra `industries` (no el UUID).
2. Renderizar en el modal (`frontend/src/app/dashboard/admin/empresas/page.tsx:427-470`):
   el puesto debajo del nombre en el bloque "Responsable"; una sección "Datos de la empresa"
   con rubro, ubicación y tamaño.
3. Agregar la **fecha de alta** (`created_at`, ya está en el modelo) y, si está pendiente,
   **cuánto hace que espera** — es el dato que le dice a quién atender primero.
4. Los campos vacíos se muestran como "Sin completar" y no en blanco: si la empresa no lo
   cargó, ella tiene que poder verlo para reclamarlo.

**Migración:** ninguna. **Riesgo:** bajo.

---

## B2 · El salario promedio que ofrecen las empresas

**Lo que preguntó:** *"Si yo desde mi usuario quiero ver el salario promedio que están
ofreciendo las empresas hoy, ¿dónde lo veo?"*

**Respuesta hoy: en ningún lado desde su panel.** El cálculo **existe** —
`GET /public/market-stats` (`backend/app/api/v1/landing.py:244-302`) saca el promedio del punto
medio de la banda salarial de las búsquedas activas y aprobadas, más el corte por rubro y por
modalidad. Pero:

1. Sale **sólo en la home pública** (`frontend/src/components/stats/MercadoLaboral.tsx`).
2. Está **apagado por defecto** — depende del interruptor `stats_visibles_en_landing`, que ella
   misma controla desde Indicadores. Si está apagado, el endpoint devuelve `visible: false` y
   ni siquiera calcula.
3. Cuenta **sólo los avisos donde la empresa eligió mostrar el sueldo** (`salary_visible == True`,
   `landing.py:272`). Ese filtro está bien para el número público — no se puede filtrar un
   sueldo que la empresa decidió no publicar — pero para el uso interno de Talency deja afuera
   justo los avisos más interesantes.

O sea: hay dos números distintos y hoy sólo existe el que menos le sirve.

### Qué se hace

- `GET /admin/market-stats`: **sin** el interruptor y **sin** el filtro `salary_visible`.
  Devuelve promedio, mediana, mínimo y máximo del mercado, la cantidad de búsquedas que
  declaran sueldo sobre el total, y el corte por rubro. Es la foto real, para ella.
- Se muestra en `dashboard/admin/estadisticas`, junto a un recordatorio de cuál de los dos
  números está publicado en la home y su interruptor.
- **Mediana además del promedio**: con pocas búsquedas, un aviso con un sueldo alto le mueve el
  promedio entero. La mediana no.
- Se marca explícito **sobre cuántos avisos** está calculado. Un promedio sobre 3 búsquedas no
  es un dato de mercado y ella tiene que verlo en la misma pantalla, no deducirlo.

**Migración:** ninguna. **Riesgo:** bajo — endpoint nuevo, no toca el público.

---

## B3 · La foto del candidato

**Lo que preguntó:** *"¿En algún momento se le pide que suba la foto?"* y que la empresa la
vea al lado del nombre.

**Respuesta: sí, se le pide, y ya la están subiendo.** El campo existe
(`backend/app/models/candidate.py:39`), se sube desde el perfil
(`POST /me/candidate/photo`, `frontend/src/app/dashboard/candidate/perfil/page.tsx:203-214`) y
**cuenta para el % de perfil completo** (paso "Datos personales",
`perfil/page.tsx:79`). O sea que hay fotos cargadas.

**El problema es que la empresa nunca las recibe.** Los dos schemas por los que la empresa lee
al candidato **no incluyen `photo_url`**:

- `CandidateSummary` (`backend/app/api/v1/applications.py:53-63`) — la lista de postulantes.
- `CandidateFullProfile` (`backend/app/schemas/candidate.py:228-248`) — el modal "Perfil del
  candidato", exactamente el de su captura.

Por eso al lado de "JUAN MANUEL CAPPELLA" hay un anillo con el porcentaje y no una cara.

### Qué se hace

1. Agregar `photo_url` a los dos schemas.
2. **Modal de la empresa**: la foto reemplaza al círculo del %. Sin foto, iniciales sobre el
   celeste de la paleta (`#E6F4F7`), nunca un ícono genérico.
3. **Lista de postulantes**: avatar chico a la izquierda del nombre, mismo criterio de fallback.
4. **Panel de admin**: lo mismo en la lista de candidatos y en `CandidateProfileModal.tsx`.
5. **Empujar la carga**: en el panel del candidato, si le falta la foto, un aviso corto que
   diga por qué conviene — *"Los perfiles con foto reciben más contactos"*. No obligatoria:
   pedir foto para postularse es una barrera y además invita a filtrar por lo que no se debe.

**Migración:** ninguna — la columna ya existe.
**Riesgo:** bajo. **Nota**: sumar foto a la vista de la empresa facilita el sesgo por apariencia.
No es motivo para no hacerlo (lo pidió y es estándar en el rubro), pero conviene que la foto
la controle el candidato y sea opcional, que es como queda.

---

## B4 · Filtrar postulantes por posición o experiencia

**Lo que hay hoy** (`backend/app/api/v1/applications.py:206-244`), y coincide con su captura:
edad mín./máx., sexo, movilidad, disponibilidad, disponibilidad inmediata.

**Lo que falta:** los dos que pide.

### Qué se hace

- **Años de experiencia** — `experience_min` / `experience_max`. Se calcula sumando los tramos
  de `work_experiences` del candidato. Ojo con el detalle: los tramos **se superponen** (dos
  trabajos a la vez), así que hay que sumar el rango *unido*, no la suma cruda de duraciones —
  si no, alguien con dos empleos simultáneos figura con el doble de experiencia. Se resuelve
  en el servicio, no en SQL, para que sea legible y testeable.
- **Posición** — texto libre contra `work_experiences.role_title`, con `ILIKE`, sin distinguir
  mayúsculas ni acentos. Buscar "comercial" tiene que encontrar "Ejecutivo Comercial" y
  "Vendedor comercial".
- Se agregan los dos controles a la barra de filtros de
  `frontend/src/app/dashboard/company/postulaciones/page.tsx`, con el mismo estilo de los que
  ya están, y **un contador de resultados** — hoy filtrás y no sabés si el filtro hizo algo.
- Mismos filtros en el panel de admin, que mira la misma lista.

**Migración:** ninguna. Conviene un índice sobre `work_experiences.candidate_id` si no está —
se verifica al implementar.
**Riesgo:** medio en el cálculo de experiencia. Es donde hay que probar con datos reales.

---

## B5 · Estadísticas de la empresa

**Lo que pidió:** que como empresa vea en Estadísticas los mismos gráficos que ve el candidato,
por posición: edad en franjas, educación, años de experiencia.

**Y acá la buena noticia: los gráficos ya están construidos.** Salieron en la tanda del 06/08
(`frontend/src/components/stats/PanelEstadisticas.tsx`) y ya se muestran en cuatro lugares:

| Pantalla | Archivo |
|---|---|
| Postulaciones de la empresa | `dashboard/company/postulaciones/page.tsx:218` |
| Postulaciones del candidato | `dashboard/candidate/postulaciones/page.tsx:139` |
| Búsquedas del admin | `dashboard/admin/busquedas/page.tsx:564` |
| Indicadores del admin | `components/dashboard/PanelIndicadoresAdmin.tsx:90` |

**En la única pantalla donde faltan es en la que se llama "Estadísticas".**
`dashboard/company/estadisticas/page.tsx` trae los datos (`/me/company/applications/stats`,
línea 34) y **no los grafica**: muestra contadores de búsquedas y estados de postulación.
Ella fue al lugar que lleva el nombre correcto y encontró otra cosa. Es un problema de dónde
está puesto, no de qué falta.

### Qué se hace

1. Poner `PanelEstadisticas` en `company/estadisticas`, que es donde lo buscó.
2. **Selector de búsqueda arriba**, con "Todas mis búsquedas" como opción por defecto. Así ve
   el agregado de su empresa y puede bajar a "Desarrollador/a Comercial" — que es el ejemplo
   textual que da. El endpoint por aviso ya existe (`/me/company/jobs/{id}/applications/stats`,
   `applications.py:279`).
3. Dejar en Postulaciones el acceso que ya está: quien lo conoce ahí no lo pierde.
4. Que diga **sobre cuántos postulantes** está armado cada gráfico. Un gráfico de edades sobre
   4 personas es engañoso y tiene que verse en la misma tarjeta.

**Migración:** ninguna. **Riesgo:** bajo — se reutiliza un componente probado.

---

# BLOQUE C — Diseño

## C1 · La foto del puerto o del polo en el hero

**Lo que preguntó:** *"Pensé que al abrir el portal cuando salta el título tal vez quedaría
bien una foto del puerto de Bahía o del polo petroquímico, ¿qué opinás?"*

**Cómo está hoy:** el hero (`frontend/src/app/page.tsx:188-225`) es un fondo limpio —
degradé, grilla de puntos y un halo— con el título y el buscador encima. No hay ninguna foto
en `frontend/public/` fuera del logo y el OG.

**Mi opinión, y es que sí — con dos condiciones.**

A favor: es un portal *de Bahía Blanca*, y ese es todo el argumento de venta contra Bumeran y
Computrabajo. Una foto del puerto dice "esto es de acá" antes de que nadie lea una palabra.
Ninguna cantidad de copy hace eso.

Las dos condiciones:

1. **El buscador no puede perder contraste.** Es el elemento con el que se gana o se pierde
   la visita. La foto va con un velo oscuro y el texto en blanco, o va lateral con el buscador
   sobre fondo plano. Nunca texto oscuro sobre una foto clara: en un celular al sol no se lee.
2. **Foto propia o con licencia clara, y del puerto, no del polo.** El puerto es la ciudad;
   el polo petroquímico es una industria — y una con la que no todo el mundo en Bahía tiene
   la misma relación. Una foto de chimeneas en la portada de un portal de empleo carga un
   mensaje que no querés discutir. El puerto, la ría o el skyline al atardecer dicen lo mismo
   sin el ruido.

**Qué se hace:** dos maquetas para que elija — foto a ancho completo con velo, y foto lateral
con el buscador sobre plano. Peso optimizado (WebP, `next/image`, `priority`) y versión
vertical para celular. Es la decisión de ella; se le muestran las dos.

**Migración:** ninguna. **Riesgo:** ninguno, salvo el peso de la imagen — que se mide antes de
subirla, no después.

---

# Pendiente de definición

## P1 · Industria → Sector (punto 10) — **hay que preguntarle a Eugenia**

Escribió: *"agregaría Industria y el título que dice industria lo cambiaría por sector"*.
Se puede leer de dos maneras y no son compatibles.

**Lectura A — la más probable.** El desplegable tiene hoy 10 opciones
(`backend/seed.py:33-36`): Tecnología, Comercio, Salud, Educación, Construcción, Gastronomía,
Administración, Marketing, Recursos Humanos, Logística — más "Otro". **No está "Industria"**,
que en Bahía Blanca es de los rubros que más emplea. Entonces: agregar "Industria" como
opción, y renombrar el campo a "Sector" — porque no podés tener una opción llamada "Industria"
dentro de un campo llamado "Industria". Se explica solo, y encaja con que en el mismo documento
mencione el polo petroquímico.
*Costo:* bajo. Migración que suma una fila al catálogo (siguiendo el patrón de
`f1a4c7e2b9d8`, no `seed.py`, que no corre en producción) y cambio de la etiqueta en todas
las pantallas donde aparece — wizard, alta de empresa, filtros de `/empleos`, panel de admin.
La tabla sigue llamándose `industries`: es sólo el texto que ve el usuario.

**Lectura B.** Son dos campos distintos: "Sector" (área funcional: Administración, Comercio…)
e "Industria" (rubro de la empresa: Petroquímica, Agro, Portuaria…). Más preciso para filtrar.
*Costo:* alto. Columna nueva, migración con backfill, catálogo nuevo que hay que definir desde
cero, un paso más en el wizard y un filtro más en la búsqueda pública.

**Pregunta concreta para ella:** *"¿'Industria' es una opción más de la lista (junto a Comercio,
Salud, Construcción), o es un campo aparte del sector?"*

Hasta que responda, no se toca. Si contesta A, entra sin problema en la tanda.

---

## P2 · Base de Talento para empresas (punto 11) — **pendiente, no se construye ahora**

**Lo que preguntó:** *"Si una empresa quiere acceder a la base de datos de candidatos general,
¿cómo debiera hacer?"*

**Cómo está hoy: la mitad difícil está hecha, la mitad visible no existe.**

Lo que **sí** está construido y funcionando:

- El candidato da (o niega) su consentimiento explícito para aparecer en la Base de Talento,
  desde el registro (`backend/app/api/v1/onboarding.py:76-86`) o desde su panel
  (`candidates.py:88-129`, con el aviso en `dashboard/candidate/page.tsx:72-85`).
- Se guarda **con fecha**: `visible_in_talent_pool`, `talent_pool_asked_at`,
  `talent_pool_decided_at` (`backend/app/models/candidate.py:65-71`).
- Queda **rastro auditable** de cada cambio de decisión (evento `talent_pool_consent`).
- El default es **no aparecer**, y la casilla viene destildada.

Lo que **no** existe: ningún endpoint ni pantalla que consulte esa base. Hoy nadie puede verla
—ni una empresa, ni Talency—. El consentimiento se está juntando y no se está usando.

Eso es deliberado: la parte legalmente delicada (consentimiento con fecha y rastro) se dejó
lista para que el día que se construya el buscador no haya que ir a pedirle permiso a nadie
retroactivamente.

**Lo que falta**, si se decide hacerlo: buscador con filtros para la empresa, control de acceso
(¿qué empresa puede? ¿toda verificada, o sólo con plan pago?), qué se ve de un candidato al que
no le postuló nada (¿nombre y contacto, o perfil ciego hasta que la empresa pida contacto?),
y el registro de quién miró a quién.

**Qué se hace ahora:** se le responde eso, con las preguntas de producto arriba de la mesa, y
se cotiza aparte. No entra en esta tanda.

---

## P3 · Mercado Pago (punto 12) — **falta una sola cosa, y no depende de nosotros**

**Lo que preguntó:** *"¿Qué me falta para terminar de cerrar lo de Mercado Pago?"*

**El código está entero.** Lo verificado:

| Pieza | Dónde | Estado |
|---|---|---|
| Crear la preferencia de pago | `backend/app/integrations/mercado_pago.py:14-42` | ✅ |
| Checkout de la empresa | `payments.py:25-80` + `company/estadisticas/page.tsx:44-53` | ✅ |
| Webhook que acredita el pago | `webhooks.py:21-105` | ✅ |
| Firma HMAC del webhook verificada | `mercado_pago.py:46-92` | ✅ |
| El destacado se activa solo al acreditarse | `webhooks.py:58-67` | ✅ |
| Bloqueo de pagos duplicados | `payments.py:41-50` + índice único `e9f2a6c4b8d1` | ✅ |
| Notificación a Talency de cada cobro | `webhooks.py:96-98` | ✅ |
| Destacado manual sin cobrar, para canjes | `admin.py:1035` | ✅ |
| **Credenciales productivas de Talency** | `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` | ❌ **Falta** |

Sigue en **sandbox**. Con las credenciales de prueba, `create_preference` devuelve una URL
simulada (`mercado_pago.py:17-19`) y **no se le acredita plata a nadie**. Eso es exactamente
lo que falta y es todo lo que falta.

**Lo que Talency tiene que hacer** — tres pasos, ninguno técnico:

1. Entrar a la cuenta de Mercado Pago **de Talency** (la que va a cobrar) y crear una
   aplicación en el panel de desarrolladores.
2. Copiar las credenciales **de producción** (Access Token y Public Key) — no las de prueba.
3. Configurar la URL de notificaciones
   (`https://api.bbjobs.com.ar/api/v1/webhooks/mercado-pago`) y copiar la clave secreta que
   MP genera para firmar los avisos.

   > ⚠️ **Corregido el 18/08/2026.** Este documento decía
   > `https://bbjobs.com.ar/api/v1/webhooks/mercadopago`, y estaba mal por partida doble: el
   > host es `api.bbjobs.com.ar` (Railway; `bbjobs.com.ar` es el frontend en Vercel y no
   > tiene la API) y la ruta real lleva guion — `webhooks/mercado-pago`
   > (`backend/app/api/v1/webhooks.py:152`). Con la URL de este documento MP habría mandado
   > todos los avisos a un 404 y ningún pago se habría acreditado nunca. La URL correcta ya
   > estaba bien en `DEPLOY-PLAN.md:515`.

Las tres cosas se cargan como variables de entorno y **no hay que tocar una línea de código**.

**Después de cargarlas, del lado nuestro:** una prueba real de punta a punta con un monto
mínimo — destacar una búsqueda, pagar de verdad, confirmar que llega el webhook, que se
acredita, que el aviso queda destacado y que aparece en el panel de Pagos. Es media hora, pero
hay que hacerla: nunca se probó contra la cuenta real.

**Además hay que definir el precio.** Está fijo en el código
(`FEATURED_JOB_PRICE`, `backend/app/schemas/payment.py`). Si Talency lo quiere cambiar sin
depender de un deploy, se vuelve configurable desde el panel — decidilo con ella; no es
grande, pero es trabajo aparte.

---

# Resumen de lo que se toca

## Backend

| Archivo | Cambio | Punto |
|---|---|---|
| `api/deps.py` | `require_company` nueva, sin chequeo de verificación | A2 |
| `api/v1/jobs.py` | 3 endpoints pasan a `require_company` | A2 |
| `api/v1/admin.py` | `moderate_job` reversible; `reopen_job` nueva; `CompanyAdminResponse` completo; `market-stats` de admin; `DELETE /admin/contact-messages/{id}` | A1, A3, B1, B2 |
| `api/v1/applications.py` | `photo_url` en `CandidateSummary`; filtros de experiencia y posición | B3, B4 |
| `api/v1/notifications.py` | `DELETE /me/notifications/{id}` | A3 |
| `schemas/candidate.py` | `photo_url` en `CandidateFullProfile` | B3 |
| `services/` | cálculo de años de experiencia con tramos superpuestos | B4 |

## Frontend

| Archivo | Cambio | Punto |
|---|---|---|
| `admin/busquedas/page.tsx` | mostrar los dos estados + reactivar + re-moderar | A1 |
| `admin/empresas/page.tsx` | modal completo del perfil | B1 |
| `admin/mensajes/page.tsx` | borrar mensajes | A3 |
| `admin/estadisticas/page.tsx` | salario de mercado interno | B2 |
| `company/publicar/page.tsx` | se abre sin verificación, con aviso | A2 |
| `company/postulaciones/page.tsx` | foto, filtros nuevos, contador | B3, B4 |
| `company/estadisticas/page.tsx` | `PanelEstadisticas` + selector de búsqueda | B5 |
| `components/dashboard/CandidateProfileModal.tsx` | foto en lugar del anillo de % | B3 |
| `components/notifications/` | descartar notificación | A3 |
| `app/page.tsx` | hero con foto (2 maquetas) | C1 |

## Migraciones

**Ninguna nueva** en A, B y C. Todo lo que se necesita ya está en la base.

~~⚠️ **Lo que sí hay que resolver:** la cadena de la tanda del 06/08
(`f1a4c7e2b9d8` → `c3e7b1d5a92f` → `a8d2f6c1e534`) **sigue sin aplicarse a producción**.~~

> ✅ **Corregido el 18/08/2026: era falso.** El `Dockerfile:25` arranca con
> `alembic upgrade head && uvicorn`, o sea que si la migración falla el server no levanta. Esas
> tres migraciones entraron en el commit `984c42d` (07/08 09:47) y el deploy `320db97` (07/08
> 11:32) figura `SUCCESS` con el backend respondiendo `200`. Se aplicaron solas ese día.
> La advertencia se venía copiando de un plan al siguiente sin re-verificarse.
> Ver `MODIFICACIONES-EUGENIA-2026-08-18-PLAN.md`, sección "las migraciones NO estaban
> pendientes".

## Fuera de esta tanda

| Qué | Por qué |
|---|---|
| Industria/Sector (P1) | Esperando la respuesta de Eugenia |
| Base de Talento para empresas (P2) | Funcionalidad nueva completa — se cotiza aparte |
| Credenciales de Mercado Pago (P3) | Depende de Talency, no de código |
| Precio del destacado configurable | A definir con ella |

---

# Lo que hay que preguntarle a Eugenia

1. **"Industria" — ¿es una opción más de la lista, o un campo aparte del sector?** (P1)
2. **Base de Talento — ¿la querés como funcionalidad para las empresas, y en ese caso paga o
   incluida?** Y si es paga, quién puede: toda empresa verificada o sólo con plan. (P2)
3. **Mercado Pago — las credenciales productivas.** Los tres pasos están arriba. (P3)
4. **Hero — cuál de las dos maquetas.** Y si tiene una foto propia del puerto; si no, se
   consigue una con licencia. (C1)
