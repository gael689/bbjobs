"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useUser } from "@clerk/nextjs";
import { claveAviso, debeMostrarAviso } from "@/lib/avisoCorreccion";

const EVENTO = "bbjobs:aviso-correccion-cambio";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENTO, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENTO, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function leerCerrado(clave: string): boolean {
  try {
    return window.localStorage.getItem(clave) === "1";
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): se muestra y se cierra sólo en esta visita.
    return false;
  }
}

/**
 * Cartel de una sola vez para quien ya tenía cuenta cuando se corrigió el error al guardar
 * datos y subir el CV. Se cierra con la X, con "Entendido" o con Esc y no vuelve a salir.
 * Las cuentas nuevas no lo ven (ver lib/avisoCorreccion.ts).
 */
export default function AvisoCorreccion() {
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id ?? "";
  const clave = claveAviso(userId);

  // Estado "cerrado en esta visita" para el caso sin localStorage.
  const cerradoEnMemoria = useRef(false);
  const cerrado = useSyncExternalStore(
    subscribe,
    () => cerradoEnMemoria.current || (userId ? leerCerrado(clave) : true),
    () => true,
  );

  const mostrar =
    isLoaded &&
    !!isSignedIn &&
    !!userId &&
    debeMostrarAviso({ cuentaCreadaEn: user?.createdAt, ahora: new Date(), yaCerrado: cerrado });

  function cerrar() {
    cerradoEnMemoria.current = true;
    try {
      window.localStorage.setItem(clave, "1");
    } catch {
      /* ver leerCerrado */
    }
    window.dispatchEvent(new Event(EVENTO));
  }

  const botonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mostrar) return;
    botonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrar]);

  if (!mostrar) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1C2230]/60 px-4"
      onClick={cerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviso-correccion-titulo"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="bg-[#1E8EA3] px-6 py-4 pr-14 text-white">
          <span className="font-display text-lg font-extrabold tracking-tight">BBJobs</span>
          <span className="ml-3 rounded-full bg-white px-3 py-0.5 text-xs font-bold text-[#1C2230]">
            Aviso importante
          </span>
        </div>

        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar aviso"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="px-6 py-6">
          <h2 id="aviso-correccion-titulo" className="font-display text-2xl font-extrabold leading-tight text-[#1C2230]">
            Ya corregimos el error al guardar tus datos
          </h2>
          <p className="mt-3 text-base leading-relaxed text-[#1C2230]">
            Si antes te apareció <strong>“Error al guardar”</strong> al completar tu perfil, subir tu CV o
            cargar algo en tu cuenta, ya está solucionado.
          </p>
          <p className="mt-3 text-base leading-relaxed text-[#1C2230]">
            <strong>Volvé a intentarlo:</strong> tus datos y tu CV se guardan con normalidad. Si te llega a
            pedir iniciar sesión, entrá de nuevo.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-[#1C2230]">
            ¿Te sigue pasando? Escribinos desde{" "}
            <a href="/contacto" className="font-bold text-[#187B8E] underline">
              Contacto
            </a>{" "}
            y lo resolvemos.
          </p>

          <button
            ref={botonRef}
            type="button"
            onClick={cerrar}
            className="mt-6 w-full rounded-xl bg-[#1E8EA3] px-4 py-3 text-base font-bold text-white transition-colors hover:bg-[#187B8E] focus:outline-none focus:ring-2 focus:ring-[#9ED4DF]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
