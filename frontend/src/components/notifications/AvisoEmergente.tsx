"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { SparklesIcon, XMarkIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { api, isSessionExpired } from "@/lib/api";
import type { NotificationItemData } from "@/hooks/useNotifications";

/**
 * Cartel emergente para los avisos que importan (Gael, 28/10/2026: "que cuando te llegue sea un
 * mensaje saliendo en pantalla, estético, poco texto"): candidatos que encajan, el resumen de la
 * IA para Talency y las habilidades sugeridas. El backend elige cuáles (`/me/notifications/highlights`:
 * no leídos, de los últimos 3 días); acá sólo se recuerda cuáles ya se mostraron, para no
 * repetirlos en cada pantalla. Cerrarlo no lo marca como leído: sigue en la campanita.
 */
const POLL_MS = 60_000;
const PRIMERA_VEZ_MS = 2_500;
const DURACION_MS = 10_000;
const CLAVE = "bbjobs:avisos-mostrados";

function leerMostrados(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function recordar(id: string) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify([id, ...leerMostrados().filter(x => x !== id)].slice(0, 50)));
  } catch {
    // sin almacenamiento: a lo sumo se vuelve a mostrar en la próxima carga
  }
}

export default function AvisoEmergente() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [aviso, setAviso] = useState<NotificationItemData | null>(null);
  const [saliendo, setSaliendo] = useState(false);
  const mostradosEnSesion = useRef(new Set<string>());
  const enPantalla = useRef(false);

  const buscar = useCallback(async () => {
    // Con un cartel abierto no se pregunta: el próximo se busca recién cuando se cierra, así un
    // aviso que llega mientras tanto no queda marcado como mostrado sin haberse visto.
    if (enPantalla.current || document.hidden || isSessionExpired()) return;
    try {
      const r = await api.get<NotificationItemData[]>("/me/notifications/highlights");
      const vistos = new Set([...leerMostrados(), ...mostradosEnSesion.current]);
      const nuevo = r.data.find(n => !vistos.has(n.id));
      if (nuevo && !enPantalla.current) {
        enPantalla.current = true;
        mostradosEnSesion.current.add(nuevo.id);
        recordar(nuevo.id);
        setSaliendo(false);
        setAviso(nuevo);
      }
    } catch {
      // silencioso: el aviso igual está en la campanita
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    const primera = setTimeout(buscar, PRIMERA_VEZ_MS);
    const intervalo = setInterval(buscar, POLL_MS);
    return () => { clearTimeout(primera); clearInterval(intervalo); };
  }, [isSignedIn, buscar]);

  const cerrar = useCallback(() => {
    setSaliendo(true);
    setTimeout(() => { setAviso(null); setSaliendo(false); enPantalla.current = false; }, 220);
  }, []);

  function ver() {
    if (!aviso) return;
    api.patch(`/me/notifications/${aviso.id}/read`).catch(() => {});
    if (aviso.link) router.push(aviso.link);
    cerrar();
  }

  return (
    <>
      {/* Región siempre montada: si se monta junto con el texto, los lectores de pantalla no lo anuncian. */}
      <div aria-live="polite" className="sr-only">{aviso ? `${aviso.title}. ${aviso.body}` : ""}</div>
      {aviso && <CartelAviso aviso={aviso} saliendo={saliendo} onVer={ver} onCerrar={cerrar} />}
    </>
  );
}

/** El cartel en sí, sin lógica: lo usa AvisoEmergente. */
export function CartelAviso({ aviso, saliendo, onVer, onCerrar }: {
  aviso: NotificationItemData; saliendo: boolean; onVer: () => void; onCerrar: () => void;
}) {
  return (
    <div className="fixed z-[60] bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px]">
      <div
        className={`aviso-pausa relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B171D] via-[#12303A] to-[#16404B] text-white shadow-[0_20px_50px_-12px_rgba(11,23,29,0.55),0_0_0_1px_rgba(158,212,223,0.18)] ${saliendo ? "aviso-sale" : "aviso-entra"}`}
      >
        {/* Brillo decorativo */}
        <div aria-hidden className="absolute -top-16 -right-10 w-44 h-44 rounded-full bg-[#1E8EA3]/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full bg-[#D4B7A2]/20 blur-3xl" />

        <div className="relative flex items-start gap-3.5 p-4 pr-11">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br from-[#1E8EA3] to-[#9ED4DF] flex items-center justify-center shadow-[0_6px_18px_-4px_rgba(30,142,163,0.7)]">
            <SparklesIcon className="aviso-brillo w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold text-[15.5px] leading-snug">{aviso.title}</p>
            {aviso.body && <p className="text-[13px] text-[#D6E9EE] mt-0.5 line-clamp-2">{aviso.body}</p>}
            {aviso.link && (
              <button onClick={onVer}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white text-[#0B171D] text-[13px] font-extrabold px-3.5 py-2 hover:bg-[#E6F4F7] transition-colors">
                Ver ahora <ArrowRightIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar aviso"
                className="absolute top-3 right-3 p-1.5 rounded-lg text-[#D6E9EE] hover:text-white hover:bg-white/10">
          <XMarkIcon className="w-4 h-4" />
        </button>

        {/* Tiempo que le queda: al terminar se cierra solo (con el mouse encima, se pausa). */}
        <div className="relative h-1 bg-white/10">
          <div className="aviso-tiempo h-full bg-gradient-to-r from-[#9ED4DF] to-[#D4B7A2]"
               style={{ animationDuration: `${DURACION_MS}ms` }}
               onAnimationEnd={onCerrar} />
        </div>
      </div>
    </div>
  );
}
