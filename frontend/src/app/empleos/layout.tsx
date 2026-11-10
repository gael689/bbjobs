import type { Metadata } from "next";
import { metaPagina } from "@/lib/seo/meta";

// Metadata propia de /empleos (la página es un componente cliente y no puede exportarla).
// Las fichas /empleos/[id] definen la suya en generateMetadata y pisan esta.
export const metadata: Metadata = metaPagina({
  title: "Empleos en Bahía Blanca: ofertas de trabajo activas | BBJobs",
  description:
    "La bolsa de trabajo de Bahía Blanca y la región: todas las búsquedas activas de empresas verificadas por Talency, con filtros por sector, zona y modalidad. Postularte es gratis.",
  path: "/empleos",
});

export default function EmpleosLayout({ children }: { children: React.ReactNode }) {
  return children;
}
