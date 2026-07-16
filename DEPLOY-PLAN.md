# Plan de Deploy — BBJobs de pies a cabeza

> Plan formal para pasar de "corre en mi máquina" a "corre en producción, con dominio propio,
> Clerk y Mercado Pago en modo real". Relevado contra el estado real del código el 2026-07-16
> (Dockerfile, `config.py`, `next.config.ts`, migraciones, `.gitignore`, `.env.local`) — no es
> una traducción de los docs viejos de `docs/planning/`, que describen un stack que ya no existe
> (JWT propio, Cloudflare R2, Resend). Estructura en bloques A→P, como el resto de los planes del
> repo, para poder tildar a medida que se ejecuta.

## Cómo leer este documento
- 🔴 **Bloqueante real** — sin esto, el deploy no funciona o rompe algo (encontrado auditando el
  código, no una suposición).
- 🟡 **Recomendado antes de anunciar el lanzamiento** — no rompe nada si se salta, pero es mala
  praxis o riesgo real (seguridad, plata, SEO).
- ⚪ **Opcional / puede esperar a F2**.
- 🔒 **[Seguridad]** — ítem de `SEGURIDAD-PLAN.md` (plan hermano de éste) que quedó atado a un
  paso concreto de este deploy. No se puede resolver por separado del paso al que está atado.

---

## Resumen — qué falta para estar 100% en producción

1. Fixes de código puntuales (bloque C) — nada de esto depende de cuentas externas, se puede
   hacer ahora mismo.
2. Crear/activar cuentas externas (bloque B): Railway, Vercel, dominio en NIC.ar, Clerk
   producción, Mercado Pago producción, Sentry.
3. Deploy backend a Railway (bloque D) + frontend a Vercel (bloque E).
4. Conectar el dominio propio (bloque F) y reapuntar todas las env vars a URLs reales (bloque I).
5. Pasar Clerk (bloque G) y Mercado Pago (bloque H) a modo producción.
6. SEO/GEO (bloque J), backups y hardening de seguridad (bloque K), monitoreo (bloque L).
7. Checklist de smoke test end-to-end (bloque N) antes de decirle a Eugenia que está en vivo.

**Nada de esto está bloqueado por trabajo de producto pendiente** — Fase 1.5 y el módulo de
Mercado Pago ya están funcionalmente completos (ver `AUDITORIA-2026-07-15.md`). Esto es
exclusivamente infraestructura.

**Actualización 2026-07-16**: dominio confirmado (bloque A) y todo lo marcado 🟡/⚪ que era
código puro (sin depender de cuentas externas) ya está resuelto — limpieza de `.env.example`
(C5), rate limiting real (K), default inseguro de `ADMIN_PASSWORD` sacado (K), SEO/GEO completo
(J: `robots.ts`, `sitemap.ts`, metadata dinámica, JSON-LD JobPosting), y CI mínimo (M). Verificado
con `tsc --noEmit`, `npm run lint`, `npm run build` y el import de FastAPI, todos limpios. Lo que
queda son los 4 fixes bloqueantes de código (bloque C1-C4, decisión pendiente sobre cuándo
tocarlos) y todo lo que requiere crear cuentas externas (bloque B) — eso sigue intacto, esperando
a que se arranque el deploy real.

**Además, sesión de seguridad 2026-07-16 — ver `SEGURIDAD-PLAN.md`** (documento hermano de éste,
mismo nivel de detalle pero enfocado en seguridad): se arregló un XSS real en el JSON-LD que se
había introducido en esta misma sesión, se corrigió una afirmación falsa en `CLAUDE.md` sobre RLS,
se implementó una CSP estricta con nonce (verificada con Playwright contra Clerk real — 0
violaciones, login funcional), y **se creó y verificó contra la base real de Railway un rol de
Postgres de mínimo privilegio** (`app_user` — el backend se conectaba antes como superusuario;
ahora el rol de runtime ni siquiera puede hacer `CREATE TABLE`, confirmado con una prueba real).
RLS se descartó por decisión explícita del usuario, no por bloqueo técnico (ver
`SEGURIDAD-PLAN.md` bloque F). Quedan **3 ítems de seguridad atados a pasos concretos de este
mismo plan de deploy**, marcados en los bloques correspondientes más abajo con 🔒 **[Seguridad]**:
reflejar el rol `app_user` en las env vars del servicio de Railway (bloque D, ya resuelto a nivel
base de datos), MFA para admins + actualizar la CSP si se usa un dominio custom de Clerk
(bloque G), y rotación de secretos (bloque I).

---

## A. Dominio — verificar y registrar

- [x] **`bbjobs.com.ar` ya está registrado** (confirmado por Gael, 2026-07-16). El resto del
  bloque queda como checklist a confirmar, no bloqueante:
- [ ] Confirmar que quedó a nombre de Talency (no de una cuenta personal — para no depender de un
  individuo si el vínculo cambia).
- [ ] Confirmar renovación automática activa. Poner recordatorio en calendario igual (NIC.ar a
  veces falla el cobro automático).
- [ ] Decidir subdominios: `bbjobs.com.ar` (frontend, Vercel) + `api.bbjobs.com.ar` (backend,
  Railway). Es el esquema que ya asumían los docs viejos — se mantiene.

