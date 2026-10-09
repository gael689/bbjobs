import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import JsonLd from "@/components/seo/JsonLd";
import Migas from "@/components/seo/Migas";
import Preguntas from "@/components/seo/Preguntas";
import ConsultaSeleccion from "@/components/seo/ConsultaSeleccion";
import { Comparacion, ListaTildes, Pasos } from "@/components/seo/ProcesoSeleccion";
import { PARA_QUIEN, PASOS_SELECCION, SELECCION_HUB } from "@/lib/seo/seleccion";
import { RUBROS_INDICE, SELECCION_INDICE } from "@/lib/seo/indice";
import { serviceSchema } from "@/lib/seo/schema";
import { SITIO, urlAbs } from "@/lib/seo/sitio";

// /seleccion-de-personal: el servicio de selección de Talency para empresas. Página estática,
// siempre indexable: su contenido es el servicio, no depende de las búsquedas activas.

const PATH = "/seleccion-de-personal";

export const metadata: Metadata = {
  title: SELECCION_HUB.title,
  description: SELECCION_HUB.description,
  alternates: { canonical: urlAbs(PATH) },
  openGraph: {
    title: SELECCION_HUB.title,
    description: SELECCION_HUB.description,
    url: urlAbs(PATH),
    type: "website",
    siteName: SITIO.nombre,
    locale: "es_AR",
    images: [{ url: SITIO.ogImage, width: 1200, height: 630 }],
  },
};

export default function SeleccionDePersonalPage() {
  const sectores = RUBROS_INDICE.filter((r) => SELECCION_INDICE.includes(r.slug));

  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <JsonLd
        data={serviceSchema({
          nombre: "Selección de personal en Bahía Blanca",
          descripcion: SELECCION_HUB.citable,
          path: PATH,
        })}
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Migas
          migas={[
            { nombre: "Inicio", path: "/" },
            { nombre: "Selección de personal", path: PATH },
          ]}
          className="mb-8"
        />

        <header className="mb-12">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">
            Para empresas · Talency
          </span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mb-3">{SELECCION_HUB.h1}</h1>
          <p className="text-lg text-[#1C2230] leading-relaxed mb-5">{SELECCION_HUB.bajada}</p>
          <p className="text-[#1C2230] leading-relaxed mb-8">{SELECCION_HUB.citable}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="#consulta" className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-6 py-3.5 transition-colors">
              Consultar por una búsqueda <ArrowRightIcon className="w-4 h-4" />
            </a>
            <Link href="/publicar-empleo" className="inline-flex items-center justify-center gap-2 border border-[#9ED4DF] bg-[#E6F4F7] hover:bg-[#D5EBF1] text-[#187B8E] font-bold rounded-xl px-6 py-3.5 transition-colors">
              Prefiero publicar yo
            </Link>
          </div>
        </header>

        <Pasos pasos={PASOS_SELECCION} titulo="Cómo trabaja Talency" id="proceso" />

        <ListaTildes items={PARA_QUIEN} titulo="Para quién es" id="para-quien" />

        <Comparacion />

        <section className="mb-12" aria-labelledby="sectores">
          <h2 id="sectores" className="font-display font-bold text-xl text-[#1C2230] mb-2">Selección por sector</h2>
          <p className="text-[#1C2230] leading-relaxed mb-4">
            Qué perfiles se buscan y qué conviene evaluar en cada sector. Si el tuyo no está en la lista, consultá igual.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sectores.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/seleccion-de-personal/${r.slug}`}
                  className="group flex items-center justify-between gap-3 bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] rounded-xl px-4 py-3 font-bold text-[#1C2230] transition-colors"
                >
                  {r.nombre}
                  <ArrowRightIcon className="w-4 h-4 text-[#1E8EA3] group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ConsultaSeleccion />

        <Preguntas preguntas={SELECCION_HUB.preguntas} />

        <nav aria-label="Más para empresas">
          <h2 className="font-display font-bold text-base text-[#1C2230] mb-3">Más para empresas</h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li><Link href="/publicar-empleo" className="font-medium text-[#1E8EA3] hover:underline">Publicar un empleo</Link></li>
            <li><Link href="/planes" className="font-medium text-[#1E8EA3] hover:underline">Planes y precios</Link></li>
            <li><Link href="/empresas" className="font-medium text-[#1E8EA3] hover:underline">Empresas verificadas</Link></li>
            <li><a href={SITIO.talency.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[#1E8EA3] hover:underline">Conocer Talency</a></li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
