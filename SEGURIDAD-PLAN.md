# Plan de Seguridad — BBJobs

> Plan formal de endurecimiento de seguridad, relevado contra el código real el 2026-07-16.
> Complementa `DEPLOY-PLAN.md` (que cubre la infraestructura); acá está el detalle de todo lo que
> hace a la seguridad del sistema, priorizado con honestidad. Bloques A→K para poder tildar a
> medida que se ejecuta.

---

## 0. La verdad sobre "100% segura"

**No existe.** Ningún sitio lo es, y cualquiera que lo prometa está mintiendo o no sabe. Lo que sí
es alcanzable, y es lo que persigue este plan:

1. **Sin agujeros conocidos** — que nada de lo que ya sabemos que está mal quede sin arreglar.
2. **Mínimo privilegio** — que si algo se compromete, el radio de la explosión sea chico.
3. **Capas** — que un solo error no sea suficiente para que alguien entre.
4. **Visibilidad** — que si pasa algo, te enteres. No podés responder a un ataque que no ves.

La seguridad no es un estado que se alcanza, es una propiedad que se mantiene. Este plan te deja
en un punto sólido para lanzar; no te exime de revisarlo cuando el sistema crezca.

---

## 1. Punto de partida real (lo que ya está bien)

Relevado contra el código, no asumido. Vale la pena decirlo porque el sistema **no** está
desprotegido hoy:

- **Autenticación delegada a Clerk** — no manejamos contraseñas, no hay hashing propio que
  podamos hacer mal, no hay reset de contraseña casero. Clerk maneja brute force, enumeración de
  cuentas y rotación de sesión. Esto es una decisión de arquitectura que ya te evitó toda una
  categoría de vulnerabilidades.
- **Rutas protegidas a nivel proxy** — `frontend/src/proxy.ts` (era `middleware.ts` antes de
  Next 16) corre `clerkMiddleware` con `auth.protect()` sobre `/dashboard(.*)` y
  `/onboarding(.*)`. La protección no depende de que un componente se acuerde de chequear.
- **Autorización por endpoint** — cada ruta filtra por `company_id`/`candidate_id`, y los
  chequeos de rol pasan por `require_role`/`require_verified_company` en `app/api/deps.py`.
- **ORM en todos lados** — SQLAlchemy parametriza las queries; no hay concatenación de SQL con
  input de usuario en ninguna ruta.
- **Webhook de Mercado Pago bien diseñado** — nunca confía en el payload entrante: re-consulta el
  pago contra la API de MP con `data.id` y usa *eso* como fuente de verdad. Un webhook falsificado
  no alcanza para activar un destacado, incluso sin firma. Además hay idempotencia por
  `mp_event_id`.
- **Secretos fuera del repo** — verificado: `backend/.env` y `frontend/.env.local` están
  gitignoreados y **nunca** fueron commiteados en toda la historia del repo
  (`git log --all --full-history` sobre esos paths no devuelve nada).
- **CORS explícito** — lista de orígenes concreta, sin wildcard con `allow_credentials=True`
  (que sería el error clásico).
- **Rate limiting** — implementado el 2026-07-16 sobre `POST /contact` (5/min) y onboarding
  (10/min). *(Antes de esa fecha `slowapi` estaba instalado pero ningún endpoint lo usaba.)*
- **Moderación humana de búsquedas** — toda búsqueda pasa por un admin antes de ser pública.
  No es un control de seguridad, pero sube el costo de varios ataques de contenido.

---

## 2. Bloques del plan

### A. 🔴 Fix del JSON-LD — inyección de script (bug introducido el 2026-07-16)

**Esto lo rompí yo en esta misma sesión**, al agregar los datos estructurados de SEO. Lo encontré
al revisar el código para armar este plan y es el ítem más urgente de la lista.

En `frontend/src/app/empleos/[id]/page.tsx`:
```tsx
dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
```

`JSON.stringify` escapa comillas, pero **no escapa `<`**. Si el `description` o el `title` de una
búsqueda contuviera `</script><script>alert(1)</script>`, el parser HTML del navegador cierra el
`<script type="application/ld+json">` antes de tiempo y ejecuta lo que sigue. Es XSS clásico de
JSON-LD.

