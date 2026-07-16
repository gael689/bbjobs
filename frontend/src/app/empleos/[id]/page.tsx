"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  BriefcaseIcon, BuildingOffice2Icon,
  CalendarIcon, CurrencyDollarIcon, ArrowLeftIcon,
  CheckCircleIcon, XMarkIcon, PaperAirplaneIcon, BoltIcon,
} from "@heroicons/react/24/outline";
import { applyToJob, getApplyErrorMessage, loginUrlWithReturn } from "@/lib/jobApply";
import VerifiedBadge from "@/components/jobs/VerifiedBadge";

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
  company_id?: string;
  company_legal_name_snapshot: string;
  modality: string;
  zone_id?: string;
  published_at?: string;
  salary_min?: number;
  salary_max?: number;
  salary_visible?: boolean;
  salary_currency?: string;
  benefits?: string;
  is_featured?: boolean;
}

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  "híbrido": "Híbrido",
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isSignedIn } = useUser();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/jobs/${id}`)
      .then(r => setJob(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function goToLogin() {
    router.push(loginUrlWithReturn(`/empleos/${id}`));
  }

  async function handleApply() {
    if (!isSignedIn) {
      goToLogin();
      return;
    }
    if (user?.publicMetadata?.role !== "candidate") {
      showToast("Solo los candidatos pueden postularse");
      return;
    }
    setApplying(true);
    try {
      await applyToJob(id, coverLetter);
      setApplied(true);
      setShowApplyModal(false);
      showToast("Postulación enviada correctamente");
    } catch (err: unknown) {
      showToast(getApplyErrorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFBFD] pt-[140px] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen bg-[#FAFBFD] pt-[140px] flex items-center justify-center">
        <div className="text-center">
          <BriefcaseIcon className="w-12 h-12 text-[#DDE3EC] mx-auto mb-4" />
          <p className="font-bold text-[#1C2230] mb-2">Empleo no encontrado</p>
          <p className="text-sm text-[#64748B] mb-6">Esta búsqueda puede haber sido cerrada o eliminada.</p>
          <Link href="/empleos" className="text-sm font-bold text-[#1E8EA3] hover:underline flex items-center gap-1 justify-center">
            <ArrowLeftIcon className="w-4 h-4" />
            Ver todos los empleos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230] flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {toast}
        </div>
      )}

      {/* Apply modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#DDE3EC]">
              <h2 className="text-lg font-display font-bold text-[#1C2230]">Postularme a: {job.title}</h2>
              <button onClick={() => setShowApplyModal(false)} className="text-[#64748B] hover:text-[#1C2230]">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-[#64748B]">{job.company_legal_name_snapshot} · {MODALITY_LABEL[job.modality] || job.modality}</p>
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
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 border border-[#DDE3EC] text-[#64748B] font-bold rounded-xl py-3 text-sm hover:bg-[#FAFBFD] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="flex-1 bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl py-3 text-sm transition-colors"
                >
                  {applying ? "Enviando..." : "Enviar postulación"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        <Link href="/empleos" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1E8EA3] transition-colors font-medium">
          <ArrowLeftIcon className="w-4 h-4" />
          Volver a empleos
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden">
          {/* Job header */}
          <div className="px-8 py-8 border-b border-[#DDE3EC] bg-gradient-to-r from-[#E6F4F7]/40 to-white">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    job.modality === "remoto" ? "bg-green-100 text-green-700" :
                    job.modality === "híbrido" ? "bg-purple-100 text-purple-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {MODALITY_LABEL[job.modality] || job.modality}
                  </span>
                  {job.is_featured && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#F7EFE9] text-[#C4A490] px-2.5 py-0.5 rounded-full border border-[#D4B7A2]/50">
                      <BoltIcon className="w-3.5 h-3.5" />Destacado
                    </span>
                  )}
                  {job.published_at && (
                    <span className="text-xs text-[#64748B] flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {new Date(job.published_at).toLocaleDateString("es-AR")}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-display font-extrabold text-[#1C2230] mb-3">{job.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-[#64748B]">
                  <span className="flex items-center gap-1.5">
                    <BuildingOffice2Icon className="w-4 h-4 text-[#1E8EA3]" />
                    {job.company_id ? (
                      <Link href={`/empresas/${job.company_id}`} className="font-medium text-[#1C2230] hover:text-[#1E8EA3] hover:underline">
                        {job.company_legal_name_snapshot}
                      </Link>
                    ) : (
                      <span className="font-medium text-[#1C2230]">{job.company_legal_name_snapshot}</span>
                    )}
                  </span>
                  <VerifiedBadge />
                </div>
                {job.salary_visible && (job.salary_min || job.salary_max) && (
                  <div className="flex items-center gap-1.5 mt-3 text-[#1E8EA3] font-bold">
                    <CurrencyDollarIcon className="w-5 h-5" />
                    {job.salary_currency || "ARS"} {job.salary_min?.toLocaleString("es-AR")}
                    {job.salary_max ? ` – ${job.salary_max.toLocaleString("es-AR")}` : "+"}
                  </div>
                )}
              </div>

              <div className="shrink-0">
                {applied ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 font-bold rounded-xl px-6 py-3 text-sm">
                    <CheckCircleIcon className="w-5 h-5" />
                    Postulación enviada
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!isSignedIn) {
                        router.push(`/login?redirect=/empleos/${id}`);
                        return;
                      }
                      setShowApplyModal(true);
                    }}
                    className="flex items-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-6 py-3 text-sm transition-colors shadow-sm"
                  >
                    <PaperAirplaneIcon className="w-5 h-5" />
                    {isSignedIn ? "Postularme" : "Iniciá sesión para postularte"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-8">
            <section>
              <h2 className="font-display font-bold text-xl text-[#1C2230] mb-4">Descripción del puesto</h2>
              <div className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line">{job.description}</div>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-[#1C2230] mb-4">Requisitos</h2>
              <div className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line">{job.requirements}</div>
            </section>

            {job.benefits && (
              <section>
                <h2 className="font-display font-bold text-xl text-[#1C2230] mb-4">Beneficios</h2>
                <div className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line">{job.benefits}</div>
              </section>
            )}

            {/* CTA bottom */}
            {!applied && (
              <div className="border-t border-[#DDE3EC] pt-6">
                <button
                  onClick={() => {
                    if (!isSignedIn) {
                      goToLogin();
                      return;
                    }
                    setShowApplyModal(true);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-8 py-3.5 text-sm transition-colors shadow-sm"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                  {isSignedIn ? "Postularme a este empleo" : "Iniciá sesión para postularte"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
