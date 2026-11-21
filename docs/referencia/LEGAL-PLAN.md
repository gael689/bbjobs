# Legal: términos y privacidad para los módulos nuevos — plan (06/10/2026)

> **Esto es un plan técnico, no asesoramiento legal.** Lo armó el equipo de desarrollo leyendo el
> código y los planes. Las referencias a normas son para que el abogado sepa dónde mirar; **las
> tiene que confirmar él**. Nada de esto se publica sin su revisión.
>
> Es el paso **D.12** de `MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md` §10. Borradores completos en
> `legal/TERMINOS-BORRADOR.md` y `legal/PRIVACIDAD-BORRADOR.md`. **Las páginas publicadas
> (`frontend/src/app/terminos/`, `privacidad/`) no se tocaron.**

## 0. Resumen

1. **Hay un problema que no espera a la compuerta.** La política publicada ("junio de 2025") ya
   no describe lo que hace BBJobs **hoy** en producción: dice que tu perfil "solo es visible para
   las empresas a las que te postulaste", pero la **Base de Talento** (1.936 postulantes adentro,
   94 %) lo muestra a empresas a las que no te postulaste; no menciona **Mercado Pago**, los
   **destacados** ni los **packs**; no lista a **Clerk**; los plazos para ejercer derechos están
   mal; falta la leyenda obligatoria de la AAIP; y **nadie acepta los términos al registrarse**
   (no hay casilla ni versión guardada). Propuesta: una **Fase 0** que corrija esto ya.
2. **Los módulos nuevos** (IA, mails, Revisión de CV, notas, "Vieron tu CV", prospección) van en
   una **Fase 1**, que se muestra sólo con la compuerta prendida y entra en vigencia **antes** de
   que cada módulo toque datos reales.
3. **Lo que falta construir para que el texto sea verdad** (no es sólo texto): botón "no usar mi
   perfil en recomendaciones", registro de aceptación de términos, botón de arrepentimiento, y
   que las notas privadas realmente no tengan pantalla de admin.

## 1. Lo que hay hoy y qué está mal

| # | Hallazgo | Dónde | Gravedad |
|---|---|---|---|
| H1 | La política dice que el perfil sólo lo ven las empresas a las que te postulaste; la Base de Talento (en producción desde agosto) lo contradice | `privacidad/page.tsx:12-15`, `:70-75` | Alta |
| H2 | Nadie acepta los términos: el registro es el de Clerk, sin casilla, y no se guarda versión ni fecha. Sin eso, "re-aceptar" no tiene contra qué compararse | `register/`, `onboarding/`, modelo `User` | Alta |
| H3 | Plazos de derechos: dice "30 días hábiles". La ley: **10 días corridos** para acceso (art. 14) y **5 días hábiles** para rectificar o suprimir (art. 16) | `privacidad/page.tsx:122` | Alta |
| H4 | Falta la **leyenda obligatoria** de la Disposición DNPDP 10/2008 (acceso gratuito cada 6 meses, AAIP como órgano de control) | `/privacidad` | Media |
| H5 | No identifica al responsable: falta razón social, CUIT y domicilio de Talency, y el número de inscripción de la base | ambas páginas | Media |
| H6 | No menciona Mercado Pago, destacados ni packs; no hay condiciones de compra | ambas páginas | Media |
| H7 | La lista de terceros omite **Clerk** (procesa mail, contraseña, IP) | `privacidad/page.tsx:88-92` | Media |
| H8 | "Seguridad" describe "tokens JWT de corta duración y cookies httpOnly" propios: eso era el diseño viejo, hoy lo hace Clerk | `privacidad/page.tsx:128-131` | Baja |
| H9 | No lista datos que el perfil sí pide: foto, fecha de nacimiento, género, pretensión salarial, movilidad | `models/candidate.py:38-47` | Media |
| H10 | No dice qué puede hacer la empresa con los datos que ve o desbloquea | `/terminos` | Alta |
| H11 | "Modificaciones": cambios a los 10 días y "el uso continuado implica aceptación". Para cambios que agregan finalidades nuevas (IA) eso no alcanza como consentimiento | `terminos/page.tsx:83-89` | Alta |
| H12 | "Renuncia expresa a cualquier otro fuero": frente a consumidores puede ser abusiva | `terminos/page.tsx:93-96` | Baja |
| H13 | No hay edad mínima | ambas | Media |
| H14 | La fecha "junio de 2025" es anterior al portal | ambas | Baja |

