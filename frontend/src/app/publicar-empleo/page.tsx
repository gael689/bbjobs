import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, StarIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import Preguntas from "@/components/seo/Preguntas";
import { BandaCta, BotonPrincipal, BotonSecundario, Chips, HeroEmpresas, Pasos, ProblemaSolucion } from "@/components/seo/EmpresasUI";
import { PUBLICAR } from "@/lib/seo/seleccion";
import { SITIO, urlAbs } from "@/lib/seo/sitio";

// /publicar-empleo: para la empresa que quiere publicar por su cuenta. Estática e indexable.
// Lo gratis y lo pago sale de /planes (app/planes/page.tsx); no se afirma nada que no esté ahí.

const PATH = "/publicar-empleo";

export const metadata: Metadata = {
  title: PUBLICAR.title,
  description: PUBLICAR.description,
  alternates: { canonical: urlAbs(PATH) },
  openGraph: {
    title: PUBLICAR.title,
    description: PUBLICAR.description,
    url: urlAbs(PATH),
    type: "website",
    siteName: SITIO.nombre,
    locale: "es_AR",
    images: [{ url: SITIO.ogImage, width: 1200, height: 630 }],
  },
};

export default function PublicarEmpleoPage() {
  return (
    <div className="bg-[#FAFBFD] min-h-screen pb-20">
      <HeroEmpresas
        etiqueta="Para empresas · Gratis"
        titulo={PUBLICAR.h1}
        bajada={PUBLICAR.bajada}
        migas={[
          { nombre: "Inicio", path: "/" },
          { nombre: "Publicar un empleo", path: PATH },
        ]}
      >
        <BotonPrincipal href="/register?type=company">Crear cuenta de empresa</BotonPrincipal>
        <BotonSecundario href="/seleccion-de-personal">Que lo haga Talency</BotonSecundario>
      </HeroEmpresas>

      <ProblemaSolucion titulo="Dejá de perseguir CV" pares={PUBLICAR.dolores} />

      <Pasos pasos={PUBLICAR.pasos} titulo="Tres pasos" id="pasos" />

      <Chips items={PUBLICAR.incluye} titulo="Gratis para empresas verificadas" id="incluye" />

      <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-20" aria-labelledby="opcionales">
        <h2 id="opcionales" className="font-display font-extrabold text-3xl sm:text-4xl text-[#1C2230] tracking-tight mb-8">¿Querés más alcance?</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white border border-[#DDE3EC] rounded-3xl p-7">
            <span className="w-11 h-11 rounded-2xl bg-[#F7EFE9] flex items-center justify-center mb-4" aria-hidden>
              <StarIcon className="w-6 h-6 text-[#1C2230]" />
            </span>
            <h3 className="font-display font-extrabold text-xl text-[#1C2230] mb-1">Destacar una búsqueda</h3>
            <p className="text-[#1C2230] leading-snug">Tu aviso aparece primero mientras siga activo. Pago único por búsqueda.</p>
          </div>
          <div className="bg-white border border-[#DDE3EC] rounded-3xl p-7">
            <span className="w-11 h-11 rounded-2xl bg-[#E6F4F7] flex items-center justify-center mb-4" aria-hidden>
              <UserGroupIcon className="w-6 h-6 text-[#187B8E]" />
            </span>
            <h3 className="font-display font-extrabold text-xl text-[#1C2230] mb-1">Base de Talento</h3>
            <p className="text-[#1C2230] leading-snug">No esperes postulaciones: buscá entre los candidatos y desbloqueá los contactos que te interesen.</p>
          </div>
        </div>
        <Link href="/planes" className="inline-flex items-center gap-1.5 font-bold text-[#187B8E] hover:underline mt-5">
          Ver planes y precios <ArrowRightIcon className="w-4 h-4" aria-hidden />
        </Link>
      </section>

      <BandaCta
        titulo="¿Preferís que Talency se encargue?"
        texto="Filtramos, entrevistamos y evaluamos. Vos elegís."
        href="/seleccion-de-personal"
        accion="Conocer el servicio"
      />

      <Preguntas preguntas={PUBLICAR.preguntas} abiertas={false} ancho />

      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-3xl p-8 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
          <p className="font-display font-extrabold text-2xl text-[#1C2230]">Publicá tu primera búsqueda hoy</p>
          <Link href="/register?type=company" className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-7 py-4 transition-colors shrink-0">
            Crear cuenta de empresa <ArrowRightIcon className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
