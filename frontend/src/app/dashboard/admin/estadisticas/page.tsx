"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BuildingOffice2Icon, UsersIcon, BriefcaseIcon, CheckCircleIcon, ClockIcon, DocumentTextIcon,
} from "@heroicons/react/24/outline";
import type { Metrics } from "../types";

export default function AdminEstadisticasPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    api.get("/admin/dashboard").then(r => setMetrics(r.data)).catch(() => {});
  }, []);

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Estadísticas</h1>
      <p className="text-[#64748B] text-sm mb-6">Métricas generales de la plataforma.</p>

      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Empresas", value: metrics.total_companies, icon: BuildingOffice2Icon, color: "text-[#1E8EA3]", bg: "bg-[#E6F4F7]" },
            { label: "Pendientes", value: metrics.pending_companies, icon: ClockIcon, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Verificadas", value: metrics.verified_companies, icon: CheckCircleIcon, color: "text-green-600", bg: "bg-green-50" },
            { label: "Candidatos", value: metrics.total_candidates, icon: UsersIcon, color: "text-[#1E8EA3]", bg: "bg-[#E6F4F7]" },
            { label: "Búsquedas", value: metrics.total_jobs, icon: BriefcaseIcon, color: "text-[#1E8EA3]", bg: "bg-[#E6F4F7]" },
            { label: "Postulaciones", value: metrics.total_applications, icon: DocumentTextIcon, color: "text-[#1E8EA3]", bg: "bg-[#E6F4F7]" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
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