## 2. Qué cambia, módulo por módulo

| Módulo | Estado del código | Qué agrega a lo legal | Secciones |
|---|---|---|---|
| **Base de Talento, destacados, packs** | En producción | Consentimiento, perfil ciego, aviso al postulante, condiciones de compra, obligaciones de la empresa | **FASE 0** · T §5–7 · P §5–6 |
| **Recomendaciones con IA** | Escrito, compuerta | IA orientativa, una persona decide, CV anonimizado, datos que no se usan, Google como subprocesador, derecho a oponerse | T §8 · P §7, §11 |
| **Mails** (avisos, resúmenes, alertas, novedades) | Escrito, compuerta | Categorías, cuáles se pueden apagar, consentimiento de novedades, Resend, retención de 90 días, aperturas sólo en novedades | T §10 · P §8, §11, §12 |
| **Revisión de CV** | Escrito, compuerta | Servicio prestado por Talency fuera de la plataforma, sin garantía de empleo, arrepentimiento, datos que ve Talency, consentimiento de contacto | T §11 · P §9 |
| **"Vieron tu CV"** | **Planeado, no escrito** (`AVISOS-POR-ACCION-Y-NOTAS-PLAN.md`; hoy `seen_at` sólo se completa al cambiar estado) | Se le avisa al postulante; se le dice a la empresa | T §9 · P §5 |
| **Notas de la empresa** | **Planeado, no escrito** (no existe `application_notes`) | Privadas por defecto, quién las ve, responsabilidad de la empresa | T §9 · P §5 |
| **Prospección a empresas** | Escrito, compuerta | Origen de los datos, identificación del remitente, baja, supresión | P §10 |

## 3. Normativa aplicable

> Referencias para el abogado. Las marcadas con **(verificar)** no las pude confirmar en la fuente.

| Tema | Norma | Qué exige, en corto | Dónde se aplica |
|---|---|---|---|
| Datos personales, en general | **Ley 25.326** y Decreto 1558/2001 | Consentimiento libre, expreso e informado (art. 5), deber de informar finalidad, destinatarios y derechos (art. 6), calidad y finalidad (art. 4), seguridad (art. 9), confidencialidad (art. 10) | Todo |
| Datos sensibles | Ley 25.326 art. 2 y 7 | Origen racial, opiniones políticas, religión, salud, vida sexual: nadie está obligado a darlos | Notas, CV, IA |
| Cesión a terceros | Ley 25.326 art. 11 | Requiere consentimiento salvo excepciones | Desbloqueo de la Base de Talento; datos de prospectos de `leadgen` |
| **Transferencia internacional** | Ley 25.326 **art. 12**; Decreto 1558/2001 art. 12; **Disposición DNPDP 60-E/2016** (países adecuados y contratos modelo) | Prohibida a países sin protección adecuada, salvo consentimiento del titular o garantías contractuales. **EE.UU. no está en la lista de adecuados** | Clerk, Cloudinary, Vercel, Resend, Google, quizás Railway |
| Encargado de tratamiento | Ley 25.326 art. 25 | Contrato con el prestador de servicios (no puede usar los datos para otra cosa) | Gael como desarrollador; cada proveedor |
| **Registro de la base** | Ley 25.326 art. 3 y **art. 21**; trámite en TAD ante la AAIP | Toda base privada que no sea de uso exclusivamente personal se inscribe | Talency |
| Derechos de acceso, rectificación y supresión | Ley 25.326 art. 14 (acceso, **10 días corridos**), art. 16 (**5 días hábiles**), art. 27 inc. 3 (retiro/bloqueo en publicidad) | Plazos y gratuidad | P §13 |
| Leyenda obligatoria | **Disposición DNPDP 10/2008** | Texto fijo sobre acceso gratuito y la AAIP | P §13 |
| Medidas de seguridad | **Resolución AAIP 47/2018** (verificar vigencia) | Medidas recomendadas según el tipo de dato | Seguridad |
| **Decisiones automatizadas** | Ley 25.326 art. 20 (actos judiciales/administrativos); **Resolución AAIP 4/2019**, criterios orientadores (derecho a explicación y a no ser objeto de decisiones sólo automatizadas) **(verificar)**; Resolución AAIP 161/2023 (programa de IA) **(verificar)** | Informar la lógica, permitir intervención humana y oposición | IA |
| **Publicidad por mail** | Ley 25.326 **art. 27** y Decreto 1558/2001 art. 27 | Se admite con datos de fuentes públicas o con consentimiento; **cada comunicación tiene que incluir la forma de pedir la baja**; el retiro es gratuito | Novedades y prospección |
| Llamadas y mensajes comerciales | **Ley 26.951 (Registro "No Llame")** | Consultar el registro antes de contactar por teléfono **(verificar si alcanza a WhatsApp)** | WhatsApp asistido a prospectos |
| Antidiscriminación | **Ley 23.592**; LCT (Ley 20.744) arts. 17 y 81; Convenio 111 OIT | Prohibido discriminar; la empresa responde por sus actos | Avisos, notas, IA (R11 de la auditoría) |
| Defensa del consumidor | **Ley 24.240** (arts. 4, 34, 36, 37); Código Civil y Comercial arts. 1092–1122 (contratos de consumo y a distancia; arrepentimiento arts. 1110–1116) | Información clara, revocación en 10 días, cláusulas abusivas | Revisión de CV (y postulantes en general) |
| **Botón de arrepentimiento** | **Resolución SCI 424/2020** | Link visible en la primera pantalla, sin registrarse, código de trámite en 24 h | Revisión de CV |
| Link a Defensa del Consumidor | Resolución de la Secretaría de Comercio sobre el link a la Ventanilla Única Federal **(verificar número y vigencia)** | Leyenda + link en sitios que venden a consumidores | Pie del sitio |
| Factura | Normativa de ARCA (ex AFIP) | Factura electrónica por cada venta | Revisión de CV, destacados, packs |
| Proveedor de IA | Términos de la Gemini API + **Prohibited Use Policy** de Google | Sin decisiones automatizadas con impacto en empleo **sin supervisión humana**; nivel pago para que no se use para entrenar | IA (auditoría R21) |
| Proveedor de mail | **Acceptable Use Policy de Resend** | Prohíbe *cold outreach* y datos *scrapeados*. No es ley, pero es **riesgo de suspensión** | Prospección (ver riesgo 4) |

