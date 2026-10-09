import {ClerkProvider} from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ClerkTokenSync from "@/components/auth/ClerkTokenSync";
import SessionExpiredBanner from "@/components/auth/SessionExpiredBanner";
import AvisoCorreccion from "@/components/auth/AvisoCorreccion";
import { Analytics } from "@vercel/analytics/next";
import CookieBanner from "@/components/consent/CookieBanner";
import GoogleAnalytics from "@/components/consent/GoogleAnalytics";
import { clerkAppearance } from "@/lib/clerk-appearance";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, SITIO } from "@/lib/seo/sitio";
import { organizationSchema, websiteSchema } from "@/lib/seo/schema";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["400","500","600","700","800"] });
const dmSans  = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap", weight: ["400","500","700"] });

// Dominio canónico: www (el apex redirige 308). Ver lib/seo/sitio.ts.
const OG_IMAGE = SITIO.ogImage;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "BBJobs — El trabajo que buscás está en Bahía",
  description: "Portal de empleos local de Bahía Blanca. Empresas verificadas, postulación con un click y oportunidades recomendadas según tu perfil.",
  keywords: "empleo Bahía Blanca, trabajo Bahía Blanca, búsqueda laboral, Talency",
  openGraph: {
    title: "BBJobs — El trabajo que buscás está en Bahía",
    description: "Portal de empleos local de Bahía Blanca. Empresas verificadas, postulación con un click y oportunidades recomendadas según tu perfil.",
    url: SITE_URL,
    siteName: "BBJobs",
    type: "website",
    locale: "es_AR",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "BBJobs — Bahía Blanca" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BBJobs — El trabajo que buscás está en Bahía",
    description: "Portal de empleos local de Bahía Blanca. Empresas verificadas, postulación con un click y oportunidades recomendadas según tu perfil.",
    images: [OG_IMAGE],
  },
};

// Sin `force-dynamic` acá (sacado el 23/09/2026): las páginas públicas se prerenderizan y llevan
// una CSP fija; sólo los segmentos con sesión (dashboard, onboarding, login, register, post-login)
// se renderizan por request, cada uno con su layout.tsx, para la CSP con nonce. Antes todo el
// árbol era dinámico y cada visita a la home gastaba CPU del plan de Vercel. Ver src/proxy.ts.

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${jakarta.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[#FAFBFD] text-[#1C2230] font-sans flex flex-col antialiased relative">
        {/* JSON-LD del sitio: Organization (BBJobs, iniciativa de Talency) + WebSite con buscador. */}
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <ClerkProvider appearance={clerkAppearance} localization={esES}>
          <ClerkTokenSync />
          <SessionExpiredBanner />
          <AvisoCorreccion />
          <Header />
          <main className="flex-1 w-full relative z-10">{children}</main>
          <Footer />
          {/* Medición (Frente 3): Vercel Analytics no usa cookies; GA4 sólo con consentimiento. */}
          <CookieBanner />
          <GoogleAnalytics />
          <Analytics />
        </ClerkProvider>
      </body>
    </html>
  );
}