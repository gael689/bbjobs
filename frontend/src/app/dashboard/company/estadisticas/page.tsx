"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BriefcaseIcon, UsersIcon, ClockIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import { APP_STATUS_LABEL, type Application, type JobPosting } from "../types";

export default function CompanyEstadisticasPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [appsByJob, setAppsByJob] = useState<Record<string, Application[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/me/company/jobs").then(async (r) => {
      const jobList: JobPosting[] = r.data;
      setJobs(jobList);
      const results = await Promise.all(
        jobList.map(j =>
          api.get(`/me/company/jobs/${j.id}/applications`).then(res => [j.id, res.data] as const).catch(() => [j.id, []] as const)
        )
      );
      setAppsByJob(Object.fromEntries(results));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const allApps = Object.values(appsByJob).flat();
  const activeCount = jobs.filter(j => j.status === "active").length;
  const pausedCount = jobs.filter(j => j.status === "paused").length;
  const closedCount = jobs.filter(j => j.status === "closed").length;

  const statusBreakdown: Record<string, number> = {};
  for (const app of allApps) {
    statusBreakdown[app.status] = (statusBreakdown[app.status] || 0) + 1;
  }

  // Aproximación: promedio de tiempo hasta "contacted" sobre postulaciones que
  // actualmente están en ese estado (no trackea el historial completo de transiciones).
  const contactedApps = allApps.filter(a => a.status === "contacted" && (a as unknown as { status_updated_at?: string }).status_updated_at);
  let avgDaysToContact: number | null = null;
  if (contactedApps.length > 0) {
    const totalMs = contactedApps.reduce((sum, a) => {
      const updated = new Date((a as unknown as { status_updated_at: string }).status_updated_at).getTime();
      const created = new Date(a.created_at).getTime();
      return sum + Math.max(0, updated - created);
    }, 0);
    avgDaysToContact = totalMs / contactedApps.length / (1000 * 60 * 60 * 24);
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Estadísticas</h1>
      <p className="text-[#64748B] text-sm mb-6">Resumen de tus búsquedas y postulaciones.</p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
              <div className="w-9 h-9 bg-[#E6F4F7] rounded-lg flex items-center justify-center mb-3">
                <BriefcaseIcon className="w-5 h-5 text-[#1E8EA3]" />
              </div>
              <p className="text-2xl font-display font-extrabold text-[#1C2230]">{jobs.length}</p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">Búsquedas totales</p>
            </div>
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
              <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3">
                <ChartBarIcon className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-display font-extrabold text-[#1C2230]">{activeCount}</p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">Activas ({pausedCount} pausadas, {closedCount} cerradas)</p>
            </div>
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
              <div className="w-9 h-9 bg-[#E6F4F7] rounded-lg flex items-center justify-center mb-3">
                <UsersIcon className="w-5 h-5 text-[#1E8EA3]" />
              </div>
              <p className="text-2xl font-display font-extrabold text-[#1C2230]">{allApps.length}</p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">Postulaciones totales</p>
            </div>
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
              <div className="w-9 h-9 bg-[#E6F4F7] rounded-lg flex items-center justify-center mb-3">
                <ClockIcon className="w-5 h-5 text-[#1E8EA3]" />
              </div>
              <p className="text-2xl font-display font-extrabold text-[#1C2230]">
                {avgDaysToContact !== null ? `${avgDaysToContact.toFixed(1)}d` : "—"}
              </p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">Prom. a contactado</p>
            </div>
          </div>

          <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
            <h3 className="text-sm font-bold text-[#1C2230] mb-4">Postulaciones por estado</h3>
            {allApps.length === 0 ? (
              <p className="text-sm text-[#64748B]">Todavía no recibiste postulaciones.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(statusBreakdown).map(([status, count]) => {
                  const meta = APP_STATUS_LABEL[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meta.cls}`}>{meta.label}</span>
                      <span className="text-sm font-bold text-[#1C2230]">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#DDE3EC] bg-[#FAFBFD]">
              <h3 className="text-sm font-bold text-[#1C2230]">Postulaciones por búsqueda</h3>
            </div>
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#64748B]">Todavía no publicaste ninguna búsqueda.</div>
            ) : (
              <div className="divide-y divide-[#DDE3EC]">
                {jobs.map(job => (
                  <div key={job.id} className="px-6 py-3.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-[#1C2230] truncate">{job.title}</span>
                    <span className="text-sm font-bold text-[#1E8EA3] shrink-0 ml-3">{(appsByJob[job.id] || []).length}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