Con el dominio confirmado, el código ya asume `https://bbjobs.com.ar` como default en
`NEXT_PUBLIC_SITE_URL` (`robots.ts`, `sitemap.ts`, metadata de `/empleos/[id]` y `/empresas/[id]`
— ver bloque J) — no hace falta tocar código cuando se conecte el DNS, sólo setear la env var en
Vercel si en algún momento se usa un subdominio distinto.

---

## B. Cuentas y credenciales a crear

| Servicio | Qué falta | Bloqueante para |
|---|---|---|
| Railway | ✅ Proyecto creado, repo de GitHub conectado (confirmado por Gael, 2026-07-16). Falta: confirmar el addon de Postgres (ver nota al inicio del bloque D), configurar el servicio backend (bloque D pasos 3-8) | Backend + Postgres |
| Vercel | Listo para conectar (confirmado por Gael, 2026-07-16) — falta crearlo/conectarlo de verdad y **decidir plan** (ver nota abajo) | Frontend |
| Clerk | Crear **instancia de producción** (hoy sólo existe la de test, `pk_test_.../sk_test_...`) | Auth real |
| Mercado Pago | Cuenta de negocio para Talency/BBJobs + credenciales sandbox, luego producción | Cobrar de verdad |
| Cloudinary | Confirmar que las credenciales actuales son la cuenta definitiva (no una de prueba personal) | CVs/logos |
| Sentry | Cuenta + proyecto (el SDK ya está instalado en el backend, sólo falta el DSN) | Monitoreo de errores |
| Email real de Talency | Casilla real para la cuenta admin definitiva (`admin@bbjobs.com.ar` hoy es un placeholder de seed) | Producción real |

**Nota sobre Vercel — plan Hobby no aplica acá:** el plan Hobby de Vercel es gratuito pero sus
términos de servicio lo limitan a uso **no comercial**. BBJobs es un producto comercial de
Talency, así que corresponde el plan **Pro** (~USD 20/mes) desde el día del deploy a producción,
no el Hobby aunque "alcance" en recursos. 🔴 Bloqueante legal/ToS, no técnico.

---

## C. Fixes de código — bloqueantes reales encontrados en la auditoría

Estos cuatro rompen el deploy tal cual está el código hoy. Ninguno depende de una cuenta externa
— se pueden resolver ahora mismo, antes de tocar Railway o Vercel.

### C1. ✅ `backend/Dockerfile` no escuchaba en el puerto que Railway asigna — resuelto 2026-07-16
Tenía:
```dockerfile
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
Railway inyecta un `$PORT` dinámico y hace el healthcheck contra ese puerto — un puerto
hardcodeado en formato exec (`["..."]`) no expande variables de entorno, así que el contenedor
nunca respondía donde Railway esperaba. Se combinó con el fix de C4 (ver abajo) en una sola línea
en forma shell, verificada localmente simulando `$PORT` (servidor real levantado en un puerto
dinámico y respondiendo a `curl`, no sólo revisado a simple vista):
```dockerfile
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

### C2. 🟡 `DATABASE_URL` de Railway no es compatible tal cual con `asyncpg` — sorteado a mano, sin fix de código
El backend usa `postgresql+asyncpg://...` (ver `config.py`, `DATABASE_URL: str` sin
transformación). Si se copia el `DATABASE_URL`/`DATABASE_PUBLIC_URL` que Railway autogenera para
el addon de Postgres tal cual (scheme `postgresql://`), `create_async_engine` falla al arrancar.
**Hoy esto no rompió nada** porque `DATABASE_URL`/`MIGRATIONS_DATABASE_URL` se armaron a mano con
el scheme correcto al hacer el bloque D paso 9 (rol `app_user`) — pero sigue siendo un fix de
código pendiente, real, no cosmético: cualquiera que en el futuro copie una URL de Postgres
autogenerada por Railway sin acordarse de este detalle va a pisar el mismo error. Recomendado:
normalizar en `config.py` con un `field_validator` que reescriba el scheme automáticamente sin
importar cómo venga.

### C4. ✅ Las migraciones de Alembic no estaban conectadas al proceso de deploy — resuelto 2026-07-16
El `Dockerfile` sólo levantaba `uvicorn`, nunca corría `alembic upgrade head` — en producción no
puede depender de que alguien se acuerde de correrlo antes de cada deploy. Se optó por bakearlo en
el `CMD` del Dockerfile (no un start command aparte en el dashboard de Railway, para que quede
versionado en el repo, no sólo en la config de Railway) — ver el `CMD` combinado en C1. Alembic
usa `MIGRATIONS_DATABASE_URL` (rol con DDL), no `DATABASE_URL` (rol de mínimo privilegio) — ver
bloque D paso 9. Verificado localmente: `alembic upgrade head` + arranque de `uvicorn` en un
puerto dinámico simulado, encadenados con `&&`, funcionando de punta a punta contra la base real.

### C3. ✅ `next.config.ts` no tenía `images.remotePatterns` — resuelto 2026-07-16
`next/image` se usa en 6 archivos (`Header`, `Footer`, `DashboardShell`, `onboarding`, login/
register). En producción, Next.js **rechaza optimizar imágenes de dominios no declarados
explícitamente** (a diferencia de dev, donde a veces pasa desapercibido) — logos de empresa y CVs
subidos a Cloudinary, y avatares de usuario servidos por Clerk, hubieran roto (400 del
optimizador de imágenes de Next). Agregado:
```ts
images: {
  remotePatterns: [
    { protocol: "https", hostname: "res.cloudinary.com" },
    { protocol: "https", hostname: "img.clerk.com" },
  ],
}
```
Verificado con `tsc --noEmit` limpio.

