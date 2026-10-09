import type { Metadata } from "next";
import { SITIO, urlAbs } from "@/lib/seo/sitio";

// Metadata propia de /empleos (la página es un componente cliente y no puede exportarla).
// Las fichas /empleos/[id] definen la suya en generateMetadata y pisan esta.
const title = "Empleos en Bahía Blanca y la región | BBJobs";
const description =
  "Todas las búsquedas laborales activas de Bahía Blanca, Punta Alta, Monte Hermoso y Coronel Suárez, de empresas verificadas por Talency. Postulate gratis.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: urlAbs("/empleos") },
  openGraph: {
    title,
    description,
    url: urlAbs("/empleos"),
    type: "website",
    siteName: SITIO.nombre,
    locale: "es_AR",
    images: [{ url: SITIO.ogImage, width: 1200, height: 630 }],
  },
};

export default function EmpleosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
