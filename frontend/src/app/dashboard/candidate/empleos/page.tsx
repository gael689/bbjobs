"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BriefcaseIcon, CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { MODALITY_LABEL, type Application, type CandidateProfile, type Job } from "../types";

export default function CandidateEmpleosPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [applyModal, setApplyModal] = useState<Job | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [applyingTo, setApplyingTo] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get("/jobs?page_size=100").then(r => setJobs(r.data.items)).catch(() => {});
    api.get("/me/candidate/applications").then(r => setApplications(r.data)).catch(() => {});
    api.get("/me/candidate/profile").then(r => setProfile(r.data)).catch(() => {});
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  function alreadyApplied(jobId: string) {
    return applications.some(a => a.job_posting_id === jobId);
  }

  async function handleApply() {
    if (!applyModal) return;
    setApplyingTo(applyModal.id);
    try {
      await api.post(`/jobs/${applyModal.id}/apply`, { cover_letter: coverLetter || undefined });
      toast("Postulación enviada correctamente");
      const r = await api.get("/me/candidate/applications");
      setApplications(r.data);
      setApplyModal(null);
      setCoverLetter("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast(detail || "Error al postularse");
    } finally {
      setApplyingTo(null);
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

      {applyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#DDE3EC]">
              <h2 className="text-lg font-display font-bold text-[#1C2230]">Postularme a: {applyModal.title}</h2>
              <button onClick={() => { setApplyModal(null); setCoverLetter(""); }} className="text-[#64748B] hover:text-[#1C2230]">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#64748B]">{applyModal.company_legal_name_snapshot} · {MODALITY_LABEL[applyModal.modality] || applyModal.modality}</p>
              <div>
                <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Carta de presentación (opcional)</label>
                <textarea
                  rows={5}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  placeholder="Presentate brevemente y contá por qué te interesa este puesto..."
                  className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors resize-none"
                />
              </div>
              {!profile?.cv_file_url && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-medium">
                  No tenés CV cargado. Podés postularte igual, pero subir tu CV mejora tus chances.
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setApplyModal(null); setCoverLetter(""); }}
                  className="flex-1 border border-[#DDE3EC] text-[#64748B] font-bold rounded-xl py-3 text-sm hover:bg-[#FAFBFD] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApply}
                  disabled={applyingTo === applyModal.id}
                  className="flex-1 bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl py-3 text-sm transition-colors"
                >
                  {applyingTo === applyModal.id ? "Enviando..." : "Enviar postulación"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Explorar empleos</h1>
      <p className="text-[#64748B] text-sm mb-6">Búsquedas activas en Bahía Blanca.</p>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden">
        {jobs.length === 0 ? (
          <div className="p-12 text-center">
            <BriefcaseIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-4" />
            <p className="text-[#64748B] font-medium">No hay búsquedas activas en este momento.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]">
            {jobs.map(job => {
              const applied = alreadyApplied(job.id);
              return (
                <div key={job.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAFBFD] transition-colors">
                  <div className="min-w-0">
                    <p className="font-bold text-[#1C2230] truncate">{job.title}</p>
                    <p className="text-sm text-[#64748B] mt-0.5">{job.company_legal_name_snapshot}</p>
                    <span className="text-xs text-[#64748B]">{MODALITY_LABEL[job.modality] || job.modality}</span>
                  </div>
                  <button
                    onClick={() => !applied && setApplyModal(job)}
                    disabled={applied || applyingTo === job.id}
                    className={`shrink-0 text-sm font-bold rounded-full px-5 py-2.5 transition-colors ${
                      applied
                        ? "bg-green-100 text-green-700 cursor-default"
                        : "bg-[#1E8EA3] hover:bg-[#187B8E] text-white disabled:opacity-60"
                    }`}
                  >
                    {applied ? "Postulado" : "Postularme"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