> El proyecto de nueva ley de datos personales no está vigente; no se usó.

## 4. Qué datos van a cada tercero

| Tercero | Rol | Para qué | Datos que recibe | Dónde | Hoy / Compuerta |
|---|---|---|---|---|---|
| **Clerk** | Encargado | Registro, sesión, verificación del mail | Mail, nombre, hash de contraseña, sesiones, IP, navegador; `public_metadata` (rol) | EE.UU. | Hoy |
| **Cloudinary** | Encargado | Archivos | CVs en PDF (**privados**, link firmado de 5 min), fotos de postulantes, logos, documentación de verificación | EE.UU. | Hoy |
| **Railway** | Encargado | Backend + Postgres | **Todo** (incluye CV redactado, embeddings, notas, outbox) | [[ver región en Railway]] | Hoy |
| **Vercel** | Encargado | Frontend | IP, navegador, logs de acceso; no guarda datos de perfil | EE.UU. / global | Hoy |
| **Mercado Pago** | Responsable propio del pago | Cobros | BBJobs le manda **sólo** ítem, precio y referencia opaca (`external_reference = payment.id`); los datos del pagador los carga la persona en MP | Argentina | Hoy (destacados, packs) · Compuerta (Revisión de CV) |
| **Resend** (cuenta avisos) | Encargado | Mails transaccionales y novedades | Mail y nombre del destinatario, asunto y cuerpo (puede incluir nombre de la búsqueda, empresa, estado, **nota visible**), eventos de entrega; aperturas/clics **sólo en `novedades.`** | EE.UU. (Resend tiene otras regiones: **evaluar UE**, que es "adecuada") | Compuerta |
| **Resend** (cuenta prospección, aparte) | Encargado | Mails a empresas no registradas | Mail comercial de la empresa, nombre, cuerpo | EE.UU. | Compuerta |
| **Google (Gemini API)** | Encargado | Embeddings, extracción de requisitos, rerank, redactora de campañas | **Texto del CV redactado** (sin nombre, contacto, DNI, CUIL, edad, fecha de nacimiento, estado civil, links), fragmentos por sección (≤ 12), habilidades técnicas, zona, disponibilidad, títulos de puestos; texto de las búsquedas; ideas de campaña de Eugenia. **Nunca** foto, género, fecha de nacimiento, nombre ni el PDF. `store=False`, nivel pago, `labels` con el UUID de la empresa (no del candidato) | EE.UU. y otros | Compuerta |
| **Talency (equipo)** | Responsable | Revisión de CV | Nombre, canal y dato de contacto, objetivo (≤ 500 caracteres), link firmado al CV del momento del pago, estado y nota interna | Bahía Blanca + WhatsApp/mail (fuera de la plataforma) | Compuerta |
| **Meta (WhatsApp)** | Tercero, fuera de la plataforma | Contacto asistido (`wa.me`) | Lo que Eugenia escriba | — | Hoy (botón) / Compuerta |
| **Empresas verificadas** | Responsables independientes desde que descargan | Selección | Perfil, CV, carta; contacto si desbloquean; notas propias | — | Hoy |
| **Gael / `leadgen` → BBJobs** | Origen de datos de prospectos | Prospección | Nombre, rubro, dirección, teléfono, WhatsApp, mail, web, redes de ~7.800 empresas; supresiones | Local → Railway | Compuerta |