**Explotabilidad hoy:** moderada-baja — hace falta ser una empresa verificada, publicar una
búsqueda con payload en la descripción, y que un admin la apruebe. La moderación es una barrera
real, pero es una persona leyendo texto para evaluar calidad, no escaneando payloads de XSS. No
es un control de seguridad.

**Fix:** escapar `<` como `<` antes de inyectar. Es válido dentro de un string JSON y parsea
de vuelta a `<`, así que el JSON-LD sigue siendo semánticamente idéntico para Google, pero el
parser HTML nunca ve `</script>`:
```tsx
JSON.stringify(jsonLd).replace(/</g, "\\u003c")
```

- [x] ✅ **Resuelto 2026-07-16** — aplicado en `/empleos/[id]/page.tsx`.
- [x] ✅ Confirmado con `grep -r dangerouslySetInnerHTML frontend/src`: era el único uso en todo
      el proyecto. No queda ningún otro punto de inyección de HTML sin sanitizar.

---

### B. 🟡 Corregir `CLAUDE.md` — la mentira sobre RLS

Hoy `CLAUDE.md` afirma:

> **Row-Level Security**: `app/db/rls.py` sets `SET LOCAL app.current_user_id` / `app.user_role`
> per request so Postgres RLS policies scope data access (e.g. a candidate's profile is only
> visible to companies they applied to).

**Es falso.** Verificado con grep sobre todo `backend/alembic/`: no existe **ninguna** migración
con `ENABLE ROW LEVEL SECURITY` ni `CREATE POLICY`. `set_rls_context` setea dos variables de
sesión que **nadie lee**. El aislamiento de datos hoy es 100% a nivel de aplicación.

Esto es peligroso justamente por lo contrario de lo que parece: te hace creer que tenés una
segunda capa de defensa que no tenés. Si mañana un endpoint nuevo se olvida un filtro, nadie lo
atrapa — pero la documentación dice que sí.

- [x] ✅ **Resuelto 2026-07-16** — sección reescrita en `CLAUDE.md` con el estado real: contexto
      de sesión seteado por request, sin políticas RLS aplicadas, aislamiento sólo a nivel
      aplicación, y nota de que el rol de conexión es superusuario (ver bloque E).
- [x] ✅ `set_rls_context` se deja tal cual (código inofensivo, queda listo para cuando se
      implementen las políticas del bloque F) — no se tocó, es una decisión, no un olvido.

---

### C. ✅ Headers de seguridad HTTP — resuelto 2026-07-16, con CSP estricta (nonce)

Hoy `next.config.ts` está prácticamente vacío y no hay ningún header de seguridad configurado.
Esta es la mejora de mejor relación impacto/esfuerzo de todo el plan.

**Decisión de diseño — CSP con nonce, no la opción conservadora.** La documentación de Next.js
ofrece dos caminos, con esta diferencia:

| | Con nonce (elegido) | Sin nonce |
|---|---|---|
| Bloquea XSS inline | ✅ Sí | ❌ No (requiere `'unsafe-inline'`) |
| Renderizado | Fuerza dinámico en todas las páginas | Mantiene estático |
| Cache de CDN de las páginas | Deshabilitado | Funciona |

Mi primera recomendación había sido la opción sin nonce, para no perder el prerenderizado
estático que acabamos de construir para SEO. El usuario pidió explícitamente lo más seguro
posible sin importar el costo — se implementó la opción con nonce. Importante: esto **no**
deshace el trabajo de SEO (`sitemap.ts`, `robots.ts`, `generateMetadata`, JSON-LD) — esas piezas
siguen funcionando igual, sólo cambia que las páginas ahora se renderizan por request en vez de
servirse desde HTML pregenerado en build time (confirmado con `npm run build`: todas las rutas
pasaron de `○` estático a `ƒ` dinámico, excepto `robots.txt`/`sitemap.xml`, que son route
handlers aparte y no heredan la config del layout).

**Implementado:**
- `frontend/src/proxy.ts` (antes `middleware.ts` — renombrado en Next 16): genera un nonce por
  request dentro del mismo `clerkMiddleware` ya existente, arma la CSP, y setea todos los headers
  en la respuesta.
