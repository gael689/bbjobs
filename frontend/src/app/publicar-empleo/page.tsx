import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, StarIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import Migas from "@/components/seo/Migas";
import Preguntas from "@/components/seo/Preguntas";
import { ListaTildes, Pasos } from "@/components/seo/ProcesoSeleccion";
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
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Migas
          migas={[
            { nombre: "Inicio", path: "/" },
            { nombre: "Publicar un empleo", path: PATH },
          ]}
          className="mb-8"
        />

        <header className="mb-12">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">Para empresas</span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mb-3">{PUBLICAR.h1}</h1>
          <p className="text-lg text-[#1C2230] leading-relaxed mb-5">{PUBLICAR.bajada}</p>
          <p className="text-[#1C2230] leading-relaxed mb-8">{PUBLICAR.citable}</p>
          <Link href="/register?type=company" className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-6 py-3.5 transition-colors">
            Crear cuenta de empresa <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </header>

        <Pasos pasos={PUBLICAR.pasos} titulo="Cómo publicar una búsqueda" id="pasos" />

        <ListaTildes items={PUBLICAR.incluye} titulo="Gratis para empresas verificadas" id="incluye" />

        <section className="mb-12" aria-labelledby="opcionales">
          <h2 id="opcionales" className="font-display font-bold text-xl text-[#1C2230] mb-4">Si querés más alcance</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
              <StarIcon className="w-6 h-6 text-[#1E8EA3] mb-3" aria-hidden />
              <h3 className="font-display font-bold text-[#1C2230] mb-1">Destacar una búsqueda</h3>
              <p className="text-sm text-[#1C2230] leading-relaxed">
                Para una búsqueda urgente o difícil de cubrir: el aviso aparece primero en los resultados mientras siga activo. Pago único por búsqueda.
              </p>
            </div>
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
              <UserGroupIcon className="w-6 h-6 text-[#1E8EA3] mb-3" aria-hidden />
              <h3 className="font-display font-bold text-[#1C2230] mb-1">Base de Talento</h3>
              <p className="text-sm text-[#1C2230] leading-relaxed">
                No esperes a que se postulen: explorá la base de candidatos, filtrá por puesto, experiencia y zona, y desbloqueá los contactos que te interesen.
              </p>
            </div>
          </div>
          <Link href="/planes" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:underline mt-4">
            Ver planes y precios <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </section>

        <section className="bg-[#1C2230] rounded-2xl p-8 mb-12">
          <p className="text-[#9ED4DF] font-bold text-xs uppercase tracking-wider mb-3">Selección de personal por Talency</p>
          <h2 className="font-display font-extrabold text-2xl text-white mb-3">¿Preferís que Talency se encargue?</h2>
          <p className="text-white/90 leading-relaxed mb-6">
            Si no tenés tiempo de revisar postulaciones ni de entrevistar, Talency puede hacer la búsqueda completa: relevamiento del perfil,
            publicación, revisión de postulaciones, entrevistas, evaluaciones psicométricas y presentación de candidatos.
          </p>
          <Link href="/seleccion-de-personal" className="inline-flex items-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-6 py-3 transition-colors">
            Conocer el servicio de selección <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </section>

        <Preguntas preguntas={PUBLICAR.preguntas} />

        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-8 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
          <div>
            <p className="font-display font-bold text-lg text-[#1C2230]">Publicá tu primera búsqueda</p>
            <p className="text-sm text-[#1C2230]">La cuenta y la verificación son gratis.</p>
          </div>
          <Link href="/register?type=company" className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold rounded-xl px-6 py-3 transition-colors shrink-0">
            Crear cuenta de empresa <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