## 5. Riesgos, de mayor a menor

1. **Privacidad publicada desactualizada hoy (H1, H10).** No depende de la compuerta. Un
   postulante que reclama ante la AAIP tiene a mano un texto que dice lo contrario de lo que pasa.
   → Fase 0 cuanto antes.
2. **IA sobre CVs de personas que no lo sabían.** El backfill va a procesar ~1.781 CVs que se
   cargaron bajo una política que no menciona IA ni Google, y el consentimiento de la Base de
   Talento tampoco lo menciona. → **El backfill no corre hasta que la versión nueva esté vigente y
   exista el botón de oposición.** El abogado decide si alcanza con informar + oposición o hace
   falta consentimiento nuevo (re-aceptación).
3. **Transferencia internacional (art. 12).** Hoy ya pasa con Clerk y Cloudinary sin que nadie lo
   haya consentido expresamente; se suman Resend y Google. → Consentimiento expreso en la
   aceptación de la versión nueva + aceptar los DPA de cada proveedor + evaluar región UE en Resend.
4. **Prospección.** Tres capas: (a) **la cesión de la base de `leadgen`** de Gael a Talency: el
   argumento es "fuente de acceso público irrestricto" (art. 5 inc. 2.a y art. 11), pero datos
   juntados de Google Maps y de webs no necesariamente califican; (b) algunos mails son de
   personas (`juan@empresa.com`), no genéricos; (c) **la política de Resend prohíbe cold
   outreach**: el riesgo práctico es que suspendan la cuenta. → Abogado + cuenta aparte (ya
   decidido) + volumen bajo + **Registro No Llame** antes de cualquier WhatsApp o llamada.
5. **Notas privadas vs. derecho de acceso.** Una nota privada sobre un postulante es un dato
   personal suyo. Si pide acceso (art. 14), "nadie la ve" choca con la ley. Y el plan de notas
   propone que Talency las lea (sólo lectura), lo contrario de lo que pide el encargo. → Decisión
   (§10, L3) + abogado (§8). El borrador dice "Talency no las lee en la plataforma" y deja la excepción
   abierta: **si se construye una pantalla de admin para notas, el texto hay que cambiarlo**.
6. **Arrepentimiento en un servicio que se presta rápido.** Si Eugenia hace la revisión en 48 h,
   el plazo de 10 días sigue abierto. → Abogado; mientras tanto, devolución total.
7. **Sin registro de aceptación (H2).** Cualquier cambio de términos es difícil de probar.
   → Construirlo en la Fase 0.
8. **Postulantes y empresas ven género y fecha de nacimiento** (campos opcionales del perfil). La IA
   no los usa, pero la empresa sí los ve en la ficha. Con notas y recomendaciones, el riesgo de
   discriminación queda más expuesto. → Decisión (§10, L5): ocultar esos campos a las empresas.
9. **Auditoría de impacto dispar (auditoría R14, P8).** Si se hace, usa edad y género **sólo para
   medir**; tiene que estar en la política antes. Hoy el borrador no lo menciona porque está
   pendiente de decisión.

## 6. Plan de publicación

### Versiones

| Versión | Contenido | Cuándo se ve | Cuándo rige |
|---|---|---|---|
| **1.0** | Lo publicado hoy ("junio de 2025") | Hasta la Fase 0 | — |
| **2.0** (Fase 0) | Marcas **[ACTUAL] + [FASE 0]** de los borradores | Apenas lo revise el abogado | A los [[15]] días de avisar |
| **3.0** (Fase 1) | Todo, incluido **[COMPUERTA]** | Sólo con `NEXT_PUBLIC_MODULOS_NUEVOS=true` | A los [[15]] días de avisar, **antes** de prender IA, novedades o prospección |

