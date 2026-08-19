"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  CheckCircleIcon, XCircleIcon, BoltIcon, PencilIcon, PauseIcon, PlayIcon,
  UserCircleIcon, XMarkIcon, ArrowRightIcon,
} from "@heroicons/react/24/outline";
import ExpiryBadge from "@/components/ui/ExpiryBadge";
import { useListaPaginada } from "@/hooks/useListaPaginada";
import CandidateProfileModal, { type CandidateProfileModalData } from "@/components/dashboard/CandidateProfileModal";
import {
  JOB_MODERATION_CLS, JOB_MODERATION_LABEL, FEATURED_JOB_PRICE,
  type Application, type JobPosting,
} from "../types";

type FilterTab = "all" | "active" | "paused" | "closed";

interface EditForm {
  title: string;
  description: string;
  modality: string;
  duration_days: number;
}

export default function CompanyBusquedasPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [featureModal, setFeatureModal] = useState<JobPosting | null>(null);
  const [featuring, setFeaturing] = useState(false);

  const [viewProfile, setViewProfile] = useState<CandidateProfileModalData | null>(null);
  const [loadingViewProfile, setLoadingViewProfile] = useState(false);

  const toast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const fetchJobs = useCallback((keepSelection = true) => {
    api.get("/me/company/jobs").then(r => {
      const data: JobPosting[] = r.data;
      setJobs(data);
      if (!keepSelection || !data.some(j => j.id === selectedId)) {
        setSelectedId(data[0]?.id ?? null);
      }
    }).catch(() => toast("Error al cargar tus búsquedas", "error"))
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

  // Acá los postulantes son un vistazo, no la pantalla de trabajo: se muestran los 6 últimos y
  // el link manda a Postulaciones, que sí filtra y pagina. Pidiendo page_size=6 el vistazo
  // deja de bajar la lista entera para mostrar seis, y el "cuántos son" sale del `total`.
  const postulantes = useListaPaginada<Application>(
    selectedId ? `/me/company/jobs/${selectedId}/applications` : null,
    {},
    { pageSize: 6 },
  );
  const applicants = postulantes.items;

  const filteredJobs = useMemo(() => {
    if (filterTab === "all") return jobs;
    return jobs.filter(j => j.status === filterTab);
  }, [jobs, filterTab]);

  const selectedJob = jobs.find(j => j.id === selectedId) ?? null;

  async function handleStatusChange(jobId: string, status: string) {
    setActionLoading(jobId + status);
    try {
      await api.patch(`/me/company/jobs/${jobId}`, { status });
      toast(status === "paused" ? "Búsqueda pausada" : status === "active" ? "Búsqueda reactivada" : "Búsqueda cerrada");
      fetchJobs();
    } catch {
      toast("Error al actualizar el estado", "error");
    } finally {
      setActionLoading(null);
    }
  }

  function startEdit(job: JobPosting) {
    setEditForm({
      title: job.title,
      description: job.description,
      modality: job.modality,
      duration_days: job.duration_days ?? 20,
    });
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!selectedId || !editForm) return;
    setActionLoading(selectedId + "edit");
    try {
      await api.patch(`/me/company/jobs/${selectedId}`, editForm);
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
      const r = await api.get(`/me/company/candidates/${candidateId}`);
      setViewProfile(r.data);
    } catch {
      toast("Error al cargar el perfil del candidato", "error");
    } finally {
      setLoadingViewProfile(false);
    }
  }

  async function confirmFeature() {
    if (!featureModal) return;
    setFeaturing(true);
    try {
      const r = await api.post(`/me/company/jobs/${featureModal.id}/feature`);
      window.location.href = r.data.init_point;
    } catch {
      toast("Error al iniciar el pago del destacado", "error");
      setFeaturing(false);
      setFeatureModal(null);
    }
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "active", label: "Activas" },
    { key: "paused", label: "Pausadas" },
    { key: "closed", label: "Cerradas" },
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

      {featureModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-3">
              <BoltIcon className="w-5 h-5 text-[#D4B7A2]" />
              <h2 className="font-display font-bold text-[#1C2230]">Destacar búsqueda</h2>
            </div>
            <p className="text-sm text-[#64748B] mb-4">
              Vas a destacar <span className="font-bold text-[#1C2230]">&quot;{featureModal.title}&quot;</span> por{" "}
              <span className="font-bold text-[#1C2230]">${FEATURED_JOB_PRICE.toLocaleString("es-AR")} ARS</span>.
              Vas a ser redirigido a Mercado Pago para completar el pago.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setFeatureModal(null)} disabled={featuring}
                className="flex-1 border border-[#DDE3EC] text-[#64748B] font-bold rounded-xl py-2.5 text-sm hover:bg-[#FAFBFD] disabled:opacity-60">
                Cancelar
              </button>
              <button onClick={confirmFeature} disabled={featuring}
                className="flex-1 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl py-2.5 text-sm disabled:opacity-60">
                {featuring ? "Redirigiendo..." : "Ir a pagar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-2xl font-display font-bold text-[#1C2230]">Búsquedas</h1>
        <Link
          href="/dashboard/company/publicar"
          className="inline-flex items-center gap-1.5 text-sm font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white px-4 py-2 rounded-xl transition-colors"
        >
          Publicar nueva <ArrowRightIcon className="w-4 h-4" />
        </Link>
      </div>
      <p className="text-[#64748B] text-sm mb-6">Gestioná el estado, la edición y el destacado de tus búsquedas.</p>

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
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-12 text-center">
          <p className="text-[#64748B] font-medium mb-4">Todavía no publicaste ninguna búsqueda.</p>
          <Link href="/dashboard/company/publicar" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:underline">
            Publicar tu primera búsqueda <ArrowRightIcon className="w-4 h-4" />
          </Link>
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
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <ExpiryBadge expiresAt={job.expires_at} status={job.status} />
                    {job.moderation_status && job.moderation_status !== "approved" && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${JOB_MODERATION_CLS[job.moderation_status]}`}>
                        {JOB_MODERATION_LABEL[job.moderation_status]}
                      </span>
                    )}
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
                      className="w-full border border-[#DDE3EC] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#1E8EA3] bg-white"
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
                      {selectedJob.published_at && `Publicada ${new Date(selectedJob.published_at).toLocaleDateString("es-AR")}`}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <ExpiryBadge expiresAt={selectedJob.expires_at} status={selectedJob.status} />
                      {selectedJob.moderation_status && selectedJob.moderation_status !== "approved" && (
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${JOB_MODERATION_CLS[selectedJob.moderation_status]}`}>
                          {JOB_MODERATION_LABEL[selectedJob.moderation_status]}
                        </span>
                      )}
                      {selectedJob.is_featured && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#F7EFE9] text-[#B98F72] px-2.5 py-0.5 rounded-full border border-[#D4B7A2]/50">
                          <BoltIcon className="w-3.5 h-3.5" />Destacada
                          {selectedJob.featured_until && ` · hasta ${new Date(selectedJob.featured_until).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`}
                        </span>
                      )}
                    </div>
                    {selectedJob.moderation_notes && selectedJob.moderation_status === "rejected" && (
                      <p className="text-xs text-red-600 mt-2">Nota de rechazo: {selectedJob.moderation_notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {selectedJob.status === "active" && (
                      <button
                        onClick={() => handleStatusChange(selectedJob.id, "paused")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#64748B] hover:bg-[#54606F] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        <PauseIcon className="w-3.5 h-3.5" />Pausar
                      </button>
                    )}
                    {selectedJob.status === "paused" && (
                      <button
                        onClick={() => handleStatusChange(selectedJob.id, "active")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        <PlayIcon className="w-3.5 h-3.5" />Reactivar
                      </button>
                    )}
                    {(selectedJob.status === "active" || selectedJob.status === "paused") && (
                      <button
                        onClick={() => {
                          if (confirm("¿Cerrar esta búsqueda? No vas a poder reabrirla.")) handleStatusChange(selectedJob.id, "closed");
                        }}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                      >
                        Cerrar
                      </button>
                    )}
                    {!selectedJob.is_featured && selectedJob.status !== "closed" && selectedJob.status !== "expired" && (
                      <button
                        onClick={() => setFeatureModal(selectedJob)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#D4B7A2] hover:bg-[#c7a58d] text-[#3D2B1F] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <BoltIcon className="w-3.5 h-3.5" />Destacar
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(selectedJob)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#1C2230] hover:bg-[#111621] text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <PencilIcon className="w-3.5 h-3.5" />Editar
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-4 py-3">
                    <p className="text-lg font-display font-extrabold text-[#1C2230]">{postulantes.total}</p>
                    <p className="text-[11px] text-[#64748B]">Postulantes</p>
                  </div>
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-4 py-3">
                    <p className="text-lg font-display font-extrabold text-[#1C2230]">
                      {(() => {
                        const ages = applicants.map(a => a.candidate?.age).filter((a): a is number => !!a);
                        return ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : "—";
                      })()}
                    </p>
                    {/* Sobre los que se están mostrando: el promedio de todos vive en
                        Estadísticas, que lo calcula el backend en una sola pasada. */}
                    <p className="text-[11px] text-[#64748B]">Edad prom. (últimos {applicants.length})</p>
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

                {/* Postulantes */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-sm text-[#1C2230]">Postulantes</h3>
                  {postulantes.total > 0 && (
                    <Link
                      href="/dashboard/company/postulaciones"
                      className="text-xs font-bold text-[#1E8EA3] hover:underline"
                    >
                      Ver los {postulantes.total} en Postulaciones →
                    </Link>
                  )}
                </div>
                {postulantes.cargando ? (
                  <div className="py-8 flex justify-center">
                    <div className="w-5 h-5 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : applicants.length === 0 ? (
                  <p className="text-sm text-[#64748B]">Todavía no hay postulantes.</p>
                ) : (
                  <div className="divide-y divide-[#DDE3EC]/60">
                    {applicants.map(app => (
                      <div key={app.id} className="flex items-center gap-3 py-3">
                        {/* Sin anillo de % de perfil — mismo motivo que en Postulaciones:
                            la empresa lo confunde con un % de ajuste al puesto. La foto sí se
                            muestra (ver B3 del plan del 14/08) — antes no llegaba acá. */}
                        {app.candidate?.photo_url ? (
                          <img
                            src={app.candidate.photo_url}
                            alt={`${app.candidate.first_name} ${app.candidate.last_name}`}
                            className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#DDE3EC]"
                          />
                        ) : app.candidate ? (
                          <div className="w-8 h-8 rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0 text-[#1E8EA3] font-display font-bold text-[11px]">
                            {app.candidate.first_name.slice(0, 1)}{app.candidate.last_name.slice(0, 1)}
                          </div>
                        ) : (
                          <UserCircleIcon className="w-8 h-8 text-[#DDE3EC]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[13.5px] text-[#1C2230] truncate">
                            {app.candidate ? `${app.candidate.first_name} ${app.candidate.last_name}` : "Candidato"}
                          </p>
                          <p className="text-[11.5px] text-[#64748B] truncate">
                            {app.candidate?.age && `${app.candidate.age} años · `}
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
        cvLinkEndpoint={viewProfile ? `/me/company/candidates/${viewProfile.id}/cv/link` : undefined}
      />
    </div>
  );
}
