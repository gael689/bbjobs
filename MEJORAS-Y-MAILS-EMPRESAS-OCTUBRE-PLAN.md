# BBJobs: plan de implementación de los pedidos de Eugenia ("mejoras.pdf" y "bbjobs mails automáticos (1).pdf")

> Plan del 19/10/2026, armado leyendo el código (solo lectura).
> - **Repo:** rama `feat/mails-ia` en `013116d`.
> - **Producción:** `origin/main` en `661bcf0`.
> - **Alcance:** la optimización de CPU de Vercel no se planifica acá. La implementa otro agente en `perf/optimizacion-vercel` (sale de `main`). Acá solo se marca el impacto de cada pedido y esa rama queda como dependencia previa del lanzamiento.
> - **Fuentes:** `C:\Users\gaelr\Downloads\mejoras.pdf` y `C:\Users\gaelr\Downloads\bbjobs mails auomaticos (1).pdf`.

## Estado al cierre del 19/10/2026 y cómo retomar

**Hecho hoy:**
- Vercel Pro activo; sitio de vuelta. Optimización de CPU (`perf/optimizacion-vercel`) en producción.
- **Tanda 2 (§4.5) hecha** en `feat/mails-ia`: textos E3–E21 de Eugenia, voz de empresa, WhatsApp desde
  configuración, `{dias}`/`{cantidad}`/`{cantidad_contactos}`, avisos nuevos `job_feature_granted` y
  `talent_pack_granted`. 410 tests sin base OK; **faltan correr 3 tests con Postgres local** (E12, E13 y
  pack regalado) con `backend/scripts/probar_local_mails.ps1`.
- **Vista previa para Eugenia publicada** en `main` (`/vista-previa/<VISTA_PREVIA_CLAVE>`): dos pestañas
  (mails / recomendaciones con IA), índice, etiquetas "Texto de Eugenia / Propuesto / A confirmar" y la
  sección "Preguntas para vos". Sin "Contactado" ni "Finalista" (el generador los excluye con
  `FUERA_DE_LA_VISTA_PREVIA`). Todavía no incluye los mails de prospección ni las automatizaciones del
  Centro de IA (Gael: "todavía no").
- Investigación de tests psicométricos: `TESTS-PSICOMETRICOS-REFERENCIAS-PLAN.md`.

**Para retomar:**
1. Mandarle a Eugenia el link de la vista previa y esperar respuestas a P1–P14.
2. Probar un login real en producción después de la optimización (no se pudo probar en Preview: usa la
   instancia de test de Clerk). Si falla: `vercel rollback --scope talency1`.
3. Poner tope de gasto en Vercel (Spend Management) y en Railway (`railway usage`).
4. Tanda 1 (§5): buscador de postulantes, marca "ya lo vi", aviso de otros procesos y estados nuevos del
   desplegable, como fix a `main`.
5. El checkout principal sigue en `feat/mails-ia` viejo (`013116d`) con cambios sin commitear: ordenarlo
   (Tanda 0) antes de traer los commits nuevos de `origin/feat/mails-ia`.
6. Fuera de BBJobs: el CI de Plenia-Brokers consumió ~90 % de los minutos de GitHub Actions de la cuenta
   (corre 4 jobs en cada push a cualquier rama). Propuesta: sólo PR y push a `main`, filtros por carpeta y
   budget de USD 0. BBJobs es repo **público** (no gasta minutos); conviene pasarlo a privado porque los
   planes tienen datos reales y reglas de negocio.

---

## 0. Estado del repo

| Dato | Valor | Evidencia |
|---|---|---|
| Producción | `origin/main` = `661bcf0` (páginas de selección de personal y sectores). El `main` **local** quedó viejo, en `90a2b1b` | `git log origin/main` |
| Cuánto adelanta `feat/mails-ia` | **48 commits** sobre `origin/main` (61 sobre el `main` local) | `git rev-list --count` |
| Cuánto le falta a `feat/mails-ia` | **2 commits** de `origin/main`: `a51e905` y `661bcf0` (SEO para empresas) | `git rev-list feat/mails-ia..origin/main` |
| Cambios sin commitear en el checkout principal | Son una copia a mano de esos 2 commits de main (`publicar-empleo`, `seleccion-de-personal`, `Footer`, `components/seo/*`, `lib/seo/*`, `sitemap.ts`, `EmpresasUI.tsx` sin trackear). Contra `origin/main` solo difieren en `PaginaListado.tsx` (8 líneas) y `EmpresasUI.tsx`. Además hay ~150 borrados de `.claude/skills/clerk-*` y archivos sueltos: `LEGAL-PLAN.md`, `PROSPECCION-PROPIA-BBJOBS-PLAN.md`, `REVISION-CV-PROPUESTA.md`, `legal/`, PDFs. | `git status`, `git diff origin/main -- <archivos>` |
| Cadena de migraciones en prod | Head `a9e3f1c5b7d2` (site_events) ← `c7d1e5f9a2b4` (buscador) ← `c8d4e1f7a2b3` (legal) ← `a7c3e9d2f514` | `backend/alembic/versions/` en `origin/main` |
| Cadena en `feat/mails-ia` | `a9e3f1c5b7d2` → `b1e4c7a2d905` (mails) → `c5e1a9d3b7f2` (Revisión de CV) → `d7a3f1c9e2b4` (prospectos) → `e8b2c4d6f1a3` (IA/pgvector) → `f9c3d5e7a1b2` (campañas) → `b6e2d9a4c7f1` (**notas**) → `d8e2f6a0b3c5` (`last_seen_at`) → `f2b3c4d5e6a7` → `b4c6d8e0f2a1` (head). Es lineal y cuelga del head de prod: hoy no hay que reordenar nada. | `down_revision` de cada archivo |
| Compuerta | `MODULOS_NUEVOS_ACTIVOS` (`backend/app/core/features.py:17-26`): sin ella las rutas nuevas dan 404 y `mark_seen` no hace nada | `features.py` |
| Otra rama del 19/10 | `infra/railway-frontend` (`b6c639d`) deja el frontend listo para Railway: redirect a www, `minimumCacheTTL` 30 días y sin `@vercel/analytics` | `git diff origin/main...infra/railway-frontend` |
| Datos reales (auditoría 04/10) | 2.068 candidatos, ~3.000 postulaciones/mes, mediana de 62 postulantes por búsqueda (máx. 666), **95 % de las postulaciones siguen en `new`**, ~12–15 mil mails/mes | `AUDITORIA-RAG-Y-MODULOS-2026-10-04.md` §5-ter |

**Hallazgo clave:** la parte de **candidatos** del PDF de mails (C1–C11) y los pedidos en rojo (sacar Contactado/Finalista, dividir "No avanza", vista previa del mail) **ya se recibieron el 08/10 y están construidos** en `feat/mails-ia` (`MAILS-SEO-IA-OCTUBRE-PLAN.md` §1, commit `8acedbd`). Lo nuevo de esta versión "(1)" del PDF es:
- los textos de **empresas E3–E21** (antes "E3+ vacío", y en el código figuran como `propuesto`);
- las **páginas 15–19 de PDA** (capturas de un test conductual, sin ningún texto que explique qué quiere).

---

## 1. Pedidos, numerados, con página

### mejoras.pdf (1 página)