Si Eugenia prefiere **una sola publicación**, se puede saltar la 2.0, pero entonces el H1 sigue
abierto hasta el lanzamiento (no lo recomiendo).

### Secuencia

**Fase 0 (ya, sin compuerta)**
1. Talency completa los datos que faltan (§9) y el abogado revisa las marcas [ACTUAL] y [FASE 0].
2. Se construye el **registro de aceptación** (§7.2) y se deploya con la 2.0 como "próxima versión".
3. Aviso a todos los usuarios: **banner** en el panel + **notificación en la web** (no hay mails
   todavía), con fecha de vigencia y link a qué cambia.
4. Al cumplirse el plazo: la 2.0 pasa a vigente; al entrar, cada usuario ve un **modal de
   aceptación** (no bloquea ver búsquedas; sí postularse, publicar o pagar hasta aceptar). Los
   nuevos aceptan en el onboarding con una casilla.

**Fase 1 (con la compuerta)** — encaja con el orden de prendido del plan v4 §10.F:
1. Merge a `main` con la compuerta cerrada (la 3.0 está en el código pero oculta).
2. `MODULOS_NUEVOS_ACTIVOS=true` / `NEXT_PUBLIC_MODULOS_NUEVOS=true`: aparece la 3.0 **como
   "próxima versión, rige desde [fecha]"**, con banner y notificación. Ese mismo día, si la cuenta
   de Resend de avisos ya está, **un mail de categoría `cuenta`** a toda la base (es un aviso del
   servicio, no marketing; respeta el calentamiento: se reparte en varios días).
3. Durante esos [[15]] días se pueden prender sólo cosas que **no** cambian el tratamiento de datos
   existentes: Revisión de CV (pide su propio consentimiento al comprar) y mails transaccionales.
   [[El abogado confirma que los transaccionales pueden salir antes de que rija la 3.0.]]
4. Rige la 3.0 → re-aceptación al entrar (incluye el consentimiento expreso a la transferencia
   internacional y a la IA con opción de oposición). **Recién ahí:** backfill de embeddings, IA,
   el mail único "¿querés recibir novedades?" (D10) y, después, prospección.
5. "Vieron tu CV" y notas: cuando se construyan; ya están descriptos en la 3.0. Si se lanzan
   después que el resto, no hace falta otra versión mientras el texto no cambie.

### ¿Hace falta re-aceptación?

**Sí, en las dos fases**, por cuatro motivos: (1) hoy no hay ninguna aceptación registrada (H2);
(2) se agregan finalidades nuevas (IA) y la ley pide consentimiento informado para eso; (3) la
transferencia internacional necesita consentimiento expreso; (4) el "uso continuado = acepto"
del texto actual es débil. La re-aceptación **no** reemplaza los consentimientos aparte, que
siguen siendo casillas separadas y destildadas: Base de Talento, novedades y contacto para la
Revisión de CV.

## 7. Cómo implementarlo en el código

### 7.1 Páginas con secciones condicionadas

- `frontend/src/lib/legal.ts`: versiones y fechas, y cuál está vigente según la compuerta.
  ```ts
  import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";
  export const LEGAL = MODULOS_NUEVOS_VISIBLES
    ? { version: "3.0", vigenteDesde: "2026-xx-xx" }
    : { version: "2.0", vigenteDesde: "2026-xx-xx" };
  ```
- `frontend/src/components/legal/Section.tsx`: sacar el `Section` duplicado de las dos páginas y
  sumarle `soloModulosNuevos?: boolean` → si es `true` y `!MODULOS_NUEVOS_VISIBLES`, devuelve
  `null`. Como `NEXT_PUBLIC_*` se resuelve en el build, **el texto oculto no llega al HTML** (no
  queda en el código fuente de la página).
- Numeración: con secciones que aparecen y desaparecen, los números se calculan (o se usan
  títulos sin número), para que no quede "6, 8, 9".
- Las páginas siguen siendo server components estáticos; el SEO no cambia.
- `/terminos/versiones` y `/privacidad/versiones`: las versiones anteriores, en archivos
  estáticos con su fecha (para poder probar qué aceptó cada uno).
