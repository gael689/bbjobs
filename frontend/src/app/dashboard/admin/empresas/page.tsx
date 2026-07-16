"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  BuildingOffice2Icon, CheckCircleIcon, XCircleIcon, ClockIcon, ShieldExclamationIcon,
  ChevronDownIcon, ChevronUpIcon, BriefcaseIcon, UsersIcon, UserCircleIcon,
  XMarkIcon, GlobeAltIcon, EnvelopeIcon, PhoneIcon, IdentificationIcon,
} from "@heroicons/react/24/outline";
import ExpiryBadge from "@/components/ui/ExpiryBadge";
import {
  VERIF_CLS, VERIF_LABEL, MODERATION_CLS, MODERATION_LABEL, APP_STATUS_LABEL,
  type Company, type Job, type AdminApplication,
} from "../types";

export default function AdminEmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const [viewCompany, setViewCompany] = useState<Company | null>(null);

  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [companyJobs, setCompanyJobs] = useState<Record<string, Job[]>>({});
  const [loadingJobs, setLoadingJobs] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [jobApplications, setJobApplications] = useState<Record<string, AdminApplication[]>>({});
  const [loadingApps, setLoadingApps] = useState<string | null>(null);

  const toast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  const fetchCompanies = useCallback(() => {
    api.get("/admin/companies").then(r => setCompanies(r.data)).catch(() => toast("Error al cargar empresas", "error"));
  }, [toast]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  async function handleVerify(companyId: string, action: "approve" | "reject") {
    if (action === "reject") {
      setRejectModal(companyId);
      return;
    }
    setActionLoading(companyId + action);
    try {
      await api.patch(`/admin/companies/${companyId}/verify`, { action, notes: null });
      toast("Empresa verificada");
      fetchCompanies();
    } catch {
      toast("Error al verificar", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectModal) return;
    setActionLoading(rejectModal + "reject");
    try {
      await api.patch(`/admin/companies/${rejectModal}/verify`, { action: "reject", notes: rejectNotes || null });
      toast("Empresa rechazada");
      fetchCompanies();
    } catch {
      toast("Error al rechazar", "error");
    } finally {
      setActionLoading(null);
      setRejectModal(null);
      setRejectNotes("");
    }
  }

  async function handleSuspend(companyId: string) {
    setActionLoading(companyId + "suspend");
    try {
      await api.patch(`/admin/companies/${companyId}/suspend`);
      toast("Empresa suspendida");
      fetchCompanies();
    } catch {
      toast("Error al suspender", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReactivate(companyId: string) {
    setActionLoading(companyId + "reactivate");
    try {
      await api.patch(`/admin/companies/${companyId}/reactivate`);
      toast("Empresa reactivada");
      fetchCompanies();
    } catch {
      toast("Error al reactivar", "error");
    } finally {
      setActionLoading(null);
    }
  }

  function toggleCompanyJobs(companyId: string) {
    if (expandedCompany === companyId) {
      setExpandedCompany(null);
      return;
    }
    setExpandedCompany(companyId);
    setExpandedJob(null);
    if (!companyJobs[companyId]) {
      setLoadingJobs(companyId);
      api.get(`/admin/companies/${companyId}/jobs`)
        .then(r => setCompanyJobs(prev => ({ ...prev, [companyId]: r.data })))
        .catch(() => setCompanyJobs(prev => ({ ...prev, [companyId]: [] })))
        .finally(() => setLoadingJobs(null));
    }
  }

  function toggleJobApplications(jobId: string) {
    if (expandedJob === jobId) {
      setExpandedJob(null);
      return;
    }
    setExpandedJob(jobId);
    if (!jobApplications[jobId]) {
      setLoadingApps(jobId);
      api.get(`/admin/jobs/${jobId}/applications`)
        .then(r => setJobApplications(prev => ({ ...prev, [jobId]: r.data })))
        .catch(() => setJobApplications(prev => ({ ...prev, [jobId]: [] })))
        .finally(() => setLoadingApps(null));
    }
  }

  const pending = companies.filter(c => c.verification_status === "pending");
  const verified = companies.filter(c => c.verification_status === "verified");
  const suspended = companies.filter(c => c.verification_status === "suspended");

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
            <h2 className="font-display font-bold text-[#1C2230] mb-3">Rechazar empresa</h2>
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

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Empresas</h1>
      <p className="text-[#64748B] text-sm mb-6">Gestioná la verificación de empresas registradas.</p>

      {companies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-[#DDE3EC] rounded-xl px-4 py-3">
            <p className="text-lg font-display font-extrabold text-[#1C2230]">{companies.length}</p>
            <p className="text-[11px] text-[#64748B]">Total</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-lg font-display font-extrabold text-amber-700">{pending.length}</p>
            <p className="text-[11px] text-amber-700/80">Pendientes</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <p className="text-lg font-display font-extrabold text-green-700">{verified.length}</p>
            <p className="text-[11px] text-green-700/80">Verificadas</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <p className="text-lg font-display font-extrabold text-red-700">{suspended.length}</p>
            <p className="text-[11px] text-red-700/80">Suspendidas</p>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-center gap-3 mb-6">
          <ClockIcon className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            Hay <span className="font-bold">{pending.length}</span> empresa{pending.length > 1 ? "s" : ""} esperando verificación.
          </p>
        </div>
      )}

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#DDE3EC]/60">
        {companies.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">Sin empresas registradas.</div>
        ) : (
          companies.map(company => (
            <div key={company.id} className="px-6 py-5 hover:bg-[#FAFBFD] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  {company.logo_url ? (
                    <div className="w-12 h-12 rounded-xl border border-[#DDE3EC] bg-white flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={company.logo_url} alt="logo" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                      <BuildingOffice2Icon className="w-6 h-6 text-[#1E8EA3]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#1C2230]">{company.legal_name}</p>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${VERIF_CLS[company.verification_status]}`}>
                        {VERIF_LABEL[company.verification_status]}
                      </span>
                    </div>
                    <p className="text-sm text-[#64748B] mt-0.5">CUIT: {company.cuit}</p>
                    <div className="text-sm text-[#64748B] mt-1 flex flex-col gap-0.5">
                      <span>{company.responsible_full_name} · {company.responsible_email}</span>
                      {company.verification_notes && (
                        <p className="text-xs text-red-600 mt-0.5">Nota: {company.verification_notes}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {company.verification_status === "pending" && (
                    <>
                      <button
                        onClick={() => handleVerify(company.id, "reject")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-sm font-bold border border-red-200 text-red-600 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleVerify(company.id, "approve")}
                        disabled={!!actionLoading}
                        className="inline-flex items-center gap-1.5 text-sm font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                      >
                        {actionLoading === company.id + "approve" ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : <CheckCircleIcon className="w-4 h-4" />}
                        Verificar
                      </button>
                    </>
                  )}

                  {company.verification_status === "verified" && (
                    <button
                      onClick={() => handleSuspend(company.id)}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 text-sm font-bold border border-orange-200 text-orange-600 px-4 py-2 rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-60"
                    >
                      {actionLoading === company.id + "suspend" ? (
                        <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                      ) : <ShieldExclamationIcon className="w-4 h-4" />}
                      Suspender
                    </button>
                  )}

                  {company.verification_status === "suspended" && (
                    <button
                      onClick={() => handleReactivate(company.id)}
                      disabled={!!actionLoading}
                      className="inline-flex items-center gap-1.5 text-sm font-bold bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      {actionLoading === company.id + "reactivate" ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : <CheckCircleIcon className="w-4 h-4" />}
                      Reactivar
                    </button>
                  )}

                  <button
                    onClick={() => setViewCompany(company)}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] px-2 py-2 rounded-xl hover:bg-[#E6F4F7] transition-colors"
                  >
                    <UserCircleIcon className="w-4 h-4" />
                    Ver perfil
                  </button>
                  <button
                    onClick={() => toggleCompanyJobs(company.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748B] border border-[#DDE3EC] px-3 py-2 rounded-xl hover:bg-[#FAFBFD] transition-colors"
                  >
                    <BriefcaseIcon className="w-4 h-4" />
                    Búsquedas
                    {expandedCompany === company.id ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {expandedCompany === company.id && (
                <div className="mt-4 ml-0 sm:ml-16 border border-[#DDE3EC] rounded-xl overflow-hidden">
                  {loadingJobs === company.id ? (
                    <div className="p-6 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (companyJobs[company.id] || []).length === 0 ? (
                    <div className="p-4 text-center text-sm text-[#64748B]">Esta empresa todavía no publicó ninguna búsqueda.</div>
                  ) : (
                    <div className="divide-y divide-[#DDE3EC]">
                      {(companyJobs[company.id] || []).map(job => (
                        <div key={job.id}>
                          <div className="px-4 py-3 flex items-center justify-between gap-3 bg-[#FAFBFD]">
                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-[#1C2230]">{job.title}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${MODERATION_CLS[job.moderation_status]}`}>
                                {MODERATION_LABEL[job.moderation_status]}
                              </span>
                              <ExpiryBadge expiresAt={job.expires_at} status={job.status} />
                            </div>
                            <button
                              onClick={() => toggleJobApplications(job.id)}
                              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E] px-2 py-1 rounded-lg hover:bg-[#E6F4F7] transition-colors"
                            >
                              <UsersIcon className="w-3.5 h-3.5" />
                              Postulantes
                              {expandedJob === job.id ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                            </button>
                          </div>
                          {expandedJob === job.id && (
                            <div className="bg-white">
                              {loadingApps === job.id ? (
                                <div className="p-4 flex items-center justify-center">
                                  <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                                </div>
                              ) : (jobApplications[job.id] || []).length === 0 ? (
                                <div className="p-4 text-center text-xs text-[#64748B]">Sin postulaciones para esta búsqueda.</div>
                              ) : (
                                <div className="divide-y divide-[#EEF2F7]">
                                  {(jobApplications[job.id] || []).map(app => (
                                    <div key={app.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                      <span className="text-sm text-[#1C2230] truncate">
                                        {app.candidate ? `${app.candidate.first_name} ${app.candidate.last_name}` : "Candidato"}
                                      </span>
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${APP_STATUS_LABEL[app.status]?.cls || "bg-gray-100 text-gray-600"}`}>
                                        {APP_STATUS_LABEL[app.status]?.label || app.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {viewCompany && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewCompany(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#DDE3EC] px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-lg font-display font-bold text-[#1C2230]">Perfil de la empresa</h2>
              <button onClick={() => setViewCompany(null)} className="text-[#64748B] hover:text-[#1C2230] transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5 pb-6 border-b border-[#DDE3EC]">
                {viewCompany.logo_url ? (
                  <div className="w-16 h-16 rounded-2xl border border-[#DDE3EC] bg-white flex items-center justify-center shrink-0 overflow-hidden">
                    <img src={viewCompany.logo_url} alt="logo" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                    <BuildingOffice2Icon className="w-8 h-8 text-[#1E8EA3]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-display font-bold text-[#1C2230]">{viewCompany.legal_name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${VERIF_CLS[viewCompany.verification_status]}`}>
                      {VERIF_LABEL[viewCompany.verification_status]}
                    </span>
                    {viewCompany.verified_at && (
                      <span className="text-xs text-[#64748B]">
                        Verificada el {new Date(viewCompany.verified_at).toLocaleDateString("es-AR")}
                      </span>
                    )}
                  </div>
                </div>
                {viewCompany.website && (
                  <a
                    href={viewCompany.website.startsWith("http") ? viewCompany.website : `https://${viewCompany.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <GlobeAltIcon className="w-4 h-4" />
                    Sitio web
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Datos legales</p>
                    <div className="border border-[#DDE3EC] rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center gap-2 text-sm text-[#1C2230]">
                        <IdentificationIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
                        CUIT: {viewCompany.cuit}
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Responsable</p>
                    <div className="border border-[#DDE3EC] rounded-xl p-4 space-y-2.5">
                      <p className="text-sm font-bold text-[#1C2230]">{viewCompany.responsible_full_name}</p>
                      <div className="flex items-center gap-2 text-sm text-[#64748B]">
                        <EnvelopeIcon className="w-4 h-4 shrink-0" />
                        <a href={`mailto:${viewCompany.responsible_email}`} className="hover:text-[#1E8EA3]">{viewCompany.responsible_email}</a>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#64748B]">
                        <PhoneIcon className="w-4 h-4 shrink-0" />
                        <a href={`tel:${viewCompany.responsible_phone}`} className="hover:text-[#1E8EA3]">{viewCompany.responsible_phone}</a>
                      </div>
                    </div>
                  </div>

                  {viewCompany.verification_notes && (
                    <div>
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Notas de verificación</p>
                      <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-4">{viewCompany.verification_notes}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Sobre la empresa</p>
                  {viewCompany.description ? (
                    <p className="text-sm text-[#1C2230] leading-relaxed bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4">{viewCompany.description}</p>
                  ) : (
                    <p className="text-sm text-[#64748B] bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4">Todavía no completó la descripción de perfil público.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
