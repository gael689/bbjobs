import type { Metadata } from "next";
import EmpresasClient from "./EmpresasClient";
import { metaPagina } from "@/lib/seo/meta";
import { getVerifiedCompanies } from "@/lib/seo/datos";

// /empresas: la página para empresas y la vitrina de las verificadas. Hasta el 09/11/2026 era un
// componente cliente: heredaba el título de la home, no tenía canónica y la lista de empresas se
// pedía desde el navegador, así que el HTML no enlazaba ninguna ficha. Ahora la lista sale en el
// HTML con ISR de 1 hora (la misma lectura cacheada que usa el sitemap).
export const revalidate = 3600;

export const metadata: Metadata = metaPagina({
  title: "Para empresas: encontrá personal en Bahía Blanca | BBJobs",
  description:
    "Publicá búsquedas en BBJobs y recibí postulaciones de candidatos de Bahía Blanca y la región en un solo panel. Conocé las empresas verificadas por Talency que ya publican.",
  path: "/empresas",
});

export default async function EmpresasPage() {
  const companies = await getVerifiedCompanies();
  return (
    <EmpresasClient
      initialCompanies={companies.map((c) => ({ id: c.id, legal_name: c.legal_name, logo_url: c.logo_url ?? null, website: c.website ?? null }))}
    />
  );
}
