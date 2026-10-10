import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildingOffice2Icon, MapPinIcon } from "@heroicons/react/24/outline";
import JsonLd from "@/components/seo/JsonLd";
import Preguntas from "@/components/seo/Preguntas";
import ConsultaSeleccion from "@/components/seo/ConsultaSeleccion";
import { BotonPrincipal, BotonSecundario, Chips, HeroEmpresas, Pasos, ProblemaSolucion } from "@/components/seo/EmpresasUI";
import { PASOS_CORTOS, SELECCION_RUBROS, getSeleccionRubro } from "@/lib/seo/seleccion";
import { RUBROS_INDICE, SELECCION_INDICE, localidadDeZona } from "@/lib/seo/indice";
import { etiquetasJob, getActiveJobs, getCatalogos, idsPorSlug } from "@/lib/seo/datos";
import { serviceSchema } from "@/lib/seo/schema";
import { SITIO, urlAbs } from "@/lib/seo/sitio";
import { jobUrl } from "@/lib/seo/urls";

// /seleccion-de-personal/<sector>: sólo los sectores con texto propio en lib/seo/seleccion.ts
// (SELECCION_INDICE); cualquier otro → 404. Siempre indexables: el contenido es el servicio en
// ese sector, y las búsquedas activas se muestran como prueba de actividad, no son la página.
// Se regenera cada 15 minutos por esas búsquedas.
export const revalidate = 900;
export const dynamicParams = false;

export function generateStaticParams() {
  return SELECCION_RUBROS.map((r) => ({ rubro: r.slug }));
}

type Props = { params: Promise<{ rubro: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rubro: slug } = await params;
  const r = getSeleccionRubro(slug);
  if (!r) return {};
  const url = urlAbs(`/seleccion-de-personal/${slug}`);
  return {
    title: r.title,
    description: r.description,
    alternates: { canonical: url },
    openGraph: {
      title: r.title,
      description: r.description,
      url,
      type: "website",
      siteName: SITIO.nombre,
      locale: "es_AR",
      images: [{ url: SITIO.ogImage, width: 1200, height: 630 }],
    },
  };
}

export default async function SeleccionRubroPage({ params }: Props) {
  const { rubro: slug } = await params;
  const r = getSeleccionRubro(slug);
  if (!r) notFound();

  const [todas, cat] = await Promise.all([getActiveJobs(900), getCatalogos()]);
  const ids = idsPorSlug(cat.rubros, r.catalogo);
  const jobs = todas.filter((j) => j.industry_id && ids.has(j.industry_id)).slice(0, 4);
  const path = `/seleccion-de-personal/${slug}`;
  const hermanos = RUBROS_INDICE.filter((x) => x.slug !== slug && SELECCION_INDICE.includes(x.slug));

  return (
    <div className="bg-[#FAFBFD] min-h-screen pb-20">
      <JsonLd data={serviceSchema({ nombre: r.h1, descripcion: r.citable, path, sector: r.nombre })} />

      <HeroEmpresas
        etiqueta={`Para empresas · ${r.nombre}`}
        titulo={r.h1}
        bajada={r.bajada}
        migas={[
          { nombre: "Inicio", path: "/" },
          { nombre: "Selección de personal", path: "/seleccion-de-personal" },
          { nombre: r.nombre, path },
        ]}
      >
        <BotonPrincipal href="#consulta">Consultar por una búsqueda</BotonPrincipal>
        <BotonSecundario href="/publicar-empleo">Prefiero publicar yo</BotonSecundario>
      </HeroEmpresas>

      <ProblemaSolucion titulo="Lo que te frena, resuelto" pares={r.dolores} />

      <Chips items={r.perfiles} titulo="Perfiles que buscamos" id="perfiles" />

      <Pasos pasos={PASOS_CORTOS} titulo="Así de simple" id="proceso" />

      {/* Búsquedas activas del sector: muestran que el portal se mueve en ese rubro. */}
      {jobs.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-20" aria-labelledby="activas">
          <div className="flex items-end justify-between gap-4 mb-5">
            <h2 id="activas" className="font-display font-extrabold text-2xl sm:text-3xl text-[#1C2230] tracking-tight">
              Búsquedas de {r.nombre.toLowerCase()} en BBJobs
            </h2>
            <Link href={`/empleos-de/${slug}`} className="text-sm font-bold text-[#187B8E] hover:underline shrink-0">
              Ver todas
            </Link>
          </div>
          <ul className="space-y-2">
            {jobs.map((job) => {
              const { zona } = etiquetasJob(job, cat);
              const lugar = job.modality === "remoto" ? "Remoto" : localidadDeZona(zona?.slug, zona?.name);
              return (
                <li key={job.id}>
                  <Link href={jobUrl(job)} className="group block bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] rounded-2xl px-5 py-4 transition-colors">
                    <span className="font-bold text-[#1C2230] group-hover:text-[#187B8E] transition-colors">{job.title}</span>
                    <span className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-[#1C2230]">
                      <span className="flex items-center gap-1.5"><BuildingOffice2Icon className="w-4 h-4 text-[#1E8EA3]" aria-hidden />{job.company_legal_name_snapshot}</span>
                      <span className="flex items-center gap-1.5"><MapPinIcon className="w-4 h-4 text-[#1E8EA3]" aria-hidden />{lugar}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ConsultaSeleccion sector={r.nombre} titulo={`Tu búsqueda de ${r.nombre.toLowerCase()}, en buenas manos`} />

      <Preguntas preguntas={r.preguntas} abiertas={false} ancho />

      <nav className="max-w-4xl mx-auto px-4 sm:px-6" aria-label="Más sectores">
        <h2 className="font-display font-bold text-base text-[#1C2230] mb-3">Selección en otros sectores</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {hermanos.map((h) => (
            <li key={h.slug}>
              <Link href={`/seleccion-de-personal/${h.slug}`} className="inline-block rounded-full border border-[#9ED4DF] bg-white hover:bg-[#E6F4F7] px-4 py-1.5 font-bold text-[#187B8E] transition-colors">
                {h.nombre}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/seleccion-de-personal" className="inline-block rounded-full bg-[#1C2230] hover:bg-[#1E8EA3] px-4 py-1.5 font-bold text-white transition-colors">
              Todos los sectores
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
