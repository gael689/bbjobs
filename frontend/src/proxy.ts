import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { construirCsp, headersSeguridad } from "@/lib/seguridad";

// Público-primero: BBJobs es un portal público (home, /empleos, /login, /register, etc.).
// Sólo el panel autenticado y el onboarding requieren sesión.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/onboarding(.*)"]);

// El proxy corre SÓLO en las rutas con sesión o formularios de Clerk (19/10/2026, ver `matcher`
// abajo y lib/rutas-sesion.ts): ahí se renderiza por request y va la CSP estricta con nonce.
// Las páginas públicas no pasan por acá: son estáticas/ISR y sus headers de seguridad (CSP fija
// sin nonce, HSTS, etc.) los pone next.config.ts `headers()`, que la CDN aplica sin función.
//
// Por qué alcanza con Clerk sólo en estas rutas: ninguna página pública llama a auth() ni a
// currentUser() del lado del servidor (lo único que exige que el middleware haya corrido), y el
// <ClerkProvider> del layout raíz no es `dynamic`, así que no lee la sesión en el servidor. En
// las públicas la sesión la maneja clerk-js en el navegador (useUser en el Header, getToken para
// la API). El handshake de Clerk (refrescar la cookie __session vencida) sí necesita el
// middleware, y por eso sigue corriendo en /login, /register, /post-login, /onboarding y
// /dashboard, que son las únicas que leen la sesión en el servidor (auth.protect()).
export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const cspHeader = construirCsp({ nonce, isDev });

  // El CSP con nonce viaja también en el request: es de donde Next.js lo lee para ponerle el
  // atributo nonce a sus <script> al renderizar.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", cspHeader);
  for (const { key, value } of headersSeguridad(isDev)) {
    response.headers.set(key, value);
  }

  return response;
});

export const config = {
  // Antes (hasta el 19/10/2026) el matcher tomaba todo salvo estáticos: el proxy, que en Next 16
  // corre en Node.js, era una invocación de función por cada request del sitio, incluidos los
  // prefetch de RSC (~160 por visita a la home, medido con Playwright) y los bots. Ahora sólo
  // estas rutas. Tiene que coincidir con RUTAS_CON_SESION (lib/rutas-sesion.ts): Next exige un
  // literal acá. `/:path*` también toma la ruta pelada (/dashboard, /login).
  // No hay rutas /api en el frontend (el backend es api.bbjobs.com.ar), así que no se listan.
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/login/:path*",
    "/register/:path*",
    "/post-login/:path*",
  ],
};
