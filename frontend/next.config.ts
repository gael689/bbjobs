import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Saca el header `X-Powered-By: Next.js` — no protege de nada por sí solo, pero es gratis
  // no anunciar el framework exacto.
  poweredByHeader: false,
  // El dominio sin www antes lo redirigía Vercel desde su panel; en Railway (19/10/2026) lo hace la
  // app. 308 permanente: el canónico es www (metadataBase y Clerk viven en www.bbjobs.com.ar).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "bbjobs.com.ar" }],
        destination: "https://www.bbjobs.com.ar/:path*",
        permanent: true,
      },
    ];
  },
  images: {
    // En Railway la optimización corre en el mismo servidor: cachear el resultado 30 días evita
    // re-procesar los mismos logos en cada visita (los logos nuevos de Cloudinary cambian de URL).
    minimumCacheTTL: 2592000,
    // Sin esto, next/image rechaza optimizar imágenes de estos dominios en producción (en dev
    // a veces pasa desapercibido) — logos/CVs de Cloudinary y avatares de Clerk, usados en
    // Header/Footer/DashboardShell/onboarding/login/register.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
};

export default nextConfig;