### C5. ✅ Limpieza de `.env.example` — resuelto 2026-07-16
Se sacaron `RESEND_API_KEY`, `EMAIL_FROM`, `R2_*` y el bloque `JWT_ALGORITHM`/
`ACCESS_TOKEN_TTL_MINUTES`/`REFRESH_TOKEN_TTL_DAYS` — ya no los consume ningún código
(Resend/R2 fueron reemplazados por Cloudinary, el JWT propio por Clerk). De paso se agregaron
`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`, que sí se leen en
`config.py` pero nunca habían quedado documentados en el `.env.example` — el mismo problema al
revés, alguien buscando cargar la credencial de Cloudinary no la encontraba listada.

---

## D. Backend → Railway, paso a paso

**Estado 2026-07-16 — primer deploy exitoso.** Confirmado: el Postgres del proyecto de Railway es
el mismo que se usó toda la sesión (`reseau.proxy.rlwy.net`), así que `app_user` (paso 9) ya
estaba listo a nivel base de datos — sólo hacía falta cargarlo en las env vars del servicio.

1. ~~Crear proyecto en Railway, conectar el repo de GitHub (rama `main`).~~ — hecho.
2. ~~Addon de Postgres~~ — confirmado, es la base que ya se usaba.
3. ~~Configurar el servicio backend para buildear con `backend/Dockerfile`~~ — hecho, con dos
   ajustes que no eran obvios de entrada:
   - **Root Directory** del servicio tenía que ser `backend` — sin esto, Railway (Railpack)
     escaneaba la raíz del repo entera y no reconocía ningún lenguaje.
   - **Builder** tenía que pasarse de Railpack (auto-detección) a **Dockerfile** explícitamente.
4. ~~Aplicar los fixes C1 y C4~~ — hecho 2026-07-16. **Se encontró un bug real en el primer
   intento de deploy** que la verificación local no había atrapado: `pip install .` corría antes
   de que el código se copiara a la imagen (`COPY pyproject.toml .` → install → recién `COPY .
   .`), dejando el paquete `app` mal instalado — `ModuleNotFoundError: No module named 'app'` al
   correr `alembic upgrade head` en el contenedor real. Funcionaba en local sólo porque ese
   `.venv` tiene una instalación editable (apunta directo al código fuente), que enmascaraba el
   problema. Se corrigió el orden del `COPY` en el Dockerfile — verificado sin prender Docker
   Desktop, instalando de forma no-editable en un venv aislado y reproduciendo/confirmando el fix
   antes de pushear. C2 sigue abierto como mejora recomendada (no bloqueante hoy porque
   `DATABASE_URL`/`MIGRATIONS_DATABASE_URL` se armaron a mano con el scheme correcto).
5. ~~Cargar las env vars de producción~~ — hecho: `ENV=production`, `DEBUG=false`, `SECRET_KEY`,
   `DATABASE_URL` (`app_user`), `MIGRATIONS_DATABASE_URL` (`postgres`), y el resto copiado del
   `.env` local (con Clerk todavía en modo test — suficiente para este primer deploy de prueba,
   ver bloque G para el pase a producción real). `ALLOWED_ORIGINS`/`FRONTEND_URL` siguen en
   `localhost:3000` — hay que actualizarlas cuando exista el dominio de Vercel.
6. ~~Deploy inicial~~ — **confirmado en los logs reales**: `alembic upgrade head` corrió limpio,
   `scheduler_started` (APScheduler con `expire_jobs`/`notify_expiring_soon`), uvicorn escuchando
   en el puerto que asignó Railway (8080, no el 8000 hardcodeado — confirma el fix de C1),
   `Application startup complete`.
   ✅ **Confirmado con requests reales desde afuera** (dominio público generado en Railway:
   `bbjobs-production.up.railway.app`): `GET /health` → 200, `GET /catalogs/industries` → 200
   (SELECT real vía `app_user`), `POST /contact` → 200 (INSERT real vía `app_user`, con su
   notificación a admins disparándose — datos de prueba borrados después). **Primer deploy de
   backend en Railway funcionando de punta a punta.**
