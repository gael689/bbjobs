import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import JsonLd from "@/components/seo/JsonLd";
import Preguntas from "@/components/seo/Preguntas";
import ConsultaSeleccion from "@/components/seo/ConsultaSeleccion";
import { BotonPrincipal, BotonSecundario, Chips, DosCaminos, HeroEmpresas, Pasos, ProblemaSolucion } from "@/components/seo/EmpresasUI";
import { PARA_QUIEN, PASOS_CORTOS, SELECCION_HUB } from "@/lib/seo/seleccion";
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
    <div className="bg-[#FAFBFD] min-h-screen pb-20">
      <JsonLd
        data={serviceSchema({
          nombre: "Selección de personal en Bahía Blanca",
          descripcion: SELECCION_HUB.citable,
          path: PATH,
        })}
      />

      <HeroEmpresas
        etiqueta="Para empresas · Talency"
        titulo={SELECCION_HUB.h1}
        bajada={SELECCION_HUB.bajada}
        migas={[
          { nombre: "Inicio", path: "/" },
          { nombre: "Selección de personal", path: PATH },
        ]}
      >
        <BotonPrincipal href="#consulta">Consultar por una búsqueda</BotonPrincipal>
        <BotonSecundario href="/publicar-empleo">Prefiero publicar yo</BotonSecundario>
      </HeroEmpresas>

      <ProblemaSolucion titulo="Contratar bien lleva tiempo. Lo hacemos nosotros." pares={SELECCION_HUB.dolores} />

      <Pasos pasos={PASOS_CORTOS} titulo="Así de simple" id="proceso" />

      <Chips items={PARA_QUIEN} titulo="¿Es para tu empresa?" id="para-quien" />

      <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-20" aria-labelledby="sectores">
        <h2 id="sectores" className="font-display font-extrabold text-3xl sm:text-4xl text-[#1C2230] tracking-tight mb-6">Elegí tu sector</h2>
        <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {sectores.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/seleccion-de-personal/${r.slug}`}
                className="group flex items-center justify-between gap-3 bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] hover:bg-[#E6F4F7] rounded-2xl px-5 py-4 font-bold text-[#1C2230] transition-colors"
              >
                {r.nombre}
                <ArrowRightIcon className="w-4 h-4 text-[#1E8EA3] group-hover:translate-x-0.5 transition-transform" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <DosCaminos
        titulo="¿Publicás vos o lo hacemos nosotros?"
        caminos={[
          {
            titulo: "Publicás vos",
            precio: "Gratis para empresas verificadas",
            puntos: ["Cargás el aviso en BBJobs", "Recibís las postulaciones en tu panel", "Entrevistás vos"],
            accion: "Publicar un empleo",
            href: "/publicar-empleo",
          },
          {
            titulo: "Lo hacemos nosotros",
            precio: "A consultar",
            puntos: ["Talency define el perfil y publica", "Filtra, entrevista y evalúa", "Te presenta a los mejores"],
            accion: "Consultar",
            href: "#consulta",
            destacado: true,
          },
        ]}
      />

      <ConsultaSeleccion />

      <Preguntas preguntas={SELECCION_HUB.preguntas} abiertas={false} ancho />
    </div>
  );
}
