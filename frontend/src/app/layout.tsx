import {ClerkProvider} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ClerkTokenSync from "@/components/auth/ClerkTokenSync";
import { clerkAppearance } from "@/lib/clerk-appearance";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["400","500","600","700","800"] });
const dmSans  = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap", weight: ["400","500","700"] });

export const metadata: Metadata = {
  title: "BBJobs — El trabajo que buscás está en Bahía",
  description: "Portal de empleos local de Bahía Blanca. Empresas verificadas, postulación con un click y matching con IA.",
  keywords: "empleo Bahía Blanca, trabajo Bahía Blanca, búsqueda laboral, Talency",
};

// La CSP con nonce (ver proxy.ts) necesita que cada página se renderice por request: una página
// estática se genera en build time, sin request de la que sacar un nonce, así que sus scripts
// quedarían sin el atributo nonce y la CSP los bloquearía enteros. `force-dynamic` en el layout
// raíz aplica a todo el árbol de rutas de una sola vez (ver SEGURIDAD-PLAN.md bloque C — es un
// costo consciente: se pierde el prerenderizado estático a cambio de bloquear scripts inline no
// autorizados de verdad, no sólo confiar en que React escapa el contenido).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${jakarta.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[#FAFBFD] text-[#1C2230] font-sans flex flex-col antialiased relative">
        <ClerkProvider appearance={clerkAppearance}>
          <ClerkTokenSync />
          <Header />
          <main className="flex-1 w-full relative z-10">{children}</main>
          <Footer />
        </ClerkProvider>
      </body>
    </html>
  );
}