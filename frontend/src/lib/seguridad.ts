// Headers de seguridad del sitio: la CSP y el resto (HSTS, X-Frame-Options...).
//
// Los usan dos lugares (19/10/2026):
// - src/proxy.ts, para las rutas con sesión (lib/rutas-sesion.ts): CSP con nonce, por request.
// - next.config.ts `headers()`, para todo lo demás: CSP fija sin nonce. Esos headers los aplica
//   la CDN de Vercel sin levantar ninguna función.
// Antes el proxy corría en TODAS las páginas sólo para poner estos headers, y en Next 16 el proxy
// corre en Node.js: cada request (incluidos los ~160 prefetch de RSC que dispara una sola visita,
// por los links del Header y el Footer) era una invocación de función con clerkMiddleware adentro.
// Eso es lo que agotaba el CPU (fluidCpuDuration) aunque las páginas públicas ya fueran estáticas.
//
// Este archivo no puede importar nada de Next ni de Clerk: lo carga next.config.ts.

// Origen del backend, derivado de NEXT_PUBLIC_API_URL (ej. http://localhost:8000/api/v1 en dev,
// https://api.bbjobs.com.ar/api/v1 en prod) — connect-src necesita el origen, no la ruta.
function apiOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").origin;
  } catch {
    return "http://localhost:8000";
  }
}

/**
 * Arma la CSP. Con `nonce` (rutas con sesión) los scripts necesitan el nonce; sin nonce (páginas
 * públicas) se permite 'unsafe-inline'.
 */
export function construirCsp({ nonce, isDev }: { nonce: string | null; isDev: boolean }): string {
  // Preview deploys siguen en la instancia de test de Clerk (*.clerk.accounts.dev, cubierto por
  // el wildcard). Production (DEPLOY-PLAN.md bloque G, 2026-07-20) pasó a un dominio custom de
  // Clerk (clerk.www.bbjobs.com.ar para el Frontend API, accounts.www.bbjobs.com.ar para el
  // Account Portal) que el wildcard de *.clerk.accounts.dev no cubre — hay que listarlo
  // explícito. isDev sólo distingue "corriendo local" de "deployado" (Preview y Production
  // corren ambos con NODE_ENV=production), así que se listan los tres orígenes siempre.
  const clerkOrigins =
    "https://*.clerk.accounts.dev https://clerk.www.bbjobs.com.ar https://accounts.www.bbjobs.com.ar";

  // NO usar 'strict-dynamic' acá: verificado con Playwright (ver SEGURIDAD-PLAN.md bloque C)
  // que ClerkProvider inyecta sus propios <script src="https://...clerk.accounts.dev/..."> ya
  // en el HTML servido, sin nonce — no son scripts "cargados por un script ya confiable", son
  // tags de primer nivel. 'strict-dynamic' hace que el navegador IGNORE cualquier dominio
  // explícito en script-src (por spec CSP3), así que combinarlo con el dominio de Clerk sería
  // inútil: el dominio nunca se respetaría. En cambio, confiamos en el nonce (para lo que
  // genera Next.js) + el dominio exacto de Clerk (para su script) — nada más pasa.
  //
  // style-src usa 'unsafe-inline' a propósito, no nonce: Tailwind/Next generan bastante estilo
  // inline (style={{}} en componentes como el anillo de perfil), y CSP no soporta nonce para
  // atributos style="" (sólo para <style>/<link>, ver CSP3). La inyección de CSS es un riesgo
  // mucho menor que la de JS (no ejecuta código ni exfiltra datos), así que el compromiso es
  // script-src estricto (con nonce + allowlist puntual) + style-src relajado.
  // Clerk usa Cloudflare Turnstile (challenges.cloudflare.com) para el CAPTCHA de bot-protection
  // en signup/signin. Sin este origen en script-src/frame-src/connect-src, Turnstile no carga y
  // Clerk devuelve 400 con "CAPTCHA failed to load" (visto en prod 2026-07-21).
  const turnstileOrigin = "https://challenges.cloudflare.com";

  // Páginas públicas: 'unsafe-inline' en vez de nonce (23/09/2026). Con nonce, TODAS las páginas
  // tenían que renderizarse por request (`force-dynamic` en el layout raíz), y eso agotaba el CPU
  // del plan de Vercel: cada visita a la home o a /empleos era una función corriendo, aunque esas
  // páginas traen sus datos desde el navegador. El costo de seguridad es acotado: estas páginas no
  // tienen sesión ni formularios de login (esos quedan en lib/rutas-sesion.ts, con nonce), y no
  // renderizan HTML de terceros — React escapa todo, y el único dangerouslySetInnerHTML (JSON-LD de
  // /empleos/[id]) ya escapa "<". Ver SEGURIDAD-PLAN.md, bloque C (actualización).
  const scriptSrc = nonce ? `'nonce-${nonce}'` : "'unsafe-inline'";

  // Medición (Frente 3, MAILS-SEO-IA-OCTUBRE-PLAN.md). Google Analytics 4 sólo se descarga después
  // de que la persona acepta "Medición" en el banner (components/consent/), pero la CSP tiene que
  // dejarlo pasar en todas las rutas. gtag.js sale de googletagmanager.com y manda los hits a
  // *.google-analytics.com / *.analytics.google.com (region1, etc.). No hay <script> inline: el
  // stub de gtag lo arma lib/analytics.ts, así que el nonce del panel no se toca.
  // Vercel Web Analytics usa /_vercel/insights (mismo origen, ya cubierto por 'self'); sólo en
  // `next dev` carga su script de debug desde va.vercel-scripts.com.
  // A propósito NO se habilita https://www.google.com: gtag.js manda ahí una copia del hit para
  // las funciones publicitarias (verificado con Playwright 08/10/2026: el hit de medición sale
  // igual por *.google-analytics.com). BBJobs no hace publicidad, así que esa copia queda bloqueada
  // y en la consola aparece un aviso de CSP esperable.
  const gaScript = "https://www.googletagmanager.com";
  const gaConnect =
    "https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com";
  const vercelAnalyticsDev = isDev ? " https://va.vercel-scripts.com" : "";

  return `
    default-src 'self';
    script-src 'self' ${scriptSrc} ${clerkOrigins} ${turnstileOrigin} ${gaScript}${vercelAnalyticsDev}${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://res.cloudinary.com https://img.clerk.com ${gaConnect};
    font-src 'self' data:;
    connect-src 'self' ${apiOrigin()} ${clerkOrigins} ${turnstileOrigin} ${gaConnect}${vercelAnalyticsDev};
    frame-src 'self' ${clerkOrigins} ${turnstileOrigin};
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, " ").trim();
}

/** Los headers de seguridad que no son la CSP. Iguales en todas las rutas. */
export function headersSeguridad(isDev: boolean): { key: string; value: string }[] {
  const lista = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
  // max-age corto a propósito para el lanzamiento — HSTS es difícil de revertir (el navegador
  // recuerda la directiva). Subir el valor con el tiempo, no arrancar en el máximo. Sin
  // "preload": eso sí es prácticamente irreversible.
  if (!isDev) {
    lista.push({ key: "Strict-Transport-Security", value: "max-age=86400; includeSubDomains" });
  }
  return lista;
}