- **Antes de tocar estas páginas**, leer `frontend/AGENTS.md` y la doc de Next 16 en
  `node_modules/next/dist/docs/`.

### 7.2 Registro de aceptación (Fase 0, sin compuerta)

- Migración: tabla `legal_acceptances (user_id, document ['terminos'|'privacidad'], version,
  accepted_at, ip, user_agent)`. Se suma a `services/account_deletion.py` (en lápida se conserva
  sin IP).
- `GET /me/legal` → versiones aceptadas y vigentes; `POST /me/legal/accept`.
- Onboarding (postulante y empresa): casilla **destildada** "Leí y acepto los términos y la
  política de privacidad" con links; sin ella no avanza.
- Modal de re-aceptación en los layouts de `dashboard/` cuando la versión aceptada < vigente.
- Opción complementaria: el "legal consent" que ofrece Clerk en el registro. No reemplaza al
  registro propio (no guarda la versión de nuestro texto).

### 7.3 Lo que el texto promete y hay que construir (Fase 1)

| Promesa del borrador | Qué hay que hacer | Bloquea |
|---|---|---|
| "Podés pedir que tu perfil no se use para recomendaciones" (P §7) | `candidate_profiles.ai_opt_out` (+ fecha) en Mi cuenta; el pipeline lo excluye; al activarlo se borran `candidate_cv_texts`, chunks, índice y recomendaciones. La empresa ve al postulante igual, sin puntaje. **No existe hoy** (grep `ai_opt_out`: nada) | Prender la IA |
| "Pedir que una persona revise una recomendación" | Alcanza con el mail de privacidad + procedimiento interno de Talency | — |
| Botón de arrepentimiento (T §11) | Página `/arrepentimiento` pública, link en el `Footer` (visible desde la home), formulario sin login, código de trámite por mail/pantalla en < 24 h, aviso al admin | Vender la Revisión de CV |
| "Ningún aviso lo escribe una IA" | Ya es así (`catalog.py`, R2 del plan v4). Test que lo cuide | — |
| "Aperturas sólo en novedades" | Tracking apagado en `avisos.` y prendido en `novedades.` (config de Resend) | Mails |
| Notas privadas sin pantalla de admin | No construir un endpoint de admin que las lea, o cambiar el texto | Notas |
| Notas: "no incluyas motivos discriminatorios" | Cartel en el cuadro de nota (ya está en el plan) | Notas |
| Mail único "¿querés recibir novedades?" | Ya previsto (D10). Sale **después** de que rija la 3.0 | Campañas |
| Casilla de novedades destildada en el registro | Ya previsto (D10); verificar que el onboarding la tenga | Campañas |
| Prospección: remitente identificado y baja | Ya está (`List-Unsubscribe`, supresión). Sumar al pie: razón social de Talency, domicilio y por qué le escribimos | Prospección |
| "Te avisamos con 15 días" | Plantilla de mail `legal_update` en categoría `cuenta` | Fase 1 |

## 8. Checklist para el abogado

- [ ] Revisar los dos borradores completos, en particular las notas **[ABOGADO]**.
- [ ] **Base legal de la IA**: ¿alcanza con informar + derecho de oposición (ejecución del servicio
  pedido), o hace falta consentimiento específico? ¿Y para la Base de Talento, cuyo consentimiento
  se dio antes de que existiera la IA?
- [ ] **Transferencia internacional**: mecanismo (consentimiento expreso en la aceptación y/o
  cláusulas modelo de la Disp. 60-E/2016); si alcanzan los DPA estándar de Clerk, Cloudinary,
  Vercel, Railway, Resend y Google.
- [ ] Confirmar las citas marcadas **(verificar)** en §3 (Res. AAIP 4/2019 y 161/2023, Res. 47/2018,
  norma del link a Defensa del Consumidor, alcance de la Ley 26.951 a WhatsApp).
- [ ] **Prospección**: si la base de `leadgen` califica como fuente de acceso público irrestricto;
  si la entrega de Gael a Talency es una cesión (art. 11) y qué papeles requiere; tratamiento de
  mails de personas físicas; texto mínimo del pie (art. 27 y Decreto 1558/01).
- [ ] **Notas privadas**: cómo se responde un pedido de acceso de un postulante sobre una nota
  privada (¿lo responde la empresa como responsable? ¿Talency como encargado?). Rol de la empresa
  respecto de los datos que descarga (responsable independiente vs. cesionaria).
