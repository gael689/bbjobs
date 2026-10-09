"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SparklesIcon, PlusIcon } from "@heroicons/react/24/outline";

/**
 * "Sugerencias según tu CV" en el perfil del candidato (módulo nuevo, Frente 6.5).
 *
 * Habilidades del catálogo que el CV respalda y la persona todavía no eligió, cada una con la
 * frase del CV que la sostiene. Sumar una es un clic (se guarda con el endpoint de siempre); la
 * IA no guarda nada sola. Sin el módulo, sin IA, sin CV o con la ruta en 404: no aparece.
 */

const ACTIVO = process.env.NEXT_PUBLIC_MODULOS_NUEVOS === "true";

export interface SugerenciaHabilidad {
  skill_id: string;
  skill_name: string;
  slug: string;
  category: "soft" | "technical";
  evidence: string;
}

export default function SugerenciasHabilidades({
  selectedIds, onAdd,
}: {
  selectedIds: string[];
  onAdd: (s: SugerenciaHabilidad) => Promise<void>;
}) {
  const [sugerencias, setSugerencias] = useState<SugerenciaHabilidad[] | null>(null);
  const [sumando, setSumando] = useState<string | null>(null);

  useEffect(() => {
    if (!ACTIVO) return;
    api.get("/me/candidate/ai/skill-suggestions")
      .then(r => setSugerencias(r.data?.available ? r.data.suggestions : null))
      .catch(() => setSugerencias(null));
  }, []);

  const pendientes = (sugerencias ?? []).filter(s => !selectedIds.includes(s.skill_id));
  if (!ACTIVO || pendientes.length === 0) return null;

  async function sumar(s: SugerenciaHabilidad) {
    setSumando(s.skill_id);
    try {
      await onAdd(s);
    } finally {
      setSumando(null);
    }
  }

  return (
    <div className="mt-6 bg-[#FAFBFD] border border-[#9ED4DF] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <SparklesIcon className="w-4 h-4 text-[#1E8EA3]" />
        <p className="text-sm font-bold text-[#1C2230]">Sugerencias según tu CV</p>
      </div>
      <p className="text-[13px] text-[#64748B] mb-3">
        Encontramos estas habilidades en tu CV. Sumá las que te representen con un clic.
      </p>
      <ul className="space-y-2">
        {pendientes.map(s => (
          <li key={s.skill_id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1C2230]">{s.skill_name}</p>
              <p className="text-xs text-[#64748B] mt-0.5">&ldquo;{s.evidence}&rdquo;</p>
            </div>
            <button
              type="button"
              onClick={() => sumar(s)}
              disabled={sumando !== null}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-[#1E8EA3] border border-[#9ED4DF] bg-white hover:bg-[#E6F4F7] disabled:opacity-50 rounded-full px-3 py-1.5 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              {sumando === s.skill_id ? "Sumando..." : "Sumar"}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[#64748B] mt-3">Es una sugerencia: elegí sólo las que de verdad tengas.</p>
    </div>
  );
}