| # | Pedido | Pág. |
|---|---|---|
| **M1** | En "Filtrar postulantes", buscar texto libre combinado ("vendedor + mcdonals") y por **nombre de la persona**. Hoy hay que abrir los CV de a uno, "y por ahí son 400". | 1 |
| **M2** | **Comentarios internos u observaciones** por candidato ("no recomendado: malas referencias", "no se presentó a la entrevista"). Solo los ve quien los escribió; otra empresa nunca. "Yo con mi usuario general sí podría ver todo." Motivo: riesgo de denuncia si un candidato se entera. | 1 |
| **M3** | **Marca de "ya lo vi"** (el perfil se pinta de verde, como en Randstad), para saber hasta qué postulante se revisó. | 1 |
| **M4** | **Alerta de "este candidato está en otros procesos en BBJobs"** cuando una segunda empresa lo avanza en su proceso. Es solo un aviso: no impide contactarlo. | 1 |

### bbjobs mails automáticos (1).pdf (19 páginas)

| # | Pedido | Pág. |
|---|---|---|
| **C1** | Bienvenida al candidato | 1 |
| **C2** | Postulación confirmada: {puesto} | 1 |
| **C3** | Tu perfil fue revisado: {puesto} (estado "Perfil revisado") | 2 |
| **C3-bis** | **Sacar "Contactado"** del desplegable | 2 |
| **C4** | Tu postulación avanzó (En proceso) | 2–3 |
| **C4-bis** | **Sacar "Finalista"** | 3 |
| **C5** | Fuiste seleccionado/a | 3 |
| **C6** | "No avanza – revisión de perfil" (concepto nuevo) | 3 |
| **C7** | "No avanza – después de entrevistas" (concepto nuevo) | 3–4 |
| **C-ROJO** | En la pantalla del cambio de estado, mostrarle a la empresa el mail que le va a llegar al candidato ("sindicato" en el PDF es un error de tipeo); o, como mínimo, avisarle que le va a llegar un mensaje | 4 |
| **C8** | Una empresa vio tu perfil (Base de Talento) | 4 |
| **C9** | Perfil incompleto ({porcentaje}) | 4–5 |
| **C10** | Una semana sin entrar | 5 |
| **C11** | Resumen semanal de oportunidades, con "Administrar notificaciones" | 5–6 |
| **E1** | Registro de empresa recibido | 6 |
| **E2** | Empresa verificada | 6–7 |
| **E3** | No pudimos verificar tu empresa (WhatsApp 291 508-9353) | 7 |
| **E4** | Empresa suspendida (sin saludo, sin asunto, sin botón) | 7 |
| **E5** | Empresa reactivada | 7–8 |
| **E6** | Publicá tu primera búsqueda ("de forma gratuita") | 8 |
| **E7** | Publicación aprobada ("Ver mi publicación") | 8 |
| **E8** | Tu búsqueda necesita cambios ("consultá el motivo en tu cuenta") | 9 |
| **E9** | Publicación dada de baja por incumplimiento | 9 |
| **E10** | Publicación reactivada | 9–10 |
| **E11** | Publicación eliminada | 10 |
| **E12** | Por vencer: "en **3 días**" | 10 |
| **E13** | Vencida: "**30 días** (o los días que dijimos, que no lo recuerdo)" | 10–11 |
| **E14** | Una semana sin postulaciones | 11 |
| **E15** | Destacado activo ("que contrataste") | 11–12 |
| **E16** | El pago del destacado no se acreditó | 12 |
| **E17** | Destacado desactivado | 12 |
| **E18** | Acceso a la Base de Talento ("Se acreditó tu pago", {cantidad_contactos}) | 12–13 |
| **E19** | El pago del pack no se completó | 13 |
| **E20** | Nuevos perfiles recomendados ({cantidad}, {puesto}) | 13–14 |
| **E21** | Resumen de postulaciones, por búsqueda ({puesto_n}, {cantidad_n}) | 14 |
| **PDA** | Capturas del formulario PDA (introducción, alta de persona con nombre, mail, género y nacimiento, dos listas de adjetivos, texto libre, resultado "Dinámico", pantalla final) **sin ninguna consigna** | 15–19 |

---

## 2. Estado actual de cada pedido

| # | Estado | Evidencia |
|---|---|---|
| **M1** | **Parcial (en main).** Solo existe `position`, que es `ILIKE '%x%'` sobre `Experience.role_title`: sin tildes, sin AND entre palabras, sin empresa, sin nombre. **El endpoint de admin no tiene ningún filtro.** El buscador léxico existe pero solo para avisos. | main `backend/app/api/v1/applications.py:213-264` (`position`, `:259-264`); feat `:242-296`; front `dashboard/company/postulaciones/page.tsx:221-226` (feat) / `:196` (main); admin `api/v1/admin.py:772-790` sin filtros y `:530-552` (`q` solo nombre/apellido en `/admin/candidates`); `services/job_search.py` y migración `c7d1e5f9a2b4` (`f_unaccent`, `pg_trgm`, ya en prod) |
| **M2** | **Hecho en feat/mails-ia, detrás de la compuerta**, con dos diferencias con lo que pide Eugenia: (a) la nota es **por postulación**, no por candidato; (b) **decidido el 06/10 que Talency NO lee las privadas**, y hay un test que lo garantiza. Eugenia ahora pide verlas. | `services/application_events.py`; endpoints `applications.py:663-723` (feat); `components/dashboard/NotasPostulacion.tsx`; migración `b6e2d9a4c7f1_application_notes.py`; `AVISOS-POR-ACCION-Y-NOTAS-PLAN.md:109-114, 120-121`; `LEGAL-PLAN.md:122-126, 290` (L3: "No"); `services/account_deletion.py:196-197, 281-285`; `tests/test_application_notes_db.py` |
| **M3** | **Parcial.** La columna `applications.seen_at` existe en prod y ya viaja al frontend, pero **la pantalla no la muestra**. En main solo se completa al cambiar de estado. En feat se completa al abrir ficha o CV (`mark_seen`), **solo con la compuerta abierta**, y además pasa a "Perfil revisado" y le avisa al candidato. | main `models/job.py:118`, `applications.py:587-588`; feat `application_events.py:205-258` (`if not new_modules_enabled(): return []` en `:225`); front `postulaciones/page.tsx:334-411` (ninguna marca) y `:147-152` |
| **M4** | **No existe.** | — |
| **C1–C11** | **Hecho en feat/mails-ia (compuerta).** Textos `eugenia` en `copy.py`; C10 con `users.last_seen_at` (7 días, cada 30 como máximo, 3 veces como tope) | `backend/app/services/email/copy.py:94-186, 376-381`; `catalog.py:110-138`; migración `d8e2f6a0b3c5`; `MAILS-SEO-IA-OCTUBRE-PLAN.md` §1.1–1.4 |
| **C3-bis, C4-bis, C6, C7** | **Hecho en feat, sin compuerta pero sin mergear.** `SELECTABLE_STATUSES` y `discarded_interview`; en prod el desplegable sigue con Contactado y Finalista | feat `models/job.py:97-124`, `application_events.py:102`, `frontend/.../company/types.ts:241-260`; main `types.ts:245-249` |
| **C-ROJO** | **Hecho en feat (compuerta)**: `POST /me/company/applications/{id}/status-preview` y el cuadro `CambioEstadoConNota`. **En prod no hay ningún aviso**: el cambio de estado se guarda en el acto. | feat `applications.py:643-660`; `postulaciones/page.tsx:132-140, 442-453`; main `postulaciones/page.tsx:375-377` |
| **E1, E2** | **Hecho en feat** (texto de Eugenia) | `copy.py:209-227` |
| **E3–E21** | **Hecho en feat con texto propuesto**: hay que reemplazarlo por el de Eugenia y ajustar variables y disparadores (ver §4.5) | `copy.py:229-361` (`source="propuesto"`); disparadores en `admin.py:340-366` (verificación), `:416, :457, :508, :971, :1030, :1135, :1376`; `webhooks.py:131, 153, 215, 237`; `talent.py:782`; `core/scheduler.py:60, 73-107`; `services/lifecycle.py:57, 112, 148, 177`; `services/ai/jobs.py:180-215` |
| **PDA** | **No existe.** El módulo psicométrico está "en pausa hasta que Talency mande el material" y figura cotizado en F2 ("ítem 4"). Las tablas viejas existen; el endpoint tiene bugs conocidos. | `MODULOS-MAILS-IA-PLAN.md:836-852` (Anexo A); `backend/app/models/tests.py`; `api/v1/tests.py`; `INTERNO - BBJobs alcance y extras octubre 2026.pdf` p. 2 |