7. Correr `python seed.py` **una vez**, apuntando a la DB de producción y a la instancia de Clerk
   de producción (ver bloque G) — crea catálogos base + el usuario admin. Usar
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` reales de Talency, no el placeholder del `.env.example`.
8. Activar dominio custom `api.bbjobs.com.ar` en la configuración del servicio (deja un CNAME
   pendiente para el bloque F).

9. 🔒 **[Seguridad]** ✅ **Rol de Postgres de mínimo privilegio — hecho y verificado 2026-07-16**
   contra la base real (`SEGURIDAD-PLAN.md` bloque E, detalle completo ahí). Resumen: se creó
   `app_user` (sin `SUPERUSER`/`CREATEDB`/ownership) con `SELECT/INSERT/UPDATE/DELETE` sobre las
   37 tablas existentes + default privileges para que las tablas de migraciones futuras hereden
   los mismos grants. `backend/.env` local ya quedó con `DATABASE_URL` → `app_user` y la nueva
   `MIGRATIONS_DATABASE_URL` → `postgres` (para que `alembic upgrade head` siga pudiendo hacer
   DDL). Verificado con un servidor real: `CREATE TABLE` rechazado con `app_user`, requests HTTP
   reales (`GET`/`POST`) funcionando de punta a punta.
   **Falta, no es código**: reflejar estas mismas dos env vars en el **servicio de Railway** (no
   sólo en el `.env` local) cuando se configure el paso 5 de este bloque — y, si el Postgres de
   Railway termina siendo una instancia nueva y no la que ya se usó (ver nota al inicio de este
   bloque), volver a correr `backend/scripts/create_app_user_role.py` contra ella (está pensado
   para eso, es idempotente).

**Notas de riesgo específicas de Railway** (a verificar en el dashboard actual, no asumir lo que
decían los docs de planning viejos — la política de cold-starts de Railway cambia con el tiempo y
el plan elegido):
- 🟡 Confirmar si el plan elegido tiene **backups automáticos de Postgres**. Si no, programar un
  `pg_dump` periódico (cron job simple, o un segundo servicio en Railway) hacia algún storage —
  perder la única base de producción sin backup es el peor escenario posible acá.
- 🟡 APScheduler corre dentro del mismo proceso (`lifespan` de FastAPI) — sólo funciona
  correctamente con **una sola instancia** del backend corriendo. Si en algún momento se escala a
  2+ réplicas, `expire_jobs`/`notify_expiring_soon` se van a duplicar. No tocar el número de
  réplicas sin resolver esto primero (mover a un worker separado o usar un lock de Postgres).

---

## E. Frontend → Vercel, paso a paso

**Bug real encontrado en el primer intento de deploy (2026-07-16), ya resuelto**:
`.gitignore` tenía una regla `lib/` sin scope (pensada para carpetas de virtualenv de Python,
junto a `lib64/` — plantilla genérica de Python) que bloqueaba **cualquier** carpeta `lib` del
repo, incluida `frontend/src/lib/` — donde vive `api.ts` (el cliente axios que importa
prácticamente toda página), `clerk-appearance.ts` y `jobApply.ts`. Esos tres archivos **nunca
habían estado en git**, sólo existían en el disco local — por eso todo funcionó siempre en local
y en el build local de esta sesión, y recién se rompió con ~30 errores `Module not found` en el
primer build limpio desde GitHub (Vercel clona el repo real, no tu working tree). Se corrigió el
scope a `backend/lib/`/`backend/lib64/` (su intención real) y se agregaron los tres archivos.
**Lección para el resto del deploy**: un build local o un `git status` limpio no garantizan que
todo lo necesario esté realmente en git — vale la pena, después de este hallazgo, no asumir que
"si build local funciona, el deploy va a funcionar".

1. Crear proyecto en Vercel (plan **Pro**, ver nota del bloque B), conectar el repo, root
   directory = `frontend/`. Vercel detecta Next.js automáticamente (build = `next build`).
2. Cargar env vars — `NEXT_PUBLIC_API_URL` apuntando al backend de Railway (dominio que Railway
   asigne, o `api.bbjobs.com.ar` si ya está el DNS del bloque F), y las claves de Clerk. **Para un
   primer deploy de prueba** (confirmar que todo levanta) sirve reusar las `pk_test_`/`sk_test_`
   que ya están funcionando — igual que se hizo en Railway. Antes de anunciar el lanzamiento real,
   sí hay que pasar a las claves de producción (`pk_live_`/`sk_live_`, ver bloque G) — no mezclar
   ambos pasos, son momentos distintos.
3. ~~Aplicar el fix C3~~ — resuelto 2026-07-16 (`remotePatterns` para Cloudinary/Clerk).
4. Deploy, y validar visualmente `/`, `/empleos`, `/login`, `/register`, un dashboard de cada rol.
5. Activar dominio custom `bbjobs.com.ar` (+ `www` si se quiere, con redirect a apex o viceversa)
   en la configuración del proyecto — deja los registros DNS pendientes para el bloque F.

---

## F. DNS — conectar el dominio

Una vez registrado el dominio (bloque A) y creados ambos servicios (D y E), en el panel de DNS de
NIC.ar (o el proveedor de DNS que se use si se delega):

- [ ] `bbjobs.com.ar` (apex) → registros que indique Vercel al agregar el dominio custom
  (normalmente un `A` a la IP de Vercel, o `ALIAS`/`ANAME` si el proveedor lo soporta).
- [ ] `www.bbjobs.com.ar` → `CNAME` a `cname.vercel-dns.com` (o el valor exacto que muestre
  Vercel), con redirect configurado del lado de Vercel hacia el que se elija como canónico.
- [ ] `api.bbjobs.com.ar` → `CNAME` al dominio que indique Railway para el servicio backend.
- [ ] Esperar propagación DNS (puede tardar horas) y confirmar HTTPS activo en ambos (Vercel y
  Railway emiten certificados automáticamente vía Let's Encrypt una vez que el DNS resuelve).

🔴 Hasta que esto no esté resuelto, **no tiene sentido** pasar Clerk ni Mercado Pago a producción
(bloques G y H) — ambos necesitan URLs reales y estables para configurar redirects/webhooks.

---

## G. Clerk → instancia de producción

Hoy el proyecto corre 100% contra una instancia de **test** de Clerk (`pk_test_.../sk_test_...`,
visible en `frontend/.env.local`) — tiene límites de uso pensados para desarrollo, no para
usuarios reales, y probablemente muestra avisos de "modo desarrollo" en los flujos de auth.

1. En el dashboard de Clerk, crear/promover una **instancia de producción** para la app.
2. Configurar los dominios permitidos y las URLs de redirect con el dominio real
   (`https://bbjobs.com.ar`), no `localhost`.
