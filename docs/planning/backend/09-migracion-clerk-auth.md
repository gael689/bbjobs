# Paso 9 — Migración del auth a Clerk

> Planeamiento full-stack para reemplazar el sistema de autenticación propio de BBJobs
> (JWT HS256 + refresh tokens en DB + bcrypt + tokens de verificación/reset) por **Clerk**
> como proveedor de identidad. Cubre backend (FastAPI) y frontend (Next.js 16).
>
> **No se toca código en este paso.** Este documento es el plan; la implementación es posterior.
>
> **Decisiones tomadas** (validadas con el usuario antes de redactar):
> 1. **UI híbrida**: se mantiene la página propia (fondo mesh, logo BBJobs, flecha "volver al inicio") y adentro se embebe el componente de Clerk (`<SignIn>` / `<SignUp>`) tematizado con la *appearance API* para acercarlo a la paleta teal/glassmorphism. Los flujos sensibles (recupero de contraseña, verificación de email, MFA futuro) los maneja Clerk.
> 2. **Datos actuales**: se recrean de cero. El seed provisiona el admin en Clerk vía Backend API; la empresa de prueba se vuelve a registrar con el flujo nuevo. No se migran hashes de contraseña.
>
> **Principios rectores (obligatorios al implementar):**
> - **Separación de responsabilidades**: *Clerk maneja la autenticación (identidad, sesiones, credenciales, recupero, verificación). La lógica de negocio de los roles y permisos la maneja nuestra base de datos PostgreSQL.* El backend nunca delega la autorización a Clerk: el `role` autoritativo vive en `users.role` (ver §8).
> - **Appearance API no es opcional**: al generar el código, **es obligatorio** incluir la configuración de la `appearance` API de Clerk, alimentada por las variables/tokens de diseño del proyecto (radios de borde, colores primarios, tipografías). Sin esto el componente importado no se funde con la interfaz. Detalle concreto en §7.1.

---

## 1. Diagnóstico del auth actual

### Qué hay hoy

**Backend**
- JWT **HS256** (30 min) firmado con `SECRET_KEY` (`app/core/security.py`).
- **Refresh tokens opacos** en tabla `refresh_tokens`, con rotación + período de gracia de 30 s contra reuse (`app/api/v1/auth.py`).
- Contraseñas con **bcrypt** directo.
- Tokens de **verificación de email** (`email_verification_tokens`) y **reset de contraseña** (`password_reset_tokens`) — pero **sin proveedor de mail activo** (Resend pendiente), así que hoy no se envían.
- Tabla `users` local (canónica) con `role` (admin/company/candidate) + 3 tablas de perfil (`candidate_profiles`, `company_profiles`, `admin_profiles`).
- `get_current_user` decodifica el JWT, busca el `User` por UUID y **setea el contexto RLS** (`app.current_user_id`, `app.user_role`) vía `SET LOCAL` (`app/db/rls.py`).
- `require_role`, `require_verified_company` para autorización.
- Borrado de cuenta (Ley 25.326) verifica la contraseña con bcrypt (`app/api/v1/account.py`).

**Frontend**
- Axios con `withCredentials`; access token **en memoria** (variable de módulo en `lib/api.ts`).
- Store Zustand (`store/auth.ts`) con `user` + `isAuthenticated`.
- Refresh **lazy**: sólo cuando una request da 401, el interceptor llama a `/auth/refresh` (lee la cookie httpOnly) y reintenta.
- Páginas custom de login y registro (el registro de empresa junta muchos datos: razón social, CUIT, industria, provincia, ciudad, cantidad de empleados, responsable…).

### Qué duele (por qué migramos)

1. **No hay rehidratación de sesión al recargar.** El token vive en memoria y se pierde en cada F5. No existe un provider que restaure la sesión al montar la app; el refresh sólo ocurre reactivamente ante un 401. Resultado: parpadeos de "no logueado", panels que arrancan en estado inconsistente.
2. **Recupero de contraseña y verificación de email no funcionan** (falta proveedor de mail). Construirlos y mantenerlos es trabajo que no aporta al negocio.
3. **Superficie de seguridad propia**: rotación de refresh tokens, hashing, expiración, revocación — todo mantenido a mano.
4. **RLS a medias**: `set_rls_context` setea las variables GUC pero **no hay policies de RLS en la DB todavía** (es andamiaje). El mecanismo se conserva, pero hoy no protege nada.