---

## 3. Contradicciones y huecos: preguntas para decidir

### Para Eugenia

- **P1 (M2, la más importante). ¿Talency lee las notas privadas?** El PDF dice que sí ("con mi usuario general podría ver todo"). Lo decidido el 06/10 y la recomendación legal L3 dicen que no. Si es que sí:
  - cambia el texto del panel ("No la ve el postulante ni el equipo de BBJobs y Talency", hoy en `NotasPostulacion.tsx`);
  - cambia el borrador de privacidad 3.0;
  - se agrega un registro de auditoría de cada lectura;
  - hay que borrar o invertir el test `test_application_notes_db.py` del "admin recibe 403".
  - **Propuesta:** que sí, solo lectura, con auditoría y con el texto del panel cambiado a "No la ve el postulante ni otras empresas. El equipo de Talency puede leerla." Se valida con el abogado.
- **P2 (M2). ¿La nota es del candidato o de la postulación?** El ejemplo de Eugenia ("ya lo entrevistamos anteriormente y no se presentó") pide verla en **cualquier** búsqueda futura de la misma empresa, y también desde la Base de Talento.
  - **Propuesta:** que sea del candidato dentro de la empresa. Se muestran todas las observaciones de la empresa sobre esa persona y cada una queda asociada, si corresponde, a la búsqueda donde se escribió.
- **P3 (M2). Expectativa legal.** "Que el candidato no se entere" **no es garantizable**: por el art. 14 de la Ley 25.326 el titular tiene derecho de acceso a sus datos, y una nota es un dato personal suyo (`LEGAL-PLAN.md:122-126`). ¿Acepta Eugenia esto?
  - cartel "Registrá hechos, no opiniones; nada de salud, edad, género ni datos sensibles (Ley 23.592)";
  - etiquetas rápidas opcionales: "No se presentó", "Ya entrevistado", "Referencias a revisar";
  - **vencimiento** de las notas privadas a los 24 meses.
- **P4 (M3). ¿Ver la ficha le avisa al candidato?** Con los módulos prendidos, abrir la ficha ya **cambia el estado a "Perfil revisado" y le manda un mail** (como máximo uno por día). ¿Quiere eso igual cuando recorre 400 perfiles, o quiere mirar "en silencio" y que el aviso salga solo al cambiar el estado a mano?
  - **Propuesta:** mantener lo decidido el 06/10 (sí avisa) y que la marca verde exista con o sin módulos.
- **P5 (M3). ¿La marca de "visto" es también para su usuario de admin?** Hoy, ver desde el admin no marca nada a propósito. Si la quiere, hace falta una tabla `admin_application_views` por admin.
- **P6 (M4). Qué cuenta como "en otro proceso".** Propuesta:
  - estados `in_process`, `finalist`, `selected` o `contacted` en **otra empresa**, con movimiento en los últimos 90 días;
  - **sin decir cuál** empresa ni qué búsqueda;
  - "seleccionado en otra búsqueda en los últimos 60 días" como aviso aparte;
  - ¿se muestra solo al avanzar (lo que pidió) o también en la ficha? Propuesta: ambos, sin badge en la lista.
- **P7 (M4).** ¿Se informa en la política de privacidad y se le da al candidato la opción de oponerse? Recomendación: sí, porque es un dato suyo que se le muestra a un tercero. Decide el abogado.
- **P8 (E13). Duración real.** El máximo real es **20 días**, no 30 (`backend/app/schemas/job.py:9`, `MAX_JOB_DURATION_DAYS = 20`), y la empresa puede acortarlo. Propuesta: el mail dice "{dias} días", con el valor real de la búsqueda. Lo mismo para E12 ("{dias}" en lugar de "3" fijo: si la búsqueda dura menos de 3 días, el aviso llega antes).
- **P9 (E15 y E18). Destacados y packs gratis.** "El servicio que contrataste" y "Se acreditó tu pago" son falsos cuando Talency **destaca gratis** (`admin.py:1376`) o **regala un pack** (`talent.py:782`): hoy usan el mismo `type`. Propuesta: dos avisos nuevos, `job_feature_granted` y `talent_pack_granted`, con el texto adaptado. ¿Los escribe Eugenia o van propuestos?
- **P10 (E20).** Su texto es **por búsqueda** ({puesto}). Hoy se manda **uno por empresa por noche**, agrupando búsquedas (`services/ai/jobs.py:180-215`). Propuesta: con una búsqueda, su texto literal; con varias, "Identificamos {cantidad} nuevos perfiles para tus búsquedas: X, Y". ¿De acuerdo?
- **P11 (E3 y E8). "Consultá el motivo en tu cuenta".**
  - El motivo del rechazo de una **búsqueda** se ve en el panel solo si está rechazada (`dashboard/company/busquedas/page.tsx:358-359`).
  - El de la **verificación** (`company.verification_notes`) **no se muestra en ningún lado** del panel de la empresa: solo en el texto de la campanita.
  - Propuesta: mostrarlo en `dashboard/company/perfil` (arreglo chico, va a main) y **no** incluirlo en el mail, como escribió ella. ¿Confirma que el mail no lleva el motivo?
- **P12 (E3–E21). Detalles de forma.**
  - Faltan los asuntos de E3, E4, E6, E7 y E9–E21: propuesta, usar el título en negrita como asunto.
  - E4 no tiene saludo: propuesta, "Hola, {nombre}:".
  - Las empresas cierran con "Saludos, / Equipo de BBJobs / Una iniciativa de Talency" y el renglón de WhatsApp; los candidatos, con "BBJobs. El talento de Bahía, más cerca." ¿Se mantienen los dos estilos? Propuesta: sí.
- **P13. Avisos sin texto suyo** (quedan "Propuesto" en la vista previa si no los escribe):
  - `talent_pack_low`, `application_note`, los 4 de Revisión de CV, `digest_alertas`;
  - "Tu búsqueda cerró: ¿avisamos a los que no quedaron?";
  - el resumen mensual de la empresa.