3. Copiar las claves de producción (`pk_live_...`/`sk_live_...`) a las env vars de Vercel
   (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) y de Railway
   (`CLERK_SECRET_KEY`, mismo valor secreto en ambos lados).
4. Actualizar `CLERK_AUTHORIZED_PARTIES` en el backend (Railway) a `https://bbjobs.com.ar` (hoy es
   `http://localhost:3000` — si no se cambia, **todas las verificaciones de sesión van a fallar**
   en producción, `app/api/deps.py` rechaza JWTs cuya `azp` no esté en esta lista).
5. Registrar el webhook de producción: `https://api.bbjobs.com.ar/api/v1/webhooks/clerk`,
   eventos `user.deleted` y `user.updated`. Copiar el signing secret a `CLERK_WEBHOOK_SECRET` en
   Railway (svix lo valida en `webhooks.py::clerk_webhook` — sin el secreto correcto, 401 en todo
   evento entrante).
6. Recrear el usuario admin en la instancia de producción — no se puede migrar desde test.
   Correr `python seed.py` (paso D7) con las credenciales de producción cargadas.
7. 🟡 Actualizar `clerkAppearance` (`frontend/src/lib/clerk-appearance.ts`) si hace falta algo
   específico de la instancia de producción (logo, colores) — la app ya inyecta el tema BBJobs,
   sólo confirmar que se ve igual en la instancia nueva.
8. 🔒 **[Seguridad]** Activar MFA en Clerk y **exigirlo para las cuentas de rol admin**
   (`SEGURIDAD-PLAN.md` bloque D) — es configuración pura en el dashboard de Clerk, sin código.
   El panel de admin ve el perfil completo de cualquier candidato sin restricción
   (`GET /admin/candidates/{id}` no tiene chequeo de acceso, por diseño — CVs, teléfonos, fechas
   de nacimiento), así que una sola contraseña de admin comprometida es la filtración total de
   PII del sistema. Hacerlo **antes** de crear las cuentas admin reales de Talency en el paso 6.
9. 🔒 **[Seguridad]** Si en este paso se configura un **dominio custom de Clerk** (ej.
   `clerk.bbjobs.com.ar`) en vez de seguir sirviendo desde `*.clerk.accounts.dev`: hay que sumar
   ese dominio a la Content-Security-Policy del frontend (`frontend/src/proxy.ts` —
   `script-src`/`connect-src`/`frame-src`, ver `SEGURIDAD-PLAN.md` bloque C). El wildcard actual
   (`https://*.clerk.accounts.dev`) sólo cubre subdominios de Clerk, no un dominio propio. Sin
   este ajuste, el login se rompería en producción exactamente por el mismo motivo que se
   encontró y corrigió en dev (script de Clerk bloqueado por la CSP).

---

## H. Mercado Pago → producción

Ya documentado en detalle en `MERCADOPAGO-DESTACAR-PLAN.md` (§6) — resumen aplicado a este plan
de deploy:

1. Crear/confirmar la cuenta de Mercado Pago de Talency para BBJobs.
2. Sacar credenciales de **sandbox/test** primero y cargarlas en Railway
   (`MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY`/`MP_WEBHOOK_SECRET`).
3. Registrar el webhook de test: `https://api.bbjobs.com.ar/api/v1/webhooks/mercado-pago`
   (necesita el dominio real y HTTPS ya andando — no se puede probar contra `localhost`).
4. Hacer una compra de prueba de punta a punta con tarjeta de test: confirmar que
   `verify_signature` valida la firma real (hoy es un no-op porque el secret está vacío), que
   `is_featured` se activa, que la notificación a la empresa y a los admins llega, y que el
   destacado se apaga solo al cerrar/vencer la búsqueda.
5. Recién después, reemplazar por credenciales de **producción** y hacer **un pago real de bajo
   monto** (ej. el mismo $5.000 real) antes de anunciar el cobro a Talency — confirmar que el
   dinero efectivamente entra a la cuenta y que el flujo completo se sostiene con datos reales.
6. 🟡 Documentar en un lugar visible (runbook interno) cómo revocar el `MP_ACCESS_TOKEN` en caso
   de compromiso — es dinero real, a diferencia de todas las demás credenciales de este plan.

---

## I. Variables de entorno — tabla completa de producción

🔒 **[Seguridad] Rotación de secretos** (`SEGURIDAD-PLAN.md` bloque G) — regla general para toda
esta tabla: **ningún valor de producción debería ser el mismo que el que hoy vive en
`backend/.env`/`frontend/.env.local` de desarrollo.** Esos valores vivieron en una máquina de
dev; aunque no hay indicio de filtración (están gitignoreados, nunca commiteados — verificado con
`git log --all --full-history`), la higiene correcta es que las credenciales de producción nazcan
nuevas, no que se copien. Aplica en particular a `SECRET_KEY` y a la contraseña del rol de DB
(nueva de por sí si se sigue el paso 9 del bloque D).

