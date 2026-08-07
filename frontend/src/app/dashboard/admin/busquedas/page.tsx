"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  CheckCircleIcon, XCircleIcon, BoltIcon, PencilIcon, TrashIcon,
  UserCircleIcon, XMarkIcon,
} from "@heroicons/react/24/outline";
import ExpiryBadge from "@/components/ui/ExpiryBadge";
import ProfileCompletionRing from "@/components/ui/ProfileCompletionRing";
import CandidateProfileModal, { type CandidateProfileModalData } from "@/components/dashboard/CandidateProfileModal";
import {
  MODERATION_CLS, MODERATION_LABEL, MODALITY_LABEL,
  CANDIDATE_GENDER_LABEL, CANDIDATE_AVAILABILITY_LABEL,
  type Job, type AdminApplication,
} from "../types";

type FilterTab = "all" | "pending_review" | "approved" | "rejected";

interface EditForm {
  title: string;
  description: string;
  modality: string;
  duration_days: number;
}

export default function AdminBusquedasPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [applicantsByJob, setApplicantsByJob] = useState<Record<string, AdminApplication[]>>({});
  const [viewProfile, setViewProfile] = useState<CandidateProfileModalData | null>(null);
  const [loadingViewProfile, setLoadingViewProfile] = useState(false);
  // Sin flag de loading aparte — "está cargando" se deriva de que selectedId todavía no tiene
  // entrada en el cache (evita un setState síncrono dentro del efecto de abajo).
  const applicantsLoading = !!selectedId && !applicantsByJob[selectedId];

  const toast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // `loading` arranca en `true` (useState arriba) y sólo se apaga async en el .finally — nunca
  // se vuelve a prender sincrónicamente, así que fetchJobs es seguro de llamar directo desde
  // un efecto sin disparar el lint de set-state-in-effect.
  const fetchJobs = useCallback((keepSelection = true) => {
    api.get("/admin/jobs").then(r => {
      const data: Job[] = r.data;
      setJobs(data);
      if (!keepSelection || !data.some(j => j.id === selectedId)) {
        const firstPending = data.find(j => j.moderation_status === "pending_review");
        setSelectedId((firstPending ?? data[0])?.id ?? null);
      }
    }).catch(() => toast("Error al cargar búsquedas", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  useEffect(() => {
    fetchJobs(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectJob = useCallback((jobId: string) => {
    setSelectedId(jobId);
    setEditing(false);
  }, []);

  // Única fuente de fetch de postulantes — dispara al cambiar de búsqueda seleccionada
  // (por click en la lista o por la auto-selección de fetchJobs), cacheado por id.
  useEffect(() => {
    if (selectedId && !applicantsByJob[selectedId]) {
      api.get(`/admin/jobs/${selectedId}/applications`)
        .then(r => setApplicantsByJob(prev => ({ ...prev, [selectedId]: r.data })))
        .catch(() => setApplicantsByJob(prev => ({ ...prev, [selectedId]: [] })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const filteredJobs = useMemo(() => {
    if (filterTab === "all") return jobs;
    return jobs.filter(j => j.moderation_status === filterTab);
  }, [jobs, filterTab]);

  const selectedJob = jobs.find(j => j.id === selectedId) ?? null;
  const applicants = selectedId ? applicantsByJob[selectedId] ?? [] : [];

  const pendingCount = jobs.filter(j => j.moderation_status === "pending_review").length;

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

  /** Destaca o quita el destacado sin pago — para canjes y cortesías. El backend rechaza
   *  quitarlo si hay un destacado pago activo, así no se apaga algo que la empresa pagó. */
  async function handleFeature(jobId: string, featured: boolean) {
    const notes = featured
      ? prompt("¿Por qué se destaca sin cobrar? (canje, cortesía, compensación)") ?? ""
      : "";
    if (featured && !notes.trim()) return;

    setActionLoading(jobId + "feature");
    try {
      await api.patch(`/admin/jobs/${jobId}/feature`, { featured, notes: notes.trim() || null });
      toast(featured ? "Búsqueda destacada" : "Destacado quitado");
      fetchJobs();
    } catch (e: unknown) {
      const detalle = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast(detalle || "Error al cambiar el destacado", "error");
    } finally {
      setActionLoading(null);
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

  function startEdit(job: Job) {
    setEditForm({
      title: job.title,
      description: job.description,
      modality: job.modality,
      duration_days: job.duration_days,
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!selectedId || !editForm) return;
    setActionLoading(selectedId + "edit");
    try {
      await api.patch(`/admin/jobs/${selectedId}`, editForm);
      toast("Búsqueda actualizada");
      setEditing(false);
      fetchJobs();
    } catch {
      toast("Error al guardar los cambios", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function openCandidateProfile(candidateId: string) {
    setLoadingViewProfile(true);
    setViewProfile(null);
    try {
      const r = await api.get(`/admin/candidates/${candidateId}`);
      setViewProfile(r.data);
    } catch {
      toast("Error al cargar el perfil del candidato", "error");
    } finally {
      setLoadingViewProfile(false);
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm("¿Eliminar esta búsqueda? No se puede deshacer — desaparece del portal, de tu panel y del de la empresa.")) return;
    setActionLoading(jobId + "delete");
    try {
      await api.delete(`/admin/jobs/${jobId}`);
      toast("Búsqueda eliminada");
      fetchJobs(false);
    } catch {
      toast("Error al eliminar", "error");
    } finally {
      setActionLoading(null);
    }
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending_review", label: "Por revisar" },
    { key: "approved", label: "Aprobadas" },
    { key: "rejected", label: "Rechazadas" },
  ];

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

      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-2xl font-display font-bold text-[#1C2230]">Búsquedas y postulantes</h1>
      </div>
      <p className="text-[#64748B] text-sm mb-6">
        {jobs.length} búsqueda{jobs.length !== 1 ? "s" : ""}
        {pendingCount > 0 && <> · <span className="text-amber-600 font-semibold">{pendingCount} por revisar</span></>}
      </p>

      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilterTab(t.key)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors ${
              filterTab === t.key ? "bg-[#1E8EA3] text-white" : "bg-white border border-[#DDE3EC] text-[#64748B] hover:border-[#9ED4DF]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-12 text-center text-[#64748B]">
          Sin búsquedas publicadas.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
          {/* Lista */}
          <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm max-h-[70vh] overflow-y-auto">
            {filteredJobs.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#64748B]">Nada en esta categoría.</div>
            ) : (
              filteredJobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => selectJob(job.id)}
                  className={`w-full text-left px-4 py-3.5 border-b border-[#DDE3EC]/70 last:border-b-0 transition-colors ${
                    job.id === selectedId ? "bg-[#E6F4F7] shadow-[inset_3px_0_0_#1E8EA3]" : "hover:bg-[#FAFBFD]"
                  }`}
                >
                  <p className="font-bold text-[13.5px] text-[#1C2230] truncate">{job.title}</p>
                  <p className="text-xs text-[#64748B] truncate mt-0.5">{job.company_legal_name_snapshot}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${MODERATION_CLS[job.moderation_status]}`}>
                      {MODERATION_LABEL[job.moderation_status]}
                    </span>
                    {job.is_featured && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-[#F7EFE9] text-[#B98F72] px-2 py-0.5 rounded-full">
                        <BoltIcon className="w-3 h-3" />Destacada
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detalle */}
          <div className="bg-white border border-[#DDE3EC] rounded-2xl shadow-sm p-6 min-h-[70vh]">
            {!selectedJob ? (
              <div className="h-full flex items-center justify-center text-sm text-[#64748B]">
                Elegí una búsqueda de la lista.
              </div>
            ) : editing && editForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg text-[#1C2230]">Editar búsqueda</h2>
                  <button onClick={() => setEditing(false)} className="text-[#64748B] hover:text-[#1C2230]">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1C2230] mb-1.5">Título</label>
                  <input
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full border border-[#DDE3EC] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#1E8EA3]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1C2230] mb-1.5">El aviso</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    rows={12}
                    className="w-full border border-[#DDE3EC] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#1E8EA3] leading-relaxed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#1C2230] mb-1.5">Modalidad</label>
                    <select
                      value={editForm.modality}
                      onChange={e => setEditForm({ ...editForm, modality: e.target.value })}
                      className="w-full border border-[#DDE3EC] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#1E8EA3]"
                    >
                      <option value="presencial">Presencial</option>
                      <option value="remoto">Remoto</option>
                      <option value="híbrido">Híbrido</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#1C2230] mb-1.5">Duración (días)</label>
                    <input
                      type="number" min={1} max={20}
                      value={editForm.duration_days}
                      onChange={e => setEditForm({ ...editForm, duration_days: Number(e.target.value) })}
                      className="w-full border border-[#DDE3EC] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#1E8EA3]"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditing(false)}
                    className="flex-1 border border-[#DDE3EC] text-[#64748B] font-bold rounded-xl py-2.5 text-sm hover:bg-[#FAFBFD]">
                    Cancelar
                  </button>
                  <button onClick={handleSaveEdit} disabled={actionLoading === selectedId + "edit"}
                    className="flex-1 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-60">
                    {actionLoading === selectedId + "edit" ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-[#DDE3EC] pb-4 mb-4 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-lg text-[#1C2230]">{selectedJob.title}</h2>
                    <p className="text-sm text-[#64748B] mt-0.5">
                      {selectedJob.company_legal_name_snapshot}
                      {selectedJob.published_at && ` · Publicada ${new Date(selectedJob.published_at).toLocaleDateString("es-AR")}`}
                      {` · ${MODALITY_LABEL[selectedJob.modality] || selectedJob.modality}`}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${MODERATION_CLS[selectedJob.moderation_status]}`}>
                        {MODERATION_LABEL[selectedJob.moderation_status]}
                      </span>
                      <ExpiryBadge expiresAt={selectedJob.expires_at} status={selectedJob.status} />
                      {selectedJob.is_featured && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#F7EFE9] text-[#B98F72] px-2.5 py-0.5 rounded-full border border-[#D4B7A2]/50">
                          <BoltIcon className="w-3.5 h-3.5" />Destacada
                        </span>
                      )}
                    </div>
                    {selectedJob.moderation_notes && selectedJob.moderation_status === "rejected" && (
                      <p className="text-xs text-red-600 mt-2">Nota de rechazo: {selectedJob.moderation_notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {selectedJob.moderation_status === "pending_review" && (
                      <>
                        <button
                          onClick={() => handleModerate(selectedJob.id, "reject")}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                        >
                          <XCircleIcon className="w-3.5 h-3.5" />Rechazar
                        </button>
                        <button
                          onClick={() => handleModerate(selectedJob.id, "approve")}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {actionLoading === selectedJob.id + "approve" ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : <CheckCircleIcon className="w-3.5 h-3.5" />}
                          Aprobar
                        </button>
                      </>
                    )}
                    {selectedJob.status !== "closed" && selectedJob.status !== "expired" && (
                      <button
                        onClick={() => handleFeature(selectedJob.id, !selectedJob.is_featured)}
                        disabled={actionLoading === selectedJob.id + "feature"}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                          selectedJob.is_featured
                            ? "bg-[#F7EFE9] text-[#8A6A54] border border-[#D4B7A2]"
                            : "bg-[#D4B7A2] hover:bg-[#C4A692] text-[#1C2230]"
                        }`}
                      >
                        <BoltIcon className="w-3.5 h-3.5" />
                        {actionLoading === selectedJob.id + "feature"
                          ? "..."
                          : selectedJob.is_featured ? "Quitar destacado" : "Destacar sin cargo"}
                      </button>
                    )}
                    {selectedJob.status !== "closed" && selectedJob.status !== "expired" && (
                      <button
                        onClick={() => handleTakedown(selectedJob.id)}
                        disabled={actionLoading === selectedJob.id + "takedown"}
                        className="text-xs font-bold bg-[#64748B] hover:bg-[#54606F] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {actionLoading === selectedJob.id + "takedown" ? "..." : "Dar de baja"}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(selectedJob)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#1C2230] hover:bg-[#111621] text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <PencilIcon className="w-3.5 h-3.5" />Editar
                    </button>
                    <button
                      onClick={() => handleDelete(selectedJob.id)}
                      disabled={actionLoading === selectedJob.id + "delete"}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />Eliminar
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-4 py-3">
                    <p className="text-lg font-display font-extrabold text-[#1C2230]">{applicants.length}</p>
                    <p className="text-[11px] text-[#64748B]">Postulantes</p>
                  </div>
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-4 py-3">
                    <p className="text-lg font-display font-extrabold text-[#1C2230]">
                      {(() => {
                        const ages = applicants.map(a => a.candidate?.age).filter((a): a is number => !!a);
                        return ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : "—";
                      })()}
                    </p>
                    <p className="text-[11px] text-[#64748B]">Edad promedio</p>
                  </div>
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-4 py-3">
                    <p className="text-lg font-display font-extrabold text-[#1C2230]">
                      {(() => {
                        const p = applicants.map(a => a.candidate?.completion_percent).filter((p): p is number => p !== undefined);
                        return p.length ? `${Math.round(p.reduce((s, x) => s + x, 0) / p.length)}%` : "—";
                      })()}
                    </p>
                    <p className="text-[11px] text-[#64748B]">Perfil completo prom.</p>
                  </div>
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-4 py-3">
                    <p className="text-lg font-display font-extrabold text-[#1C2230]">
                      {selectedJob.salary_visible && selectedJob.salary_min
                        ? `${selectedJob.salary_currency || "ARS"} ${selectedJob.salary_min.toLocaleString("es-AR")}`
                        : "No visible"}
                    </p>
                    <p className="text-[11px] text-[#64748B]">Salario</p>
                  </div>
                </div>

                {/* El aviso completo — sin esto la moderación es a ciegas: hay que poder leer
                    lo que la empresa escribió antes de aprobar o rechazar. */}
                <div className="border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] p-5 mb-6">
                  <h3 className="font-display font-bold text-sm text-[#1C2230] mb-2">Aviso completo</h3>
                  <div className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line">
                    {selectedJob.description?.trim() || (
                      <span className="text-[#64748B] italic">Esta búsqueda no tiene descripción cargada.</span>
                    )}
                  </div>
                </div>

                {/* Postulantes */}
                <h3 className="font-display font-bold text-sm text-[#1C2230] mb-3">Postulantes</h3>
                {applicantsLoading ? (
                  <div className="py-8 flex justify-center">
                    <div className="w-5 h-5 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : applicants.length === 0 ? (
                  <p className="text-sm text-[#64748B]">Todavía no hay postulantes.</p>
                ) : (
                  <div className="divide-y divide-[#DDE3EC]/60">
                    {applicants.map(app => (
                      <div key={app.id} className="flex items-center gap-3 py-3">
                        {app.candidate ? (
                          <ProfileCompletionRing percent={app.candidate.completion_percent} size={34} strokeWidth={4} />
                        ) : (
                          <UserCircleIcon className="w-8 h-8 text-[#DDE3EC]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[13.5px] text-[#1C2230] truncate">
                            {app.candidate ? `${app.candidate.first_name} ${app.candidate.last_name}` : "Candidato eliminado"}
                          </p>
                          <p className="text-[11.5px] text-[#64748B] truncate">
                            {app.candidate?.age && `${app.candidate.age} años · `}
                            {app.candidate?.gender && `${CANDIDATE_GENDER_LABEL[app.candidate.gender]} · `}
                            {app.candidate?.availability && `${CANDIDATE_AVAILABILITY_LABEL[app.candidate.availability]} · `}
                            Postuló {new Date(app.created_at).toLocaleDateString("es-AR")}
                          </p>
                        </div>
                        {app.candidate && (
                          <button
                            onClick={() => openCandidateProfile(app.candidate!.id)}
                            className="shrink-0 text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E] px-2.5 py-1.5 rounded-lg hover:bg-[#E6F4F7] transition-colors"
                          >
                            Ver perfil
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <CandidateProfileModal
        profile={viewProfile}
        loading={loadingViewProfile}
        onClose={() => setViewProfile(null)}
        cvLinkEndpoint={viewProfile ? `/admin/candidates/${viewProfile.id}/cv/link` : undefined}
        showCompletion
      />
    </div>
  );
}
