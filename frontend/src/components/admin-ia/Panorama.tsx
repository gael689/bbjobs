"use client";

import { useEffect, useState } from "react";
import {
  CheckCircleIcon, XCircleIcon, SparklesIcon, HandThumbUpIcon, EyeIcon, BriefcaseIcon, ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { detalleError } from "@/hooks/useModulo";
import { NivelChip, PuntajeAnillo, type Umbrales } from "@/components/recomendados/Visual";
import { Aviso, Spinner, usd } from "./comun";

/**
 * Panorama del Centro de IA: lo primero que ve Talency. Estado, cómo rinden las recomendaciones,
 * cuánto se usa y cuánto cuesta, y las mejores coincidencias del momento. No llama a Gemini.
 */

interface Dia { day: string; spend_usd: number; calls: number }
interface Funcion { feature: string; calls: number; spend_usd: number }
interface Coincidencia {
  job_id: string; job_title: string; company_name: string; candidate_ref: string;
  name?: string | null; source: "applicant" | "talent"; score: number; computed_at: string;
}
interface Panorama {
  ai_configured: boolean; recs_switch_on: boolean; assistant_on: boolean; budget_left: boolean;
  daily_budget_usd: number; spent_today_usd: number;
  days: Dia[]; features: Funcion[];
  jobs_with_recs: number; recommendations: number; strong_fits: number;
  applicants_strong: number; applicants_strong_advanced: number; notices_week: number;
  feedback_up: number; feedback_down: number;
  top_matches: Coincidencia[];
  thresholds: Umbrales;
}

const FUNCIONES: Record<string, string> = {
  rerank: "Evaluar candidatos",
  resumen: "Resúmenes de 3 líneas",
  requisitos: "Leer las búsquedas",
  embeddings: "Leer los perfiles",
  moderacion: "Revisar avisos",
  busqueda: "Buscador inteligente",
  habilidades: "Habilidades sugeridas",
  redaccion: "Redactar búsquedas",
  campana_borrador: "Borradores de campaña",
  campana_audiencia: "Audiencias de campaña",
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : null);

function Estado({ ok, si, no }: { ok: boolean; si: string; no: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-bold rounded-full px-3 py-1.5 ${ok ? "bg-white/10 text-white" : "bg-[#D4B7A2] text-[#241C15]"}`}>
      {ok ? <CheckCircleIcon className="w-4 h-4 text-[#9ED4DF]" /> : <XCircleIcon className="w-4 h-4" />}
      {ok ? si : no}
    </span>
  );
}

function Indicador({ icono: Icono, valor, titulo, detalle }: {
  icono: typeof SparklesIcon; valor: React.ReactNode; titulo: string; detalle?: string;
}) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
      <div className="w-9 h-9 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center mb-3">
        <Icono className="w-5 h-5" />
      </div>
      <p className="text-3xl font-display font-extrabold text-[#1C2230] leading-none">{valor}</p>
      <p className="text-sm font-bold text-[#1C2230] mt-1.5">{titulo}</p>
      {detalle && <p className="text-xs text-[#1C2230] mt-0.5">{detalle}</p>}
    </div>
  );
}

function diaCorto(iso: string) {
  // La fecha llega como "AAAA-MM-DD" (día de Argentina): se arma local para que no se corra un día.
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

/** Gasto por día, una sola serie: barras finas con el detalle al pasar el mouse. */
function GastoDiario({ dias, tope }: { dias: Dia[]; tope: number }) {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(tope, ...dias.map(d => d.spend_usd), 0.0001);
  const total = dias.reduce((s, d) => s + d.spend_usd, 0);
  const elegido = foco != null ? dias[foco] : null;
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h3 className="font-display font-bold text-[#1C2230]">Gasto de los últimos 14 días</h3>
        <p className="text-sm text-[#1C2230]">
          {elegido ? <><strong>{diaCorto(elegido.day)}:</strong> {usd(elegido.spend_usd)} · {elegido.calls} usos</>
            : <>Total <strong>{usd(total)}</strong></>}
        </p>
      </div>
      <div className="relative h-36 flex items-end gap-[2px]" onMouseLeave={() => setFoco(null)}>
        {tope > 0 && (
          <div className="absolute left-0 right-0 border-t border-dashed border-[#D4B7A2]" style={{ bottom: `${(100 * tope) / max}%` }}>
            <span className="absolute right-0 -top-5 text-[11px] font-bold text-[#5C3B22]">Tope diario {usd(tope)}</span>
          </div>
        )}
        {dias.map((d, i) => (
          <button key={d.day} type="button" onMouseEnter={() => setFoco(i)} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}
                  aria-label={`${diaCorto(d.day)}: ${usd(d.spend_usd)}, ${d.calls} usos`}
                  className="flex-1 h-full flex items-end group">
            <span className={`w-full rounded-t-[4px] transition-colors ${foco === i ? "bg-[#187B8E]" : "bg-[#1E8EA3]"}`}
                  style={{ height: `${Math.max(d.spend_usd > 0 ? 3 : 1, (100 * d.spend_usd) / max)}%`, opacity: d.spend_usd > 0 ? 1 : 0.25 }} />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] font-bold text-[#1C2230] mt-2">
        <span>{dias[0] && diaCorto(dias[0].day)}</span>
        <span>Hoy</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-bold text-[#187B8E]">Ver como tabla</summary>
        <table className="w-full mt-2 text-[#1C2230]">
          <thead><tr className="text-left text-xs uppercase"><th className="py-1">Día</th><th>Usos</th><th className="text-right">Gasto</th></tr></thead>
          <tbody className="divide-y divide-[#DDE3EC]/60">
            {dias.map(d => <tr key={d.day}><td className="py-1">{diaCorto(d.day)}</td><td>{d.calls}</td><td className="text-right">{usd(d.spend_usd)}</td></tr>)}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function UsoPorFuncion({ funciones }: { funciones: Funcion[] }) {
  const max = Math.max(1, ...funciones.map(f => f.calls));
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
      <h3 className="font-display font-bold text-[#1C2230] mb-4">Para qué se usó (30 días)</h3>
      {funciones.length === 0 ? (
        <p className="text-sm text-[#1C2230]">Todavía no se usó. Cuando la IA trabaje, aparece acá.</p>
      ) : (
        <ul className="space-y-3">
          {funciones.map(f => (
            <li key={f.feature}>
              <div className="flex justify-between gap-2 text-sm text-[#1C2230] mb-1">
                <span className="font-bold">{FUNCIONES[f.feature] ?? f.feature}</span>
                <span>{f.calls} · {usd(f.spend_usd)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#EEF2F7] overflow-hidden">
                <div className="h-full rounded-full bg-[#1E8EA3]" style={{ width: `${(100 * f.calls) / max}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Panorama({ onVerBusqueda }: { onVerBusqueda: (jobId: string) => void }) {
  const [p, setP] = useState<Panorama | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Panorama>("/admin/ai/overview").then(r => setP(r.data)).catch(e => setError(detalleError(e)));
  }, []);

  if (error) return <Aviso tono="error">{error}</Aviso>;
  if (!p) return <div className="py-12 flex justify-center"><Spinner /></div>;

  const votos = p.feedback_up + p.feedback_down;
  const sirvio = pct(p.feedback_up, votos);
  const miradas = pct(p.applicants_strong_advanced, p.applicants_strong);
  const usoTope = p.daily_budget_usd > 0 ? Math.min(100, (100 * p.spent_today_usd) / p.daily_budget_usd) : 0;
  const trabajando = p.ai_configured && p.recs_switch_on && p.budget_left;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B171D] via-[#12303A] to-[#16404B] text-white p-6">
        <div aria-hidden className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[#1E8EA3]/30 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 justify-between">
          <div>
            <p className="flex items-center gap-2 font-display font-extrabold text-xl">
              <span className={`w-2.5 h-2.5 rounded-full ${trabajando ? "bg-[#9ED4DF] ai-dot" : "bg-[#D4B7A2]"}`} />
              {trabajando ? "La IA está trabajando" : "La IA está en pausa"}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Estado ok={p.ai_configured} si="Gemini conectado" no="Falta la cuenta de Gemini" />
              <Estado ok={p.recs_switch_on} si="Recomendados prendidos" no="Recomendados apagados" />
              <Estado ok={p.assistant_on} si="Asistente prendido" no="Asistente apagado" />
            </div>
          </div>
          <div className="lg:w-72">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-bold">Gasto de hoy</span>
              <span>{usd(p.spent_today_usd)} de {usd(p.daily_budget_usd)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
              <div className={`h-full rounded-full ${usoTope >= 90 ? "bg-[#D4B7A2]" : "bg-[#9ED4DF]"}`} style={{ width: `${usoTope}%` }} />
            </div>
            <p className="text-xs text-[#D6E9EE] mt-1.5">{p.budget_left ? "Al llegar al tope, se frena sola hasta mañana." : "Llegó al tope: vuelve mañana."}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Indicador icono={BriefcaseIcon} valor={p.jobs_with_recs} titulo="Búsquedas con recomendados"
                   detalle={`${p.recommendations} candidatos ordenados`} />
        <Indicador icono={SparklesIcon} valor={p.strong_fits} titulo="Encajan muy bien"
                   detalle={`${p.notices_week} avisados a empresas esta semana`} />
        <Indicador icono={HandThumbUpIcon} valor={sirvio == null ? "—" : `${sirvio} %`} titulo="Les sirvió a las empresas"
                   detalle={votos ? `${p.feedback_up} 👍 · ${p.feedback_down} 👎` : "Todavía nadie votó"} />
        <Indicador icono={EyeIcon} valor={miradas == null ? "—" : `${miradas} %`} titulo="La empresa ya los miró"
                   detalle={p.applicants_strong ? `${p.applicants_strong_advanced} de ${p.applicants_strong} postulantes que encajan` : "Sin postulantes que encajen todavía"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><GastoDiario dias={p.days} tope={p.daily_budget_usd} /></div>
        <div className="lg:col-span-2"><UsoPorFuncion funciones={p.features} /></div>
      </section>

      <section className="bg-white border border-[#DDE3EC] rounded-2xl shadow-sm overflow-hidden">
        <h3 className="font-display font-bold text-[#1C2230] px-5 pt-5 pb-3">Las mejores coincidencias de ahora</h3>
        {p.top_matches.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-[#1C2230]">Cuando la IA calcule recomendados, acá van las mejores.</p>
        ) : (
          <ul className="divide-y divide-[#DDE3EC]/60">
            {p.top_matches.map(m => (
              <li key={`${m.job_id}-${m.candidate_ref}`}>
                <button onClick={() => onVerBusqueda(m.job_id)}
                        className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-[#FAFBFD] focus:bg-[#FAFBFD]">
                  <PuntajeAnillo score={m.score} umbrales={p.thresholds} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#1C2230] flex flex-wrap items-center gap-2">
                      {m.name ?? `Perfil ${m.candidate_ref}`}
                      <NivelChip score={m.score} umbrales={p.thresholds} />
                      {m.source === "talent" && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F7EFE9] text-[#5C3B22]">Base de Talento</span>}
                    </p>
                    <p className="text-sm text-[#1C2230] truncate">{m.job_title} · {m.company_name}</p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-[#187B8E] shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