- `frontend/src/app/layout.tsx`: `export const dynamic = "force-dynamic"` en el layout raíz —
  aplica a todo el árbol de rutas de una sola vez, requerido porque una página estática no tiene
  request del que sacar un nonce (sus scripts quedarían sin el atributo y la CSP los bloquearía).
- `frontend/next.config.ts`: `poweredByHeader: false`.

**Hallazgo real durante la verificación (no una suposición):** el primer intento usaba
`'strict-dynamic'` junto al nonce, tal como sugiere el ejemplo "recomendado" de la doc de
Next.js. Probado con Playwright contra la instancia real de Clerk, **rompió el login**: Clerk
inyecta su propio `<script src="https://improved-crab-40.clerk.accounts.dev/...">` directo en el
HTML servido, sin nonce — no es un script "cargado por un script ya confiable" (que es lo único
que `strict-dynamic` deja pasar), así que quedó bloqueado. Y por spec de CSP3, `'strict-dynamic'`
hace que el navegador **ignore** cualquier dominio explícito en `script-src`, así que agregar el
dominio de Clerk al lado de `strict-dynamic` no lo hubiera arreglado. Se sacó `'strict-dynamic'`
y se agregó el dominio de Clerk (`https://*.clerk.accounts.dev`) directo a `script-src` — nonce
para lo que genera Next.js, dominio explícito para Clerk, nada más. `style-src` usa
`'unsafe-inline'` a propósito (CSP no soporta nonce para atributos `style=""`, sólo para
`<style>`/`<link>`; inyección de CSS es un riesgo mucho menor que el de JS).

**CSP final** (`connect-src`/`img-src`/`frame-src` incluyen Cloudinary, Clerk y el origen del
backend, derivado de `NEXT_PUBLIC_API_URL`):
```
default-src 'self';
script-src 'self' 'nonce-{random}' https://*.clerk.accounts.dev;
style-src 'self' 'unsafe-inline';
img-src 'self' blob: data: https://res.cloudinary.com https://img.clerk.com;
font-src 'self' data:;
connect-src 'self' {api origin} https://*.clerk.accounts.dev;
frame-src 'self' https://*.clerk.accounts.dev;
worker-src 'self' blob:;
object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'; upgrade-insecure-requests;
```

⚠️ **Pendiente para cuando Clerk pase a producción** (`DEPLOY-PLAN.md` bloque G): si se configura
un dominio custom de Clerk (ej. `clerk.bbjobs.com.ar`) en vez de seguir en `*.clerk.accounts.dev`,
hay que sumarlo a `script-src`/`connect-src`/`frame-src` en `proxy.ts` — el wildcard actual no lo
cubre. Ya queda un comentario explícito en el código marcando esto.

**Verificación real, no sólo build verde:**
- `npm run build`: todas las rutas de página pasaron a `ƒ` (dinámico); `robots.txt`/`sitemap.xml`
  siguen `○` estático (no forman parte del árbol de `layout.tsx`, no se ven afectados).
- `curl -sI http://localhost:3000/`: confirmó los 6 headers presentes y bien formados, y que
  Next.js propaga el nonce automáticamente a sus propios recursos (`link: preload...
  nonce="..."` en el header de fonts).
- Playwright contra el dev server real: 0 violaciones de CSP en consola en `/`, `/empleos`,
  `/login`, `/register`, `/dashboard/candidate`.
- Screenshot + conteo de elementos (`[class*='cl-']`) en `/login`: **61 elementos de Clerk
  renderizados**, widget completo y funcional (Google OAuth, email, botón continuar) — no sólo
  "sin errores en consola", confirmado visualmente que el login realmente funciona bajo la CSP
  estricta.
- Se encontró y mató en el camino un proceso `node.exe` zombie de una corrida de prueba anterior
  que había quedado colgado en el puerto 3000 y hacía fallar los intentos siguientes — no era un
  problema de CSP, era higiene de proceso. Anotado acá por si vuelve a pasar: `netstat -ano` +
  filtrar por el puerto para encontrar el PID.

---

### D. 🟡 MFA obligatorio para admins (al pasar Clerk a producción)

