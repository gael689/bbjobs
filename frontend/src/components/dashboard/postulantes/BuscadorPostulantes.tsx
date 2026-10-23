"use client";

import { useState } from "react";
import { AdjustmentsHorizontalIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { StarIcon } from "@heroicons/react/24/solid";
import {
  CLAVES_AVANZADAS, FILTROS_VACIOS, hayFiltros,
  type ConteosPostulantes, type FiltrosPostulantes,
} from "./filtros";

interface Props {
  filtros: FiltrosPostulantes;
  onCambiar: (f: FiltrosPostulantes) => void;
  /** Los chips (sobre la búsqueda entera). `null` mientras cargan. */
  conteos: ConteosPostulantes | null;
  /** Cuántos quedaron con los filtros aplicados. `null` mientras carga. */
  resultado: number | null;
  estados: Record<string, { label: string }>;
  zonas: { id: string; name: string }[];
  generos: Record<string, string>;
  disponibilidades: Record<string, string>;
}

const INPUT = "border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]";

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1.5 border transition-colors ${
        activo
          ? "bg-[#1E8EA3] border-[#1E8EA3] text-white"
          : "bg-white border-[#DDE3EC] text-[#64748B] hover:border-[#9ED4DF] hover:text-[#1C2230]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Buscador de postulantes de una búsqueda: un campo de texto ancho, chips de estrella, sin ver
 * y estado, y el resto de los filtros plegados. Filtra mientras se escribe (el listado espera
 * 300 ms de tipeo), sin botón "Filtrar": con el buscador arriba, tener que apretar algo para
 * ver el resultado era el paso que se olvidaba.
 */
export default function BuscadorPostulantes({
  filtros, onCambiar, conteos, resultado, estados, zonas, generos, disponibilidades,
}: Props) {
  const [masFiltros, setMasFiltros] = useState(() => CLAVES_AVANZADAS.some(c => !!filtros[c]));
  const set = (cambio: Partial<FiltrosPostulantes>) => onCambiar({ ...filtros, ...cambio });
  const avanzadosActivos = CLAVES_AVANZADAS.filter(c => !!filtros[c]).length;

  // Los estados con al menos un postulante, en el orden del embudo. Así "Contactado" o
  // "Finalista" aparecen sólo si la búsqueda tiene postulaciones viejas en esos estados.
  const estadosConPostulantes = Object.entries(estados).filter(([v]) => (conteos?.by_status[v] ?? 0) > 0);
  const n = (x: number | undefined) => (conteos ? ` (${x ?? 0})` : "");

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4">
      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={filtros.q}
          onChange={e => set({ q: e.target.value })}
          placeholder="Buscar por nombre, apellido, puesto, empresa o estudio (ej.: técnico electromecánico)"
          aria-label="Buscar postulantes"
          maxLength={200}
          className="w-full border border-[#DDE3EC] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Chip activo={!filtros.status && !filtros.starred && !filtros.seen} onClick={() => set({ status: "", starred: "", seen: "" })}>
          Todos{n(conteos?.total)}
        </Chip>
        <Chip activo={filtros.starred === "true"} onClick={() => set({ starred: filtros.starred ? "" : "true" })}>
          <StarIcon className={`w-3.5 h-3.5 ${filtros.starred ? "text-white" : "text-amber-400"}`} />
          Con estrella{n(conteos?.starred)}
        </Chip>
        <Chip activo={filtros.seen === "false"} onClick={() => set({ seen: filtros.seen ? "" : "false" })}>
          Sin ver{n(conteos?.unseen)}
        </Chip>
        {estadosConPostulantes.length > 0 && <span className="w-px h-5 bg-[#DDE3EC] mx-1" aria-hidden />}
        {estadosConPostulantes.map(([valor, { label }]) => (
          <Chip key={valor} activo={filtros.status === valor} onClick={() => set({ status: filtros.status === valor ? "" : valor })}>
            {label}{n(conteos?.by_status[valor])}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button"
          onClick={() => setMasFiltros(v => !v)}
          aria-expanded={masFiltros}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E]"
        >
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          {masFiltros ? "Menos filtros" : "Más filtros"}
          {avanzadosActivos > 0 && !masFiltros && ` (${avanzadosActivos})`}
        </button>
        <select
          value={filtros.orden}
          onChange={e => set({ orden: e.target.value as FiltrosPostulantes["orden"] })}
          aria-label="Ordenar"
          className={INPUT}
        >
          <option value="">Más recientes primero</option>
          <option value="estrella">Con estrella primero</option>
        </select>
        {hayFiltros(filtros) && (
          <button
            type="button"
            onClick={() => onCambiar({ ...FILTROS_VACIOS, orden: filtros.orden })}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#64748B] hover:text-[#1C2230]"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
        )}
        {/* Sin el contador, filtrar y no ver cambios es indistinguible de que el filtro no hizo
            nada (B4 del plan del 14/08). */}
        {resultado !== null && (
          <span className="text-xs text-[#64748B] ml-auto">
            {`${resultado} postulante${resultado === 1 ? "" : "s"}`}
            {hayFiltros(filtros) && " con estos filtros"}
          </span>
        )}
      </div>

      {masFiltros && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3 pt-3 border-t border-[#DDE3EC]">
          <input type="number" min={0} placeholder="Edad mín." aria-label="Edad mínima"
            value={filtros.age_min} onChange={e => set({ age_min: e.target.value })} className={INPUT} />
          <input type="number" min={0} placeholder="Edad máx." aria-label="Edad máxima"
            value={filtros.age_max} onChange={e => set({ age_max: e.target.value })} className={INPUT} />
          <input type="number" min={0} step={0.5} placeholder="Exp. mín. (años)" aria-label="Experiencia mínima en años"
            value={filtros.experience_min} onChange={e => set({ experience_min: e.target.value })} className={INPUT} />
          <input type="number" min={0} step={0.5} placeholder="Exp. máx. (años)" aria-label="Experiencia máxima en años"
            value={filtros.experience_max} onChange={e => set({ experience_max: e.target.value })} className={INPUT} />
          <select value={filtros.zone_id} onChange={e => set({ zone_id: e.target.value })} aria-label="Zona" className={INPUT}>
            <option value="">Zona (todas)</option>
            {zonas.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select value={filtros.gender} onChange={e => set({ gender: e.target.value })} aria-label="Sexo" className={INPUT}>
            <option value="">Sexo (todos)</option>
            {Object.entries(generos).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select
            value={filtros.has_own_transport}
            onChange={e => set({ has_own_transport: e.target.value as FiltrosPostulantes["has_own_transport"] })}
            aria-label="Movilidad" className={INPUT}
          >
            <option value="">Movilidad (todas)</option>
            <option value="true">Con movilidad</option>
            <option value="false">Sin movilidad</option>
          </select>
          <select value={filtros.availability} onChange={e => set({ availability: e.target.value })} aria-label="Disponibilidad" className={INPUT}>
            <option value="">Disponibilidad (todas)</option>
            {Object.entries(disponibilidades).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
            <input
              type="checkbox"
              checked={filtros.immediate_availability === "true"}
              onChange={e => set({ immediate_availability: e.target.checked ? "true" : "" })}
              className="w-3.5 h-3.5 accent-[#1E8EA3]"
            />
            Disp. inmediata
          </label>
        </div>
      )}
    </div>
  );
}