- **P14 (PDA). ¿Qué quiere con PDA?** Opciones:
  - (a) que BBJobs invite al candidato a hacer el PDA en la plataforma de PDA (con la licencia de Talency) y guarde el estado y el resultado que Talency cargue;
  - (b) integración por API, si PDA International la ofrece;
  - (c) un test propio inspirado en el PDA: **no recomendado** (licencia, derechos de autor, validez).
  - Preguntas: ¿para quién (todos, solo los de búsquedas de Talency, o como producto pago)? ¿Quién ve el resultado? ¿Cuánto cuesta cada evaluación?

### Para Gael

- **P15. ¿Vercel Pro o Railway?** **Resuelta el 19/10: Vercel Pro.** El servicio `frontend` de Railway ya se borró. La rama `infra/railway-frontend` no se mergea; si se quiere, se rescata solo el `minimumCacheTTL`.
- **P16.** ¿Las mejoras M1, M3, M4 y C3-bis/C6/C7 salen **ya a main** sin esperar a los mails? Recomendación: sí (§5, Tanda 1).
- **P17. ¿Las notas privadas salen antes que los mails?** Están detrás de la compuerta solo porque se construyeron en esa rama: no dependen de Resend. Recomendación: sacarlas con el merge de la Tanda 4, abiertas para las notas privadas y con las visibles todavía detrás de la compuerta.
- **P18 (riesgo).** Según `PENDIENTES-BBJOBS.md:68-70`, **producción sigue usando la instancia de test de Clerk**, y los 3 usuarios de prueba siguen vivos. Hay que resolverlo antes del lanzamiento. (Ojo: el 19/10 se comprobó que la clave publicable de producción es `pk_live_` con dominio `clerk.www.bbjobs.com.ar`; verificar si este pendiente sigue vigente.)
- **P19 (M1). ¿Buscar dentro del texto del CV?** El 39 % de los candidatos no cargó experiencias (auditoría §5-ter): sin el CV, "vendedor mcdonalds" no encuentra a muchos. El texto del CV extraído y anonimizado solo existe en `candidate_cv_texts` (feat), lo llena la ingesta de IA y por plan legal no corre hasta que rija la versión 3.0. ¿Se separa la extracción local (sin Gemini) de la IA para usarla en el buscador? Lo decide el abogado.

---

## 4. Diseño técnico por pedido

Reglas que aplican a todo:
- toda consulta de empresa filtra por `company_id`, y la de otra empresa da 404 (no 403);
- cada consulta nueva lleva su test de acceso cruzado;
- toda tabla nueva con datos personales se suma a `services/account_deletion.py`;
- las migraciones se prueban solo contra un Postgres local descartable (`backend/.env` apunta a producción) usando `backend/scripts/probar_local_mails.ps1`;
- antes de tocar Next.js 16, leer `frontend/node_modules/next/dist/docs/`.

### 4.1 M1: buscador de postulantes

**Backend** (va a main, sin migración):
- `backend/app/services/applicant_search.py` (nuevo). Reusa `parse_query` y las variantes de `services/job_search.py`: minúsculas, sin tildes, palabras vacías, singular/plural, masculino/femenino, sinónimos de rubro.
  - Separadores: espacio, `+`, `,`, `y`. Se normalizan apóstrofos ("McDonald's" → "mcdonalds").
  - **AND entre palabras, OR entre variantes.** Cada palabra tiene que aparecer, comparando `f_unaccent(lower(campo))`, en alguno de estos campos:
    - `first_name`, `last_name`, `first_name || ' ' || last_name`;
    - `Experience.role_title`, `Experience.company_name`, `Experience.description` (EXISTS, no JOIN, como el filtro actual);
    - `CandidateProfile.summary`, `other_skill`;
    - nombres de `Skill` vía `CandidateSkill`;
    - `Education.degree`, `Education.institution`.
  - Errores de tipeo: para palabras de 5 letras o más que no aparecen literal, `word_similarity >= 0.5` contra `Experience.company_name` y `role_title`. Es el mismo umbral medido del buscador de avisos: "mcdonals"/"mcdonalds" pasa.
  - Devuelve un `match` corto ("Experiencia: Vendedor en McDonald's") para mostrar por qué apareció.
- `GET /me/company/jobs/{id}/applications`: nuevo `q: str | None` (máximo 100 caracteres). `position` sigue por compatibilidad: el frontend lo deja de mandar y en el backend pasa a ser un alias de `q`.
- `GET /admin/jobs/{job_id}/applications` (`admin.py:772`): suma `q` **y los mismos filtros que la empresa**, porque hoy no tiene ninguno. Conviene extraer el armado de filtros a una función común en `applicant_search.py`.
- `GET /admin/candidates` (`admin.py:548-552`): `q` pasa a usar el mismo servicio.

**Frontend:**
- `dashboard/company/postulaciones/page.tsx`: el campo "Posición" se reemplaza por un buscador ancho, "Buscar por nombre, puesto, empresa o habilidad (ej.: vendedor mcdonalds)". `ApplicantFilters.q` en `company/types.ts`. Se muestra el `match` debajo del nombre.
- Lo mismo en `dashboard/admin/busquedas/page.tsx`.

**Rendimiento:** 666 postulantes como máximo por búsqueda, así que la consulta con EXISTS sobre unaccent es trivial. Más adelante, una migración opcional con índices GIN de trigramas sobre `experiences.company_name` y `role_title`, solo si `EXPLAIN` lo pide.

**Etapa 2** (con la compuerta, después de la versión legal 3.0, si se aprueba P19): sumar `candidate_cv_texts.text` como campo con peso 1.

**Tests** (`tests/test_applicant_search.py` puros y `tests/test_applicant_search_db.py`):
- "vendedor mcdonals" encuentra la experiencia "Vendedor" en "McDonald's";
- encuentra por nombre con y sin tilde ("Nahuelfil");
- AND: "vendedor cajero" no trae a quien tiene solo una de las dos;
- **cruce:** la empresa B con el id de una búsqueda de A recibe 404;
- el admin filtra igual que la empresa;
- `q` vacío equivale a sin filtro;
- la paginación sigue estable.

**Impacto en Vercel:** ninguno. Es una página cliente que le pega al backend en Railway.

### 4.2 M3: marca de "ya lo vi"

**Backend (main, sin migración):**
- Al abrir `GET /me/company/candidates/{id}` o el link al CV, completar `applications.seen_at` (si está vacío) de la postulación que viene en `application_id` (validada con `company_id`). Si no viene, de las postulaciones del candidato a búsquedas de esa empresa.
- Sin cambio de estado y sin aviso: con un solo `UPDATE … WHERE seen_at IS NULL`.
- El frontend de main tiene que empezar a mandar `application_id`, como ya hace feat (`postulaciones/page.tsx:147`).

**Ajuste obligatorio en feat al mergear:** `application_events.mark_seen` (`:225`) hoy devuelve `[]` con la compuerta cerrada. Tiene que pasar a:
- con la compuerta cerrada: solo completar `seen_at`;
- con la compuerta abierta: la lógica actual (estado y aviso).

Si no, el merge **apaga** la marca verde en producción.

**Ojo:** las postulaciones vistas antes del lanzamiento ya tendrán `seen_at` y no van a disparar "Vieron tu CV". Es deseable: no sale una avalancha de mails el día del lanzamiento. Hay que documentarlo.

**Frontend:**
- En las filas de `company/postulaciones` y de `company/busquedas` (los dos abren fichas): con `seen_at`, fondo `#E6F4F7` o borde izquierdo verde, más la etiqueta "Visto el dd/mm".
- Al abrir, se actualiza la fila en el momento (`actualizarItems`).
- Filtro opcional "Sin ver / Vistos" con `seen: bool` en el endpoint.

