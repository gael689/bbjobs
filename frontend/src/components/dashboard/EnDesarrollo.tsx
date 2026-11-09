"use client";

import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

/**
 * Cartel de los módulos nuevos mientras no están lanzados (mails, IA, Revisión de CV,
 * empresas a contactar, campañas). En producción el backend responde 404 en esas rutas
 * (compuerta `MODULOS_NUEVOS_ACTIVOS`) y la pantalla muestra esto en lugar de un error.
 */
export default function EnDesarrollo({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-6">{titulo}</h1>
      <div className="bg-white border border-[#9ED4DF] rounded-2xl p-8 max-w-2xl shadow-sm">
        <div className="w-11 h-11 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center mb-4">
          <WrenchScrewdriverIcon className="w-6 h-6" />
        </div>
        <span className="inline-block text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#E6F4F7] text-[#187B8E] mb-3">
          En desarrollo
        </span>
        <p className="text-[#1C2230] font-semibold mb-1">Esta sección todavía no está disponible.</p>
        <p className="text-[#1C2230] text-sm leading-relaxed">{descripcion}</p>
      </div>
    </div>
  );
}