> **Conclusión.** Clerk resuelve identidad, sesiones persistentes, recupero, verificación y MFA "que funciona". Lo que **no** delegamos es el modelo de negocio: roles, perfiles, verificación de empresa, anonimización (Ley 25.326). Eso sigue en nuestra DB.

---

## 2. Arquitectura objetivo

**Clerk = proveedor de identidad. La tabla `users` local sigue siendo la fuente canónica del usuario de negocio.** Se vinculan por una columna nueva `clerk_user_id`.

```
┌────────────┐   session JWT (RS256)   ┌──────────────────────┐
│  Navegador │ ──────────────────────▶ │  FastAPI              │
│ (Clerk SDK)│   Authorization: Bearer │  verifica vía JWKS    │
└────────────┘                         │  → clerk_user_id      │
      │                                │  → User local (UUID)  │
      │ signup/login/reset             │  → set RLS context    │
      ▼                                └──────────────────────┘
┌────────────┐   webhooks (Svix)             │
│   Clerk    │ ────────────────────────────▶ │ /webhooks/clerk
│ (identidad)│   user.deleted / user.updated │ (sync a DB)
└────────────┘                               │
      ▲   Backend API (crear admin, borrar usuario, set metadata)
      └────────────────────────────────────────────────────────
```

### Por qué mantener la tabla `users` local (y no ir "Clerk-only")

- **Todo el dominio está cableado al `User.id` (UUID)** vía FKs: `candidate_profiles`, `company_profiles`, `applications`, `job_postings` (dueño), `notifications`, `subscriptions`, `payments`, `audit_logs`. Reemplazar esa clave por el ID de Clerk en todas las tablas sería una refactor gigante y riesgosa.
- **La RLS** (cuando se activen policies) necesita el UUID interno.
- **Roles, verificación de empresa y anonimización** son reglas de negocio que deben vivir en nuestra DB, no en el proveedor de identidad.

### Verificación de token en el backend

Clerk emite un **session token** (JWT RS256) que el frontend obtiene con `getToken()`. El backend lo verifica de forma **networkless** contra el **JWKS** de Clerk (claves públicas cacheadas):

- Valida firma, `iss` (issuer de la instancia Clerk), `exp`, y `azp` (authorized party = origen del frontend).
- Extrae `sub` = `clerk_user_id`.
- Busca el `User` local por `clerk_user_id`. Si no existe → el usuario aún no completó **onboarding** (ver §5).

Se usa el **SDK oficial de Clerk para Python** (`clerk-backend-api`) para: verificar requests, crear usuarios (alta de admin), borrar usuarios (Ley 25.326) y setear metadata. Para los webhooks se usa **`svix`** (verificación de firma).

### Provisión del `User` local — JIT en onboarding

**El `User` local se crea al completar el onboarding, no en el signup de Clerk.** Esto evita el problema de "usuario sin rol" (la columna `users.role` es NOT NULL y el rol recién se conoce en el onboarding).

- Signup en Clerk → sesión activa, pero todavía **no hay `User` local**.
- El frontend detecta "onboarding incompleto" y redirige a `/onboarding`.
- El form de onboarding hace `POST /api/v1/me/onboarding/{candidate|company}` → el backend crea `User(clerk_user_id, role, email)` + perfil + (empresa: `Subscription` Free + `notify_all_admins`).
- Los **webhooks** cubren lo que pasa fuera de banda: `user.deleted` (baja), `user.updated` (sincronizar email). `user.created` es no-op (la provisión real ocurre en onboarding).

---

## 3. Cambios en el modelo de datos

### `users` (tabla existente)

| Cambio | Detalle |
|--------|---------|
| **+ `clerk_user_id`** | `VARCHAR(255) UNIQUE NULL` (nullable durante la transición; en la práctica siempre presente para usuarios nuevos). Indexado. |
| **`password_hash` → nullable** | Clerk es dueño de las credenciales. Se deja de escribir/leer. Se dropea en una migración de limpieza posterior. |
| `email` | Se mantiene (espejo del email de Clerk, sincronizado por webhook `user.updated`). |
| `role`, `is_active`, `email_verified_at`, `deleted_at` | Se mantienen. `email_verified_at` pasa a reflejar el estado de Clerk (seteado en onboarding si el email ya está verificado). |

### Tablas que quedan obsoletas (deprecadas, se dropean en migración de limpieza)