**Si P5 es que sí:** migración `admin_application_views(admin_user_id, application_id, viewed_at)` y el mismo dibujo en `admin/busquedas`. No es un dato personal del candidato más allá del vínculo; al borrarse la postulación corre el CASCADE.

**Tests:**
- abrir la ficha marca `seen_at` una sola vez;
- la empresa B no puede marcar una postulación de A (404 o sin efecto);
- con la compuerta cerrada no hay notificación ni cambio de estado;
- con la compuerta abierta se mantiene el comportamiento de feat (los tests existentes).

**Impacto en Vercel:** ninguno.

### 4.3 M4: aviso de "está en otros procesos"

**Backend** (main o compuerta, según P7; recomendación: main con un interruptor `aviso_otros_procesos_activo` en `site_settings`, apagado hasta publicar la cláusula de privacidad. Es un interruptor de producto, no la compuerta de módulos):
- `services/other_processes.py`: `count_other_processes(db, company_id, candidate_id, now)`. Cuenta postulaciones del candidato con `JobPosting.company_id != company_id`, estado en (`contacted`, `in_process`, `finalist`, `selected`), `status_updated_at >= now - 90d` y `deleted_at IS NULL`. Devuelve `{"en_proceso": n, "seleccionado_reciente": bool}`.
  - **Nunca** nombres de empresas, títulos, fechas ni ids.
- `GET /me/company/applications/{id}/other-processes`: primero valida que la postulación sea de la empresa (`application_events.company_application`; en main, el `select` equivalente con `company_id`).
- Como optimización, el mismo dato puede viajar en la respuesta de `status-preview` (feat).

**Frontend:**
- En main (Tanda 1): un cuadro de confirmación nuevo al cambiar el estado. Al pasar a `in_process` o `selected` muestra "Esta persona está en proceso en otra búsqueda de BBJobs. Es solo informativo: podés contactarla igual." También cubre el mínimo de C-ROJO: "Al guardar, el postulante recibe un aviso en BBJobs."
- En feat, el mismo bloque dentro de `CambioEstadoConNota` y en la ficha.

**Legal:** cláusula en `/privacidad` (versión 2.x en main; se revisa en la 3.0) y, si P7 es que sí, un interruptor en el perfil del candidato: "Mostrar a las empresas que estoy en otros procesos".

**Tests:**
- no cuenta los procesos de la propia empresa;
- no devuelve ningún nombre ni id (aserción sobre el JSON completo);
- la empresa B no consulta una postulación de A (404);
- respeta la ventana de 90 días;
- con el interruptor apagado devuelve `en_proceso: 0`.

**Nota de producto:** con el 95 % de las postulaciones en `new`, al principio el aviso va a salir poco. Mejora a medida que las empresas usen los estados, y los mails de estado ayudan a eso.

**Impacto en Vercel:** ninguno.

### 4.4 C3-bis, C4-bis, C6 y C7: estados del desplegable (fix a main)

- Traer de feat **solo** la parte de estados de `8acedbd`:
  - `models/job.py` (`discarded_interview`, `SELECTABLE_STATUSES`, `NOT_ADVANCED_STATUSES`);
  - la validación de `update_application_status` en main (`applications.py:568-650`): no se puede pasar a un estado fuera de la lista, salvo dejarlo como estaba;
  - `company/types.ts` (`APP_STATUS_SELECTABLE`, `opcionesDeEstado`) y las etiquetas del candidato y del admin;
  - estadísticas y conteos que tratan `discarded` como cerrado sin éxito (`services/applicant_stats.py`, `admin.py` dashboard);
  - el texto de la notificación en la web (`services/notifications.py` y `components/notifications/notification-config.ts`).
- La columna es `String(50)`: sin migración.
- **Tests:** no se puede elegir `contacted` ni `finalist` en una postulación nueva; una postulación vieja en `finalist` puede quedar así; `discarded_interview` cuenta como cerrada en las estadísticas; aviso en la web al candidato.
- **Impacto en Vercel:** ninguno.

### 4.5 E3–E21: textos de Eugenia para empresas (feat/mails-ia, compuerta)

**`backend/app/services/email/copy.py`:**
- Reemplazar las entradas `company_rejected`, `company_suspended`, `company_reactivated`, `company_onboarding_guide`, `job_approved`, `job_rejected`, `job_takedown`, `job_reopened`, `job_deleted`, `job_expiring_soon`, `job_expired`, `job_no_applications`, `job_feature_active`, `job_feature_rejected`, `job_feature_expired`, `talent_pack_active`, `talent_pack_rejected` y `recommended_candidates_new` por los textos literales del PDF (corrigiendo tipeos como "vcambios"), con `source=E`. También `DIGESTS["digest_empresa"]` (E21: "Tu resumen de postulaciones").
- Campos nuevos en `MailCopy`:
  - `voice: Literal["candidato","empresa"]`: el saludo "¡Hola, X!" contra "Hola, X:", y la firma (tagline contra "Saludos, / **Equipo de BBJobs** / Una iniciativa de Talency");
  - `help_whatsapp: bool`: el renglón "Si necesitás ayuda, escribinos por WhatsApp al 291 508-9353", con link.
- Variables nuevas: `{dias}`, `{cantidad}`, `{cantidad_contactos}`.

**`render.py`:**
- `render_email(..., voice=..., help_whatsapp=...)`: el link de WhatsApp lo arma el render desde la configuración, **nunca** desde texto de usuario. El cuerpo sigue escapado y sin links.
- `greeting()` en `copy.py:60` con las dos voces.

**`core/config.py`:** `TALENCY_WHATSAPP = "5492915089353"` (hoy está duplicado en `frontend/src/app/contacto/page.tsx:5` y `components/seo/ConsultaSeleccion.tsx:5`; conviene unificarlo también en el front, en `lib/contacto.ts`).

**Disparadores** (que manden las variables que pide el texto):

| Aviso | Dónde | Cambio |
|---|---|---|
| `job_expiring_soon` (E12) | `scheduler.py:96-104` | `email_vars["dias"] = days_left` |
| `job_expired` (E13) | `scheduler.py:56-62` | `email_vars["dias"] = job.duration_days` |
| `talent_pack_active` (E18) | `webhooks.py:215` | `cantidad_contactos` |
| `talent_pack_granted` (nuevo) | `talent.py:782` | — |
| `job_feature_granted` (nuevo) | `admin.py:1376` (cuando `payload.featured`) | — |
| `recommended_candidates_new` (E20) | `services/ai/jobs.py:205-214` | `cantidad` y `puesto` (o la lista, según P10) |
| `job_approved` (E7) | `admin.py` moderate, `approve` | link a la ficha pública (`core/urls.py`), "Ver mi publicación" |
| `job_feature_rejected` y `talent_pack_rejected` (E16, E19) | — | link a la pantalla de pago (`/dashboard/company/pagos` o la de destacar) |
| `company_rejected` (E3) | — | link a `/dashboard/company/perfil`; sin párrafo "Motivo" si P11 lo confirma |

**`catalog.py`:**
- `job_feature_granted` y `talent_pack_granted` = `_CUENTA`;
- copy y `notification-config.ts` (iconos y textos de la campanita) para los dos tipos nuevos.

