import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowRightIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Migas from "@/components/seo/Migas";
import type { Miga } from "@/lib/seo/schema";
import type { Par, Paso } from "@/lib/seo/seleccion";

// Piezas visuales de las páginas para empresas (/seleccion-de-personal, sus sectores y
// /publicar-empleo). Poco texto, mucho diseño: el hero oscuro con el "BBJobs" gigante de fondo,
// problema → solución, tres pasos y la banda final. Todo contraste pleno, sin grises.

/** El logotipo en grande, recortado contra el borde de la sección. Decorativo: no lo lee nadie. */
function MarcaDeFondo({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none select-none absolute inset-x-0 flex justify-center whitespace-nowrap font-display font-extrabold leading-none tracking-tighter text-[27vw] sm:text-[22vw] lg:text-[19rem] ${className}`}
    >
      <span className="text-[#1E8EA3]/40">BB</span>
      <span className="text-white/[0.07]">Jobs</span>
    </div>
  );
}

export function HeroEmpresas({
  etiqueta,
  titulo,
  bajada,
  migas,
  children,
}: {
  etiqueta: string;
  titulo: string;
  bajada: string;
  migas: Miga[];
  /** Los botones. */
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-[#1C2230] rounded-b-[2.5rem] sm:rounded-b-[4rem] pt-[150px] pb-28 sm:pb-40 mb-16">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-24 w-[34rem] h-[34rem] rounded-full bg-[#1E8EA3]/35 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 w-[26rem] h-[26rem] rounded-full bg-[#D4B7A2]/25 blur-3xl" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:26px_26px]"
      />
      <MarcaDeFondo className="-bottom-[0.1em]" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
        <Migas migas={migas} tono="oscuro" className="mb-8" />
        <span className="inline-flex items-center gap-2 rounded-full bg-[#D4B7A2] text-[#1C2230] text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 mb-6">
          {etiqueta}
        </span>
        <h1 className="font-display font-extrabold text-4xl sm:text-6xl text-white leading-[1.05] tracking-tight mb-5">{titulo}</h1>
        <p className="text-xl sm:text-2xl text-white leading-snug max-w-2xl mb-9">{bajada}</p>
        <div className="flex flex-col sm:flex-row gap-3">{children}</div>
      </div>
    </section>
  );
}

export function BotonPrincipal({ href, children }: { href: string; children: ReactNode }) {
  const clase =
    "inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-7 py-4 shadow-[0_8px_24px_rgba(30,142,163,0.4)] transition-colors";
  const contenido = (
    <>
      {children} <ArrowRightIcon className="w-4 h-4" aria-hidden />
    </>
  );
  return href.startsWith("#") ? (
    <a href={href} className={clase}>{contenido}</a>
  ) : (
    <Link href={href} className={clase}>{contenido}</Link>
  );
}

export function BotonSecundario({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 border-2 border-white/80 hover:bg-white hover:text-[#1C2230] text-white font-bold rounded-xl px-7 py-4 transition-colors"
    >
      {children}
    </Link>
  );
}

/** Cada renglón: lo que duele a la izquierda, cómo se resuelve a la derecha. */
export function ProblemaSolucion({ pares, titulo }: { pares: Par[]; titulo: string }) {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-20" aria-labelledby="problema-solucion">
      <h2 id="problema-solucion" className="font-display font-extrabold text-3xl sm:text-4xl text-[#1C2230] tracking-tight mb-8">
        {titulo}
      </h2>
      <ul className="space-y-4">
        {pares.map((par) => (
          <li key={par.problema} className="grid md:grid-cols-[1fr_auto_1fr] items-stretch gap-2 md:gap-3">
            <div className="flex items-center gap-3 rounded-2xl bg-[#F7EFE9] border border-[#D4B7A2] p-5">
              <span className="shrink-0 w-8 h-8 rounded-full bg-[#D4B7A2] flex items-center justify-center" aria-hidden>
                <XMarkIcon className="w-4 h-4 text-[#1C2230] stroke-[3]" />
              </span>
              <p className="font-bold text-[#1C2230] leading-snug">{par.problema}</p>
            </div>
            <div className="flex items-center justify-center text-[#1E8EA3]" aria-hidden>
              <ArrowDownIcon className="w-5 h-5 md:hidden" />
              <ArrowRightIcon className="w-6 h-6 hidden md:block" />
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-[#E6F4F7] border border-[#9ED4DF] p-5">
              <span className="shrink-0 w-8 h-8 rounded-full bg-[#1E8EA3] flex items-center justify-center" aria-hidden>
                <CheckIcon className="w-4 h-4 text-white stroke-[3]" />
              </span>
              <p className="text-[#1C2230] leading-snug">{par.solucion}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Tres pasos con el número enorme de fondo. */
export function Pasos({ pasos, titulo, id }: { pasos: Paso[]; titulo: string; id: string }) {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-20" aria-labelledby={id}>
      <h2 id={id} className="font-display font-extrabold text-3xl sm:text-4xl text-[#1C2230] tracking-tight mb-8">{titulo}</h2>
      <ol className="grid md:grid-cols-3 gap-4">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="relative overflow-hidden bg-white border border-[#DDE3EC] rounded-3xl p-6 pt-10 shadow-[0_8px_32px_rgba(30,142,163,0.08)]">
            <span aria-hidden className="absolute -top-5 -right-1 font-display font-extrabold text-[8rem] leading-none text-[#E6F4F7] select-none">
              {i + 1}
            </span>
            <h3 className="relative font-display font-extrabold text-xl text-[#1C2230] mb-2">{p.titulo}</h3>
            <p className="relative text-[#1C2230] leading-snug">{p.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Etiquetas con tilde: para quién es, perfiles, qué incluye. */
export function Chips({ items, titulo, id }: { items: string[]; titulo: string; id: string }) {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-20" aria-labelledby={id}>
      <h2 id={id} className="font-display font-extrabold text-3xl sm:text-4xl text-[#1C2230] tracking-tight mb-6">{titulo}</h2>
      <ul className="flex flex-wrap gap-3">
        {items.map((t) => (
          <li key={t} className="inline-flex items-center gap-2 bg-white border border-[#9ED4DF] rounded-full pl-2 pr-4 py-2 font-bold text-[#1C2230]">
            <span className="w-6 h-6 rounded-full bg-[#1E8EA3] flex items-center justify-center shrink-0" aria-hidden>
              <CheckIcon className="w-3.5 h-3.5 text-white stroke-[3]" />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}

export type Camino = { titulo: string; precio: string; puntos: string[]; accion: string; href: string; destacado?: boolean };

/** Dos caminos lado a lado: publicar por tu cuenta o que Talency se encargue. */
export function DosCaminos({ caminos, titulo }: { caminos: [Camino, Camino]; titulo: string }) {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-20" aria-labelledby="caminos">
      <h2 id="caminos" className="font-display font-extrabold text-3xl sm:text-4xl text-[#1C2230] tracking-tight mb-8">{titulo}</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {caminos.map((c) => (
          <div
            key={c.titulo}
            className={`rounded-3xl p-7 flex flex-col ${c.destacado ? "bg-[#1C2230] text-white shadow-[0_16px_48px_rgba(28,34,48,0.35)]" : "bg-white border border-[#DDE3EC] text-[#1C2230]"}`}
          >
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${c.destacado ? "text-[#D4B7A2]" : "text-[#187B8E]"}`}>{c.precio}</p>
            <h3 className="font-display font-extrabold text-2xl mb-5">{c.titulo}</h3>
            <ul className="space-y-3 mb-7 flex-1">
              {c.puntos.map((p) => (
                <li key={p} className="flex items-start gap-2.5 leading-snug">
                  <CheckIcon className={`w-5 h-5 shrink-0 stroke-[3] ${c.destacado ? "text-[#9ED4DF]" : "text-[#1E8EA3]"}`} aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
            {c.href.startsWith("#") ? (
              <a href={c.href} className="inline-flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-6 py-3.5 transition-colors">
                {c.accion} <ArrowRightIcon className="w-4 h-4" aria-hidden />
              </a>
            ) : (
              <Link href={c.href} className="inline-flex items-center justify-center gap-2 border-2 border-[#1E8EA3] text-[#187B8E] hover:bg-[#E6F4F7] font-bold rounded-xl px-6 py-3.5 transition-colors">
                {c.accion} <ArrowRightIcon className="w-4 h-4" aria-hidden />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Banda final: fondo teal con el logotipo gigante, un título y un botón. */
export function BandaCta({ titulo, texto, href, accion }: { titulo: string; texto?: string; href: string; accion: string }) {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 mb-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#187B8E] px-7 py-12 sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none select-none absolute -bottom-[0.14em] -right-4 font-display font-extrabold leading-none tracking-tighter text-[7rem] sm:text-[11rem] text-white/[0.09] whitespace-nowrap"
        >
          BBJobs
        </div>
        <div className="relative z-10 max-w-xl">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-3">{titulo}</h2>
          {texto && <p className="text-lg text-white leading-snug mb-7">{texto}</p>}
          <Link
            href={href}
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#E6F4F7] text-[#1C2230] font-bold rounded-xl px-7 py-4 transition-colors"
          >
            {accion} <ArrowRightIcon className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