- [ ] **Revisión de CV**: arrepentimiento cuando el servicio ya se prestó; información obligatoria
  de la oferta (precio final, impuestos, datos del proveedor); si los packs y destacados (B2B)
  también necesitan botón.
- [ ] Cláusulas de limitación de responsabilidad, modificación unilateral y jurisdicción frente a
  consumidores.
- [ ] Edad mínima (18, o 16 con autorización según la LCT).
- [ ] Redacción vigente de la leyenda de la Disp. DNPDP 10/2008.
- [ ] Si la auditoría de impacto dispar (R14/P8) se hace: cómo se informa.
- [ ] Contrato de encargado de tratamiento entre Talency y Gael (art. 25).
- [ ] Plazo de aviso previo (15 días propuesto) y mecanismo de re-aceptación.

## 9. Lo que tiene que hacer Talency

- [ ] **Inscribir la base de datos** de BBJobs en el **Registro Nacional de Bases de Datos** de la
  AAIP (trámite a distancia, TAD). Antes de publicar la 2.0, porque el número va en la política.
  [[Si Talency ya tiene una base inscripta por su consultora, ver con el abogado si se amplía o se
  inscribe otra.]]
- [ ] Pasar razón social, CUIT y domicilio exactos para ambas páginas.
- [ ] Confirmar que **privacidad@bbjobs.com.ar** e **info@bbjobs.com.ar** existen y alguien los lee;
  armar el procedimiento interno para responder derechos en **10 días corridos / 5 hábiles**.
- [ ] Contratar al abogado y pasarle este plan + borradores.
- [ ] Firmar con Gael un contrato de encargado de tratamiento (acceso a la base, confidencialidad,
  borrado al terminar).
- [ ] Aceptar los DPA de cada proveedor desde la cuenta de Talency (Resend, Google Cloud/AI Studio
  con facturación, Cloudinary, Clerk, Vercel, Railway) y guardarlos.
- [ ] **Registro No Llame**: suscribirse/consultar antes de contactar prospectos por WhatsApp o
  teléfono.
- [ ] Facturación de la Revisión de CV (factura electrónica por cada venta).
- [ ] Definir quién atiende el botón de arrepentimiento y las devoluciones en Mercado Pago.

## 10. Decisiones para Eugenia

| # | Decisión | Propuesta |
|---|---|---|
| L1 | ¿Fase 0 ya (corregir lo que está en producción) o todo junto al lanzar? | **Fase 0 ya** |
| L2 | Plazo de aviso antes de que rija un cambio | 15 días corridos |
| L3 | ¿Talency puede leer notas privadas? El encargo dice que no; el plan de notas propone sí, sólo lectura | **No**, salvo orden de autoridad. Si se quiere moderación, que sea sólo ante una denuncia concreta, y se dice así en la política |
| L4 | Edad mínima | 18 años [[o 16 con autorización — lo define el abogado]] |
| L5 | ¿Ocultar género y fecha de nacimiento a las empresas? | **Sí**: la IA ya no los usa; que tampoco los vea la empresa en la ficha |
| L6 | Borrado de cuentas sin uso | Avisar a los 18 meses sin entrar y borrar a los 24 |
| L7 | ¿Pantalla "lo que lee la IA de tu CV" para el postulante? | Sí, si entra en el tiempo: es el mejor control del tachado |
| L8 | Qué incluye la Revisión de CV y plazo (D16, D18) | Va textual en los términos |
| L9 | Precio con o sin IVA en pantalla | Final, con impuestos (consumidor) |
| L10 | ¿Se hace la auditoría de impacto dispar con edad y género (P8)? | Sí, sólo para medir, informado en la política |
| L11 | ¿Prospección por mail aunque Resend la prohíba? | Decidir con el abogado; si sí, cuenta aparte y volumen mínimo (ya decidido DP1) |

## 11. Validación sin abogado (28/10/2026)

> Gael decidió que no hay abogado: la validación la hizo el equipo de desarrollo contra las normas
> de §3. No es asesoramiento legal profesional. Cuando se elige una opción dudosa, se elige **la
> más protectora para la persona**, que es la que menos riesgo deja.

**Publicado en el código** (rige con la compuerta abierta; sin ella sigue la 2.0):
`frontend/src/components/legal/PrivacidadV3.tsx` y `TerminosV3.tsx`. La versión vive en
`backend/app/core/legal.py` y `frontend/src/lib/legal.ts` (un test controla que coincidan).
Abrir la compuerta pide re-aceptar a todos (`LegalGate`).

