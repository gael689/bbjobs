"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PaperAirplaneIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import PanelEstadisticas from "@/components/stats/PanelEstadisticas";
import { APP_STATUS, type Application, type ApplicationHistoryItem, type Job } from "../types";
import type { ApplicantStats } from "@/app/dashboard/company/types";

/** Lo que devuelve /me/candidate/applications/{id}/comparison: los mismos gráficos que ve la
 *  empresa, más las franjas propias para resaltarlas. */
interface Comparativa {
  stats: ApplicantStats;
  mi_franja_edad?: string | null;
  mi_franja_experiencia?: string | null;
  mi_educacion?: string | null;
  mis_habilidades: string[];
}

export default function CandidatePostulacionesPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, ApplicationHistoryItem[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);
  const [comparativas, setComparativas] = useState<Record<string, Comparativa | null>>({});
  const [cargandoComparativa, setCargandoComparativa] = useState<string | null>(null);

  useEffect(() => {
    api.get("/me/candidate/applications").then(r => setApplications(r.data)).catch(() => {});
    api.get("/jobs?page_size=100").then(r => setJobs(r.data.items)).catch(() => {});
  }, []);

  /** Pide la comparativa una sola vez por postulación. Si el backend responde 404 es porque
   *  Talency todavía no publicó las estadísticas — se cachea el null y no se vuelve a pedir. */
  function cargarComparativa(appId: string) {
    if (appId in comparativas) return;
    setCargandoComparativa(appId);
    api.get(`/me/candidate/applications/${appId}/comparison`)
      .then(r => setComparativas(prev => ({ ...prev, [appId]: r.data })))
      .catch(() => setComparativas(prev => ({ ...prev, [appId]: null })))
      .finally(() => setCargandoComparativa(null));
  }

  function toggleHistory(appId: string) {
    if (expanded === appId) {
      setExpanded(null);
      return;
    }
    setExpanded(appId);
    cargarComparativa(appId);
    if (!history[appId]) {
      setLoadingHistory(appId);
      api.get(`/me/candidate/applications/${appId}/history`)
        .then(r => setHistory(prev => ({ ...prev, [appId]: r.data })))
        .catch(() => setHistory(prev => ({ ...prev, [appId]: [] })))
        .finally(() => setLoadingHistory(null));
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Mis postulaciones</h1>
      <p className="text-[#64748B] text-sm mb-6">Seguimiento del estado de tus postulaciones.</p>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden">
        {applications.length === 0 ? (
          <div className="p-12 text-center">
            <PaperAirplaneIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-4" />
            <p className="text-[#64748B] font-medium mb-5">Aún no te postulaste a ninguna búsqueda.</p>
            <Link
              href="/dashboard/candidate/empleos"
              className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-full px-6 py-2.5 text-sm hover:bg-[#187B8E] transition-colors"
            >
              Explorar empleos
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]">
            {applications.map(app => {
              const job = jobs.find(j => j.id === app.job_posting_id);
              const st = APP_STATUS[app.status] || { label: app.status, cls: "bg-gray-100 text-gray-600" };
              const isExpanded = expanded === app.id;
              return (
                <div key={app.id}>
                  <button
                    onClick={() => toggleHistory(app.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#FAFBFD] transition-colors text-left"
                  >
                    <div>
                      <p className="font-bold text-[#1C2230]">{job?.title || "Búsqueda"}</p>
                      <p className="text-sm text-[#64748B]">
                        {job?.company_legal_name_snapshot} · {new Date(app.created_at).toLocaleDateString("es-AR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                      {isExpanded ? <ChevronUpIcon className="w-4 h-4 text-[#64748B]" /> : <ChevronDownIcon className="w-4 h-4 text-[#64748B]" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-4 bg-[#FAFBFD]">
                      {loadingHistory === app.id ? (
                        <div className="py-4 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (history[app.id] || []).length === 0 ? (
                        <p className="text-xs text-[#64748B] py-2">Sin historial disponible.</p>
                      ) : (
                        <div className="pt-2 space-y-2">
                          {(history[app.id] || []).map(h => {
                            const label = APP_STATUS[h.to_status]?.label || h.to_status;
                            return (
                              <div key={h.id} className="flex items-center gap-2 text-xs text-[#64748B]">
                                <ClockIcon className="w-3.5 h-3.5 text-[#9ED4DF] shrink-0" />
                                <span className="font-semibold text-[#1C2230]">{label}</span>
                                <span>· {new Date(h.created_at).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Comparativa contra el resto de los postulantes de ESTA vacante.
                          Nunca contra todo el portal: mezclar un aviso de depósito con uno de
                          sistemas haría que el número no signifique nada. */}
                      {cargandoComparativa === app.id ? (
                        <div className="py-6 flex justify-center">
                          <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : comparativas[app.id] ? (
                        <div className="pt-5 mt-4 border-t border-[#DDE3EC]">
                          <div className="flex items-center gap-2 mb-3">
                            <ChartBarIcon className="w-4 h-4 text-[#1E8EA3]" />
                            <p className="text-sm font-bold text-[#1C2230]">Cómo te comparás con los demás postulantes</p>
                          </div>
                          <PanelEstadisticas
                            stats={comparativas[app.id]!.stats}
                            mio={{
                              franjaEdad: comparativas[app.id]!.mi_franja_edad,
                              franjaExperiencia: comparativas[app.id]!.mi_franja_experiencia,
                              educacion: comparativas[app.id]!.mi_educacion,
                              habilidades: comparativas[app.id]!.mis_habilidades,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
