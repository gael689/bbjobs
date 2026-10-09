import Link from "next/link";
import {
  ArrowRightIcon, BriefcaseIcon, BuildingOffice2Icon, MapPinIcon, BellAlertIcon,
} from "@heroicons/react/24/outline";
import JsonLd from "./JsonLd";
import Migas from "./Migas";
import { faqSchema, type Miga } from "@/lib/seo/schema";
import type { PaginaSeo } from "@/lib/seo/tipos";
import type { Catalogos, PublicJob } from "@/lib/seo/datos";
import { etiquetasJob } from "@/lib/seo/datos";
import { localidadDeZona } from "@/lib/seo/indice";
import { jobUrl } from "@/lib/seo/urls";

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  "híbrido": "Híbrido",
};

type Enlace = { href: string; nombre: string };

// Página de zona (/trabajo-en/…) o de sector (/empleos-de/…), todo server-rendered: H1, párrafo
// citable, búsquedas activas con su link canónico, CTA, preguntas frecuentes (FAQPage), migas y
// enlaces a las otras zonas/sectores.
export default function PaginaListado({
  contenido, jobs, cat, migas, otros, otrosTitulo, cruzados, cruzadosTitulo, filtroEmpleos,
}: {
  contenido: PaginaSeo;
  jobs: PublicJob[];
  cat: Catalogos;
  migas: Miga[];
  otros: Enlace[];
  otrosTitulo: string;
  cruzados: Enlace[];
  cruzadosTitulo: string;
  /** Link a /empleos con el filtro ya aplicado. */
  filtroEmpleos: string;
}) {
  // Las alertas de empleo todavía no están lanzadas: el CTA lleva a crear la cuenta de candidato.
  const cta = { href: "/register?type=candidate", texto: "Cargar mi CV gratis", nota: "Con tu perfil listo, te postulás con un click apenas aparece una búsqueda." };

  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <JsonLd data={faqSchema(contenido.preguntas)} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Migas migas={migas} className="mb-8" />

        {/* Hero */}
        <header className="mb-10">
          <span className="inline-block text-xs font-bold text-[#1E8EA3] uppercase tracking-widest mb-4">
            {jobs.length === 1 ? "1 búsqueda activa" : `${jobs.length} búsquedas activas`}
          </span>
          <h1 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mb-3">{contenido.h1}</h1>
          <p className="text-lg text-[#64748B] leading-relaxed mb-5">{contenido.bajada}</p>
          <p className="text-[#1C2230] leading-relaxed">{contenido.citable}</p>
        </header>

        {/* Búsquedas activas */}
        <section className="mb-12" aria-labelledby="busquedas">
          <div className="flex items-end justify-between gap-4 mb-4">
            <h2 id="busquedas" className="font-display font-bold text-xl text-[#1C2230]">Búsquedas activas</h2>
            <Link href={filtroEmpleos} className="text-sm font-bold text-[#1E8EA3] hover:underline shrink-0">
              Ir al buscador
            </Link>
          </div>
          {jobs.length === 0 ? (
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-10 text-center">
              <BriefcaseIcon className="w-10 h-10 text-[#9ED4DF] mx-auto mb-3" />
              <p className="font-bold text-[#1C2230] mb-1">Hoy no hay búsquedas activas acá</p>
              <p className="text-sm text-[#64748B] mb-5">Cuando una empresa verificada publique, la vas a ver en esta página.</p>
              <Link href="/empleos" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:underline">
                Ver todas las búsquedas <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => {
                const { zona, contrato } = etiquetasJob(job, cat);
                const lugar = job.modality === "remoto" ? "Remoto" : localidadDeZona(zona?.slug, zona?.name);
                return (
                  <li key={job.id}>
                    <Link
                      href={jobUrl(job)}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] rounded-2xl p-5 transition-colors"
                    >
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-[#1C2230] group-hover:text-[#1E8EA3] transition-colors">{job.title}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-[#64748B]">
                          <span className="flex items-center gap-1.5">
                            <BuildingOffice2Icon className="w-4 h-4 text-[#1E8EA3]" />
                            {job.company_legal_name_snapshot}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPinIcon className="w-4 h-4 text-[#1E8EA3]" />
                            {lugar}
                          </span>
                          <span>{MODALITY_LABEL[job.modality] || job.modality}</span>
                          {contrato && <span>{contrato.name}</span>}
                        </div>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-[#1E8EA3]">
                        Ver aviso <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* CTA */}
        <section className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-8 mb-12 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
          <div className="flex items-start gap-3">
            <BellAlertIcon className="w-6 h-6 text-[#1E8EA3] shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-bold text-lg text-[#1C2230]">¿No encontrás lo que buscás?</p>
              <p className="text-sm text-[#1C2230]">{cta.nota}</p>
            </div>
          </div>
          <Link href={cta.href} className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold rounded-xl px-6 py-3 transition-colors shrink-0">
            {cta.texto} <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </section>

        {/* Textos propios */}
        <section className="bg-white border border-[#DDE3EC] rounded-2xl p-8 mb-12 space-y-4">
          {contenido.textos.map((t) => (
            <p key={t.slice(0, 40)} className="text-[#1C2230] leading-relaxed">{t}</p>
          ))}
        </section>

        {/* Preguntas frecuentes */}
        <section className="mb-12" aria-labelledby="preguntas">
          <h2 id="preguntas" className="font-display font-bold text-xl text-[#1C2230] mb-4">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {contenido.preguntas.map((q) => (
              <details key={q.p} className="group bg-white border border-[#DDE3EC] rounded-2xl p-5" open>
                <summary className="font-bold text-[#1C2230] cursor-pointer list-none flex justify-between gap-4">
                  {q.p}
                </summary>
                <p className="text-sm text-[#1C2230] leading-relaxed mt-2">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Enlaces */}
        <nav className="grid sm:grid-cols-2 gap-8" aria-label="Más búsquedas">
          <div>
            <h2 className="font-display font-bold text-base text-[#1C2230] mb-3">{otrosTitulo}</h2>
            <ul className="space-y-2 text-sm">
              {otros.map((o) => (
                <li key={o.href}><Link href={o.href} className="font-medium text-[#1E8EA3] hover:underline">{o.nombre}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-[#1C2230] mb-3">{cruzadosTitulo}</h2>
            <ul className="space-y-2 text-sm">
              {cruzados.map((o) => (
                <li key={o.href}><Link href={o.href} className="font-medium text-[#1E8EA3] hover:underline">{o.nombre}</Link></li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </div>
  );
}