El panel de admin es el objetivo de mayor valor de todo el sistema: aprueba empresas, ve **todos**
los perfiles de candidatos sin restricción (`GET /admin/candidates/{id}` no tiene chequeo de
acceso, por diseño), incluyendo CVs, teléfonos, fechas de nacimiento. Es la caja fuerte de datos
personales.

Una sola contraseña de admin comprometida = filtración total de PII.

- [ ] Activar MFA en Clerk y **exigirlo para las cuentas de rol admin**. Clerk lo soporta nativo;
      es configuración, no código.
- [ ] Hacerlo en el momento de crear la instancia de producción (bloque G de `DEPLOY-PLAN.md`),
      antes de crear las cuentas admin reales de Talency.

Alto impacto, esfuerzo casi nulo. De los ítems 🟡, éste es el que más recomiendo no saltear.

---

### E. ✅ Rol de base de datos con mínimo privilegio — resuelto 2026-07-16

**Hallazgo verificado** (corrido contra la base real de Railway):
```
current_user=postgres  rolsuper=True  rolbypassrls=True
candidate_profiles owner=postgres
```

El backend se conectaba a Postgres **como superusuario**. Si algún día se filtra el `.env`, o
aparece una inyección SQL en cualquier lado, el atacante no leía algunos datos: tenía
superusuario. Borra todo, crea roles, lee todo, se persiste. Este era un riesgo real **e
independiente de RLS** — el pedazo genuinamente valioso que estaba escondido dentro de la
discusión de políticas, y el usuario pidió resolverlo apenas se aclaró esto (RLS en sí se
descartó — ver bloque F).

**Implementado y verificado contra la base real de Railway** (no hay staging — se hizo con
cuidado, probando cada paso antes de dar el cambio por bueno):

- `backend/scripts/create_app_user_role.py` (nuevo, queda en el repo — es idempotente, se puede
  re-correr si se provisiona un Postgres nuevo en el deploy a Railway): crea el rol `app_user`
  (`LOGIN`, sin `SUPERUSER`/`CREATEDB`/`CREATEROLE`), le otorga `SELECT, INSERT, UPDATE, DELETE`
  sobre las 37 tablas existentes en el schema `public` (nada de `ALL PRIVILEGES`, nada de
  ownership), y configura `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` para que las tablas que
  cree Alembic en migraciones futuras hereden esos mismos grants automáticamente — sin esto,
  cada migración nueva habría necesitado un `GRANT` manual aparte. La password se genera adentro
  del script con `secrets.token_urlsafe(32)` y **nunca se imprime** — sólo queda escrita en
  `backend/.env`.
- **Split de `DATABASE_URL`**: como Alembic necesita DDL (`CREATE TABLE`/`ALTER TABLE`) que
  `app_user` no tiene, se agregó `MIGRATIONS_DATABASE_URL` (nueva en `app/core/config.py`,
  con fallback a `DATABASE_URL` si no está seteada — no rompe nada para quien no haya hecho el
  split). `alembic/env.py` ahora arma la conexión con `settings.migrations_database_url` en vez
  de `settings.DATABASE_URL`. Resultado: `DATABASE_URL` = `app_user` (lo que usa la app en cada
  request), `MIGRATIONS_DATABASE_URL` = `postgres` (lo que usa `alembic upgrade head`).
- **Verificación real, no asumida** (`backend/scripts/verify_app_user_privileges.py`, corrido y
  borrado después de confirmar):
  - `app_user`: `SELECT` contra `industries` — OK. `CREATE TABLE` — **rechazado** con
    `ProgrammingError`, confirmando que el mínimo privilegio funciona de verdad, no sólo que se
    configuró.
  - `postgres` (vía `MIGRATIONS_DATABASE_URL`): `CREATE`/`DROP TABLE` — OK, Alembic sigue
    pudiendo migrar.
  - `alembic current` corrido de verdad: conecta con el rol de migraciones, confirma `head`
    (`e9f2a6c4b8d1`).
  - **Servidor real levantado** (`uvicorn`, no sólo import) contra la `DATABASE_URL` nueva, y
    probado con requests HTTP reales: `GET /health` (200), `GET /catalogs/industries` (SELECT vía
    ORM, 11 filas), `GET /jobs` (SELECT con joins), `POST /contact` (INSERT vía ORM, dispara
    `notify_all_admins` — otro INSERT). Los datos de prueba insertados se borraron después.