### Backend (Railway)
| Variable | Valor en producción | Nota |
|---|---|---|
| `ENV` | `production` | |
| `DEBUG` | `false` | |
| `SECRET_KEY` | random fuerte, **generado nuevo para prod** (no reusar el de dev) | sigue siendo obligatorio aunque el JWT propio esté deprecado |
| `DATABASE_URL` | del addon de Railway, **con scheme `postgresql+asyncpg://`**, con las credenciales del rol `app_user` (ver bloque D paso 9 — creado y verificado 2026-07-16, mínimo privilegio, sin DDL) | ver fix C2 |
| `MIGRATIONS_DATABASE_URL` | credenciales del rol admin/owner del addon (`postgres` u otro con permisos de DDL) | nueva — separada de `DATABASE_URL` porque `app_user` no puede correr `alembic upgrade head`; si se omite, Alembic cae a `DATABASE_URL` y fallaría por falta de DDL |
| `ALLOWED_ORIGINS` | 2026-07-16: `http://localhost:3000,https://bbjobs-eight.vercel.app,https://bbjobs.com.ar,https://www.bbjobs.com.ar` | CORS — sin esto el frontend no puede llamar a la API. 🟡 **Sacar `localhost` antes del lanzamiento real** — se dejó a propósito para poder probar el backend desplegado desde un frontend local, pero es un origen de confianza que no debería quedar habilitado en producción de forma permanente. |
| `FRONTEND_URL` | `https://bbjobs.com.ar` | usado para construir `success_url` de MP |
| `CLERK_SECRET_KEY` | clave `sk_live_...` de producción | ver bloque G |
| `CLERK_WEBHOOK_SECRET` | signing secret del webhook de producción | ver bloque G |
| `CLERK_AUTHORIZED_PARTIES` | mismo valor y misma nota de `localhost` que `ALLOWED_ORIGINS` (2026-07-16) | 🔴 si queda sin la URL real del frontend, el login rompe en prod |
| `SENTRY_DSN` | DSN del proyecto de Sentry | ver bloque L |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | credenciales definitivas | confirmar que no son de una cuenta de prueba |
| `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` / `MP_WEBHOOK_SECRET` | producción (tras validar en sandbox) | ver bloque H |

