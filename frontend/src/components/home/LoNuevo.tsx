import Link from "next/link";
import {
  SparklesIcon, EnvelopeIcon, DocumentCheckIcon, ShareIcon, BanknotesIcon, CheckBadgeIcon, ArrowRightIcon,
} from "@heroicons/react/24/outline";

/**
 * Lanzamiento de los módulos nuevos (23/11/2026, pedido de Gael: "tiene que hacer ruido").
 * - `CintaNovedades`: franja que se desliza sin fin debajo del hero.
 * - `LoNuevo`: tres tarjetas grandes con lo nuevo, cada una con su llamado a la acción.
 * Sin estado ni datos: se renderizan en el servidor junto con el resto del inicio.
 */

const CINTA = [
  { icono: SparklesIcon, texto: "Candidatos recomendados con IA para cada búsqueda" },
  { icono: EnvelopeIcon, texto: "Avisos por mail de cada postulación" },
  { icono: DocumentCheckIcon, texto: "Revisión de CV hecha por Talency" },
  { icono: ShareIcon, texto: "Compartí avisos por WhatsApp" },
  { icono: BanknotesIcon, texto: "Filtrá sólo avisos con sueldo" },
  { icono: CheckBadgeIcon, texto: "Empresas verificadas · postularte es gratis" },
];

function TramoCinta({ oculto = false }: { oculto?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={oculto || undefined}>
      {CINTA.map(({ icono: Icono, texto }) => (
        <li key={texto} className="flex items-center gap-2.5 whitespace-nowrap">
          <Icono className="w-5 h-5 text-[#9ED4DF]" />
          <span className="font-display text-[15px] font-extrabold tracking-tight text-white">{texto}</span>
          <span className="ml-8 text-[#D4B7A2]" aria-hidden>✦</span>
        </li>
      ))}
    </ul>
  );
}

export function CintaNovedades() {
  return (
    <div className="relative overflow-hidden border-y border-[#146678] bg-gradient-to-r from-[#0B171D] via-[#146678] to-[#0B171D] py-3.5">
      <div className="absolute inset-y-0 left-0 z-10 flex items-center pl-4 pr-6 bg-gradient-to-r from-[#0B171D] via-[#0B171D] to-transparent">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#D4B7A2] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#241C15] shadow">
          <SparklesIcon className="w-3.5 h-3.5" /> Nuevo
        </span>
      </div>
      {/* Dos tramos iguales que se corren la mitad del ancho: el segundo ocupa el lugar del
          primero y el corte no se ve. Con "reducir movimiento" queda quieta y se puede deslizar. */}
      <div className="cinta-novedades flex w-max pl-28 motion-reduce:w-auto motion-reduce:overflow-x-auto">
        <TramoCinta />
        <TramoCinta oculto />
      </div>
    </div>
  );
}

const TARJETAS = [
  {
    icono: SparklesIcon,
    etiqueta: "Para empresas",
    titulo: "Candidatos recomendados con IA",
    texto: "Para cada búsqueda te mostramos los perfiles que mejor encajan, con el porqué de cada uno. La IA ordena; siempre decidís vos.",
    cta: "Publicar una búsqueda",
    href: "/publicar-empleo",
    fondo: "from-[#146678] to-[#1E8EA3]",
  },
  {
    icono: DocumentCheckIcon,
    etiqueta: "Para postulantes",
    titulo: "Revisión de CV por Talency",
    texto: "Una persona del equipo de Talency revisa tu CV pensando en el puesto que buscás y te da su devolución para mejorarlo.",
    cta: "Pedir mi revisión",
    href: "/dashboard/candidate/revision-cv",
    fondo: "from-[#7A5A44] to-[#B98F72]",
  },
  {
    icono: EnvelopeIcon,
    etiqueta: "Para todos",
    titulo: "Enterate al instante por mail",
    texto: "Cuando una empresa mira tu CV, cambia tu postulación o llega un postulante nuevo, te avisamos. Vos elegís qué recibir.",
    cta: "Crear mi cuenta gratis",
    href: "/register?type=candidate",
    fondo: "from-[#0B171D] to-[#1C2230]",
  },
];

export default function LoNuevo() {
  return (
    <section className="relative overflow-hidden bg-[#FAFBFD] border-t border-[#DDE3EC] py-16 px-4" aria-labelledby="lo-nuevo-titulo">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4F7] border border-[#9ED4DF] px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[#187B8E]">
            <SparklesIcon className="w-3.5 h-3.5" /> Lo nuevo en BBJobs
          </span>
          <h2 id="lo-nuevo-titulo" className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1C2230]">
            Más rápido para encontrar trabajo.<br className="hidden sm:block" /> Más fácil para encontrar a la persona indicada.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {TARJETAS.map(({ icono: Icono, etiqueta, titulo, texto, cta, href, fondo }) => (
            <Link
              key={titulo}
              href={href}
              prefetch={false}
              className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${fondo} p-7 text-white shadow-lg transition-transform hover:-translate-y-1`}
            >
              <div aria-hidden className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Icono className="w-6 h-6" />
              </span>
              <p className="relative mt-5 text-xs font-extrabold uppercase tracking-wider text-white/70">{etiqueta}</p>
              <h3 className="relative mt-1 font-display text-xl font-extrabold leading-snug">{titulo}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-white/85">{texto}</p>
              <span className="relative mt-5 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#1C2230]">
                {cta} <ArrowRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