- `.env.example` actualizado con las dos variables y una nota de por qué existen dos.

**Pendiente, no de código:** si al armar el deploy a Railway (`DEPLOY-PLAN.md` bloque D) se
provisiona un Postgres **nuevo** (addon separado del que se usó hoy), hay que volver a correr
`create_app_user_role.py` contra esa base — está pensado para eso, es idempotente.

---

### F. ⚪ Políticas RLS reales — descartado, decisión del usuario (2026-07-16)

**No se va a hacer.** Confirmado explícitamente por el usuario tras la explicación de este
bloque ("mejor sin RLS no es necesario"). Con el bloque E ya resuelto, RLS pasó de "sería código
muerto" a "técnicamente posible" — pero la razón de fondo para no hacerlo nunca fue sólo el
bloqueo técnico, sino que la app ya tiene autorización real a nivel de aplicación y RLS sería una
segunda capa redundante para esta arquitectura (ver razones abajo). Queda documentado para que
sea una decisión consciente y registrada, no un olvido — si en el futuro cambia algo estructural
(ver condiciones al final), es una decisión a reabrir, no a asumir.

Por qué no es vital:
- RLS es una **segunda** red debajo de la primera. La primera —el filtro por endpoint— existe y
  está hecha con cuidado.
- El navegador nunca habla con Postgres: siempre pasa por FastAPI. La frontera de seguridad real
  es la capa de aplicación, y esa capa está puesta. RLS es imprescindible en arquitecturas donde
  el cliente habla directo con la base (Supabase, PostgREST) — **no es el caso de BBJobs**.
- La mayoría de las apps SaaS de esta escala no usan RLS. No es negligencia: es que el
  costo/beneficio no cierra cuando ya tenés autorización en la app.

Por qué seguía siendo riesgoso incluso después del bloque E:
- No hay staging ni suite de tests. Una política que no matchee exactamente algún patrón de
  acceso no falla con un error en un log — falla con "un usuario legítimo dejó de ver sus propios
  datos en producción".
- El admin necesita bypass total en varios endpoints, lo que agrega casos especiales a cada
  política.

**Condiciones para reabrir esta decisión** (no automáticas — si se cumplen, vale la pena
replantearlo, no implementarlo sin más):
1. Existe un ambiente de staging, o al menos una base descartable donde probar.
2. Existen tests de autorización por rol (ver bloque J), que son los que avisarían si una
   política rompió algo.
3. Cambia algo estructural en cómo se accede a los datos (ej. se suma un cliente que hable
   directo con Postgres, no sólo a través de FastAPI) — ahí RLS deja de ser una segunda capa
   redundante y pasa a ser la única frontera real.

Alcance estimado cuando se haga: 1 migración, políticas sobre ~5-8 tablas sensibles
(`candidate_profiles`, `company_profiles`, `applications`, `job_postings`, `notifications`,
`payments`, `job_features`), bypass explícito para admin, y prueba de cada rol contra una base
real.

---

### G. 🟡 Rotación de secretos al pasar a producción

Todas las credenciales actuales vivieron en una máquina de desarrollo. No hay indicio de que se
hayan filtrado (están gitignoreadas y nunca se commitearon, verificado), pero la higiene dice que
las credenciales de producción deberían nacer nuevas.

- [ ] `SECRET_KEY` — generar uno nuevo para producción (no reusar el de dev).
- [x] ✅ Contraseña de la base — resuelto de paso al hacer el bloque E: `app_user` nació con una
      password generada con `secrets.token_urlsafe(32)`, nunca expuesta en ningún log ni
      transcript. Sigue viva la contraseña vieja de `postgres` (ahora sólo usada para
      migraciones, vía `MIGRATIONS_DATABASE_URL`) — evaluar rotarla también si en algún momento
      hay sospecha de exposición, aunque su radio de uso quedó mucho más acotado.
