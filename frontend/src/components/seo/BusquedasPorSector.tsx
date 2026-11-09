import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { RUBROS_INDICE, ZONAS_INDICE, type EntradaIndice } from "@/lib/seo/indice";
import { idsPorSlug, type Catalogos, type PublicJob } from "@/lib/seo/datos";

type ConCantidad = EntradaIndice & { cantidad: number };

function contar(indice: readonly EntradaIndice[], lista: Catalogos["rubros"], jobs: PublicJob[], campo: "industry_id" | "zone_id"): ConCantidad[] {
  return indice
    .map((e) => {
      const ids = idsPorSlug(lista, e.catalogo);
      return { ...e, cantidad: jobs.filter((j) => j[campo] && ids.has(j[campo]!)).length };
    })
    .filter((e) => e.cantidad > 0);
}

/** Sectores y zonas con al menos una búsqueda activa (las únicas páginas indexables: las vacías
 *  son noindex, ver app/empleos-de/[rubro]/page.tsx). */
export function paginasConBusquedas(jobs: PublicJob[], cat: Catalogos) {
  return {
    rubros: contar(RUBROS_INDICE, cat.rubros, jobs, "industry_id"),
    zonas: contar(ZONAS_INDICE, cat.zonas, jobs, "zone_id"),
  };
}

const plural = (n: number) => (n === 1 ? "1 búsqueda" : `${n} búsquedas`);

// Bloque server-rendered de la home y de /empleos (09/11/2026): links en el HTML a las páginas de
// sector y de zona que tienen búsquedas, con la cantidad. Antes la home y /empleos traían todo
// desde el navegador y su HTML no enlazaba ninguna búsqueda ni ninguna página de sector con
// contenido; los únicos links eran los del footer, a las 15 páginas por igual (11 vacías y noindex).
export default function BusquedasPorSector({
  jobs,
  cat,
  titulo,
  bajada,
}: {
  jobs: PublicJob[];
  cat: Catalogos;
  titulo: string;
  bajada: string;
}) {
  const { rubros, zonas } = paginasConBusquedas(jobs, cat);
  if (jobs.length === 0) return null;

  return (
    <section aria-labelledby="busquedas-por-sector" className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 sm:p-8">
        <h2 id="busquedas-por-sector" className="font-display font-bold text-2xl text-[#1C2230] mb-2">{titulo}</h2>
        <p className="text-[#64748B] mb-6 max-w-3xl">{bajada}</p>

        <div className="grid md:grid-cols-[2fr_1fr] gap-8">
          {rubros.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">Por sector</h3>
              <ul className="grid sm:grid-cols-2 gap-2">
                {rubros.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/empleos-de/${r.slug}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#DDE3EC] px-4 py-3 text-sm font-semibold text-[#1C2230] hover:border-[#1E8EA3] hover:text-[#1E8EA3] transition-colors"
                    >
                      Empleos de {r.nombre.toLowerCase()}
                      <span className="text-xs font-medium text-[#64748B]">{plural(r.cantidad)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">Por zona</h3>
            <ul className="space-y-2">
              {zonas.map((z) => (
                <li key={z.slug}>
                  <Link
                    href={`/trabajo-en/${z.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#DDE3EC] px-4 py-3 text-sm font-semibold text-[#1C2230] hover:border-[#1E8EA3] hover:text-[#1E8EA3] transition-colors"
                  >
                    Trabajo en {z.nombre}
                    <span className="text-xs font-medium text-[#64748B]">{plural(z.cantidad)}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/empleos" className="inline-flex items-center gap-1.5 pt-1 text-sm font-bold text-[#1E8EA3] hover:underline">
                  Ver las {plural(jobs.length)} activas <ArrowRightIcon className="w-4 h-4" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