**Panel de la empresa (fix a main, P11):** mostrar `verification_notes` en `dashboard/company/perfil` cuando `verification_status == rejected`. Hay que exponerlo en `GET /me/company/profile`; es solo de la propia empresa.

**Vista previa:**
- `backend/scripts/generar_vista_previa.py` y `frontend/src/vista-previa/datos/avisos.json`: regenerar y marcar "Texto de Eugenia" o "Propuesto";
- actualizar `AVISOS-AUTOMATICOS-EUGENIA.pdf`.

**Tests:**
- `tests/test_email_copy.py`: cada `type` del catálogo con `source` coherente, variables sin reemplazar = 0 y un párrafo vacío se omite;
- voz de empresa: saludo con dos puntos y firma "Equipo de BBJobs";
- el link de WhatsApp es el de la configuración y un título de búsqueda con `**` o `<a>` no inyecta nada;
- `tests/test_mails_eugenia_db.py` con E12 y E13 usando los días reales;
- el pack regalado usa `talent_pack_granted`.

**Impacto en Vercel:** ninguno en el envío (el logo `/logo.png` es estático y el matcher de `frontend/src/proxy.ts:129-131` excluye `.png`). Los clics de los mails suman visitas a `/empleos/[id]` y a los paneles: unos cientos a pocos miles por mes. Eso queda dentro de lo que resuelve `perf/optimizacion-vercel`.

### 4.6 M2: notas u observaciones (feat/mails-ia; se libera en la Tanda 4)

**Modelo:** la migración `b6e2d9a4c7f1` **no está en producción**, así que se puede **editar en el lugar** antes del merge, sin migración nueva:
- `application_notes.candidate_id` FK a `candidate_profiles`, NOT NULL, ON DELETE CASCADE (se llena al crear);
- `application_id` pasa a **nullable** (notas desde la Base de Talento o sin postulación);
- `CHECK` que exija `candidate_id`;
- índice `(company_id, candidate_id, created_at)`;
- opcional: `tags varchar[]` con valores de una lista cerrada (P3).

Si Gael prefiere no tocar migraciones ya escritas: migración nueva al final de la cadena, con ese mismo contenido.

**Servicio** (`services/application_events.py`):
- `list_candidate_notes(db, company, candidate_id)`: filtra por `company_id` y `candidate_id`;
- `add_note` acepta `candidate_id` sin postulación, solo si la empresa tiene acceso al candidato: se postuló a una búsqueda suya (`_assert_candidate_applied_to_company`, `applications.py:539-558`) o lo desbloqueó en la Base de Talento.

**Endpoints:**
- `GET /me/company/candidates/{candidate_id}/notes` (todas las de la empresa sobre esa persona);
- `POST /me/company/candidates/{candidate_id}/notes` (privada, sin postulación);
- los de `/applications/{id}/notes` se mantienen;
- en la lista de postulantes, `notes_count` de la propia empresa (subconsulta `count` por `company_id`) para un ícono "tiene observaciones".

**Admin (solo si P1 es que sí):**
- `GET /admin/candidates/{candidate_id}/notes`, de solo lectura, con el nombre de la empresa autora, y un `AuditLog(action="admin_read_notes")` por cada lectura;
- en `admin/candidatos` y `admin/busquedas`, una pestaña "Observaciones de empresas";
- se cambian el texto del panel y `/privacidad`.

**Frontend:**
- `NotasPostulacion.tsx`: un bloque "Observaciones de tu empresa sobre esta persona" en la ficha, con la búsqueda de origen y las etiquetas rápidas;
- el cartel de Ley 23.592 y "registrá hechos, no opiniones";
- también en `company/talento` para los perfiles desbloqueados.

**Liberación:**
- con la compuerta cerrada, las rutas de notas **privadas** salen de `require_new_modules`, con una constante `NOTAS_PRIVADAS_FUERA_DE_COMPUERTA` o con dependencias separadas;
- las **visibles** siguen detrás de la compuerta porque generan avisos;
- el `PATCH` de estado sigue ignorando `note_visible` con la compuerta cerrada.

**`services/account_deletion.py`:**
- **borrado del candidato:** hoy vacía `body` filtrando por `application_id IN (postulaciones del candidato)` (`:196-197`). Tiene que pasar a filtrar por `candidate_id`, para cubrir las notas sin postulación;
- **borrado de la empresa:** se borran las privadas (`:281-285`; se mantiene);
- `preview_deletion` cuenta las notas;
- **vencimiento** (P3): tarea del scheduler que borra las privadas con más de N meses.

**Tests:**
- la empresa B no lista ni crea notas sobre un candidato de A (404), aunque el candidato se haya postulado a las dos: B no ve las de A;
- nota sin postulación solo con acceso (postulación o desbloqueo);
- el candidato nunca recibe una privada (historial, notificación, mail);
- admin: 403 si P1 es que no; lectura con `AuditLog` si es que sí;
- borrado de cuenta: el candidato con notas sin postulación queda con `body` vacío;
- migración ida y vuelta en local.

**Impacto en Vercel:** ninguno.

### 4.7 C-ROJO y C1–C11: verificación (ya construido)

- Revisar en local (`PENDIENTES-BBJOBS.md` §Gael.4) que la vista previa del cambio de estado muestre el texto final de C3–C7 y la nota visible.
- Con la compuerta cerrada, el cuadro de la Tanda 1 (§4.3) cubre el "al menos avisale".
- C10: confirmar que el corte después de 3 reactivaciones sin volver (R8) está en el código (`lifecycle.py`).

### 4.8 PDA (bloqueado hasta P14)

Diseño propuesto, opción (a), "PDA por invitación":
- **Tablas:**
  - `pda_invitations(id, candidate_id FK CASCADE, requested_by_admin_id, job_posting_id null, status [invitado|completado|vencido], invite_url, sent_at, completed_at)`;
  - `pda_results(id, candidate_id FK CASCADE, estilo varchar, informe_url Cloudinary privado, cargado_por_admin_id, visible_para_empresas bool default false, consent_at)`.
- **Flujo:** Talency genera el link en su cuenta de PDA, lo carga en BBJobs y se le notifica al candidato (web y mail `pda_invitation`, propuesto). Talency carga después el resultado (estilo e informe PDF). El candidato siempre ve su resultado. Una empresa lo ve solo en postulaciones propias y con consentimiento expreso del candidato (Anexo A de `MODULOS-MAILS-IA-PLAN.md`).
- **La IA no puntúa** (regla del Anexo A).
- **Datos personales:** en `account_deletion.py` se borran el resultado y el informe de Cloudinary; consentimiento aparte; cláusula legal; perfil conductual de uso restringido.
- **Endpoints:** `require_new_modules` + `require_admin` / `require_candidate`; tests de cruce candidato contra candidato y empresa contra empresa.
- **Impacto en Vercel:** ninguno, salvo que se haga una página pública con render en servidor (no hace falta).

---

## 5. Orden de implementación por tandas

### Tanda 0: prerrequisitos (sin código de los PDFs)

1. **No tocar el checkout sucio.** Gael decide qué hacer con los cambios sin commitear del checkout principal: son una copia de `a51e905`/`661bcf0`, salvo `PaginaListado.tsx` y `EmpresasUI.tsx`. Recomendación: verificar con `git diff origin/main -- <archivos>` y descartarlos, porque el merge de main los trae. Los `.md` y PDFs sueltos (`LEGAL-PLAN.md`, `PROSPECCION-PROPIA-BBJOBS-PLAN.md`, `legal/`, …) se commitean aparte.
2. Mergear `perf/optimizacion-vercel` a `main` (P15 ya resuelta: Vercel Pro).
3. Actualizar `main` local: `git fetch` y `main = origin/main`.

