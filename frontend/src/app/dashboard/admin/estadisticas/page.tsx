"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  BuildingOffice2Icon, UsersIcon, BriefcaseIcon, CheckCircleIcon, ClockIcon, DocumentTextIcon,
  ChatBubbleLeftRightIcon, CreditCardIcon, CurrencyDollarIcon, ArrowRightIcon,
} from "@heroicons/react/24/outline";
import type { Metrics } from "../types";

interface AdminMarketStats {
  total_busquedas: number;
  busquedas_con_salario: number;
  salario_promedio: number | null;
  salario_mediana: number | null;
  salario_min: number | null;
  salario_max: number | null;
  por_rubro: { label: string; count: number }[];
}

interface TrendPoint {
  date: string;
  jobs_created: number;
  applications: number;
}

interface Trends {
  points: TrendPoint[];
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[3px] h-6 mt-2">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: i === values.length - 1 ? color : `${color}55` }}
        />
      ))}
    </div>
  );
}

function TrendCard({
  label, values, total,
}: { label: string; values: number[]; total: number }) {
  const firstHalf = values.slice(0, Math.ceil(values.length / 2)).reduce((s, v) => s + v, 0);
  const secondHalf = values.slice(Math.ceil(values.length / 2)).reduce((s, v) => s + v, 0);
  const trendingUp = secondHalf >= firstHalf;

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-2xl font-display font-extrabold text-[#1C2230]">{total}</p>
        <span className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-full ${
          trendingUp ? "bg-green-50 text-green-700" : "bg-[#FAFBFD] text-[#64748B]"
        }`}>
          {trendingUp ? "↑" : "→"} 7 días
        </span>
      </div>
      <p className="text-xs text-[#64748B] font-medium mt-1">{label}</p>
      <Sparkline values={values} color="#1E8EA3" />
    </div>
  );
}

export default function AdminEstadisticasPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [marketStats, setMarketStats] = useState<AdminMarketStats | null>(null);

  useEffect(() => {
    api.get("/admin/dashboard").then(r => setMetrics(r.data)).catch(() => {});
    api.get("/admin/dashboard/trends").then(r => setTrends(r.data)).catch(() => {});
    api.get("/admin/market-stats").then(r => setMarketStats(r.data)).catch(() => {});
  }, []);

  const jobsSeries = trends?.points.map(p => p.jobs_created) ?? [];
  const appsSeries = trends?.points.map(p => p.applications) ?? [];
  const jobsTotal = jobsSeries.reduce((s, v) => s + v, 0);
  const appsTotal = appsSeries.reduce((s, v) => s + v, 0);

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Estadísticas</h1>
      <p className="text-[#64748B] text-sm mb-6">Métricas generales de la plataforma.</p>

      {/* Tendencia — últimos 7 días */}
      {trends && (
        <>
          <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Últimos 7 días</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <TrendCard label="Búsquedas nuevas publicadas" values={jobsSeries} total={jobsTotal} />
            <TrendCard label="Postulaciones recibidas" values={appsSeries} total={appsTotal} />
          </div>
        </>
      )}

      {/* Salario de mercado — vista interna, sin el filtro de "empresa eligió mostrarlo" ni
          el interruptor de la home (ver B2 del plan del 14/08). Es distinto del número
          público: acá se ve el mercado real para decidir qué publicar, no lo ya publicado. */}
      <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Salario de mercado (interno)</h2>
      {marketStats && (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm mb-8">
          {marketStats.busquedas_con_salario === 0 ? (
            <p className="text-sm text-[#64748B]">Ninguna búsqueda activa declara un sueldo todavía.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xl font-display font-extrabold text-[#1C2230]">
                    ${marketStats.salario_promedio?.toLocaleString("es-AR")}
                  </p>
                  <p className="text-xs text-[#64748B]">Promedio</p>
                </div>
                <div>
                  <p className="text-xl font-display font-extrabold text-[#1C2230]">
                    ${marketStats.salario_mediana?.toLocaleString("es-AR")}
                  </p>
                  <p className="text-xs text-[#64748B]">Mediana</p>
                </div>
                <div>
                  <p className="text-xl font-display font-extrabold text-[#1C2230]">
                    ${marketStats.salario_min?.toLocaleString("es-AR")}
                  </p>
                  <p className="text-xs text-[#64748B]">Mínimo</p>
                </div>
                <div>
                  <p className="text-xl font-display font-extrabold text-[#1C2230]">
                    ${marketStats.salario_max?.toLocaleString("es-AR")}
                  </p>
                  <p className="text-xs text-[#64748B]">Máximo</p>
                </div>
              </div>
              <p className="text-xs text-[#64748B] flex items-center gap-1.5 mb-1">
                <CurrencyDollarIcon className="w-3.5 h-3.5 text-[#1E8EA3] shrink-0" />
                Calculado sobre {marketStats.busquedas_con_salario} de {marketStats.total_busquedas} búsquedas activas que declaran sueldo
                {marketStats.busquedas_con_salario < 5 && " — muestra chica, tomalo como orientativo"}.
              </p>
              <p className="text-xs text-[#94A3B8]">
                Este número es interno — cuenta todas las búsquedas, publiquen o no el sueldo.{" "}
                <Link href="/dashboard/admin/indicadores" className="text-[#1E8EA3] font-semibold hover:underline inline-flex items-center gap-0.5">
                  El que ven las empresas y candidatos se controla desde Indicadores <ArrowRightIcon className="w-3 h-3" />
                </Link>
              </p>
            </>
          )}
        </div>
      )}

      {/* Estado general — agrupado por dominio */}
      <h2 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">Estado general</h2>
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Empresas", value: metrics.total_companies, icon: BuildingOffice2Icon, color: "text-[#1E8EA3]", bg: "bg-[#E6F4F7]" },
            { label: "Pendientes", value: metrics.pending_companies, icon: ClockIcon, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Verificadas", value: metrics.verified_companies, icon: CheckCircleIcon, color: "text-green-600", bg: "bg-green-50" },
            { label: "Candidatos", value: metrics.total_candidates, icon: UsersIcon, color: "text-[#B98F72]", bg: "bg-[#F7EFE9]" },
            { label: "Búsquedas", value: metrics.total_jobs, icon: BriefcaseIcon, color: "text-[#1E8EA3]", bg: "bg-[#E6F4F7]" },
            { label: "Búsquedas por revisar", value: metrics.pending_jobs, icon: ClockIcon, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Postulaciones", value: metrics.total_applications, icon: DocumentTextIcon, color: "text-[#1E8EA3]", bg: "bg-[#E6F4F7]" },
            { label: "Mensajes pendientes", value: metrics.pending_contact_messages, icon: ChatBubbleLeftRightIcon, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Ingresos por destacados", value: `$${metrics.total_revenue_featured.toLocaleString("es-AR")}`, icon: CreditCardIcon, color: "text-green-600", bg: "bg-green-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm hover:border-[#9ED4DF] transition-colors">
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-display font-extrabold text-[#1C2230]">{value}</p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
