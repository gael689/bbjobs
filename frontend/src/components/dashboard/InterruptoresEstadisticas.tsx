"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChartBarIcon } from "@heroicons/react/24/outline";

interface Settings {
  stats_visibles_para_candidatos: boolean;
  stats_visibles_en_landing: boolean;
}

const INTERRUPTORES: { key: keyof Settings; titulo: string; detalle: string }[] = [
  {
    key: "stats_visibles_para_candidatos",
    titulo: "Mostrar la comparativa a los candidatos",
    detalle:
      "Cada candidato ve, dentro de su postulación, cómo se compara con el resto de los " +
      "postulantes de esa misma búsqueda. Conviene prenderlo cuando las búsquedas tengan " +
      "varios postulantes: con dos o tres, los gráficos hablan de personas puntuales.",
  },
  {
    key: "stats_visibles_en_landing",
    titulo: "Mostrar estadísticas del mercado en la página principal",
    detalle:
      "Un bloque público con búsquedas activas, salario promedio publicado y distribución por " +
      "rubro. Sale de los avisos, no de los candidatos.",
  },
];

/**
 * Los interruptores con los que Talency decide qué estadísticas se publican.
 *
 * Las estadísticas se calculan siempre y Eugenia las ve desde su panel sin importar cómo estén
 * estos interruptores: lo único que controlan es si además salen al portal. Así el sistema
 * queda construido y se prende cuando el volumen lo justifique, sin tocar código.
 */
export default function InterruptoresEstadisticas() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get("/admin/settings").then(r => setSettings(r.data)).catch(() => setError(true));
  }, []);

  async function alternar(key: keyof Settings) {
    if (!settings) return;
    setGuardando(key);
    setError(false);
    try {
      const r = await api.patch("/admin/settings", { [key]: !settings[key] });
      setSettings(r.data);
    } catch {
      setError(true);
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <ChartBarIcon className="w-5 h-5 text-[#1E8EA3]" />
        <h2 className="font-display font-bold text-[#1C2230]">Publicación de estadísticas</h2>
      </div>
      <p className="text-xs text-[#64748B] mb-5">
        Vos ves todas las estadísticas siempre desde tu panel. Acá decidís cuáles se muestran
        además fuera de él.
      </p>

      {!settings ? (
        <div className="py-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {INTERRUPTORES.map(({ key, titulo, detalle }) => (
            <label
              key={key}
              className="flex items-start justify-between gap-4 border border-[#DDE3EC] rounded-xl p-4 cursor-pointer hover:bg-[#FAFBFD] transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#1C2230]">{titulo}</span>
                <span className="block text-xs text-[#64748B] mt-1 leading-relaxed">{detalle}</span>
              </span>
              <input
                type="checkbox"
                checked={settings[key]}
                disabled={guardando === key}
                onChange={() => alternar(key)}
                className="w-5 h-5 accent-[#1E8EA3] shrink-0 mt-0.5"
              />
            </label>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mt-3">No pudimos guardar el cambio. Probá de nuevo.</p>
      )}
    </div>
  );
}
