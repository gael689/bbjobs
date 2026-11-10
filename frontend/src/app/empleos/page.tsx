import EmpleosClient from "./EmpleosClient";
import BusquedasPorSector from "@/components/seo/BusquedasPorSector";
import { getActiveJobs, getCatalogos } from "@/lib/seo/datos";
import { aPreview } from "@/lib/seo/preview";
import JsonLd from "@/components/seo/JsonLd";
import { coleccionSchema } from "@/lib/seo/schema";
import { jobUrl } from "@/lib/seo/urls";

// /empleos (09/11/2026): server component con ISR de 30 minutos que le pasa la primera página de
// búsquedas al buscador (componente cliente). Antes el HTML no traía ninguna búsqueda: Google
// mostraba /empleos en la posición 5-6 para "empleos bahía blanca" sin ver un solo aviso en la
// página. La metadata sigue en layout.tsx. Misma lectura cacheada que la home y las de zona.
export const revalidate = 1800;

const PAGE_SIZE = 20; // el mismo que EmpleosClient

export default async function EmpleosPage() {
  const [jobs, cat] = await Promise.all([getActiveJobs(1800), getCatalogos()]);
  const primeras = jobs.slice(0, PAGE_SIZE);
  return (
    <>
      {/* CollectionPage + ItemList con las búsquedas que trae el HTML (las mismas que ve la persona
          antes de filtrar). Va acá y no en EmpleosClient para no tocar el componente cliente. */}
      <JsonLd
        data={coleccionSchema({
          path: "/empleos",
          nombre: "Empleos en Bahía Blanca",
          descripcion: "Todas las búsquedas laborales activas de Bahía Blanca y la región, de empresas verificadas por Talency.",
          items: primeras.map((j) => ({ url: jobUrl(j), nombre: j.title })),
        })}
      />
      <EmpleosClient
        initialJobs={jobs.length > 0 ? primeras.map(aPreview) : null}
        initialTotal={jobs.length}
        bloqueBusquedas={
          <BusquedasPorSector
            jobs={jobs}
            cat={cat}
            titulo="Ofertas de trabajo en Bahía Blanca por sector"
            bajada="Si preferís ver sólo un rubro o una localidad, cada página junta las búsquedas activas de ese sector o esa zona, con respuestas a las dudas más comunes."
          />
        }
      />
    </>
  );
}
