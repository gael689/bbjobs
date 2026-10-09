"use client";

import { useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { useModulo } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import Recomendados from "@/components/admin-ia/Recomendados";
import Actividad from "@/components/admin-ia/Actividad";
import Acciones from "@/components/admin-ia/Acciones";
import { Aviso, Spinner, type ResumenActividad } from "@/components/admin-ia/comun";

/**
 * Centro de IA (pedido de Gael: "Talency debe ver todo"). Tres pestañas:
 * - Recomendados: los de cualquier búsqueda, con lo que Talency necesita para gestionar.
 * - Actividad: qué hizo la IA (lecturas de CV, recálculos, resúmenes, moderación…), con alertas.
 * - Acciones: lanzar a mano lo que la IA hace sola, con confirmación y dentro del tope de gasto.
 * Módulo en desarrollo: con la compuerta cerrada el backend responde 404 y se ve el cartel.
 */
type Pestana = "recomendados" | "actividad" | "acciones";

const PESTANAS: { clave: Pestana; label: string }[] = [
  { clave: "recomendados", label: "Recomendados" },
  { clave: "actividad", label: "Actividad" },
  { clave: "acciones", label: "Acciones" },
];

export default function CentroIaPage() {
  const resumen = useModulo<ResumenActividad>("/admin/ai/activity/summary");
  const [pestana, setPestana] = useState<Pestana>("recomendados");
  const [jobAbierto, setJobAbierto] = useState<string | null>(null);

  if (resumen.estado === "en_desarrollo") {
    return (
      <EnDesarrollo
        titulo="Centro de IA"
        descripcion="Acá vas a ver todo lo que hace la IA: los candidatos recomendados de cada búsqueda, cada CV que lee y anonimiza, lo que marca al moderar y cuánto gasta. Y vas a poder lanzar a mano los recálculos y las revisiones."
      />
    );
  }

  function irA(p: Pestana) {
    setPestana(p);
    if (p !== "recomendados") setJobAbierto(null);
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1 flex items-center gap-2">
        <SparklesIcon className="w-6 h-6 text-[#187B8E]" /> Centro de IA
      </h1>
      <p className="text-[#1C2230] text-sm mb-5">
        Todo lo que hace la IA y los botones para lanzarla a mano. La IA ordena, resume y avisa: nunca manda mails ni cambia el estado de nada.
      </p>

      <div role="tablist" aria-label="Secciones del Centro de IA" className="flex gap-1 border-b border-[#DDE3EC] mb-6 overflow-x-auto">
        {PESTANAS.map(p => (
          <button key={p.clave} role="tab" aria-selected={pestana === p.clave} onClick={() => irA(p.clave)}
                  className={`px-4 py-2.5 text-sm font-bold whitespace-nowrap border-b-2 -mb-px ${pestana === p.clave ? "border-[#1E8EA3] text-[#187B8E]" : "border-transparent text-[#1C2230] hover:text-[#187B8E]"}`}>
            {p.label}
            {p.clave === "actividad" && resumen.estado === "listo" && resumen.datos.today.alerts > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-extrabold">
                {resumen.datos.today.alerts}
              </span>
            )}
          </button>
        ))}
      </div>

      {resumen.estado === "cargando" ? (
        <div className="py-12 flex justify-center"><Spinner /></div>
      ) : resumen.estado === "error" ? (
        <Aviso tono="error">{resumen.mensaje}</Aviso>
      ) : pestana === "recomendados" ? (
        <Recomendados jobInicial={jobAbierto} onJobAbierto={setJobAbierto} />
      ) : pestana === "actividad" ? (
        <Actividad resumen={resumen.datos} onVerBusqueda={id => { setJobAbierto(id); setPestana("recomendados"); }} />
      ) : (
        <Acciones />
      )}
    </div>
  );
}
