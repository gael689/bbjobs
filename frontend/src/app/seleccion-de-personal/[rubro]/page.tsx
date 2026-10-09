import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon, BuildingOffice2Icon, MapPinIcon } from "@heroicons/react/24/outline";
import JsonLd from "@/components/seo/JsonLd";
import Migas from "@/components/seo/Migas";
import Preguntas from "@/components/seo/Preguntas";
import ConsultaSeleccion from "@/components/seo/ConsultaSeleccion";
import { ListaTildes, Pasos } from "@/components/seo/ProcesoSeleccion";
import { PASOS_SELECCION, SELECCION_RUBROS, getSeleccionRubro } from "@/lib/seo/seleccion";
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
  const jobs = todas.filter((j) => j.industry_id && ids.has(j.industry_id)).slice(0, 6);
  const path = `/seleccion-de-personal/${slug}`;
  const hermanos = RUBROS_INDICE.filter((x) => x.slug !== slug && SELECCION_INDICE.includes(x.slug));

  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <JsonLd data={serviceSchema({ nombre: r.h1, descripcion: r.citable, path, sector: r.nombre })} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Migas
          migas={[
            { nombre: "Inicio", path: "/" },
            { nombre: "Selección de personal", path: "/seleccion-de-personal" },
            { nombre: r.nombre, path },
          ]}
          className="mb-8"
        />

        <header className="mb-12">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">
            Para empresas · {r.nombre}
          </span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mb-3">{r.h1}</h1>
          <p className="text-lg text-[#1C2230] leading-relaxed mb-5">{r.bajada}</p>
          <p className="text-[#1C2230] leading-relaxed mb-8">{r.citable}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="#consulta" className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-6 py-3.5 transition-colors">
              Consultar por una búsqueda <ArrowRightIcon className="w-4 h-4" />
            </a>
            <Link href="/publicar-empleo" className="inline-flex items-center justify-center gap-2 border border-[#9ED4DF] bg-[#E6F4F7] hover:bg-[#D5EBF1] text-[#187B8E] font-bold rounded-xl px-6 py-3.5 transition-colors">
              Prefiero publicar yo
            </Link>
          </div>
        </header>

        <section className="bg-white border border-[#DDE3EC] rounded-2xl p-6 sm:p-8 mb-12">
          <p className="text-[#1C2230] leading-relaxed">{r.contexto}</p>
        </section>

        <div className="grid md:grid-cols-2 gap-x-6">
          <ListaTildes items={r.perfiles} titulo="Perfiles que suelen buscarse" id="perfiles" />
          <ListaTildes items={r.evaluar} titulo="Qué conviene evaluar" id="evaluar" />
        </div>

        <Pasos pasos={PASOS_SELECCION} titulo="Cómo trabaja Talency" id="proceso" />

        {/* Búsquedas activas del sector: muestran que el portal se mueve en ese rubro. */}
        {jobs.length > 0 && (
          <section className="mb-12" aria-labelledby="activas">
            <div className="flex items-end justify-between gap-4 mb-4">
              <h2 id="activas" className="font-display font-bold text-xl text-[#1C2230]">Búsquedas de {r.nombre.toLowerCase()} en BBJobs</h2>
              <Link href={`/empleos-de/${slug}`} className="text-sm font-bold text-[#1E8EA3] hover:underline shrink-0">
                Ver todas
              </Link>
            </div>
            <ul className="space-y-2">
              {jobs.map((job) => {
                const { zona } = etiquetasJob(job, cat);
                const lugar = job.modality === "remoto" ? "Remoto" : localidadDeZona(zona?.slug, zona?.name);
                return (
                  <li key={job.id}>
                    <Link href={jobUrl(job)} className="group block bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] rounded-xl px-5 py-3.5 transition-colors">
                      <span className="font-bold text-[#1C2230] group-hover:text-[#1E8EA3] transition-colors">{job.title}</span>
                      <span className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-[#1C2230]">
                        <span className="flex items-center gap-1.5"><BuildingOffice2Icon className="w-4 h-4 text-[#1E8EA3]" />{job.company_legal_name_snapshot}</span>
                        <span className="flex items-center gap-1.5"><MapPinIcon className="w-4 h-4 text-[#1E8EA3]" />{lugar}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <ConsultaSeleccion sector={r.nombre} titulo={`Consultá por tu búsqueda de ${r.nombre.toLowerCase()}`} />

        <Preguntas preguntas={r.preguntas} />

        <nav className="grid sm:grid-cols-2 gap-8" aria-label="Más sectores">
          <div>
            <h2 className="font-display font-bold text-base text-[#1C2230] mb-3">Selección en otros sectores</h2>
            <ul className="space-y-2 text-sm">
              {hermanos.map((h) => (
                <li key={h.slug}><Link href={`/seleccion-de-personal/${h.slug}`} className="font-medium text-[#1E8EA3] hover:underline">{h.nombre}</Link></li>
              ))}
              <li><Link href="/seleccion-de-personal" className="font-medium text-[#1E8EA3] hover:underline">Selección de personal en Bahía Blanca</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-[#1C2230] mb-3">Para candidatos y empresas</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href={`/empleos-de/${slug}`} className="font-medium text-[#1E8EA3] hover:underline">Empleos de {r.nombre.toLowerCase()} en Bahía Blanca</Link></li>
              <li><Link href="/publicar-empleo" className="font-medium text-[#1E8EA3] hover:underline">Publicar un empleo</Link></li>
              <li><Link href="/planes" className="font-medium text-[#1E8EA3] hover:underline">Planes y precios</Link></li>
            </ul>
          </div>
        </nav>
      </div>
    </div>
  );
}
