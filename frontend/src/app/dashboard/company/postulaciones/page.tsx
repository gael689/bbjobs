"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  UsersIcon, UserCircleIcon, CheckCircleIcon, XMarkIcon,
  BriefcaseIcon, AcademicCapIcon, WrenchScrewdriverIcon,
  LanguageIcon, ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { APP_STATUS_LABEL, type Application, type CandidateFullProfile, type JobPosting } from "../types";

export default function CompanyPostulacionesPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [applications, setApplications] = useState<Record<string, Application[]>>({});
  const [loadingApps, setLoadingApps] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateFullProfile | null>(null);
  const [loadingCandidate, setLoadingCandidate] = useState(false);

  useEffect(() => {
    api.get("/me/company/jobs").then(r => {
      setJobs(r.data);
      if (r.data.length > 0) setSelectedJobId(r.data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedJobId || applications[selectedJobId]) return;
    setLoadingApps(true);
    api.get(`/me/company/jobs/${selectedJobId}/applications`)
      .then(r => setApplications(prev => ({ ...prev, [selectedJobId]: r.data })))
      .catch(() => toast("Error al cargar postulaciones"))
      .finally(() => setLoadingApps(false));
  }, [selectedJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function handleAppStatus(appId: string, jobId: string, status: string) {
    try {
      await api.patch(`/me/company/applications/${appId}/status`, { status });
      setApplications(prev => ({
        ...prev,
        [jobId]: prev[jobId].map(a => (a.id === appId ? { ...a, status } : a)),
      }));
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

  const currentApps = applications[selectedJobId] || [];

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
          <div className="mb-5">
            <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">Búsqueda</label>
            <select
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              className="w-full sm:w-80 border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
            >
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>

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
                      <div className="w-9 h-9 rounded-lg bg-[#E6F4F7] flex items-center justify-center shrink-0">
                        <UsersIcon className="w-4 h-4 text-[#1E8EA3]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1C2230]">
                          {app.candidate ? `${app.candidate.first_name} ${app.candidate.last_name}` : "Candidato"}
                        </p>
                        <p className="text-xs text-[#64748B]">{new Date(app.created_at).toLocaleDateString("es-AR")}</p>
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
                        onChange={e => handleAppStatus(app.id, selectedJobId, e.target.value)}
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
                  <div className="w-14 h-14 rounded-2xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                    <UserCircleIcon className="w-8 h-8 text-[#1E8EA3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-display font-bold text-[#1C2230]">
                      {candidateProfile.first_name} {candidateProfile.last_name}
                    </h3>
                    <p className="text-sm text-[#64748B] mt-0.5">{candidateProfile.phone}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {candidateProfile.accepts_onsite && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Presencial</span>}
                      {candidateProfile.accepts_remote && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Remoto</span>}
                      {candidateProfile.accepts_hybrid && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Híbrido</span>}
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