- `refresh_tokens` — Clerk maneja sesiones y refresh.
- `email_verification_tokens` — Clerk verifica emails.
- `password_reset_tokens` — Clerk maneja recupero.

> **Estrategia de migración de schema.** Una migración Alembic agrega `clerk_user_id` y hace `password_hash` nullable. Las tres tablas obsoletas se **dejan dormidas** una release (por si hay que rollback) y se dropean en una segunda migración de limpieza. Encadenada a `a7c3e0b1f4d2` (última aplicada).

---

## 4. Setup de Clerk (dashboard + entorno)

### En el dashboard de Clerk

1. Crear la aplicación (instancia **Development** para local; **Production** para `bbjobs.com.ar` más adelante).
2. Habilitar **Email + Password** y **Google** como métodos de sign-in. (LinkedIn / Microsoft opcionales para F2; Apple / Facebook / GitHub descartados.)
3. Activar los toggles anti-duplicación/abuso: **account linking**, **enforce email verification**, **block disposable emails**, **bot protection** (ver §9.1).
4. Configurar **localización en español** (`esES`) para los componentes.
5. Crear el **webhook** apuntando a `https://api.bbjobs.com.ar/api/v1/webhooks/clerk` (en local, vía túnel tipo ngrok/cloudflared) con eventos `user.created`, `user.updated`, `user.deleted`. Guardar el **signing secret**.
6. (Opcional) Personalizar el **session token** para incluir `metadata.role` como claim, así el frontend/back leen el rol sin lookup extra. El backend igual confía en la DB.

### Variables de entorno

**Backend (`.env`)**
```env
CLERK_SECRET_KEY=sk_test_...          # Backend API + verificación
CLERK_PUBLISHABLE_KEY=pk_test_...     # (opcional, referencia)
CLERK_JWKS_URL=https://<instancia>.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://<instancia>.clerk.accounts.dev
CLERK_WEBHOOK_SECRET=whsec_...        # verificación Svix
CLERK_AUTHORIZED_PARTY=http://localhost:3000   # azp esperado
```

