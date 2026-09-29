# Sesión vencida y 401 al guardar datos personales / subir CV — plan técnico (29/09/2026)

Síntoma reportado: los candidatos ven **"Error al guardar los datos personales"** y no pueden
cargar el CV.

## Diagnóstico (con evidencia de producción, Railway, 28/09/2026)

- `PATCH /me/candidate/profile`: **326 × 200 y 106 × 401** en 24 h (~25 % de fallos). Los 401
  también alcanzaron foto, CV, experiencia, idiomas, habilidades, postulaciones y el chequeo de
  notificaciones (246 × 401 en `unread-count`). No era validación (422) ni la base (500):
  `alembic upgrade head` corre en cada arranque y no había migraciones pendientes.
- Descartado: Cloudinary (10,8 % del cupo mensual del plan Free), `CLERK_AUTHORIZED_PARTIES`
  (incluye `www`, apex y el preview de Vercel), CSP.
- El token de sesión de Clerk **dura 60 s**. Llegaba vencido o directamente ausente por:
  1. **Carrera al montar**: los GET que una pantalla dispara al cargar salían antes de que
     `ClerkTokenSync` registrara `getToken` (sólo lo hace cuando `isLoaded`) → sin `Authorization`.
  2. **Subidas lentas** (CV hasta 5 MB, foto): FastAPI lee el cuerpo entero *antes* de resolver
     las dependencias, así que el token de 60 s se vencía mientras el archivo viajaba.
  3. **Formulario abierto un rato / pestaña dormida**: el token cacheado quedaba vencido.
- Lo que lo hacía invisible: el backend convertía todo rechazo en un 401 sin log, y el frontend
  mostraba el mismo cartel para cualquier fallo (`catch {}` sin mirar la respuesta).
- Agravante: `verify_session_token` era **síncrona dentro de un `async def`**, bloqueando el
  event loop cada vez que se pedía el JWKS a Clerk. Y los warnings de Pydantic por
  `company_verification_status` saturaban el límite de 500 logs/s de Railway y **descartaban
  mensajes** (incluidos los errores buscados).

## Bloques

- [x] **A · Backend: motivo del rechazo y verificación asíncrona** (29/09/2026)
  `app/integrations/clerk_client.py`: `verify_session_token` pasa a `verify_token_async`;
  `ClerkTokenError` lleva `reason` (código de Clerk) y `transient`.
  `app/api/deps.py`: `HTTPBearer(auto_error=False)`; cada rechazo loguea
  `auth_rejected reason=… method=… path=…` (nunca el token). Los fallos de **Clerk/JWKS**
  (`jwk-failed-to-load`, `jwk-remote-invalid`, `server-error`) responden **503**, no 401: no son
  una sesión vencida y el frontend no debe pedir login por ellos.
  Tests: `tests/test_auth_deps.py`.
- [x] **B · Backend: sacar el ruido de los logs** (29/09/2026)
  `app/api/v1/admin.py` (listado de búsquedas): la columna es `String` y `model_copy(update=)`
  no valida, así que llegaba `"verified"` en vez del enum. Se convierte a `VerificationStatus`.
- [x] **C · Frontend: `lib/api.ts` resiliente** (29/09/2026)
  - Espera (máx. 4 s) a que Clerk registre el `getToken` antes de mandar el primer pedido.
  - Las subidas (`FormData`) piden **token fresco** (`skipCache`).
  - Ante un 401, **reintenta una vez** con token fresco. Si vuelve a fallar marca la sesión
    como vencida (`SESSION_EXPIRED_EVENT`); el primer 2xx autenticado la limpia.
  - Verificado con un adaptador falso de axios: 401→200 reintenta y no marca; 401→401 rechaza y
    marca; 500 no reintenta; `FormData` usa token fresco.
- [x] **D · Frontend: aviso de sesión vencida** (29/09/2026)
  `components/auth/SessionExpiredBanner.tsx` (montado en `app/layout.tsx`): banner fijo con botón
  "Iniciar sesión" (`signOut` → `/login`). El chequeo de notificaciones
  (`hooks/useNotifications.ts`, `DashboardShell.tsx`) se pausa mientras la sesión está vencida.
- [x] **E · Frontend: errores que explican** (29/09/2026)
  `lib/apiError.ts` (`mensajeDeError`): distingue sesión vencida, 503, archivo grande, sin
  conexión, `detail` del servidor y 422 de Pydantic. `perfil/page.tsx` lo usa en datos personales,
  foto, CV y los "eliminar", y ya no se traga el fallo de carga del perfil.
- [x] **F · Fechas en hora local** (29/09/2026)
  `HOY` y `MAX_FECHA_NACIMIENTO` usaban `toISOString()` (UTC): en Argentina, pasadas las 21 h el
  tope del input quedaba corrido un día. Ahora `fechaLocal()`.

## Verificación en producción (pendiente hasta el deploy)

1. Railway → filtrar `auth_rejected`: ver la distribución de `reason`. Esperado: casi sin
   `no_authorization_header` ni `token-expired`; si aparece `token-invalid-authorized-parties`,
   revisar `CLERK_AUTHORIZED_PARTIES`.
2. Comparar la tasa de 401 sobre `PATCH /me/candidate/profile` contra la línea base de arriba
   (~25 %). Esperado: cerca de 0 %.
3. Probar el flujo completo (datos personales → CV) desde un navegador integrado de WhatsApp y
   desde uno normal.

## Fuera de alcance / a tener en cuenta

- El PATCH genérico de perfil envía `visible_in_talent_pool` sin pasar por
  `POST /me/candidate/talent-pool`, que es el que deja constancia del consentimiento. No se tocó
  acá; conviene revisarlo aparte porque sobre ese consentimiento se cobra un plan.
- Si tras el deploy siguieran apareciendo `token-invalid` con sesiones viejas, es probable que
  sean cookies de la instancia de test de Clerk anterior al pase a producción (20/07/2026): se
  resuelve volviendo a iniciar sesión.
