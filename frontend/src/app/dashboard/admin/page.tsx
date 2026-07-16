"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  BuildingOffice2Icon, UsersIcon, BriefcaseIcon, ChatBubbleLeftRightIcon,
  CreditCardIcon, ChartBarIcon, ArrowRightIcon, ClockIcon,
} from "@heroicons/react/24/outline";
import type { Metrics } from "./types";

interface HubCard {
  href: string;
  title: string;
  meta: string;
  icon: React.ElementType;
  tint: string;
  fg: string;
  pillWarn?: number;
}

export default function AdminInicioPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    api.get("/admin/dashboard").then(r => setMetrics(r.data)).catch(() => {});
  }, []);

  const pendingTotal = (metrics?.pending_companies ?? 0) + (metrics?.pending_jobs ?? 0);

  const cards: HubCard[] = metrics ? [
    {
      href: "/dashboard/admin/empresas", title: "Empresas",
      meta: `${metrics.verified_companies} verificadas`,
      icon: BuildingOffice2Icon, tint: "bg-[#E6F4F7]", fg: "text-[#187B8E]",
      pillWarn: metrics.pending_companies,
    },
    {
      href: "/dashboard/admin/candidatos", title: "Candidatos",
      meta: `${metrics.total_candidates} perfiles activos`,
      icon: UsersIcon, tint: "bg-[#F7EFE9]", fg: "text-[#B98F72]",
    },
    {
      href: "/dashboard/admin/busquedas", title: "Búsquedas",
      meta: `${metrics.total_jobs} publicadas · ${metrics.total_applications} postulaciones`,
      icon: BriefcaseIcon, tint: "bg-[#E6F4F7]", fg: "text-[#187B8E]",
      pillWarn: metrics.pending_jobs,
    },
    {
      href: "/dashboard/admin/mensajes", title: "Mensajes",
      meta: "Bandeja de contacto",
      icon: ChatBubbleLeftRightIcon, tint: "bg-[#F7EFE9]", fg: "text-[#B98F72]",
      pillWarn: metrics.pending_contact_messages,
    },
    {
      href: "/dashboard/admin/pagos", title: "Pagos",
      meta: `$${metrics.total_revenue_featured.toLocaleString("es-AR")} por destacados`,
      icon: CreditCardIcon, tint: "bg-green-50", fg: "text-green-700",
    },
    {
      href: "/dashboard/admin/estadisticas", title: "Estadísticas",
      meta: "Métricas generales de la plataforma",
      icon: ChartBarIcon, tint: "bg-[#E6F4F7]", fg: "text-[#187B8E]",
    },
  ] : [];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Inicio</h1>
      <p className="text-[#64748B] text-sm mb-6">Esto necesita tu atención hoy.</p>

      {metrics && pendingTotal > 0 && (
        <Link
          href={metrics.pending_jobs > 0 ? "/dashboard/admin/busquedas" : "/dashboard/admin/empresas"}
          className="group flex items-center justify-between gap-4 rounded-2xl px-6 py-5 mb-6 text-white shadow-sm transition-transform hover:-translate-y-0.5"
          style={{ background: "linear-gradient(120deg, #146678, #1E8EA3)" }}
        >
          <div className="flex items-center gap-3">
            <ClockIcon className="w-6 h-6 shrink-0 opacity-90" />
            <div>
              <p className="font-display font-bold text-[15.5px]">
                {pendingTotal} {pendingTotal === 1 ? "cosa espera" : "cosas esperan"} tu revisión
              </p>
              <p className="text-[13px] text-white/85 mt-0.5">
                {metrics.pending_jobs > 0 && `${metrics.pending_jobs} búsqueda${metrics.pending_jobs > 1 ? "s" : ""} por aprobar`}
                {metrics.pending_jobs > 0 && metrics.pending_companies > 0 && " · "}
                {metrics.pending_companies > 0 && `${metrics.pending_companies} empresa${metrics.pending_companies > 1 ? "s" : ""} por verificar`}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[13px] font-bold shrink-0">
            Revisar ahora <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ href, title, meta, icon: Icon, tint, fg, pillWarn }) => (
          <Link
            key={href}
            href={href}
            className="relative overflow-hidden bg-white border border-[#DDE3EC] rounded-2xl p-5 flex flex-col gap-2.5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
          >
            <div className={`w-10 h-10 rounded-xl ${tint} ${fg} flex items-center justify-center`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="font-display font-extrabold text-[15.5px] text-[#1C2230]">{title}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {!!pillWarn && (
                <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {pillWarn} pendiente{pillWarn > 1 ? "s" : ""}
                </span>
              )}
              <span className="text-xs text-[#64748B]">{meta}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
