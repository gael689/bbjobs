import type { Metadata } from "next";
import { SITIO, urlAbs } from "@/lib/seo/sitio";

// Metadata propia de /empleos (la página es un componente cliente y no puede exportarla).
// Las fichas /empleos/[id] definen la suya en generateMetadata y pisan esta.
const title = "Empleos en Bahía Blanca: ofertas de trabajo activas | BBJobs";
const description =
  "La bolsa de trabajo de Bahía Blanca y la región: todas las búsquedas activas de empresas verificadas por Talency, con filtros por sector, zona y modalidad. Postularte es gratis.";

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
