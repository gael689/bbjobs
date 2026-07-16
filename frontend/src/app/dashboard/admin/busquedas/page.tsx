"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CheckCircleIcon, XCircleIcon, ClockIcon, BoltIcon } from "@heroicons/react/24/outline";
import ExpiryBadge from "@/components/ui/ExpiryBadge";
import { MODERATION_CLS, MODERATION_LABEL, type Job } from "../types";

export default function AdminBusquedasPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const toast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const fetchJobs = useCallback(() => {
    api.get("/admin/jobs").then(r => setJobs(r.data)).catch(() => toast("Error al cargar búsquedas", "error"));
  }, [toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  async function handleModerate(jobId: string, action: "approve" | "reject") {
    if (action === "reject") {
      setRejectModal(jobId);
      return;
    }
    setActionLoading(jobId + "approve");
    try {
      await api.patch(`/admin/jobs/${jobId}/moderate`, { action: "approve", notes: null });
      toast("Búsqueda aprobada y publicada");
      fetchJobs();
    } catch {
      toast("Error al aprobar", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectModal) return;
    setActionLoading(rejectModal + "reject");
    try {
      await api.patch(`/admin/jobs/${rejectModal}/moderate`, { action: "reject", notes: rejectNotes || null });
      toast("Búsqueda rechazada");
      fetchJobs();
    } catch {
      toast("Error al rechazar", "error");
    } finally {
      setActionLoading(null);
      setRejectModal(null);
      setRejectNotes("");
    }
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

  const pending = jobs.filter(j => j.moderation_status === "pending_review");

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

      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-display font-bold text-[#1C2230] mb-3">Rechazar búsqueda</h2>
            <p className="text-sm text-[#64748B] mb-4">Indicá el motivo del rechazo (opcional, se enviará a la empresa).</p>
            <textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              rows={3}
              placeholder="Motivo del rechazo..."
              className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectNotes(""); }}
                className="flex-1 border border-[#DDE3EC] text-[#64748B] font-bold rounded-xl py-2.5 text-sm hover:bg-[#FAFBFD]">
                Cancelar
              </button>
              <button onClick={handleRejectConfirm} disabled={!!actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-60">
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Búsquedas</h1>
      <p className="text-[#64748B] text-sm mb-6">Todas las búsquedas publicadas en la plataforma.</p>

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-center gap-3 mb-6">
          <ClockIcon className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            Hay <span className="font-bold">{pending.length}</span> búsqueda{pending.length > 1 ? "s" : ""} esperando revisión.
          </p>
        </div>
      )}

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#DDE3EC]/60">
        {jobs.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">Sin búsquedas publicadas.</div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="px-6 py-4 hover:bg-[#FAFBFD] transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[#1C2230]">{job.title}</p>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${MODERATION_CLS[job.moderation_status]}`}>
                      {MODERATION_LABEL[job.moderation_status]}
                    </span>
                    {job.is_featured && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#F7EFE9] text-[#C4A490] px-2.5 py-0.5 rounded-full border border-[#D4B7A2]/50">
                        <BoltIcon className="w-3.5 h-3.5" />Pagada — prioridad
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#64748B]">
                    {job.company_legal_name_snapshot}
                    {job.published_at && ` · ${new Date(job.published_at).toLocaleDateString("es-AR")}`}
                  </p>
                  {job.moderation_notes && job.moderation_status === "rejected" && (
                    <p className="text-xs text-red-600 mt-0.5">Nota: {job.moderation_notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <ExpiryBadge expiresAt={job.expires_at} status={job.status} />
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    job.status === "active" ? "bg-green-100 text-green-700" :
                    job.status === "paused" ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {job.status === "active" ? "Activa" : job.status === "paused" ? "Pausada" : job.status === "expired" ? "Vencida" : "Cerrada"}
                  </span>

                  {job.moderation_status === "pending_review" ? (
                    <>
                      <button
                        onClick={() => handleModerate(job.id, "reject")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-xs font-bold border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
                      >
                        <XCircleIcon className="w-3.5 h-3.5" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleModerate(job.id, "approve")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {actionLoading === job.id + "approve" ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : <CheckCircleIcon className="w-3.5 h-3.5" />}
                        Aprobar
                      </button>
                    </>
                  ) : job.status !== "closed" && job.status !== "expired" && (
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