**Frontend (`.env.local`)**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...          # sólo si se usan server actions/API routes de Clerk
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/post-login
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding
```

Se agregan también a `backend/.env.example` y a la config de Railway/Vercel.

---

## 5. Flujos rediseñados

### 5.1 Registro de candidato

1. `/register?type=candidate` → nuestra página (shell propio) renderiza `<SignUp>` de Clerk tematizado. El `type` se guarda como `unsafeMetadata.role = "candidate"`.
2. Clerk crea el usuario, envía y valida el **código de verificación de email** (su flujo, no el nuestro).
3. Redirect a `/onboarding` → form con los campos del candidato (nombre, apellido, teléfono).
4. `POST /api/v1/me/onboarding/candidate` → crea `User(clerk_user_id, role=candidate, email)` + `CandidateProfile`. Setea `publicMetadata.role=candidate` en Clerk.
5. Redirect a `/dashboard/candidate`.

### 5.2 Registro de empresa

Igual que candidato, pero:
- `unsafeMetadata.role = "company"`.
- El onboarding junta los datos ricos actuales (razón social, CUIT, industria, provincia, ciudad, cantidad de empleados, responsable con nombre/apellido/cargo/teléfono/email).
- `POST /api/v1/me/onboarding/company` → crea `User` + `CompanyProfile(verification_status=pending)` + `Subscription` Free + **`notify_all_admins(admin_company_pending)`** (el mismo evento que ya cableamos en el módulo de notificaciones).
- Redirect a `/dashboard/company` (con el banner de "verificación en proceso").

> **Validaciones de negocio** (CUIT único, email único) se mantienen en el endpoint de onboarding, devolviendo 409 como hoy.

### 5.3 Login

- `/login` → nuestra página (shell propio) con `<SignIn>` tematizado.
- Clerk autentica y crea sesión persistente.
- Redirect a `/post-login` (página puente) → llama a `GET /api/v1/me`:
  - Si hay `User` local → redirige a `/dashboard/{role}`.
  - Si no → redirige a `/onboarding` (caso: se registró pero no completó el perfil).

### 5.4 Recupero de contraseña / verificación de email

- **100% Clerk.** El "¿Olvidaste la contraseña?" del `<SignIn>` dispara el flujo de Clerk (email con código/reset). Se elimina todo nuestro `/auth/password/*` y `/auth/verify-email*`.

### 5.5 Alta de admin (Talency)

- Los admins **no se auto-registran**. El endpoint existente `POST /api/v1/admin/users` cambia a:
  1. Crear el usuario en Clerk vía **Backend API** (`clerk-backend-api`), con `publicMetadata.role=admin`. Se envía invitación o se setea contraseña inicial.
  2. Crear `User(clerk_user_id, role=admin, email)` + `AdminProfile` inmediatamente (sin onboarding).
- **`role=admin` sólo se setea server-side.** Nunca desde el cliente (un usuario no puede auto-asignarse admin vía `unsafeMetadata`).

### 5.6 Borrado de cuenta (Ley 25.326)

- `DELETE /api/v1/me/account`:
  1. Ya no verifica contraseña con bcrypt (no la tenemos). Se reemplaza por **confirmación tipeada** en el frontend ("escribí ELIMINAR"). *(Alternativa más fuerte: Clerk re-verification; queda como opción.)*
  2. Ejecuta la lógica actual de anonimización/borrado local.
  3. **Además borra el usuario en Clerk** vía Backend API (`delete_user(clerk_user_id)`).
- El webhook `user.deleted` queda como red de seguridad idempotente (si el borrado se inicia desde el dashboard de Clerk, igual se refleja en la DB).

---

## 6. Backend — cambios por archivo

| Archivo | Cambio |
|---------|--------|
| `app/core/config.py` | + `CLERK_SECRET_KEY`, `CLERK_JWKS_URL`, `CLERK_ISSUER`, `CLERK_WEBHOOK_SECRET`, `CLERK_AUTHORIZED_PARTY`. |
| `app/integrations/clerk_client.py` (**nuevo**) | Wrapper del SDK: verificación de session token (JWKS), y helpers de Backend API (`create_user`, `delete_user`, `set_public_metadata`). |
| `app/api/deps.py` | `get_current_user` deja de decodificar HS256 propio: ahora **verifica el token de Clerk**, extrae `clerk_user_id`, busca `User` por esa columna, setea RLS. Si no hay `User` → 403 con código `onboarding_required`. `require_role` / `require_verified_company` **no cambian** (siguen recibiendo un `User`). |
| `app/api/v1/auth.py` | Se **elimina** casi todo: `register/*`, `login`, `refresh`, `logout`, `verify-email*`, `password/*`. |
| `app/api/v1/me.py` (**nuevo** o repurpose de `/auth/me`) | `GET /api/v1/me` → devuelve `{ user_id, role, email, onboarding_complete, is_verified }`. Es el endpoint que el frontend usa para rutear post-login. |
| `app/api/v1/onboarding.py` (**nuevo**) | `POST /me/onboarding/candidate` y `POST /me/onboarding/company` → crean `User` + perfil (JIT). El de empresa dispara `notify_all_admins`. |
| `app/api/v1/webhooks.py` | + `POST /webhooks/clerk`: verifica firma Svix; maneja `user.deleted` (baja/anonimización), `user.updated` (sync email). Idempotente por `clerk_user_id`. |
| `app/api/v1/admin.py` | `create_admin_user` ahora crea el usuario en Clerk (Backend API) + `publicMetadata.role=admin` + `User`/`AdminProfile` local. |
| `app/api/v1/account.py` | Borrado: quitar chequeo bcrypt (confirmación tipeada), + borrar usuario en Clerk. |
| `app/core/security.py` | Se **elimina** JWT/refresh/bcrypt helpers (o se deja vacío). |
| `app/db/rls.py` | **Sin cambios** — sigue seteando el contexto con el UUID interno. |
| `app/schemas/auth.py` | Reemplazado por `schemas/onboarding.py` (los `*Register` pierden `email`/`password`, que ahora los maneja Clerk; conservan los datos de negocio). |
| `pyproject.toml` | + `clerk-backend-api`, + `svix`. Se pueden quitar `python-jose` y `passlib[bcrypt]` en la limpieza. |
| Alembic | Migración: `+ clerk_user_id`, `password_hash` nullable. (Cleanup posterior: drop de tablas de tokens.) |

---

## 7. Frontend — cambios

| Archivo | Cambio |
|---------|--------|
| `package.json` | + `@clerk/nextjs` (verificar versión que soporte **Next 16.2 / React 19** — a la fecha, v6.x targetea App Router + React 19; confirmar al instalar). + `@clerk/localizations` (esES). |
| `src/proxy.ts` (**nuevo** — NO `middleware.ts`) | **Next.js 16 renombró `middleware.ts` → `proxy.ts`** (deprecado desde v16.0.0; la función exportada pasa a llamarse `proxy`, no `middleware`). Se envuelve `clerkMiddleware()` de Clerk dentro de `export function proxy(...)`, con `createRouteMatcher` protegiendo `/dashboard(.*)` y `/onboarding(.*)`; redirige no-autenticados a `/login`. **Verificar que la versión instalada de `@clerk/nextjs` ya soporte el nuevo nombre de archivo** — si no, usar el wrapper manual (`proxy.ts` re-exportando el handler de `clerkMiddleware()`) en vez de depender de convención automática. |
| `src/app/layout.tsx` | Envolver todo en `<ClerkProvider localization={esES} appearance={...}>`. |
| `src/lib/clerk-appearance.ts` (**nuevo**) | Objeto `appearance` de Clerk mapeado a la paleta (teal `#1E8EA3`, radios, fuentes Jakarta/DM Sans, glassmorphism en `card`). |
| `src/app/login/page.tsx` | Mantiene el shell (fondo mesh, logo, flecha volver) y adentro `<SignIn />` tematizado. Se borra el form manual y el `handleSubmit`. |
| `src/app/register/page.tsx` | Idem con `<SignUp />`; el `type` (candidate/company) se pasa como `unsafeMetadata.role`. Se conserva el toggle visual de rol. |
| `src/app/onboarding/page.tsx` (**nuevo**) | Form de datos de negocio (candidato / empresa) que hoy vive en `register`. POSTea a `/me/onboarding/*`. |
| `src/app/post-login/page.tsx` (**nuevo**) | Página puente: llama a `GET /me` y redirige a dashboard u onboarding. |
| `src/lib/api.ts` | El interceptor deja de usar el token en memoria + `/auth/refresh`. Ahora obtiene el token de Clerk (`getToken()`) antes de cada request (Clerk refresca solo). Patrón: un provider cliente registra un `getToken` en el módulo `api` (como el actual `setAccessToken`) y el interceptor lo `await`ea. |
| `src/store/auth.ts` | Se simplifica o elimina: el estado de sesión pasa a `useUser()`/`useAuth()` de Clerk. Se puede conservar un store fino para `role` + `onboarding_complete` derivados de `/me`. |
| `src/components/layout/Header.tsx` | El botón "Salir" usa `useClerk().signOut()`. "Mi Panel" lee el rol de `useUser().publicMetadata.role` o de `/me`. La campana sigue igual. |
| `src/app/dashboard/*/page.tsx` | El gating (`isAuthenticated`/`isLoading`) pasa a `useAuth()` de Clerk (`isLoaded`, `isSignedIn`) + rol de `/me`. Los botones "Salir" usan `signOut()`. |

### 7.1 Consistencia de diseño — appearance API (obligatoria)

- La página `/login` y `/register` conservan su layout actual: fondo mesh, logo BBJobs centrado, flecha "volver al inicio" arriba a la izquierda.
- Dentro va el `<SignIn>`/`<SignUp>` de Clerk con `appearance` tematizado para que **se funda sin fisuras** con el resto de la interfaz.
- Localización `esES` para que todo el copy de Clerk salga en español.

> **Instrucción explícita para la generación de código.** Es **obligatorio** definir la
> configuración de la `appearance` API de Clerk e inyectarle las variables/tokens de diseño
> del proyecto. Sin esto el componente importado se ve "estándar Clerk" y rompe la identidad.

La `appearance` se centraliza en `src/lib/clerk-appearance.ts` y se pasa al `<ClerkProvider>`
(o por componente). Mapeo mínimo desde el sistema visual de BBJobs:

```ts
// src/lib/clerk-appearance.ts  (esquema conceptual del plan, no código final)
export const clerkAppearance = {
  variables: {
    colorPrimary: "#1E8EA3",        // teal (CTAs, foco, links)
    colorText: "#1C2230",           // texto principal (nunca negro puro)
    colorTextSecondary: "#64748B",  // texto muted
    colorBackground: "#FFFFFF",     // surface de las cards
    colorInputBackground: "#FAFBFD",
    colorInputText: "#1C2230",
    colorDanger: "#EE4444",
    borderRadius: "0.75rem",        // acorde a inputs/cards del sistema (rounded-xl)
    fontFamily: "var(--font-sans)", // DM Sans (body)
    fontFamilyButtons: "var(--font-display)", // Plus Jakarta Sans (botones/headings)
  },
  elements: {
    // Ajustes finos que la `variables` no cubre:
    card: "bg-white border border-[#DDE3EC] shadow-sm rounded-2xl", // look del sistema
    formButtonPrimary: "bg-[#1E8EA3] hover:bg-[#187B8E]",
    headerTitle: "font-display",
    footer: "hidden", // ocultamos el "Secured by Clerk" / links redundantes si molesta
  },
};
```

- Las **CSS variables del proyecto** (`--font-display`, `--font-sans`, y los hex de la paleta)
  se referencian directamente, de modo que si el sistema visual cambia, Clerk lo hereda.
- Los `elements` permiten pasar **clases Tailwind** del propio proyecto, así el `card` de Clerk
  reusa exactamente el borde/sombra/radio de las demás cards (glassmorphism del navbar/paneles).
- Verificación de diseño: el `<SignIn>` embebido debe ser visualmente indistinguible de una card
  nativa de BBJobs (mismo radio, misma sombra, mismos colores de foco y tipografías).

---

## 8. Roles y autorización

> **Principio (obligatorio).** *Clerk maneja la autenticación; la lógica de negocio de los
> roles la maneja nuestra base de datos PostgreSQL.* Clerk responde "quién sos" (identidad),
> pero "qué podés hacer" (rol, permisos, verificación de empresa) lo decide el backend contra
> la DB. El `publicMetadata.role` de Clerk es sólo un **espejo de conveniencia** para el ruteo
> del frontend; jamás es la autoridad.

- **Fuente de verdad: `users.role` en la DB** (autoridad para el backend).
- **Espejo en Clerk `publicMetadata.role`** para ruteo cómodo en el frontend (`useUser()`), seteado en onboarding / alta de admin.
- `unsafeMetadata.role` (elegido por el cliente en signup) es **sólo una intención** para candidato/empresa; el backend lo valida y nunca acepta `admin` desde ahí.
- `admin` se asigna **exclusivamente server-side**.
- `require_role` y `require_verified_company` siguen funcionando igual (operan sobre el `User` local).

---

## 9. Anti-duplicación de cuentas

> Una persona con varios emails reales siempre podrá crear varias cuentas — es inherente a
> cualquier sistema basado en email. El objetivo no es prevención total (imposible) sino
> **subir la fricción** y hacer única la identidad *legalmente significativa* donde importa.

### 9.1 Clerk — toggles a activar

- **Account linking**: fusiona en una sola identidad al mismo email que entra por método
  distinto (password vs Google). Corta el caso "mismo email → dos cuentas".
- **Enforce email verification**: bloquea altas con email no verificado.
- **Block disposable/temporary emails**: rechaza dominios descartables (10minutemail, etc.).
- **Bot protection + CAPTCHA**: frena el alta masiva automatizada.

### 9.2 Empresa — CUIT (el lever real, ya en schema)

- `company_profiles.cuit` ya es `UNIQUE`: aunque existan varias identidades en Clerk, no se
  registran dos empresas con el mismo CUIT (409 en onboarding).
- **Refuerzo**: al reintentar un CUIT que pertenece a una empresa `suspended` o `rejected`,
  bloquear con un mensaje claro (evita evadir la suspensión creando una cuenta nueva). Se
  valida en `POST /me/onboarding/company`.

### 9.3 Candidato — DNI + marcador de sexo (clave compuesta)

- **F1**: alcanza con el dedup de email de Clerk (el riesgo de un candidato con doble cuenta
  es bajo — a lo sumo saltea el cooldown de un test).
- **Refuerzo opcional**: usar el **DNI** como clave de identidad. **Importante**: en Argentina
  existen DNIs duplicados legítimos — el mismo número asignado a una persona de sexo masculino
  y a una femenina. Por eso la unicidad **no puede ser sobre el DNI solo**: debe ser la
  **clave compuesta `(dni, sexo)`**.
  - El marcador de sexo del DNI argentino es **M / F / X** (la "X" no binaria existe desde
    2021, Decreto 476/2021). El campo debe aceptar los tres para no excluir a titulares con
    marcador X; la lógica de la clave compuesta es idéntica.
  - Schema (si se implementa): `+ candidate_profiles.dni` + constraint
    `UNIQUE (dni, sex_marker)`. Ya existe `candidate_profiles.gender` (String, nullable); se
    puede reutilizar o agregar un `sex_marker` dedicado y acotado a `M|F|X` para el constraint.
  - **F1: DNI opcional**; si se provee, se valida la unicidad compuesta. Hacerlo obligatorio
    sólo si aparece abuso real.

### 9.4 Punto de enforcement

Todo se hace cumplir en los endpoints de **onboarding** (`POST /me/onboarding/company|candidate`),
que devuelven **409** ante colisión de CUIT, de `(dni, sexo)`, o de email.

---

## 10. Migración de datos / seed

- **Recrear de cero** (pre-producción, sólo datos de prueba).
- El `seed.py` se ajusta: en vez de crear el admin con `bcrypt`, lo crea en **Clerk vía Backend API** (`admin@bbjobs.com.ar`), setea `publicMetadata.role=admin`, y crea el `User`/`AdminProfile` local con el `clerk_user_id` devuelto.
- La empresa de prueba (`gaellgonzalez10@gmail.com`) se vuelve a registrar con el flujo nuevo (signup Clerk → onboarding).
- No se migran hashes de contraseña (el recupero de Clerk cubre cualquier necesidad).

---

## 11. Plan de implementación (checklist por fases)

**Fase 0 — Preparación**
- [ ] Crear app en Clerk (Development), habilitar Email+Password, localización esES.
- [ ] Verificar compatibilidad `@clerk/nextjs` con Next 16.2 / React 19.
- [ ] Cargar env vars (backend + frontend) y `backend/.env.example`.
- [ ] Configurar webhook (túnel local) + guardar signing secret.

**Fase 1 — Backend base**
- [ ] `clerk_client.py` (verificación JWKS + Backend API).
- [ ] Migración Alembic: `+ clerk_user_id`, `password_hash` nullable.
- [ ] `get_current_user` verifica token de Clerk + JIT lookup + RLS.
- [ ] `GET /me` (rol + onboarding status).
- [ ] Endpoints de onboarding (candidate/company) con `notify_all_admins` en empresa.
- [ ] Webhook `/webhooks/clerk` (deleted/updated) con verificación Svix.
- [ ] Eliminar `/auth/*` (register/login/refresh/logout/verify/reset).
- [ ] `create_admin_user` vía Clerk Backend API.
- [ ] Borrado de cuenta: confirmación tipeada + `delete_user` en Clerk.

**Fase 2 — Frontend base**
- [ ] Instalar `@clerk/nextjs` + `@clerk/localizations`.
- [ ] **`src/lib/clerk-appearance.ts` con la `appearance` API alimentada por los tokens/CSS variables del proyecto (obligatorio, §7.1).**
- [ ] `<ClerkProvider>` en `layout.tsx` + `appearance` tematizado + `localization={esES}`.
- [ ] `proxy.ts` (Next 16 — no `middleware.ts`) protegiendo `/dashboard` y `/onboarding`.
- [ ] `/login` y `/register` híbridos (shell + componente Clerk).
- [ ] `/onboarding` (form de negocio) + `/post-login` (ruteo).
- [ ] `api.ts` usando `getToken()` de Clerk.
- [ ] Header + dashboards con `useAuth()`/`signOut()`.
- [ ] Simplificar/retirar el store Zustand de auth.

**Fase 3 — Datos y verificación end-to-end**
- [ ] Ajustar `seed.py` (admin en Clerk).
- [ ] Recrear empresa de prueba con el flujo nuevo.
- [ ] Probar: registro candidato → onboarding → dashboard.
- [ ] Probar: registro empresa → onboarding → notificación al admin → verificación → publicar.
- [ ] Probar: recupero de contraseña (Clerk).
- [ ] Probar: alta de admin desde el panel.
- [ ] Probar: borrado de cuenta (local + Clerk).
- [ ] Probar: recarga dura (F5) mantiene la sesión (el dolor original resuelto).

**Fase 4 — Limpieza (posterior)**
- [ ] Migración drop de `refresh_tokens`, `email_verification_tokens`, `password_reset_tokens`, `password_hash`.
- [ ] Quitar `python-jose`, `passlib[bcrypt]` de dependencias.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| `@clerk/nextjs` vs Next 16.2 / React 19 | Pre-flight en Fase 0: verificar versión soportada antes de avanzar. Si hay incompatibilidad, fijar versión de Clerk o (peor caso) evaluar App Router con la versión soportada. |
| `middleware.ts` no existe en Next 16 (renombrado a `proxy.ts`, función `proxy`) | **Ya identificado** (confirmado contra `node_modules/next/dist/docs`, ver §7). Verificar al instalar si `@clerk/nextjs`/`clerk init` ya generan `proxy.ts`; si generan `middleware.ts` por desactualización, renombrar manualmente el archivo y la función exportada. |
| Theming del componente Clerk que no matchee 100% el glassmorphism | La *appearance API* cubre colores/radios/tipografías/elementos; lo que no llegue se ajusta con CSS sobre los `elements` de Clerk. La UI híbrida ya aísla el componente dentro de nuestro shell. |
| Latencia/entrega de webhooks | La provisión real es JIT en onboarding (no depende del webhook). El webhook sólo cubre delete/update, e idempotente por `clerk_user_id`. |
| Sesión sin `User` local (onboarding a medias) | `GET /me` distingue el estado; el middleware + `/post-login` fuerzan onboarding antes de operar. Endpoints de negocio devuelven 403 `onboarding_required`. |
| Localización parcial | `esES` de `@clerk/localizations`; strings faltantes se overridean puntualmente. |
| Borrado que falla en Clerk pero ya anonimizó local (o viceversa) | Orden: anonimizar/borrar local en transacción → luego `delete_user` en Clerk; el webhook `user.deleted` reconcilia si algo quedó a mitad. |

---

## 13. Fuera de alcance (futuro)

- **Social login** (Google, etc.) — Clerk lo habilita con un toggle, pero no en esta migración.
- **MFA** — disponible en Clerk; se puede activar después sin tocar código.
- **Organizations de Clerk** para multi-usuario por empresa — hoy una empresa = un usuario; queda para cuando se necesite equipo.
- **Instancia de producción + dominio** (`bbjobs.com.ar` / `accounts.bbjobs.com.ar`) — se configura al ir a prod.
- **RLS policies reales** en Postgres — el mecanismo de contexto se conserva intacto para cuando se activen.

---

## 14. Decisiones registradas

| Decisión | Elección | Motivo |
|----------|----------|--------|
| Proveedor de identidad | Clerk | "Que funciona", trae recupero/verificación/MFA sin construirlos. |
| Tabla `users` local | Se mantiene, vinculada por `clerk_user_id` | Todo el dominio y la RLS dependen del UUID interno. |
| Verificación de token | JWKS networkless (SDK oficial) | Sin llamada de red por request; estándar de Clerk. |
| Provisión del `User` local | JIT en onboarding (no en signup) | Evita el problema de `role` NOT NULL sin rol conocido. |
| Sincronización | Webhooks (delete/update) + JIT | Cubre cambios fuera de banda de forma idempotente. |
| UI de auth | Híbrida (shell propio + componente Clerk tematizado) | Pantalla on-brand + flujos sensibles delegados. |
| Fuente de verdad de roles | DB (`users.role`), espejo en `publicMetadata` | Autoridad de negocio en la DB; ruteo cómodo en el front. |
| `admin` | Sólo server-side | Seguridad: nadie se auto-asigna admin. |
| Datos actuales | Recrear de cero | Pre-producción, datos de prueba, sin arrastrar hashes. |
| Borrado de cuenta | Confirmación tipeada + `delete_user` en Clerk | Ya no tenemos la contraseña para re-auth con bcrypt. |
| Tablas de tokens viejas | Deprecadas → drop en limpieza | Rollback seguro durante la transición. |
| Sign-in options | Email+Password + **Google**; LinkedIn/Microsoft opcionales F2; Apple/Facebook/GitHub descartados | Google domina en Argentina y baja la fricción del candidato; el resto no aporta o suma fricción/costo. |
| Anti-duplicación empresa | CUIT único (ya en schema) + bloqueo de CUIT suspendido/rechazado | ID legal único por empresa; corta evasión de suspensión. |
| Anti-duplicación candidato | Dedup de email (F1); opcional clave compuesta **`(dni, sexo)`** | Hay DNIs duplicados legítimos M/F en AR; la unicidad debe incluir el marcador de sexo (M/F/X). |

---

*Documento de migración del auth a Clerk — Paso 9.*
*Decisiones validadas con el usuario antes de redactar. No se tocó código en este paso.*
