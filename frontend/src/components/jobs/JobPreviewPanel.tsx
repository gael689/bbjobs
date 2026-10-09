"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  XMarkIcon, BuildingOffice2Icon, CalendarIcon, CurrencyDollarIcon,
  PaperAirplaneIcon, CheckCircleIcon, ArrowTopRightOnSquareIcon, BoltIcon,
} from "@heroicons/react/24/outline";
import { applyToJob, getApplyErrorMessage, loginUrlWithReturn } from "@/lib/jobApply";
import VerifiedBadge from "./VerifiedBadge";

export interface PreviewJob {
  id: string;
  title: string;
  description: string;
  benefits?: string;
  company_id?: string;
  company_legal_name_snapshot: string;
  logo_url?: string;
  modality: string;
  published_at?: string;
  salary_min?: number;
  salary_max?: number;
  salary_visible?: boolean;
  salary_currency?: string;
  is_featured?: boolean;
}

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  "híbrido": "Híbrido",
};

const MODALITY_CLS: Record<string, string> = {
  presencial: "bg-blue-100 text-blue-700",
  remoto: "bg-green-100 text-green-700",
  "híbrido": "bg-purple-100 text-purple-700",
};

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMin < 60) return `hace ${diffMin || 1}m`;
  if (diffMin < 1440) return `hace ${Math.floor(diffMin / 60)}h`;
  return `hace ${Math.floor(diffMin / 1440)}d`;
}

export default function JobPreviewPanel({
  job,
  returnPath,
  onClose,
}: {
  job: PreviewJob;
  returnPath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");

  const isCandidate = user?.publicMetadata?.role === "candidate";

  async function handleSubmit() {
    if (!isSignedIn) {
      router.push(loginUrlWithReturn(returnPath));
      return;
    }
    if (!isCandidate) {
      setError("Solo los candidatos pueden postularse.");
      return;
    }
    setApplying(true);
    setError("");
    try {
      await applyToJob(job.id, coverLetter);
      setApplied(true);
    } catch (err: unknown) {
      setError(getApplyErrorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      // pt-[124px] deja el navbar flotante (fixed top-6, ~100px de alto) siempre visible y
      // sin que el panel lo tape — el centrado queda dentro del espacio que sobra debajo.
      className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center px-4 pt-[124px] pb-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#DDE3EC] px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-display font-bold text-[#1C2230]">Vista previa del aviso</h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#1C2230] transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl border border-[#DDE3EC] bg-[#FAFBFD] flex items-center justify-center shrink-0 overflow-hidden">
              {job.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={job.logo_url} alt={job.company_legal_name_snapshot} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="font-display font-extrabold text-[#1E8EA3] text-lg">
                  {job.company_legal_name_snapshot?.[0] || "?"}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${MODALITY_CLS[job.modality] || "bg-gray-100 text-gray-600"}`}>
                  {MODALITY_LABEL[job.modality] || job.modality}
                </span>
                {job.is_featured && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full border border-red-200">
                    <BoltIcon className="w-3.5 h-3.5" />Destacado
                  </span>
                )}
                {job.published_at && (
                  <span className="text-xs text-[#64748B] flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    Publicado {timeAgo(job.published_at)}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-display font-extrabold text-[#1C2230] mb-2">{job.title}</h1>
              <div className="flex items-center gap-2 flex-wrap text-sm text-[#64748B]">
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
                <div className="flex items-center gap-1.5 mt-3 text-[#1E8EA3] font-bold text-sm">
                  <CurrencyDollarIcon className="w-5 h-5" />
                  {job.salary_currency || "ARS"} {job.salary_min?.toLocaleString("es-AR")}
                  {job.salary_max ? ` – ${job.salary_max.toLocaleString("es-AR")}` : "+"}
                </div>
              )}
            </div>
          </div>

          <Link
            href={`/empleos/${job.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:underline"
          >
            Ver aviso completo <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </Link>

          <section>
            <h3 className="font-display font-bold text-[#1C2230] mb-2">El puesto</h3>
            <p className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line">{job.description}</p>
          </section>

          {job.benefits && (
            <section>
              <h3 className="font-display font-bold text-[#1C2230] mb-2">Beneficios</h3>
              <p className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line">{job.benefits}</p>
            </section>
          )}

          {/* Apply */}
          <div className="border-t border-[#DDE3EC] pt-6">
            {applied ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 font-bold rounded-xl px-5 py-3 text-sm">
                <CheckCircleIcon className="w-5 h-5" />
                Postulación enviada correctamente
              </div>
            ) : (
              <>
                {isSignedIn && isCandidate && (
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Carta de presentación (opcional)</label>
                    <textarea
                      rows={4}
                      value={coverLetter}
                      onChange={e => setCoverLetter(e.target.value)}
                      placeholder="Presentate brevemente y contá por qué te interesa este puesto..."
                      className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors resize-none"
                    />
                  </div>
                )}
                {error && (
                  <p className="text-sm text-red-600 font-medium mb-3">{error}</p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={applying}
                  className="w-full flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl px-6 py-3 text-sm transition-colors shadow-sm"
                >
                  <PaperAirplaneIcon className="w-5 h-5" />
                  {applying ? "Enviando..." : isSignedIn ? "Postularme" : "Iniciá sesión para postularte"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