- [ ] `CLOUDINARY_API_SECRET` — evaluar rotarlo al pasar a producción.
- [ ] `ADMIN_PASSWORD` — ya no tiene default inseguro en el código (arreglado el 2026-07-16:
      `seed.py` ahora hace `raise SystemExit` si no está seteada), pero **hay que setear una
      contraseña real fuerte** en el `.env` de producción antes de correr el seed. Combinar con el
      MFA del bloque D.
- [ ] Confirmar que ningún secreto quede en variables `NEXT_PUBLIC_*` — todo lo que lleva ese
      prefijo se embebe en el bundle del navegador y es **público por definición**. Hoy está bien
      (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` es pública por diseño), pero es un error fácil de
      cometer a futuro.

---

### H. ⚪ Validación de uploads por contenido real

`upload_logo` y `upload_verification_document` validan el tipo de archivo con
`file.content_type` — que lo manda el cliente y es **falsificable**. Los límites de tamaño (2MB
logos, 5MB documentos) sí están bien puestos.

**Severidad baja**, y vale la pena explicar por qué y no inflarlo: los archivos se sirven desde
`res.cloudinary.com`, no desde `bbjobs.com.ar`. Un archivo malicioso subido como PDF falso viviría
en el dominio de Cloudinary, cross-origin respecto del sitio — no puede tocar la sesión del
usuario en BBJobs. Es un problema, pero no es *tu* problema de XSS.

- [ ] ⚪ Validar por magic bytes (los primeros bytes del archivo) además del `content_type`
      declarado.

---

### I. ⚪ Auditoría de dependencias

- [ ] Correr `npm audit` en `frontend/` y evaluar lo que aparezca.
- [ ] Auditar las dependencias de Python (`pip-audit` o similar) — no está en `pyproject.toml`
      hoy.
- [ ] ⚪ Evaluar Dependabot en GitHub — avisa de CVEs nuevos sin que tengas que acordarte de
      revisar. Es gratis y ya tenés el repo en GitHub.

---

### J. 🟡 Visibilidad — no podés defender lo que no ves

Esto es seguridad aunque no lo parezca: sin visibilidad, un ataque exitoso es indistinguible de
"la app anda bien".

- [ ] `SENTRY_DSN` en Railway — el SDK ya está instalado y `sentry_sdk.init()` ya está en
      `main.py`, condicionado a que la variable exista. Es sólo cargar el DSN.
- [ ] 🟡 Sentry en el frontend — hoy **no hay ningún error tracker**. Un XSS o un error de auth
      del lado del cliente no se ve en ningún lado salvo que un usuario lo reporte.
- [ ] ⚪ Tests de autorización por rol — que un candidato no pueda leer el perfil de otro, que una
      empresa no vea postulantes de búsquedas ajenas, que un no-admin reciba 403 en `/admin/*`.
      Hoy `backend/tests/` está vacío y `pytest` ni siquiera es dependencia. Es también el
      prerrequisito nº3 del bloque F.
- [ ] ⚪ Alertas de Sentry ante error nuevo (email/Slack).

---

### K. Consideración de datos personales (Ley 25.326)

No es seguridad contra ataques, pero es riesgo real y conviene tenerlo anotado: el sistema
almacena datos personales sensibles de candidatos (CV, teléfono, fecha de nacimiento, sexo). En
Argentina eso cae bajo la Ley 25.326 de Protección de Datos Personales.

- [ ] Confirmar que la página `/privacidad` (que ya existe) refleja qué datos se recolectan, con
      qué fin, y cómo se ejerce el derecho de acceso/rectificación/supresión.
- [ ] El borrado de cuenta ya está implementado (`DELETE /me/account`: soft-delete de candidato,
      anonimización de empresa) — confirmar que alcanza para el derecho de supresión.
- [ ] ⚪ Evaluar si corresponde inscribir la base de datos ante la AAIP. Consultar con Talency;
      excede lo técnico.

---

## 3. Lo que NO vamos a hacer (y por qué)

Decisiones explícitas, para que no queden como olvidos:

| Ítem | Por qué no |
|---|---|
| **Políticas RLS** | Decisión explícita del usuario tras la explicación del bloque F: la app ya tiene autorización real a nivel de aplicación (el navegador nunca habla directo con Postgres), así que RLS sería una segunda capa redundante para esta arquitectura, no la única frontera. Sin staging ni tests, el riesgo de romper un flujo real supera el beneficio. Ver bloque F para las condiciones bajo las que valdría la pena reabrir esta decisión. |
| **WAF / Cloudflare delante de Railway** | Vercel ya trae mitigación de DDoS en el frontend. Sumar una capa más antes de tener tráfico real es optimización prematura. |
| **Pentest profesional** | Caro, y no tiene sentido antes de estar en producción con tráfico. Reevaluar en F2. |
| **Cifrado de PII en reposo, a nivel campo** | Railway ya cifra el disco. Cifrado a nivel campo complica todas las queries y filtros que acabamos de construir (edad, zona, disponibilidad), a cambio de proteger contra un escenario —acceso físico al disco de Railway— que no es realista acá. |

---

## 4. Orden de ejecución sugerido

**✅ Hecho 2026-07-16 (sesión completa, todo verificado contra la base/servidor reales):**
1. ~~Bloque A~~ — fix del JSON-LD.
2. ~~Bloque B~~ — corregir `CLAUDE.md`.
3. ~~Bloque C~~ — headers de seguridad + CSP estricta con nonce, verificada con Playwright contra
   Clerk real (login funcional, 0 violaciones de CSP).
4. ~~Bloque E~~ — rol `app_user` de mínimo privilegio, creado y verificado contra Railway real
   (DDL rechazado, DML funcionando, servidor completo probado end-to-end).
5. ~~Bloque F~~ — RLS, decisión tomada (no se hace, ver bloque F).
6. ~~Bloque G (parcial)~~ — contraseña de la base rotada de paso al hacer el bloque E.

**Al hacer el deploy (bloques de `DEPLOY-PLAN.md`) — pendiente, depende de cuentas externas:**
7. **Bloque D** — MFA de admins, junto con la instancia de producción de Clerk. Incluye también
   sumar el dominio custom de Clerk (si se configura uno) a la CSP del bloque C.
8. **Bloque G (resto)** — `SECRET_KEY` nuevo, `CLOUDINARY_API_SECRET`, al cargar las env vars de
   producción.
9. **Bloque J** (parcial) — `SENTRY_DSN`, al cargar las env vars.

**Después de lanzar:**
10. Bloques H, I, y el resto de J.

Los ítems pendientes quedan cross-referenciados en `DEPLOY-PLAN.md` (bloques D, G, I, L) para que
no se pierdan de vista al ejecutar el deploy — ese documento es el tracker operativo, éste es el
razonamiento de seguridad detrás.

---

## 5. Resumen ejecutivo

Si tuviera que quedarme con cuatro cosas de todo este documento:

1. ~~Arreglá el JSON-LD~~ (bloque A) — ✅ resuelto, era el único agujero concreto y explotable, y
   lo introduje yo esta sesión.
2. ~~No te conectes a la base como superusuario~~ (bloque E) — ✅ resuelto. Era lo que convertía
   "se filtró una credencial" en "perdimos todo"; ahora el rol de runtime ni siquiera puede hacer
   `CREATE TABLE`, confirmado con una prueba real, no asumido.
3. **Activá MFA para los admins** (bloque D) — el mayor retorno por el menor esfuerzo que sigue
   pendiente. Una contraseña de admin es hoy la llave de todos los datos personales del sistema.
   Depende de la instancia de producción de Clerk.
4. **RLS no era lo que faltaba** (bloque F) — decisión tomada con el usuario, no sólo mía: la
   autorización real vive en la capa de aplicación, y con el bloque E resuelto RLS pasaría de
   "inútil" a "redundante", no a "necesario".

**Estado al cierre de esta sesión (2026-07-16):** bloques A, B, C, E y G-parcial completos y
verificados contra la base y el servidor reales — no build verde, sino: Playwright confirmando 0
violaciones de CSP y el login de Clerk funcionando (61 elementos `cl-*`, screenshot), y para el
rol de DB, un `CREATE TABLE` rechazado de verdad más un servidor real respondiendo `GET`/`POST`
con datos reales bajo el rol nuevo. Sólo quedan D, G (resto) y J (parcial) — todos atados a pasos
concretos de `DEPLOY-PLAN.md`, no "para después sin fecha".
