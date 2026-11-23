"use client";

import { useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { useModulo } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import Recomendados from "@/components/admin-ia/Recomendados";
import Actividad from "@/components/admin-ia/Actividad";
import Acciones from "@/components/admin-ia/Acciones";
import Panorama from "@/components/admin-ia/Panorama";
import Agentes from "@/components/admin-ia/Agentes";
import { Aviso, Spinner, type ResumenActividad } from "@/components/admin-ia/comun";

/**
 * Centro de IA (pedido de Gael: "Talency debe ver todo"). Cinco pestañas:
 * - Panorama: estado, rendimiento, uso y gasto, y las mejores coincidencias (28/10/2026).
 * - Agentes: quién es cada agente, qué hace, sus instrucciones y cuánto trabajó (15/11/2026).
 * - Recomendados: los de cualquier búsqueda, con lo que Talency necesita para gestionar.
 * - Actividad: qué hizo la IA (lecturas de CV, recálculos, resúmenes, moderación…), con alertas.
 * - Acciones: lanzar a mano lo que la IA hace sola, con confirmación y dentro del tope de gasto.
 * Módulo en desarrollo: con la compuerta cerrada el backend responde 404 y se ve el cartel.
 */
export type Pestana = "panorama" | "agentes" | "recomendados" | "actividad" | "acciones";
export type GrupoAgentes = "recomendaciones" | "prospeccion" | "asistentes";

const PESTANAS: { clave: Pestana; label: string }[] = [
  { clave: "panorama", label: "Panorama" },
  { clave: "agentes", label: "Agentes" },
  { clave: "recomendados", label: "Recomendados" },
  { clave: "actividad", label: "Actividad" },
  { clave: "acciones", label: "Acciones" },
];

// Cada pestaña tiene su dirección (/ia, /ia/agentes, /ia/agentes/prospeccion…) para entrar
// directo desde el menú; al cambiar de pestaña acá adentro se actualiza la barra del navegador.
const BASE = "/dashboard/admin/ia";
function url(p: Pestana, grupo?: GrupoAgentes | null, job?: string | null) {
  if (p === "panorama") return BASE;
  if (p === "agentes" && grupo) return `${BASE}/agentes/${grupo}`;
  if (p === "recomendados" && job) return `${BASE}/recomendados?busqueda=${job}`;
  return `${BASE}/${p}`;
}

export default function CentroIa({ inicial = "panorama", grupo = null, job = null }: {
  inicial?: Pestana; grupo?: GrupoAgentes | null; job?: string | null;
}) {
  const resumen = useModulo<ResumenActividad>("/admin/ai/activity/summary");
  const [pestana, setPestanaEstado] = useState<Pestana>(inicial);
  const [grupoAgentes, setGrupoAgentes] = useState<GrupoAgentes | null>(grupo);
  const [jobAbierto, setJobAbierto] = useState<string | null>(job);

  function setPestana(p: Pestana, g: GrupoAgentes | null = null, j: string | null = null) {
    setPestanaEstado(p);
    setGrupoAgentes(g);
    window.history.pushState(null, "", url(p, g, j));
  }

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
  function verBusqueda(id: string) {
    setJobAbierto(id);
    setPestana("recomendados", null, id);
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
      ) : pestana === "panorama" ? (
        <Panorama onVerBusqueda={verBusqueda} />
      ) : pestana === "agentes" ? (
        <Agentes grupo={grupoAgentes} onVerTodos={() => setPestana("agentes")} />
      ) : pestana === "recomendados" ? (
        <Recomendados jobInicial={jobAbierto} onJobAbierto={setJobAbierto} />
      ) : pestana === "actividad" ? (
        <Actividad resumen={resumen.datos} onVerBusqueda={verBusqueda} />
      ) : (
        <Acciones />
      )}
    </div>
  );
}
