"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { Job } from "../types";

export default function AdminBusquedasPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  function fetchJobs() {
    api.get("/admin/jobs").then(r => setJobs(r.data)).catch(() => toast("Error al cargar búsquedas", "error"));
  }

  function toast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function handleTakedown(jobId: string) {
    if (!confirm("¿Dar de baja esta búsqueda por incumplimiento?")) return;
    setActionLoading(jobId + "takedown");
    try {
      await api.patch(`/admin/jobs/${jobId}/takedown`);
      toast("Búsqueda dada de baja");
      fetchJobs();
    } catch {
      toast("Error al dar de baja", "error");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 border shadow-lg rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2 ${
          toastMsg.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-[#9ED4DF] text-[#1C2230]"
        }`}>
          {toastMsg.type === "error"
            ? <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" />
            : <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />}
          {toastMsg.text}
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Búsquedas</h1>
      <p className="text-[#64748B] text-sm mb-6">Todas las búsquedas publicadas en la plataforma.</p>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#DDE3EC]/60">
        {jobs.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">Sin búsquedas publicadas.</div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#FAFBFD] transition-colors">
              <div>
                <p className="font-bold text-[#1C2230]">{job.title}</p>
                <p className="text-sm text-[#64748B]">
                  {job.company_legal_name_snapshot}
                  {job.published_at && ` · ${new Date(job.published_at).toLocaleDateString("es-AR")}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  job.status === "active" ? "bg-green-100 text-green-700" :
                  job.status === "paused" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {job.status === "active" ? "Activa" : job.status === "paused" ? "Pausada" : "Cerrada"}
                </span>
                {job.status !== "closed" && (
                  <button
                    onClick={() => handleTakedown(job.id)}
                    disabled={actionLoading === job.id + "takedown"}
                    className="text-xs font-bold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    {actionLoading === job.id + "takedown" ? (
                      <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : "Dar de baja"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
