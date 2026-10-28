"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  AdjustmentsHorizontalIcon, BookmarkIcon, MagnifyingGlassIcon, SparklesIcon,
} from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import {
  EVENTO_ABRIR_NOVEDADES, NOVEDADES, NOVEDADES_VENCE, VERSION_ACTUAL,
  claveNovedades, type Novedad, type RolNovedades,
} from "@/lib/novedades";

const EVENTO_CAMBIO = "bbjobs:novedades-cambio";

const ICONOS: Record<Novedad["icono"], React.ReactNode> = {
  buscar: <MagnifyingGlassIcon className="w-5 h-5 text-[#1E8EA3]" />,
  estrella: <StarIcon className="w-5 h-5 text-amber-400" />,
  filtros: <AdjustmentsHorizontalIcon className="w-5 h-5 text-[#1E8EA3]" />,
  guardado: <BookmarkIcon className="w-5 h-5 text-[#1E8EA3]" />,
};

function subscribe(onChange: () => void) {
  window.addEventListener(EVENTO_CAMBIO, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENTO_CAMBIO, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function leerVisto(clave: string): boolean {
  try {
    return window.localStorage.getItem(clave) === "1";
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): se muestra y se cierra sólo en esta visita.
    return false;
  }
}

/**
 * Cartel de novedades de la versión, para empresas y admin. Sale solo la primera vez que cada
 * usuario entra al panel después de la actualización (la clave lleva la versión y el usuario) y
 * se puede volver a abrir desde la marca de versión de la barra lateral (`MarcaVersion`).
 */
export default function NovedadesVersion({ rol }: { rol: RolNovedades }) {
  const { isLoaded, user } = useUser();
  const userId = user?.id ?? "";
  const clave = claveNovedades(rol, userId);

  const vistoEnMemoria = useRef(false);
  const visto = useSyncExternalStore(
    subscribe,
    () => vistoEnMemoria.current || (userId ? leerVisto(clave) : true),
    () => true,
  );
  const [abiertoAMano, setAbiertoAMano] = useState(false);

  useEffect(() => {
    const abrir = () => setAbiertoAMano(true);
    window.addEventListener(EVENTO_ABRIR_NOVEDADES, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_NOVEDADES, abrir);
  }, []);

  const mostrar = abiertoAMano || (isLoaded && !!userId && !visto && new Date() < NOVEDADES_VENCE);

  function cerrar() {
    setAbiertoAMano(false);
    vistoEnMemoria.current = true;
    try {
      if (userId) window.localStorage.setItem(clave, "1");
    } catch {
      /* ver leerVisto */
    }
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }

  if (!mostrar) return null;
  return <CartelNovedades rol={rol} onCerrar={cerrar} />;
}

/** El cartel en sí, sin saber cuándo mostrarse (eso lo decide `NovedadesVersion`). */
export function CartelNovedades({ rol, onCerrar }: { rol: RolNovedades; onCerrar: () => void }) {
  // En una ref: el que llama pasa una función nueva en cada render y el foco y el Esc se
  // instalan una sola vez, al abrir.
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => { onCerrarRef.current = onCerrar; }, [onCerrar]);
  const cerrar = () => onCerrarRef.current();
  const botonRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    botonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrarRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const contenido = NOVEDADES[rol];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1C2230]/60 px-4 py-6" onClick={cerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="novedades-titulo"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-full overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="relative overflow-hidden bg-[#0B171D] px-6 pt-6 pb-7 pr-14 text-white">
          {/* Halo de color detrás del número de versión: lo único decorativo del cartel. */}
          <div aria-hidden className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#1E8EA3]/40 blur-3xl" />
          <div className="relative flex items-center gap-2">
            <span className="font-display font-extrabold italic text-lg tracking-tight">
              <span className="text-[#5FC4D6]">BB</span><span className="text-[#E8EEF0]">JOBS</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#D4B7A2] px-2.5 py-0.5 text-xs font-extrabold text-[#241C15]">
              <SparklesIcon className="w-3.5 h-3.5" />
              Nuevo
            </span>
          </div>
          <p className="relative mt-4 font-display text-5xl font-extrabold leading-none tracking-tight text-white">
            v{VERSION_ACTUAL}
          </p>
          <h2 id="novedades-titulo" className="relative mt-3 font-display text-xl font-extrabold leading-snug">
            Novedades en tu panel
          </h2>
          <p className="relative mt-1 text-sm text-[#A9C0C6]">{contenido.bajada}</p>
        </div>

        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar novedades"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <ul className="px-6 py-5 space-y-4">
          {contenido.items.map(item => (
            <li key={item.titulo} className="flex gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E6F4F7]">
                {ICONOS[item.icono]}
              </span>
              <div>
                <p className="text-sm font-bold text-[#1C2230]">{item.titulo}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-[#64748B]">{item.texto}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-col-reverse sm:flex-row gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={cerrar}
            className="sm:flex-1 rounded-xl border border-[#DDE3EC] px-4 py-3 text-sm font-bold text-[#64748B] transition-colors hover:bg-[#FAFBFD] hover:text-[#1C2230]"
          >
            Cerrar
          </button>
          <Link
            ref={botonRef}
            href={contenido.boton.href}
            onClick={cerrar}
            className="sm:flex-[2] rounded-xl bg-[#1E8EA3] px-4 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-[#187B8E] focus:outline-none focus:ring-2 focus:ring-[#9ED4DF]"
          >
            {contenido.boton.texto}
          </Link>
        </div>
      </div>
    </div>
  );
}

/** La marca de versión de la barra lateral. Con `conNovedades` vuelve a abrir el cartel; sin
 *  eso (el panel del candidato, que todavía no tiene novedades propias) es sólo la etiqueta. */
export function MarcaVersion({ conNovedades = true }: { conNovedades?: boolean }) {
  if (!conNovedades) {
    return (
      <span className="mt-2 inline-flex items-center rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-[#5C767D]">
        BBJobs v{VERSION_ACTUAL}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_NOVEDADES))}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#1E8EA3]/40 bg-[#1E8EA3]/10 px-2.5 py-1 text-[11px] font-bold text-[#5FC4D6] transition-colors hover:bg-[#1E8EA3]/25 hover:text-white"
    >
      <SparklesIcon className="w-3.5 h-3.5" />
      v{VERSION_ACTUAL} · Novedades
    </button>
  );
}
