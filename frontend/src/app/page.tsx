import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import BusquedasPorSector from "@/components/seo/BusquedasPorSector";
import { metaPagina } from "@/lib/seo/meta";
import { getActiveJobs, getCatalogos } from "@/lib/seo/datos";
import { aPreview } from "@/lib/seo/preview";

// Home (09/11/2026). Hasta acá era un componente cliente entero: el HTML que recibía Google no
// tenía ni un link a una búsqueda, la home no declaraba canónica y su título era el genérico del
// layout. Ahora es un server component con ISR de 30 minutos —el mismo ritmo y la misma lectura
// cacheada que /trabajo-en y /empleos-de— que le pasa los últimos avisos al componente cliente y
// suma el bloque de empleos por sector y zona. Como mucho una regeneración cada 30 minutos, y sólo
// si alguien visita la home: no es render por request.
export const revalidate = 1800;

export const metadata: Metadata = metaPagina({
  title: "BBJobs | Empleos y bolsa de trabajo en Bahía Blanca",
  description:
    "Ofertas de trabajo en Bahía Blanca y la región, publicadas por empresas verificadas por Talency. Cargá tu CV gratis y postulate con un click.",
  path: "/",
});

const ULTIMOS = 6;

export default async function Home() {
  const [jobs, cat] = await Promise.all([getActiveJobs(1800), getCatalogos()]);

  return (
    <HomeClient
      // Sin búsquedas (o si la API no respondió al regenerar) el cliente las vuelve a pedir.
      initialJobs={jobs.length > 0 ? jobs.slice(0, ULTIMOS).map(aPreview) : null}
      initialTotal={jobs.length}
      bloqueBusquedas={
        <BusquedasPorSector
          jobs={jobs}
          cat={cat}
          titulo="Empleos en Bahía Blanca por sector y zona"
          bajada="Todas las búsquedas activas de BBJobs, ordenadas por sector y por localidad. Cada aviso es de una empresa verificada por Talency y postularte es gratis."
        />
      }
    />
  );
}
