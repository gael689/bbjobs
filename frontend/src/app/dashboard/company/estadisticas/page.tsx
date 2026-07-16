"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BriefcaseIcon, UsersIcon, ClockIcon, ChartBarIcon, BoltIcon } from "@heroicons/react/24/outline";
import ExpiryBadge from "@/components/ui/ExpiryBadge";
import {
  APP_STATUS_LABEL, EDUCATION_LEVEL_LABEL, JOB_MODERATION_CLS, JOB_MODERATION_LABEL,
  FEATURED_JOB_PRICE,
  type Application, type ApplicantStats, type JobPosting,
} from "../types";

export default function CompanyEstadisticasPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [appsByJob, setAppsByJob] = useState<Record<string, Application[]>>({});
  const [applicantStats, setApplicantStats] = useState<ApplicantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [featureModalJob, setFeatureModalJob] = useState<JobPosting | null>(null);
  const [featuring, setFeaturing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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
    api.get("/me/company/applications/stats").then(r => setApplicantStats(r.data)).catch(() => {});
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function confirmFeature() {
    if (!featureModalJob) return;
    setFeaturing(true);
    try {
      const r = await api.post(`/me/company/jobs/${featureModalJob.id}/feature`);
      window.location.href = r.data.init_point;
    } catch {
      toast("Error al iniciar el pago");
      setFeaturing(false);
      setFeatureModalJob(null);
    }
  }

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
    <div className="px-4 sm:px-6 py-8 max-w-6xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230]">
          {toastMsg}
        </div>
      )}

      {featureModalJob && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-3">
              <BoltIcon className="w-5 h-5 text-[#D4B7A2]" />
              <h2 className="font-display font-bold text-[#1C2230]">Destacar búsqueda</h2>
            </div>
            <p className="text-sm text-[#64748B] mb-2">
              Vas a destacar <span className="font-bold text-[#1C2230]">&quot;{featureModalJob.title}&quot;</span> por{" "}
              <span className="font-bold text-[#1C2230]">${FEATURED_JOB_PRICE.toLocaleString("es-AR")} ARS</span>.
              El destacado dura mientras la búsqueda esté publicada — no hay reembolso si se cierra antes.
            </p>
            {featureModalJob.moderation_status && featureModalJob.moderation_status !== "approved" && (
              <p className="text-xs bg-[#E6F4F7] text-[#1C2230] rounded-lg px-3 py-2 mb-2">
                Esta búsqueda todavía está pendiente de aprobación — se va a mostrar destacada apenas
                Talency la apruebe, y mientras tanto gana prioridad de revisión.
              </p>
            )}
            <p className="text-sm text-[#64748B] mb-4">Vas a ser redirigido a Mercado Pago para completar el pago.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setFeatureModalJob(null)}
                disabled={featuring}
                className="flex-1 border border-[#DDE3EC] text-[#64748B] font-bold rounded-xl py-2.5 text-sm hover:bg-[#FAFBFD] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={confirmFeature}
                disabled={featuring}
                className="flex-1 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-60"
              >
                {featuring ? "Redirigiendo..." : "Ir a pagar"}
              </button>
            </div>
          </div>
        </div>
      )}

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            {applicantStats && applicantStats.total > 0 && (
              <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-[#1C2230] mb-4">Perfil de postulantes (todas las búsquedas)</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-3 text-center">
                    <p className="text-lg font-display font-extrabold text-[#1E8EA3]">
                      {applicantStats.avg_age != null ? applicantStats.avg_age : "—"}
                    </p>
                    <p className="text-[11px] text-[#64748B] font-medium mt-0.5">Edad prom.</p>
                  </div>
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-3 text-center">
                    <p className="text-lg font-display font-extrabold text-[#1E8EA3]">
                      {applicantStats.avg_experience_years != null ? `${applicantStats.avg_experience_years}a` : "—"}
                    </p>
                    <p className="text-[11px] text-[#64748B] font-medium mt-0.5">Experiencia</p>
                  </div>
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-3 text-center">
                    <p className="text-lg font-display font-extrabold text-[#1E8EA3]">{applicantStats.immediate_availability_count}</p>
                    <p className="text-[11px] text-[#64748B] font-medium mt-0.5">Disp. inmediata</p>
                  </div>
                </div>
                {Object.keys(applicantStats.education_distribution).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Título alcanzado</p>
                    <div className="space-y-1.5">
                      {Object.entries(applicantStats.education_distribution).map(([level, count]) => (
                        <div key={level} className="flex items-center gap-2">
                          <span className="text-xs text-[#1C2230] w-24 shrink-0">{EDUCATION_LEVEL_LABEL[level] || level}</span>
                          <div className="flex-1 h-2 bg-[#EEF2F7] rounded-full overflow-hidden">
                            <div className="h-full bg-[#1E8EA3] rounded-full" style={{ width: `${(count / applicantStats.total) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-[#1C2230] w-6 text-right">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  <div key={job.id} className="px-6 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-sm font-medium text-[#1C2230] truncate">{job.title}</span>
                      {job.moderation_status && job.moderation_status !== "approved" && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${JOB_MODERATION_CLS[job.moderation_status]}`}>
                          {JOB_MODERATION_LABEL[job.moderation_status]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ExpiryBadge expiresAt={job.expires_at} status={job.status} />
                      {job.is_featured ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#D4B7A2]/25 text-[#1C2230] border border-[#D4B7A2] px-2.5 py-1 rounded-full">
                          <BoltIcon className="w-3.5 h-3.5" />
                          Destacada
                          {job.featured_until && ` · hasta ${new Date(job.featured_until).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`}
                        </span>
                      ) : job.status !== "closed" && job.status !== "expired" && (
                        <button
                          onClick={() => setFeatureModalJob(job)}
                          className="inline-flex items-center gap-1 text-xs font-bold border border-[#D4B7A2] text-[#1C2230] px-2.5 py-1 rounded-full hover:bg-[#D4B7A2]/10 transition-colors"
                        >
                          <BoltIcon className="w-3.5 h-3.5 text-[#D4B7A2]" />
                          Destacar — ${FEATURED_JOB_PRICE.toLocaleString("es-AR")}
                        </button>
                      )}
                      <span className="text-sm font-bold text-[#1E8EA3]">{(appsByJob[job.id] || []).length}</span>
                    </div>
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