| Punto abierto (§8) | Decisión | Por qué | Dónde quedó |
|---|---|---|---|
| Base legal de la IA | **Consentimiento**: la IA procesa sólo a quien aceptó la 3.0, más oposición en Mi cuenta | Ley 25.326 art. 5: es una finalidad nueva respecto de la que se informó al cargar el CV; "informar + oposición" no alcanza para los 1.781 CV previos | `core/legal.py::accepted_ai_terms`, filtros en `services/ai/pipeline.py`; tests en `test_ai_pipeline_db.py` |
| Oposición a la IA | Botón en Mi cuenta: borra texto del CV, fragmentos, índice, puntajes y resúmenes; la persona aparece igual a la empresa, "sin puntaje" | Art. 5 y 16; Res. AAIP 4/2019 (intervención humana) | `services/ai/opt_out.py`, `POST /me/candidate/privacy-preferences`, `PreferenciaIA.tsx`, `unscored_applicants` en recomendados |
| Transferencia internacional | Consentimiento expreso al aceptar + DPA de cada proveedor | Art. 12 y Disp. 60-E/2016 | Privacidad §11. **Talency tiene que aceptar los DPA** al crear las cuentas (Resend, Google) |
| Observaciones privadas vs. derecho de acceso | Siguen sin verse en el panel (pedido de Eugenia), pero **la política dice que existen** y que se pueden pedir por acceso; Talency las lee (auditado) y puede responder | Art. 6 (deber de informar) y art. 14 (acceso a todo dato propio): ocultar su existencia en la política no es legal | Privacidad §5 y §13; términos §9 |
| Aviso "está en otro proceso" | Es una cesión de un dato de la persona a otra empresa: sólo para quien aceptó la 3.0, con oposición en Mi cuenta, y sólo un número | Art. 11 (cesión con consentimiento) | `services/other_processes.py`; tests en `test_other_processes_db.py` |
| Arrepentimiento con el servicio ya prestado | **Devolución total** dentro de los 10 días aunque la revisión ya se haya hecho | CCyC arts. 1110–1116: el art. 1116 no exceptúa servicios ya prestados | Términos §11; "Revisión de CV" en el formulario de arrepentimiento |
| Precio de la Revisión de CV | Se informa el **precio final** antes de pagar | Ley 24.240 art. 4 | Términos §11 |
| Plazo de la Revisión de CV | **No se promete plazo** (decisión de Gael, 28/10) | — | Aviso al pagar sin "48 horas hábiles"; términos sin plazo |
| Link a Defensa del Consumidor | Leyenda y link a la Ventanilla Única Federal en el pie de todas las páginas, **ya en producción** | Res. SCI 1033/2021 (hay ventas: destacados y packs) | `Footer.tsx` |
| Prospección | Datos comerciales publicados por las propias empresas, remitente identificado, baja en cada mail y lista de supresión | Art. 27 y Decreto 1558/01 art. 27 | Privacidad §10 |
| Jurisdicción y limitación de responsabilidad | Sin renuncia de fuero; las limitaciones no recortan derechos del consumidor | Ley 24.240 arts. 36–37 | Términos §14 y §16 (ya en la 2.0) |
| Plazo de aviso y re-aceptación | 15 días para cambios importantes; un uso nuevo de datos no se aplica a nadie hasta que lo acepta | Art. 5 | Privacidad §17; el filtro de la IA lo garantiza en el código |

**Riesgos que quedan** (no son de código):
1. **Inscripción de la base** en el Registro Nacional de Bases de Datos (AAIP, por TAD): la tiene que
   hacer Talency. Sin eso, la política es correcta pero la base no está registrada (art. 21).
2. **Razón social, CUIT y domicilio** de Talency en las dos páginas: faltan los datos.
3. **Resend prohíbe el cold outreach** en su política de uso: la prospección por mail puede hacer
   que suspendan esa cuenta (por eso es una cuenta aparte). Antes de cualquier WhatsApp o llamada a
   un prospecto, consultar el **Registro No Llame** (Ley 26.951).
4. **Género y fecha de nacimiento visibles para las empresas** (L5): la IA no los usa, pero la
   empresa los ve. Recomendación: ocultarlos en la ficha de empresa.
5. Resend: **tracking de aperturas apagado** en el dominio de avisos y prendido sólo en novedades,
   como dice la política §15. Es configuración de la cuenta, no código.