*(Se eliminan del `.env` real, aunque sigan en `.env.example` hasta la limpieza C5:
`JWT_ALGORITHM`, `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `RESEND_API_KEY`,
`EMAIL_FROM`, `R2_*` — ningún código los lee.)*

### Frontend (Vercel)
| Variable | Valor en producción |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.bbjobs.com.ar/api/v1` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `CLERK_SECRET_KEY` | `sk_live_...` (mismo valor que en Railway) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/login` (sin cambios) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/register` (sin cambios) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/post-login` (sin cambios) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/onboarding` (sin cambios) |

---

## J. SEO / GEO

~~Hoy sólo existe metadata estática en `frontend/src/app/layout.tsx`~~ — resuelto 2026-07-16:

- [x] ✅ `app/robots.ts` — permite crawling de páginas públicas, bloquea `/dashboard/`,
  `/onboarding`, `/post-login`. Apunta a `sitemap.xml`.
- [x] ✅ `app/sitemap.ts` — dinámico: pagina `GET /jobs` completo (activos+aprobados) y
  `GET /companies/verified`, más las rutas estáticas públicas. `revalidate: 3600`, cacheado 1h.
  Confirmado en `npm run build`: se genera como `○ /sitemap.xml` estático con revalidación.
- [x] ✅ Metadata dinámica (`generateMetadata`) en `/empleos/[id]` y `/empresas/[id]` — ambos
  `page.tsx` eran Client Components (`"use client"`), así que no podían exportar
  `generateMetadata` directamente (sólo Server Components pueden). Se dividieron en un
  `page.tsx` Server Component (metadata + fetch server-side) que envuelve la lógica interactiva
  ya existente, movida sin cambios a `JobDetailClient.tsx` / `CompanyProfileClient.tsx` — patrón
  oficial de Next.js para retrofittear SEO sobre una página cliente sin reescribirla. Título,
  description, canonical, Open Graph y Twitter card por búsqueda/empresa.
- [x] ✅ **JobPosting JSON-LD** en `/empleos/[id]` — `title`, `description`, `datePosted`,
  `validThrough`, `hiringOrganization`, `jobLocation`/`jobLocationType` (distingue remoto vs
  presencial), `baseSalary` (sólo si `salary_visible`). Es lo que permite que Google/asistentes
  de IA citen la búsqueda directamente (GEO).
- [ ] ⚪ Open Graph / Twitter Card con **imagen real** — el `openGraph.images` usa el logo de la
  empresa si existe, pero no hay una imagen de marca genérica de fallback todavía.
- [ ] Alta en **Google Business Profile** — tarea manual fuera del código, ahora desbloqueada
  (el dominio ya está registrado).
- [ ] `og:image` / favicon reales de marca (confirmar que existen, no placeholders de Next.js) —
  sin tocar, requiere asset de diseño.

---

## K. Seguridad — hardening antes de anunciar

**Este bloque quedó reemplazado por `SEGURIDAD-PLAN.md`**, un plan hermano con el mismo nivel de
detalle que éste pero enfocado 100% en seguridad (bloques A→K propios, incluyendo qué se decidió
**no** hacer y por qué — la premisa de fondo es que "100% seguro" no existe, así que priorizar
importa más que una lista plana). Lo que sigue acá es sólo el resumen de qué está resuelto y qué
sigue atado a este plan de deploy:

- [x] ✅ **Gap de RLS — corregido en la documentación; políticas descartadas por decisión
  explícita (2026-07-16)**: se verificó que no existe ninguna migración con `ENABLE ROW LEVEL
  SECURITY`/`CREATE POLICY` (`set_rls_context` setea variables de sesión que nadie lee), y que el
  backend se conectaba como **superusuario** de Postgres (`rolsuper=True`) — dato que hacía que
  ningún RLS tuviera efecto hasta resolver eso primero. `CLAUDE.md` se corrigió para reflejar la
  realidad. El rol de mínimo privilegio **ya se resolvió** (bloque D paso 9), lo que técnicamente
  habilitaría RLS real — pero consultado el usuario, decidió explícitamente no implementarlo: la
  autorización a nivel de aplicación ya es la frontera real (el navegador nunca habla directo con
  Postgres), así que políticas RLS serían una segunda capa redundante, no la que falta. Ver
  `SEGURIDAD-PLAN.md` bloque F para las condiciones bajo las que valdría la pena reabrir esto.
- [x] ✅ **XSS real en el JSON-LD — encontrado y arreglado (2026-07-16)**: bug introducido en la
  misma sesión que agregó el SEO (bloque J más arriba). `JSON.stringify` no escapa `<`; una
  descripción de búsqueda con `</script><script>` habría cerrado el tag antes de tiempo. Fix de
  una línea en `/empleos/[id]/page.tsx`, confirmado que era el único `dangerouslySetInnerHTML` del
  proyecto.
- [x] ✅ **Headers de seguridad + CSP estricta con nonce — implementado y verificado
  (2026-07-16)**: `frontend/src/proxy.ts` + `next.config.ts`. Verificado con Playwright contra el
  dev server real (no sólo build verde): 0 violaciones de CSP, login de Clerk renderizando y
  funcional. Detalle completo, incluyendo un hallazgo real sobre `'strict-dynamic'` rompiendo
  Clerk, en `SEGURIDAD-PLAN.md` bloque C.
- [ ] 🔒 **[Seguridad, pendiente]** MFA para admins — ver bloque G paso 8.
- [x] 🔒 ✅ **[Seguridad, resuelto 2026-07-16]** Rol de DB de mínimo privilegio — ver bloque D
  paso 9. Falta sólo reflejarlo en las env vars del servicio de Railway (no código).
- [ ] 🔒 **[Seguridad, pendiente]** Rotación de secretos — ver bloque I.
- [ ] 🟡 Backups de Postgres (ver nota del bloque D) — depende del plan de Railway elegido, sin
  código de por medio.
- [x] ✅ **`ADMIN_PASSWORD` sin default inseguro — resuelto 2026-07-16**: `seed.py` ya no cae en
  `"Admin1234!"` si la env var no está — ahora hace `raise SystemExit` con un mensaje explícito.
  Sigue pendiente, sí, **setear** una contraseña real fuerte en el `.env` de producción antes de
  correr `python seed.py` contra Railway (eso no es un fix de código, es un paso operativo del
  bloque D).
- [x] ✅ **Rate limiting real — resuelto 2026-07-16**: `slowapi` estaba instalado y el `Limiter`
  registrado en `app.state`, pero **ningún endpoint lo usaba** (`grep` de `@limiter.limit`/
  `limiter.limit` sobre todo `app/api/v1/` no encontraba nada — el rate limiting existía en el
  papel, no en la práctica). Se movió `Limiter` a `app/core/limiter.py` (evita el import circular
  con `main.py`) y se aplicó `@limiter.limit("5/minute")` a `POST /contact` (público, sin auth,
  el más expuesto a spam) y `@limiter.limit("10/minute")` a `POST /me/onboarding/candidate` y
  `POST /me/onboarding/company`.
- [ ] ⚪ Confirmar SPF/DKIM/DMARC si en algún momento se vuelve a sumar un proveedor de mail (hoy
  no hay ninguno — no aplica todavía).

---

## L. Monitoreo y errores

🔒 **[Seguridad]** Este bloque también es seguridad, aunque no lo parezca (`SEGURIDAD-PLAN.md`
bloque J: "no podés defender lo que no ves") — un XSS o un abuso de auth exitoso es
indistinguible de "la app anda bien" sin visibilidad de errores.

- [ ] Backend: sólo falta cargar `SENTRY_DSN` en Railway — `sentry_sdk.init()` ya está en
  `main.py`, condicionado a que la variable exista.
- [ ] 🟡 Frontend: no hay Sentry (ni ningún error tracker) instalado en el proyecto de Next.js —
  hoy los errores de cliente no se ven en ningún lado salvo que el usuario reporte manualmente.
  Evaluar `@sentry/nextjs` (mismo proyecto de Sentry, otro DSN).
- [ ] Confirmar que los logs estructurados (`structlog` → stdout) se ven correctamente en el panel
  de logs de Railway — ya están armados (`request_id`, `user_id`, `endpoint`, `duration_ms` por
  request vía middleware en `main.py`), sólo falta verificarlo en el entorno real.
- [ ] ⚪ Alertas básicas (ej. Sentry issue alert por email/Slack ante error nuevo) — no crítico día
  uno con un solo desarrollador, pero barato de activar.

---

## M. CI/CD (opcional para F1, recomendado)

- [x] ✅ **Resuelto 2026-07-16** — `.github/workflows/ci.yml`: en cada push/PR a `main`, corre
  `npm run lint` + `npx tsc --noEmit` (frontend) y `pip install .` +
  `python -c "from app.main import app"` (backend, con `SECRET_KEY`/`DATABASE_URL` dummy sólo
  para que `pydantic-settings` no explote al importar — no conecta a ninguna base real).
  **No corre `next build` completo**: `<ClerkProvider>` valida el formato de
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` al montarse, así que un build real necesitaría una key
  válida como secret de GitHub — no vale la pena para un chequeo de CI opcional. El typecheck +
  lint ya cubre la gran mayoría de regresiones que un build agregaría. No bloquea el deploy de
  Vercel/Railway (que buildean por su cuenta), es sólo una señal temprana adicional.

---

## N. Checklist de smoke test — antes de decir "está en producción"

Con dominio, Clerk producción y Mercado Pago sandbox (mínimo) ya andando:

- [ ] Registro de candidato nuevo (Clerk producción) → onboarding → perfil visible.
- [ ] Registro de empresa nueva → queda pendiente de verificación → aprobar como admin.
- [ ] Empresa publica una búsqueda → queda `pending_review` → **no** aparece en `/empleos`.
- [ ] Admin aprueba la búsqueda → aparece en `/empleos` y en `/empleos/[id]`.
- [ ] Candidato se postula con un click → aparece en el panel de la empresa.
- [ ] Subida de CV (candidato) y logo (empresa) → se ven las URLs de Cloudinary correctamente
  renderizadas (confirma el fix C3).
- [ ] Empresa destaca una búsqueda pagando con tarjeta de test de MP → webhook llega → badge
  "Destacada" aparece en `/empleos` → notificación a la empresa y a los admins.
- [ ] Notificaciones in-app llegan en los flujos clave (nueva postulación, cambio de estado,
  aprobación de búsqueda).
- [ ] Cerrar sesión / volver a iniciar sesión — confirma que `CLERK_AUTHORIZED_PARTIES` está bien
  configurado (si no, esto es lo primero que rompe).
- [ ] Confirmar HTTPS válido (candado verde) en `bbjobs.com.ar` y `api.bbjobs.com.ar`.
- [ ] 🔒 **[Seguridad]** Abrir la consola del navegador en `/`, `/login`, `/register` y un
  dashboard en producción — cero violaciones de `Content-Security-Policy`. Si el paso G9 (dominio
  custom de Clerk) se hizo, es el punto más probable de romperse — se probó en dev contra
  `*.clerk.accounts.dev`, no contra un dominio custom.
- [ ] Revisar Sentry — cero errores inesperados durante todo el smoke test.

---

## O. Costos mensuales estimados

| Servicio | Plan | Costo aprox. |
|---|---|---|
| Railway | Hobby/uso ($5 incluidos + excedente) | ~USD 5–10/mes |
| Vercel | **Pro** (Hobby no cubre uso comercial) | ~USD 20/mes |
| Dominio `.com.ar` | NIC.ar, renovación anual | bajo, anual |
| Clerk | Free tier (hasta el límite de MAU gratuito) | USD 0 hasta escalar |
| Mercado Pago | Sin costo fijo, comisión por transacción | variable según ventas |
| Cloudinary | Free tier probablemente alcanza en F1 | USD 0 hasta escalar |
| Sentry | Free tier | USD 0 hasta escalar |

**Total inicial estimado: ~USD 25–30/mes** + comisiones de MP por transacción + renovación anual
del dominio.

---

## P. Riesgos aceptados conscientemente para el primer deploy

Para no bloquear el lanzamiento por perfección — documentado para que sea una decisión explícita,
no un olvido:

1. Sin RLS real a nivel Postgres (bloque K / `SEGURIDAD-PLAN.md` bloque F) — autorización sólo a
   nivel aplicación, decisión consciente hasta que existan rol de mínimo privilegio + staging.
2. ~~Sin CI/CD~~ — resuelto (bloque M, 2026-07-16).
3. Sin tests automatizados (`backend/tests/` vacío, `pytest` ni siquiera es dependencia) — todo
   verificado manualmente contra la base real, como viene siendo la práctica en las últimas
   sesiones.
4. Un solo desarrollador — sin plan de on-call ni backup humano si Gael no puede responder ante un
   incidente. Mitigación mínima: documentar un runbook básico (rollback de deploy en Railway/
   Vercel, rollback de migración con `alembic downgrade -1`, cómo revocar `MP_ACCESS_TOKEN`).

---

## Orden de ejecución sugerido

A (dominio, ✅ hecho) → C (fixes de código C1-C4, en paralelo, no dependen de nada) →
✅ ~~C5, J, K (parcial), M~~ (código puro, resuelto 2026-07-16, incluye la sesión de seguridad de
`SEGURIDAD-PLAN.md` bloques A/B/C) → B (crear cuentas) → D (Railway, incluye 🔒 rol de DB mínimo
privilegio) → E (Vercel) → F (DNS) → G (Clerk producción, incluye 🔒 MFA admins) → H (Mercado
Pago: sandbox primero, producción después de N) → I (confirmar env vars reapuntadas + 🔒
rotación de secretos) → resto de J + K + L (monitoreo — puede ir en paralelo una vez que el sitio
esté arriba) → N (smoke test completo, sumar verificación de que la CSP no rompió nada en
producción) → recién ahí, anunciar el lanzamiento a Eugenia.
