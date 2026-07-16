import type { NextConfig } from "next";

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
  },
};

export default nextConfig;
