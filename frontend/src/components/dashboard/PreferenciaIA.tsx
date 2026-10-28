"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";
import { detalleError } from "@/hooks/useModulo";

interface Preferencia {
  opted_out: boolean;
  opted_out_at?: string | null;
}

/**
 * "No usar mi perfil en recomendaciones" (privacidad 3.0, §7). Sólo postulantes. Módulo nuevo:
 * oculto sin la variable de entorno, y si el backend responde 404 (compuerta cerrada o no es
 * postulante) no se muestra nada.
 */
export default function PreferenciaIA() {
  const [pref, setPref] = useState<Preferencia | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!MODULOS_NUEVOS_VISIBLES) return;
    api.get<Preferencia>("/me/candidate/ai-preference")
      .then(r => setPref(r.data))
      .catch(() => setPref(null));
  }, []);

  if (!MODULOS_NUEVOS_VISIBLES || !pref) return null;

  async function cambiar(optedOut: boolean) {
    setGuardando(true);
    setError(null);
    try {
      const r = await api.post<Preferencia>("/me/candidate/ai-preference", { opted_out: optedOut });
      setPref(r.data);
    } catch (e) {
      setError(detalleError(e, "No se pudo guardar. Probá de nuevo."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div id="ia" className="pb-5 mb-5 border-b border-[#DDE3EC] scroll-mt-24">
      <p className="text-sm font-bold text-[#1C2230] mb-1">Recomendaciones con inteligencia artificial</p>
      <p className="text-sm text-[#1C2230] mb-3">
        BBJobs ayuda a las empresas a ordenar postulantes según la búsqueda. La decisión siempre la toma una persona y tu
        CV se procesa sin tus datos personales. Si no querés que tu perfil se use para esto, marcalo acá: no te perjudica,
        las empresas ven tus postulaciones igual.{" "}
        <Link href="/privacidad#ia" className="font-bold text-[#187B8E] underline">Más información</Link>
      </p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <label className="flex items-start gap-3 rounded-xl border border-[#DDE3EC] px-4 py-3 bg-white cursor-pointer hover:border-[#9ED4DF]">
        <input
          type="checkbox"
          className="mt-1 w-4 h-4 accent-[#187B8E]"
          checked={pref.opted_out}
          disabled={guardando}
          onChange={e => cambiar(e.target.checked)}
        />
        <span className="flex-1">
          <span className="block text-sm font-bold text-[#1C2230]">No usar mi perfil en recomendaciones</span>
          <span className="block text-xs text-[#1C2230]">
            {pref.opted_out
              ? "Activado. Borramos lo que la IA había procesado de tu CV y no se vuelve a calcular."
              : "Si lo activás, borramos lo que la IA procesó de tu CV y tu perfil queda sin puntaje."}
          </span>
        </span>
      </label>
    </div>
  );
}
