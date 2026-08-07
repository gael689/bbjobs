"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BarrasHorizontales } from "./Graficos";

interface MarketStats {
  visible: boolean;
  total_busquedas: number;
  salario_promedio?: number | null;
  busquedas_con_salario: number;
  por_rubro: { label: string; count: number }[];
  por_modalidad: { label: string; count: number }[];
}

function aBuckets(items: { label: string; count: number }[]) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  return items.map(i => ({ ...i, percent: Math.round((i.count / total) * 1000) / 10 }));
}

/**
 * Bloque público de estadísticas del mercado laboral local.
 *
 * Sale de las **búsquedas publicadas**, no de los candidatos: publicar distribuciones de las
 * personas registradas expondría datos de gente que nunca pidió aparecer en un ranking. Acá
 * sólo hay agregados de avisos, que ya son públicos uno por uno.
 *
 * Si Talency no lo habilitó, el endpoint responde `visible: false` y el componente no
 * renderiza nada — no hay cartel de "próximamente" ni hueco en la página.
 */
export default function MercadoLaboral() {
  const [stats, setStats] = useState<MarketStats | null>(null);

  useEffect(() => {
    api.get("/public/market-stats").then(r => setStats(r.data)).catch(() => setStats(null));
  }, []);

  if (!stats?.visible || stats.total_busquedas === 0) return null;

  return (
    <section className="px-4 sm:px-6 py-16 bg-[#FAFBFD] border-t border-[#DDE3EC]">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-widest text-[#1E8EA3] uppercase mb-2">
          El mercado laboral de Bahía Blanca
        </p>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#1C2230] mb-2">
          Qué se está buscando hoy
        </h2>
        <p className="text-sm text-[#64748B] mb-8">
          Datos de las búsquedas activas en BBJobs. Se actualizan solos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-[#DDE3EC] rounded-2xl px-6 py-5">
            <p className="text-3xl font-display font-extrabold text-[#1E8EA3]">
              {stats.total_busquedas}
            </p>
            <p className="text-sm font-bold text-[#1C2230] mt-1">
              {stats.total_busquedas === 1 ? "Búsqueda activa" : "Búsquedas activas"}
            </p>
          </div>

          {stats.salario_promedio != null && (
            <div className="bg-white border border-[#DDE3EC] rounded-2xl px-6 py-5">
              <p className="text-3xl font-display font-extrabold text-[#1E8EA3]">
                ${stats.salario_promedio.toLocaleString("es-AR")}
              </p>
              <p className="text-sm font-bold text-[#1C2230] mt-1">Salario promedio publicado</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                Sobre {stats.busquedas_con_salario} búsqueda
                {stats.busquedas_con_salario === 1 ? "" : "s"} que muestran el salario
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stats.por_rubro.length > 0 && (
            <BarrasHorizontales titulo="Búsquedas por rubro" buckets={aBuckets(stats.por_rubro)} />
          )}
          {stats.por_modalidad.length > 0 && (
            <BarrasHorizontales titulo="Por modalidad" buckets={aBuckets(stats.por_modalidad)} />
          )}
        </div>
      </div>
    </section>
  );
}
