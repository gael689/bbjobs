"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import CandidateProfileModal from "@/components/dashboard/CandidateProfileModal";
import type { CandidateFullProfile } from "@/app/dashboard/admin/types";

/**
 * Piezas compartidas del Centro de IA (admin): tipos de la API, formato de montos y fechas, el
 * diálogo de confirmación de las acciones y la ficha del candidato (la misma que en Candidatos).
 */

export type Veredicto = "si" | "parcial" | "no" | "sin_datos";

export interface Requisito { id: string; texto: string; tipo: string }
export interface Evaluacion { req_id: string; verdict: Veredicto; evidence?: string | null }

export interface BusquedaIA {
  job_id: string;
  title: string;
  company_id?: string | null;
  company_name: string;
  status: string;
  moderation_status: string;
  applicants: number;
  recommendations: number;
  recommended: number;
  best_score?: number | null;
  last_computed_at?: string | null;
  queued: boolean;
  queue_reason?: string | null;
  cost_usd: number;
}

export interface RecomendadoAdmin {
  candidate_ref: string;
  candidate_id?: string | null;
  application_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  source: "applicant" | "talent";
  unlocked: boolean;
  shown_to_company: boolean;
  score: number;
  recommended: boolean;
  coverage: number;
  hybrid_fit: number;
  semantic_pct?: number | null;
  reasons: string[];
  evaluations: Evaluacion[];
  locked: boolean;
  rerank_status: string;
  alerts: string[];
  feedback?: number | null;
  computed_at?: string | null;
}

export interface DetalleBusqueda {
  enabled: boolean;
  status: "ok" | "sin_calcular" | "apagado";
  disclaimer: string;
  job: { id: string; title: string; company_id?: string | null; company_name: string; status: string; moderation_status: string };
  requirements: Requisito[];
  discarded_requirements: { texto: string; motivo?: string }[];
  requirements_with_ai: boolean;
  job_injection_flags: number;
  applicants: RecomendadoAdmin[];
  talent: RecomendadoAdmin[];
  talent_limit: number;
  computed_at?: string | null;
  queued: boolean;
  queue_reason?: string | null;
  cost_usd: number;
  rerank_counts: Record<string, number>;
}

export interface Totales {
  cv_reads: number;
  anonymization_alerts: number;
  recomputes: number;
  reranks: number;
  summaries: number;
  moderation_reviews: number;
  moderation_flags: number;
  skill_suggestions: number;
  drafts: number;
  searches: number;
  company_notices: number;
  alerts: number;
  spend_usd: number;
}

export interface ResumenActividad {
  today: Totales;
  week: Totales;
  daily_budget_usd: number;
  budget_left: boolean;
  recs_switch_on: boolean;
  ai_configured: boolean;
}

export interface ItemActividad {
  id: string;
  at: string;
  kind: string;
  job_id?: string | null;
  job_title?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  candidate_id?: string | null;
  detail: Record<string, unknown>;
  cost_usd: number;
  alert: boolean;
}

// Una búsqueda cuesta fracciones de centavo: con 2 decimales todo se leía "USD 0.00".
export const usd = (n: number) => `USD ${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

export function fecha(iso?: string | null, conHora = true): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-AR", conHora
    ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const MOTIVOS: Record<string, string> = {
  noche: "cálculo de la noche",
  aprobada: "se aprobó la búsqueda",
  postulacion: "postulación nueva",
  manual: "pedido de Talency",
  empresa: "pedido de la empresa",
  otro: "otro",
  talency: "Talency",
  al_publicar: "al publicarse",
  programado: "automático del día 1",
};

export const Spinner = () => (
  <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
);

/** Confirmación antes de lanzar algo que gasta IA. */
export function Confirmar({ titulo, texto, boton, onSi, onNo, ocupado }: {
  titulo: string; texto: string; boton: string; onSi: () => void; onNo: () => void; ocupado?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-[#1C2230]/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <p className="font-display font-bold text-lg text-[#1C2230] mb-2">{titulo}</p>
        <p className="text-sm text-[#1C2230] leading-relaxed mb-5">{texto}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={onNo} disabled={ocupado}
                  className="px-4 py-2.5 rounded-xl border border-[#DDE3EC] text-sm font-bold text-[#1C2230] hover:bg-[#FAFBFD]">
            Cancelar
          </button>
          <button onClick={onSi} disabled={ocupado}
                  className="px-4 py-2.5 rounded-xl bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold disabled:opacity-60">
            {ocupado ? "Un momento…" : boton}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Ficha del candidato (la misma que el admin ya ve en Candidatos), a partir de su id. */
export function useFichaCandidato() {
  const [perfil, setPerfil] = useState<CandidateFullProfile | null>(null);
  const [cargando, setCargando] = useState(false);

  async function abrir(id: string) {
    setCargando(true);
    setPerfil(null);
    try {
      const r = await api.get<CandidateFullProfile>(`/admin/candidates/${id}`);
      setPerfil(r.data);
    } catch {
      setPerfil(null);
    } finally {
      setCargando(false);
    }
  }

  const modal = (
    <CandidateProfileModal
      profile={perfil}
      loading={cargando}
      onClose={() => { setPerfil(null); setCargando(false); }}
      cvLinkEndpoint={perfil ? `/admin/candidates/${perfil.id}/cv/link` : undefined}
      showCompletion
    />
  );
  return { abrir, modal };
}

export function Aviso({ tono, children }: { tono: "ok" | "error" | "info"; children: React.ReactNode }) {
  const cls = tono === "ok" ? "bg-green-50 text-green-900 border-green-200"
    : tono === "error" ? "bg-red-50 text-red-900 border-red-200"
    : "bg-[#E6F4F7] text-[#1C2230] border-[#9ED4DF]";
  return <div className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${cls}`}>{children}</div>;
}
