import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Público-primero: BBJobs es un portal público (home, /empleos, /login, /register, etc.).
// Sólo el panel autenticado y el onboarding requieren sesión.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]);

// Origen del backend, derivado de NEXT_PUBLIC_API_URL (ej. http://localhost:8000/api/v1 en dev,
// https://api.bbjobs.com.ar/api/v1 en prod) — connect-src necesita el origen, no la ruta.
function apiOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").origin;
  } catch {
    return "http://localhost:8000";
  }
}

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // Clerk hoy sirve desde una instancia de test (*.clerk.accounts.dev) — el wildcard cubre
  // cualquier subdominio de esa forma. CUANDO se pase a producción (DEPLOY-PLAN.md bloque G):
  // si se configura un dominio custom de Clerk (ej. clerk.bbjobs.com.ar) hay que sumarlo acá,
  // el wildcard de *.clerk.accounts.dev no lo cubre.
  const clerkOrigins = "https://*.clerk.accounts.dev";

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
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' ${clerkOrigins}${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://res.cloudinary.com https://img.clerk.com;
    font-src 'self' data:;
    connect-src 'self' ${apiOrigin()} ${clerkOrigins};
    frame-src 'self' ${clerkOrigins};
    worker-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // max-age corto a propósito para el lanzamiento — HSTS es difícil de revertir (el navegador
  // recuerda la directiva). Subir el valor con el tiempo, no arrancar en el máximo. Sin
  // "preload": eso sí es prácticamente irreversible.
  if (!isDev) {
    response.headers.set("Strict-Transport-Security", "max-age=86400; includeSubDomains");
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