**Listo cuando:** `git status` del checkout limpio y `perf/optimizacion-vercel` en producción.

### Tanda 1: va a `main` como fix independiente (rama `feat/mejoras-postulantes` desde `origin/main`)

Sin migraciones, sin depender de Resend ni Gemini.
1. §4.4: estados del desplegable (C3-bis, C4-bis, C6, C7).
2. §4.1: buscador M1 sobre campos estructurados, para empresa y admin.
3. §4.2: marca verde M3 (`seen_at` al abrir, sin aviso).
4. §4.3: cuadro de confirmación del cambio de estado ("le va a llegar un aviso") y alerta M4, con el interruptor apagado hasta la cláusula de privacidad.
5. §4.5 / P11: `verification_notes` visible en el perfil de la empresa.

**Dependencias:** Tanda 0. M4 se prende recién cuando el abogado aprueba la cláusula.

**Listo cuando:**
- `pytest` OK, incluidos los tests nuevos de búsqueda y cruce, contra una base local;
- `npm run lint` y `next build` OK;
- en un preview, una empresa de prueba busca "vendedor mcdonals" y encuentra al de prueba; abre una ficha y la fila queda verde después de recargar; no aparecen "Contactado" ni "Finalista"; al pasar a "En proceso" aparece el cuadro;
- deploy a prod sin migraciones nuevas (`alembic current` sigue en `a9e3f1c5b7d2`).

**Inmediatamente después:** mergear `origin/main` en `feat/mails-ia`, en un worktree limpio. Conflictos esperables:
- `applications.py`: quedarse con la versión de feat y sumar `q`, `seen_at` sin compuerta y M4;
- `postulaciones/page.tsx` y `company/types.ts`;
- los archivos de SEO: quedarse con main;
- `proxy.ts` y `empleos/[id]`: **siempre gana `perf/optimizacion-vercel`**.

Además, aplicar el ajuste de `mark_seen` de §4.2.

### Tanda 2: textos de empresas (feat/mails-ia, compuerta)

§4.5 completo y vista previa regenerada para que Eugenia la revise.

**Listo cuando:**
- ningún aviso de empresa del PDF queda como `propuesto`;
- `scripts/generar_vista_previa.py` muestra E3–E21 con firma y WhatsApp;
- tests de copy y de mails OK;
- Eugenia responde P8–P13.

### Tanda 3: notas a lo Eugenia (feat/mails-ia)

§4.6 según P1–P3: la migración `b6e2d9a4c7f1` editada, endpoints por candidato, admin con auditoría si corresponde, vencimiento, `account_deletion`.

**Listo cuando:**
- tests de cruce, de borrado y de admin OK;
- migración ida y vuelta en local desde `a9e3f1c5b7d2` hasta el head;
- en local, la empresa A ve sus observaciones en una segunda búsqueda y la empresa B no las ve;
- texto legal actualizado en el borrador.

### Tanda 4: merge de `feat/mails-ia` a `main` con la compuerta cerrada (ver §7)

Después del merge, se liberan las notas privadas fuera de la compuerta (P17).

**Listo cuando:** se cumple la lista de §7.2 y, en producción con `MODULOS_NUEVOS_ACTIVOS=false`:
- `alembic current` = head de feat;
- `email_outbox` vacío durante 72 h;
- rutas nuevas en 404, salvo las notas privadas;
- smoke de los tres roles sin errores.

### Tanda 5: búsqueda en el texto del CV y PDA (compuerta)

- §4.1, etapa 2, cuando rija la versión legal 3.0 y P19 esté aprobado;
- §4.8 cuando haya respuesta a P14 y material o licencia de PDA.

**Listo cuando:** en local, la búsqueda trae candidatos sin experiencias cargadas que tienen el término en el CV; el flujo PDA queda probado con una invitación de prueba.

### Tanda 6: lanzamiento

Según `MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md` §10.F y §7.3 de este plan.

---

## 6. Riesgos y costos

### Riesgos

| Riesgo | Mitigación |
|---|---|
| **CPU de Vercel** | Ningún pedido de los PDFs agrega render en servidor ni trabajo en `proxy.ts`. Todo es panel cliente contra Railway, o mails que se arman en el backend. Lo que sí trae CPU es **el merge de feat**: `empleos/[id]/page.tsx` (+162/−), `empresas/[id]/page.tsx` (+188, renderizada en servidor), `empleos/layout.tsx`, `trabajo-en/[zona]`, `empleos-de/[rubro]`, `llms.txt`, `proxy.ts` (+22). Hay que revisarlo contra `perf/optimizacion-vercel` antes de la Tanda 4. |
| **Entregabilidad** | "Vieron tu CV", con empresas que recorren cientos de fichas, suma unos 1.000–1.500 mails/mes. Los topes R4 (2 por día), `once_per_day` y el calentamiento (`EMAIL_DAILY_CAP=150` y subir) ya existen. Una o dos semanas solo transaccionales; mail-tester y casillas de prueba (Gmail, Outlook, Yahoo) antes de abrir el tope. |
| **Prospección (Ley 25.326 y política de Resend)** | Cuenta de Resend aparte, `PROSPECT_FROM_EMAIL` en `contacto.bbjobs.com.ar`, `PROSPECT_DAILY_CAP=20`, `List-Unsubscribe` de un clic (`prospect_dispatch.py:85, 167`), filtro de dominios personales (`prospects.py:38`). Falta revisar: que el mail lleve razón social y domicilio de Talency, que se excluyan las casillas con nombre de persona (`juan@empresa`) y el Registro No Llame antes de cualquier llamado. |
| **Notas** | Derecho de acceso (art. 14); posible contenido discriminatorio (Ley 23.592); lectura de admin (P1). Mitigación: carteles, etiquetas, vencimiento, auditoría y abogado. |
| **"Otros procesos"** | Se le comunica a un tercero un dato del candidato. Sin nombres, con cláusula de privacidad y quizás oposición (P7). |
| **Merge grande** | ~43 mil líneas y 9 migraciones; `payments.company_id` pasa a nullable (Revisión de CV) y `CREATE EXTENSION vector`. Mitigación: ensayo sobre una copia de la base de producción (§7). |
| **Clerk en modo test en producción** | Bloqueante para lanzar mails a la base real (P18). |
| **PDA** | Licencia y propiedad intelectual: no copiar el cuestionario. |

### Costos mensuales estimados (cambios que traen estos pedidos y el lanzamiento)

| Concepto | Hoy | Con lanzamiento |
|---|---|---|
| Vercel Pro | Hobby (bloqueado) | USD 20 por miembro + uso (lo dimensiona `perf/optimizacion-vercel`) |
| Resend avisos (Pro, 50 mil/mes) | — | **USD 20** (~14–17 mil mails/mes con "Vieron tu CV" y los mails a empresas) |
| Resend prospección (cuenta aparte, gratis: 3.000/mes, 100/día) | — | USD 0 con un tope de 20 por día |
| Gemini | — | ≈ USD 4,5 (≈ 13 si el volumen se triplica; auditoría §5-ter), más USD 1–2 de automatizaciones |
| Railway | igual | +USD 2–5 estimado (dispatcher cada 60 s, scheduler, pgvector de unos 75 MB) |
| PDA | — | Lo que cobre PDA por evaluación (licencia de Talency) |
| M1–M4 | — | **USD 0 extra** (consultas a Postgres) |

