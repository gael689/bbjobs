import type { NextConfig } from "next";
import { construirCsp, headersSeguridad } from "./src/lib/seguridad";
import { RUTAS_CON_SESION } from "./src/lib/rutas-sesion";

const isDev = process.env.NODE_ENV === "development";

// Headers de seguridad de las páginas públicas (19/10/2026). Antes los ponía src/proxy.ts en cada
// request, y eso obligaba a correr una función por cada visita y cada prefetch aunque la página
// fuera estática. Desde acá los aplica la CDN de Vercel sin función. Las rutas con sesión quedan
// afuera del patrón: ahí el proxy pone la CSP con nonce (y los mismos headers de abajo), y si este
// patrón también las tomara, el navegador recibiría dos CSP distintas.
const PUBLICAS = `/((?!${RUTAS_CON_SESION.join("|")}).*)`;

const nextConfig: NextConfig = {
  // Saca el header `X-Powered-By: Next.js` — no protege de nada por sí solo, pero es gratis
  // no anunciar el framework exacto.
  poweredByHeader: false,
  images: {
    // Sin esto, next/image rechaza optimizar imágenes de estos dominios en producción (en dev
    // a veces pasa desapercibido) — logos/CVs de Cloudinary y avatares de Clerk, usados en
    // Header/Footer/DashboardShell/onboarding/login/register.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
    // 19/10/2026: hoy next/image sólo optimiza imágenes propias de /public (logo, hero de la home,
    // captura del panel), que cambian casi nunca. Con el default de Next 16 (4 horas) cada imagen
    // se volvía a transformar varias veces por día; con 30 días, una vez por mes. Si se reemplaza
    // una de esas imágenes, conviene hacerlo con otro nombre de archivo.
    minimumCacheTTL: 2592000,
    // Sin 2048 ni 3840 (el default los incluye): el único `sizes="100vw"` es el hero de la home,
    // y 1920 alcanza para cualquier pantalla. Menos anchos = menos transformaciones distintas.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  async headers() {
    return [
      {
        source: PUBLICAS,
        headers: [
          { key: "Content-Security-Policy", value: construirCsp({ nonce: null, isDev }) },
          ...headersSeguridad(isDev),
        ],
      },
    ];
  },
};

export default nextConfig;
