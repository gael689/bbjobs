"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  UsersIcon, UserCircleIcon, CheckCircleIcon, XMarkIcon,
  BriefcaseIcon, AcademicCapIcon, WrenchScrewdriverIcon,
  LanguageIcon, ArrowDownTrayIcon, FunnelIcon, ChartBarIcon,
} from "@heroicons/react/24/outline";
import ProfileCompletionRing from "@/components/ui/ProfileCompletionRing";
import {
  APP_STATUS_LABEL, CANDIDATE_GENDER_LABEL, CANDIDATE_AVAILABILITY_LABEL,
  EDUCATION_LEVEL_LABEL, EMPTY_APPLICANT_FILTERS,
  type Application, type ApplicantFilters, type ApplicantStats, type CandidateFullProfile, type JobPosting,
} from "../types";

export default function CompanyPostulacionesPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [currentApps, setCurrentApps] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [filters, setFilters] = useState<ApplicantFilters>(EMPTY_APPLICANT_FILTERS);
  const [stats, setStats] = useState<ApplicantStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateFullProfile | null>(null);
  const [loadingCandidate, setLoadingCandidate] = useState(false);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  function buildFilterParams(f: ApplicantFilters) {
    const params: Record<string, string | boolean> = {};
    if (f.age_min) params.age_min = f.age_min;
    if (f.age_max) params.age_max = f.age_max;
    if (f.gender) params.gender = f.gender;
    if (f.has_own_transport) params.has_own_transport = f.has_own_transport === "true";
    if (f.availability) params.availability = f.availability;
    if (f.immediate_availability) params.immediate_availability = true;
    return params;
  }

  function loadApplications(jobId: string, f: ApplicantFilters) {
    if (!jobId) return;
    setLoadingApps(true);
    api.get(`/me/company/jobs/${jobId}/applications`, { params: buildFilterParams(f) })
      .then(r => setCurrentApps(r.data))
      .catch(() => {
        toast("Error al cargar postulaciones");
        setCurrentApps([]);
      })
      .finally(() => setLoadingApps(false));
  }

  function selectJob(jobId: string) {
    setSelectedJobId(jobId);
    setFilters(EMPTY_APPLICANT_FILTERS);
    setStats(null);
    loadApplications(jobId, EMPTY_APPLICANT_FILTERS);
    api.get(`/me/company/jobs/${jobId}/applications/stats`).then(r => setStats(r.data)).catch(() => {});
  }

  useEffect(() => {
    api.get("/me/company/jobs").then(r => {
      setJobs(r.data);
      if (r.data.length > 0) selectJob(r.data[0].id);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    loadApplications(selectedJobId, filters);
  }

  function clearFilters() {
    setFilters(EMPTY_APPLICANT_FILTERS);
    loadApplications(selectedJobId, EMPTY_APPLICANT_FILTERS);
  }

  const hasActiveFilters = !!(
    filters.age_min || filters.age_max || filters.gender ||
    filters.has_own_transport || filters.availability || filters.immediate_availability
  );

  async function handleAppStatus(appId: string, status: string) {
    try {
      await api.patch(`/me/company/applications/${appId}/status`, { status });
      setCurrentApps(prev => prev.map(a => (a.id === appId ? { ...a, status } : a)));
    } catch {
      toast("Error al actualizar estado");
    }
  }

  async function openCandidateProfile(candidateId: string) {
    setLoadingCandidate(true);
    setCandidateProfile(null);
    try {
      const r = await api.get(`/me/company/candidates/${candidateId}`);
      setCandidateProfile(r.data);
    } catch {
      toast("Error al cargar el perfil del candidato");
    } finally {
      setLoadingCandidate(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230] flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {toastMsg}
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Postulaciones</h1>
      <p className="text-[#64748B] text-sm mb-6">Revisá y gestioná las postulaciones por búsqueda.</p>

      {jobs.length === 0 ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-12 text-center">
          <BriefcaseIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-4" />
          <p className="text-[#64748B] font-medium">Todavía no publicaste ninguna búsqueda.</p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">Búsqueda</label>
              <select
                value={selectedJobId}
                onChange={e => selectJob(e.target.value)}
                className="w-full sm:w-80 border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
              >
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <button
              onClick={() => setShowStats(v => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] border border-[#9ED4DF] bg-[#E6F4F7] rounded-xl px-4 py-2.5 transition-colors"
            >
              <ChartBarIcon className="w-4 h-4" />
              {showStats ? "Ocultar estadísticas" : "Ver estadísticas"}
            </button>
          </div>

          {showStats && stats && (
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 mb-5">
              <h3 className="text-sm font-bold text-[#1C2230] mb-4">Perfil de los postulantes ({stats.total})</h3>
              {stats.total === 0 ? (
                <p className="text-sm text-[#64748B]">Todavía no hay postulaciones para calcular estadísticas.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 text-center">
                    <p className="text-xl font-display font-extrabold text-[#1E8EA3]">
                      {stats.avg_age != null ? stats.avg_age : "—"}
                    </p>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5">Edad promedio</p>
                  </div>
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 text-center">
                    <p className="text-xl font-display font-extrabold text-[#1E8EA3]">
                      {stats.avg_experience_years != null ? `${stats.avg_experience_years}a` : "—"}
                    </p>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5">Experiencia promedio</p>
                  </div>
                  <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 text-center">
                    <p className="text-xl font-display font-extrabold text-[#1E8EA3]">{stats.immediate_availability_count}</p>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5">Con disp. inmediata</p>
                  </div>
                </div>
              )}
              {Object.keys(stats.education_distribution).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Título alcanzado</p>
                  <div className="space-y-1.5">
                    {Object.entries(stats.education_distribution).map(([level, count]) => (
                      <div key={level} className="flex items-center gap-2">
                        <span className="text-xs text-[#1C2230] w-24 shrink-0">{EDUCATION_LEVEL_LABEL[level] || level}</span>
                        <div className="flex-1 h-2 bg-[#EEF2F7] rounded-full overflow-hidden">
                          <div className="h-full bg-[#1E8EA3] rounded-full" style={{ width: `${(count / stats.total) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-[#1C2230] w-6 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stats.total > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2">Movilidad propia</p>
                  <div className="flex gap-4 text-xs text-[#64748B]">
                    <span>Sí: <strong className="text-[#1C2230]">{stats.mobility.yes || 0}</strong></span>
                    <span>No: <strong className="text-[#1C2230]">{stats.mobility.no || 0}</strong></span>
                    <span>Sin dato: <strong className="text-[#1C2230]">{stats.mobility.unknown || 0}</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={applyFilters} className="bg-white border border-[#DDE3EC] rounded-2xl p-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <FunnelIcon className="w-4 h-4 text-[#1E8EA3]" />
              <span className="text-sm font-bold text-[#1C2230]">Filtrar postulantes</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <input
                type="number" min={0} placeholder="Edad mín."
                value={filters.age_min}
                onChange={e => setFilters(f => ({ ...f, age_min: e.target.value }))}
                className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
              />
              <input
                type="number" min={0} placeholder="Edad máx."
                value={filters.age_max}
                onChange={e => setFilters(f => ({ ...f, age_max: e.target.value }))}
                className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
              />
              <select
                value={filters.gender}
                onChange={e => setFilters(f => ({ ...f, gender: e.target.value as ApplicantFilters["gender"] }))}
                className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
              >
                <option value="">Sexo (todos)</option>
                {Object.entries(CANDIDATE_GENDER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select
                value={filters.has_own_transport}
                onChange={e => setFilters(f => ({ ...f, has_own_transport: e.target.value as ApplicantFilters["has_own_transport"] }))}
                className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
              >
                <option value="">Movilidad (todas)</option>
                <option value="true">Con movilidad</option>
                <option value="false">Sin movilidad</option>
              </select>
              <select
                value={filters.availability}
                onChange={e => setFilters(f => ({ ...f, availability: e.target.value as ApplicantFilters["availability"] }))}
                className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
              >
                <option value="">Disponibilidad (todas)</option>
                {Object.entries(CANDIDATE_AVAILABILITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!filters.immediate_availability}
                  onChange={e => setFilters(f => ({ ...f, immediate_availability: e.target.checked }))}
                  className="w-3.5 h-3.5 accent-[#1E8EA3]"
                />
                Disp. inmediata
              </label>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" className="text-xs font-bold bg-[#1E8EA3] text-white rounded-lg px-3 py-1.5 hover:bg-[#187B8E] transition-colors">
                Filtrar
              </button>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-xs font-bold text-[#64748B] border border-[#DDE3EC] rounded-lg px-3 py-1.5 hover:bg-[#FAFBFD] transition-colors">
                  Limpiar
                </button>
              )}
            </div>
          </form>

          <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden">
            {loadingApps ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : currentApps.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#64748B]">
                <UsersIcon className="w-10 h-10 mx-auto mb-3 text-[#DDE3EC]" />
                Sin postulaciones aún para esta búsqueda.
              </div>
            ) : (
              <div className="divide-y divide-[#DDE3EC]">
                {currentApps.map(app => (
                  <div key={app.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {app.candidate ? (
                        <ProfileCompletionRing percent={app.candidate.completion_percent} size={36} strokeWidth={4} />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#E6F4F7] flex items-center justify-center shrink-0">
                          <UsersIcon className="w-4 h-4 text-[#1E8EA3]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1C2230]">
                          {app.candidate ? `${app.candidate.first_name} ${app.candidate.last_name}` : "Candidato"}
                        </p>
                        <p className="text-xs text-[#64748B]">{new Date(app.created_at).toLocaleDateString("es-AR")}</p>
                        {app.candidate && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {app.candidate.age != null && (
                              <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">{app.candidate.age} años</span>
                            )}
                            {app.candidate.gender && (
                              <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">{CANDIDATE_GENDER_LABEL[app.candidate.gender]}</span>
                            )}
                            {app.candidate.has_own_transport != null && (
                              <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">
                                {app.candidate.has_own_transport ? "Con movilidad" : "Sin movilidad"}
                              </span>
                            )}
                            {app.candidate.immediate_availability && (
                              <span className="text-[10px] font-bold bg-[#D4B7A2]/25 text-[#1C2230] border border-[#D4B7A2] px-1.5 py-0.5 rounded-full">Disp. inmediata</span>
                            )}
                          </div>
                        )}
                        {app.cover_letter && (
                          <p className="text-xs text-[#64748B] truncate mt-0.5 max-w-xs">{app.cover_letter}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {app.candidate && (
                        <button
                          onClick={() => openCandidateProfile(app.candidate!.id)}
                          className="text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#E6F4F7] transition-colors"
                        >
                          <UserCircleIcon className="w-3.5 h-3.5" />
                          Ver perfil
                        </button>
                      )}
                      <select
                        value={app.status}
                        onChange={e => handleAppStatus(app.id, e.target.value)}
                        className="text-xs border border-[#DDE3EC] rounded-lg px-2 py-1 bg-white text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                      >
                        {Object.entries(APP_STATUS_LABEL).map(([value, { label }]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Candidate full profile modal */}
      {(candidateProfile || loadingCandidate) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-end p-4" onClick={() => setCandidateProfile(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#DDE3EC] px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-display font-bold text-[#1C2230]">Perfil del candidato</h2>
              <button onClick={() => setCandidateProfile(null)} className="text-[#64748B] hover:text-[#1C2230] transition-colors">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {loadingCandidate ? (
              <div className="py-20 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : candidateProfile && (
              <div className="p-6 space-y-6">
                <div className="flex items-start gap-4">
                  <ProfileCompletionRing percent={candidateProfile.completion_percent} size={56} strokeWidth={5} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-display font-bold text-[#1C2230]">
                      {candidateProfile.first_name} {candidateProfile.last_name}
                    </h3>
                    <p className="text-sm text-[#64748B] mt-0.5">{candidateProfile.phone}</p>
                    {candidateProfile.completion_percent < 100 && (
                      <p className="text-xs text-[#64748B] mt-1">Perfil {candidateProfile.completion_percent}% completo</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {candidateProfile.accepts_onsite && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Presencial</span>}
                      {candidateProfile.accepts_remote && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Remoto</span>}
                      {candidateProfile.accepts_hybrid && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Híbrido</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {candidateProfile.age != null && (
                        <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2 py-0.5 rounded-full">{candidateProfile.age} años</span>
                      )}
                      {candidateProfile.gender && (
                        <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2 py-0.5 rounded-full">{CANDIDATE_GENDER_LABEL[candidateProfile.gender]}</span>
                      )}
                      {candidateProfile.has_own_transport != null && (
                        <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2 py-0.5 rounded-full">
                          {candidateProfile.has_own_transport ? "Con movilidad propia" : "Sin movilidad propia"}
                        </span>
                      )}
                      {candidateProfile.availability && (
                        <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2 py-0.5 rounded-full">{CANDIDATE_AVAILABILITY_LABEL[candidateProfile.availability]}</span>
                      )}
                      {candidateProfile.immediate_availability && (
                        <span className="text-xs font-bold bg-[#D4B7A2]/25 text-[#1C2230] border border-[#D4B7A2] px-2 py-0.5 rounded-full">Disponibilidad inmediata</span>
                      )}
                    </div>
                  </div>
                  {candidateProfile.cv_file_url && (
                    <a
                      href={candidateProfile.cv_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] px-3 py-2 rounded-lg transition-colors"
                    >
                      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                      Descargar CV
                    </a>
                  )}
                </div>

                {candidateProfile.summary && (
                  <div>
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Sobre el candidato</p>
                    <p className="text-sm text-[#1C2230] leading-relaxed bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4">
                      {candidateProfile.summary}
                    </p>
                  </div>
                )}

                {candidateProfile.experience.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BriefcaseIcon className="w-4 h-4 text-[#1E8EA3]" />
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Experiencia</p>
                    </div>
                    <div className="space-y-3">
                      {candidateProfile.experience.map((exp, i) => (
                        <div key={i} className="border border-[#DDE3EC] rounded-xl p-4">
                          <p className="font-bold text-sm text-[#1C2230]">{exp.role_title}</p>
                          <p className="text-sm text-[#1E8EA3] font-medium">{exp.company_name}</p>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            {new Date(exp.start_date).toLocaleDateString("es-AR", { month: "short", year: "numeric" })}
                            {" — "}
                            {exp.end_date
                              ? new Date(exp.end_date).toLocaleDateString("es-AR", { month: "short", year: "numeric" })
                              : "Actualidad"}
                          </p>
                          {exp.description && <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{exp.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {candidateProfile.education.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AcademicCapIcon className="w-4 h-4 text-[#1E8EA3]" />
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Educación</p>
                    </div>
                    <div className="space-y-3">
                      {candidateProfile.education.map((edu, i) => (
                        <div key={i} className="border border-[#DDE3EC] rounded-xl p-4">
                          <p className="font-bold text-sm text-[#1C2230]">{edu.degree}</p>
                          <p className="text-sm text-[#1E8EA3] font-medium">{edu.institution}</p>
                          <p className="text-xs text-[#64748B] mt-0.5 capitalize">{edu.level}</p>
                          <p className="text-xs text-[#64748B]">
                            {new Date(edu.start_date).toLocaleDateString("es-AR", { month: "short", year: "numeric" })}
                            {" — "}
                            {edu.in_progress ? "En curso" : edu.end_date
                              ? new Date(edu.end_date).toLocaleDateString("es-AR", { month: "short", year: "numeric" })
                              : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {candidateProfile.skills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <WrenchScrewdriverIcon className="w-4 h-4 text-[#1E8EA3]" />
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Habilidades</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {candidateProfile.skills.map((sk, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#E6F4F7] text-[#1C2230] border border-[#9ED4DF] px-3 py-1.5 rounded-full">
                          {sk.skill_name}
                          <span className="text-[#64748B] font-normal">· {sk.level}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {candidateProfile.languages.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <LanguageIcon className="w-4 h-4 text-[#1E8EA3]" />
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Idiomas</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {candidateProfile.languages.map((lang, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-3 py-1.5 rounded-full">
                          {lang.language_name}
                          <span className="text-[#64748B] font-normal">· {lang.level}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!candidateProfile.summary && candidateProfile.experience.length === 0 && candidateProfile.education.length === 0 && candidateProfile.skills.length === 0 && (
                  <div className="py-8 text-center text-sm text-[#64748B]">
                    <UserCircleIcon className="w-10 h-10 mx-auto mb-2 text-[#DDE3EC]" />
                    El candidato aún no completó su perfil.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