---

## 7. Merge de `feat/mails-ia` a `main`

### 7.1 Estrategia

1. **Un solo merge (no rebase)** de `feat/mails-ia` a `main`. Va **después** de las Tandas 1–3 y de haber mergeado `origin/main` en feat (que incluye `perf/optimizacion-vercel` y la Tanda 1). Se hace en un worktree nuevo, nunca en el checkout sucio. Se mantienen los commits (son la historia de las decisiones) y se agrega un commit de merge.
2. **Migraciones:** hoy la cadena es lineal desde el head de prod (`a9e3f1c5b7d2` → … → `b4c6d8e0f2a1`). Regla: **la Tanda 1 no agrega migraciones**. Si alguna fix de main necesitara una, se pone sobre `a9e3f1c5b7d2` y se cambia el `down_revision` de `b1e4c7a2d905` (ya se hizo así en `b9ccb0a`). Antes de mergear, `alembic heads` tiene que dar **un solo head**.
3. **Conflictos:**
   - SEO, `proxy.ts` y fichas renderizadas en servidor: gana `main` / `perf/optimizacion-vercel`;
   - `applications.py`, `postulaciones/page.tsx` y `types.ts`: la versión de feat más lo de la Tanda 1;
   - `CLAUDE.md`: se combinan.
4. **PR** de `feat/mails-ia` a `main` con la descripción del alcance y la lista de §7.2. Se deploya con la compuerta cerrada (`MODULOS_NUEVOS_ACTIVOS=false` en Railway, `NEXT_PUBLIC_MODULOS_NUEVOS` sin definir en Vercel).

### 7.2 Antes de mergear

- [ ] Suite completa con `backend/scripts/probar_local_mails.ps1` (481 tests o más, y los nuevos) en una base descartable con pgvector.
- [ ] **Ensayo de migraciones sobre una copia de producción.** `pg_dump` de Railway restaurado en un Postgres local, `alembic upgrade head`, `downgrade a9e3f1c5b7d2` y `upgrade head` otra vez. Revisar en particular:
  - `c5e1a9d3b7f2`: `payments` con datos reales, el `CHECK num_nonnulls` y las consultas de `admin.py` y `account_deletion.py` que unen `payments` con `company_profiles`;
  - `e8b2c4d6f1a3`: `CREATE EXTENSION vector`. Railway tiene pgvector 0.8.6 disponible y la app se conecta como superusuario; si se pasa al rol de mínimo privilegio de `SEGURIDAD-PLAN.md`, la extensión la crea el dueño de la base antes.
- [ ] Tiempo de la migración sobre la copia: la del deploy corre en el `Dockerfile` y bloquea el arranque.
- [ ] `next build` **sin** `NEXT_PUBLIC_MODULOS_NUEVOS`: ninguna pantalla nueva visible para empresa ni candidato; el admin muestra "En desarrollo".
- [ ] Con la compuerta cerrada: rutas nuevas en 404 (`tests/test_features_gate.py`); el scheduler no registra tareas nuevas; `create_notification` no encola mails; `mark_seen` solo marca `seen_at`.
- [ ] Revisión de CPU de los archivos de frontend que trae feat (§6, primera fila), contra `perf/optimizacion-vercel`.
- [ ] `services/account_deletion.py` cubre cada tabla nueva con datos personales: `application_notes` (con `candidate_id`), `cv_review_orders`, `candidate_cv_texts`, `candidate_chunks`, `candidate_summaries`, `email_outbox`, `job_alerts`, prospectos y, si se hace, `pda_*`. `preview_deletion` cuenta todo.
- [ ] Respaldo de la base de producción justo antes del deploy.

### 7.3 Antes de prender `MODULOS_NUEVOS_ACTIVOS`

- [ ] 72 h o más en producción con la compuerta cerrada, sin errores nuevos en Railway; `email_outbox` y `ai_usage_log` vacíos.
- [ ] **Legal:** versión 3.0 publicada y vigente; registro de aceptación funcionando (ya en prod: `90a2b1b`). Incluye las cláusulas de notas (P1), "otros procesos" (P7), IA, subprocesadores (Resend, Google) y PDA si aplica.
- [ ] **Clerk fuera del modo test** y usuarios de prueba borrados (P18).
- [ ] **Resend:**
  - cuenta Pro de avisos con `avisos.bbjobs.com.ar` y `novedades.bbjobs.com.ar` (SPF, DKIM, DMARC), **sin tocar los registros de Clerk** (`clerk-www.bbjobs.com.ar.zone`);
  - cuenta aparte para `contacto.bbjobs.com.ar`;
  - webhooks `/api/v1/webhooks/resend` y `/resend-prospeccion` con sus secretos;
  - seguimiento de aperturas y clics solo en `novedades.`.
- [ ] **Variables en Railway:** `RESEND_*`, `PROSPECT_*`, `EMAIL_DAILY_CAP=150`, `PROSPECT_DAILY_CAP=20`, `GEMINI_API_KEY` (con facturación y tope), `AI_DAILY_BUDGET_USD`, `LEADGEN_SYNC_SECRET`, `TALENCY_WHATSAPP`. En Vercel: `NEXT_PUBLIC_MODULOS_NUEVOS=true` en el mismo deploy.
- [ ] Eugenia aprobó la vista previa completa (C1–C11 y E1–E21; los propuestos marcados).
- [ ] Mails de prueba a casillas propias en Gmail, Outlook y Yahoo; puntaje en mail-tester; la baja de un clic (`/baja`) y "Administrar notificaciones" funcionan.
- [ ] Todos los interruptores de `site_settings` apagados al prender la compuerta. Se prenden en este orden:
  1. Revisión de CV;
  2. mails transaccionales (1–2 semanas, subiendo `EMAIL_DAILY_CAP` cada semana);
  3. resúmenes;
  4. IA (backfill de embeddings solo con la 3.0 vigente);
  5. campañas;
  6. prospección.
- [ ] Monitoreo del freno por salud (R12: rebotes > 4 %, quejas > 0,08 %) y del freno de gasto de IA (R13) con alerta al admin, probados en modo simulación.

---

## Archivos críticos para implementar

- `backend/app/api/v1/applications.py`
- `backend/app/services/application_events.py`
- `backend/app/services/email/copy.py` (y `render.py`, `catalog.py` en la misma carpeta)
- `frontend/src/app/dashboard/company/postulaciones/page.tsx` (y `frontend/src/components/dashboard/NotasPostulacion.tsx`)
- `backend/app/services/account_deletion.py` (y `backend/alembic/versions/b6e2d9a4c7f1_application_notes.py`)

Otros que se tocan: `backend/app/services/job_search.py` (se reusa en el buscador), `backend/app/api/v1/admin.py` (`:530-552`, `:772-790`, `:1376`), `backend/app/core/scheduler.py` (`:56-104`), `backend/app/services/ai/jobs.py` (`:180-215`), `backend/app/api/v1/talent.py` (`:782`), `backend/app/models/job.py`, `frontend/src/app/dashboard/company/types.ts`, `frontend/src/app/dashboard/admin/busquedas/page.tsx`, `backend/app/core/features.py`.
