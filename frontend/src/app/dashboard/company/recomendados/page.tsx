"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SparklesIcon, ArrowPathIcon, HandThumbUpIcon, HandThumbDownIcon, LockClosedIcon, InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";

interface Busqueda { id: string; title: string; status: string }

interface Requisito { id: string; texto: string; tipo: string }

interface Evaluacion { req_id: string; verdict: "si" | "parcial" | "no" | "sin_datos"; evidence?: string | null }

interface Recomendado {
  candidate_ref: string;
  candidate_id?: string | null;
  application_id?: string | null;
  name?: string | null;
  source: "applicant" | "talent";
  score: number;
  recommended: boolean;
  coverage: number;
  reasons: string[];
  evaluations: Evaluacion[];
  locked: boolean;
  feedback?: number | null;
}

interface Respuesta {
  enabled: boolean;
  status: "ok" | "calculando" | "apagado";
  disclaimer: string;
  requirements: Requisito[];
  discarded_requirements: { texto: string; motivo?: string }[];
  applicants: Recomendado[];
  talent: Recomendado[];
  talent_limit: number;
  computed_at?: string | null;
}

const VEREDICTO: Record<Evaluacion["verdict"], { simbolo: string; label: string; cls: string }> = {
  si: { simbolo: "✓", label: "Cumple", cls: "text-green-700" },
  parcial: { simbolo: "~", label: "En parte", cls: "text-yellow-800" },
  no: { simbolo: "✗", label: "No cumple", cls: "text-red-700" },
  sin_datos: { simbolo: "—", label: "Sin datos", cls: "text-[#1C2230]" },
};

const REINTENTO_MS = 5000;
const REINTENTO_MAX_MS = 60_000;

type Estado =
  | { tipo: "cargando" }
  | { tipo: "en_desarrollo" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: Respuesta };

interface Resumen { lines: { text: string; evidence?: string | null }[]; generated_with_ai: boolean; disclaimer: string }

function Fila({ r, requisitos, onFeedback, jobId }: { r: Recomendado; requisitos: Requisito[]; onFeedback: (r: Recomendado, v: -1 | 0 | 1) => void; jobId: string }) {
  const [abierto, setAbierto] = useState(false);
  // Resumen en 3 líneas: se pide recién al abrirlo (cuesta una llamada a la IA, después queda en caché).
  const [resumen, setResumen] = useState<Resumen | "cargando" | "error" | null>(null);
  const [verResumen, setVerResumen] = useState(false);
  function toggleResumen() {
    setVerResumen(v => !v);
    if (resumen === null || resumen === "error") {
      setResumen("cargando");
      api.get<Resumen>(`/me/company/jobs/${jobId}/recommendations/${encodeURIComponent(r.candidate_ref)}/summary`)
        .then(x => setResumen(x.data))
        .catch(() => setResumen("error"));
    }
  }
  const texto = (id: string) => requisitos.find(q => q.id === id)?.texto ?? id;
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex flex-col items-center justify-center shrink-0">
          <span className="text-lg font-display font-extrabold leading-none">{r.score}</span>
        </div>
        <div className="flex-1 min-w-[180px]">
          <p className="font-bold text-[#1C2230] flex items-center gap-2">
            {r.locked && <LockClosedIcon className="w-4 h-4 text-[#7A5A44]" />}
            {r.name ?? `Perfil ${r.candidate_ref}`}
            {r.recommended && (
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#E6F4F7] text-[#187B8E]">Recomendado</span>
            )}
          </p>
          <p className="text-xs text-[#1C2230]">Perfil {Math.round(r.coverage * 100)} % completo</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onFeedback(r, r.feedback === 1 ? 0 : 1)} title="Buena recomendación"
                  className={`p-2 rounded-lg border ${r.feedback === 1 ? "border-[#187B8E] bg-[#E6F4F7] text-[#187B8E]" : "border-[#DDE3EC] text-[#1C2230]"}`}>
            <HandThumbUpIcon className="w-4 h-4" />
          </button>
          <button onClick={() => onFeedback(r, r.feedback === -1 ? 0 : -1)} title="Mala recomendación"
                  className={`p-2 rounded-lg border ${r.feedback === -1 ? "border-red-300 bg-red-50 text-red-700" : "border-[#DDE3EC] text-[#1C2230]"}`}>
            <HandThumbDownIcon className="w-4 h-4" />
          </button>
          <button onClick={toggleResumen} className="ml-1 text-sm font-bold text-[#187B8E] px-3 py-2">
            {verResumen ? "Ocultar resumen" : "Resumen"}
          </button>
          <button onClick={() => setAbierto(a => !a)} className="ml-1 text-sm font-bold text-[#187B8E] px-3 py-2">
            {abierto ? "Cerrar" : "Ver detalle"}
          </button>
        </div>
      </div>
      {r.reasons.length > 0 && (
        <ul className="mt-2 ml-15 list-disc pl-5 text-sm text-[#1C2230] space-y-0.5">
          {r.reasons.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      )}
      {verResumen && (
        <div className="mt-3 border border-[#9ED4DF] bg-[#E6F4F7]/40 rounded-xl p-3 text-sm text-[#1C2230]">
          {resumen === "cargando" || resumen === null ? (
            <p>Armando el resumen…</p>
          ) : resumen === "error" ? (
            <p>No se pudo armar el resumen. Probá de nuevo en un rato.</p>
          ) : resumen.lines.length === 0 ? (
            <p>Todavía no hay datos suficientes en el perfil para resumirlo.</p>
          ) : (
            <ul className="space-y-1.5">
              {resumen.lines.map((l, i) => (
                <li key={i}>
                  {l.text}
                  {l.evidence ? <span className="block text-xs mt-0.5">Según el perfil: <q>{l.evidence}</q></span>
                    : r.locked ? <em className="block text-xs mt-0.5">La cita se ve al desbloquear el perfil.</em> : null}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs font-bold mt-2">Orientativo, decide la empresa.</p>
        </div>
      )}
      {abierto && (
        <div className="mt-3 border border-[#DDE3EC] rounded-xl overflow-hidden">
          {r.evaluations.length === 0 ? (
            <p className="p-3 text-sm text-[#1C2230]">Todavía no se evaluó requisito por requisito: el orden sale de los datos del perfil.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[#DDE3EC]/60">
                {r.evaluations.map(e => {
                  const v = VEREDICTO[e.verdict] ?? VEREDICTO.sin_datos;
                  return (
                    <tr key={e.req_id}>
                      <td className="p-3 text-[#1C2230] w-1/3">{texto(e.req_id)}</td>
                      <td className={`p-3 font-bold whitespace-nowrap ${v.cls}`}>{v.simbolo} {v.label}</td>
                      <td className="p-3 text-[#1C2230]">
                        {e.verdict === "sin_datos" ? "" : r.locked ? <em>Se ve al desbloquear el perfil.</em> : e.evidence ? <q>{e.evidence}</q> : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function RecomendadosPage() {
  const [busquedas, setBusquedas] = useState<Busqueda[] | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [aviso, setAviso] = useState<string | null>(null);
  const inicio = useRef(0);

  useEffect(() => {
    api.get<Busqueda[]>("/me/company/jobs")
      .then(r => {
        const activas = r.data.filter(j => j.status !== "draft");
        setBusquedas(activas);
        if (activas[0]) setJobId(activas[0].id);
        else setEstado({ tipo: "listo", datos: { enabled: true, status: "ok", disclaimer: "", requirements: [], discarded_requirements: [], applicants: [], talent: [], talent_limit: 0 } });
      })
      .catch(e => setEstado({ tipo: "error", mensaje: detalleError(e) }));
  }, []);

  // Devuelve el estado nuevo en vez de setearlo: así los efectos lo aplican en el callback.
  const pedir = useCallback(async (id: string): Promise<Estado> => {
    try {
      const r = await api.get<Respuesta>(`/me/company/jobs/${id}/recommendations`);
      return { tipo: "listo", datos: r.data };
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      return status === 404 ? { tipo: "en_desarrollo" } : { tipo: "error", mensaje: detalleError(e) };
    }
  }, []);
  const cargar = useCallback((id: string) => { pedir(id).then(setEstado); }, [pedir]);

  useEffect(() => {
    if (!jobId) return;
    inicio.current = Date.now();
    pedir(jobId).then(setEstado);
  }, [jobId, pedir]);

  // "Calculando": reintenta cada 5 s, como mucho un minuto.
  const calculando = estado.tipo === "listo" && estado.datos.status === "calculando";
  useEffect(() => {
    if (!calculando || !jobId) return;
    if (Date.now() - inicio.current > REINTENTO_MAX_MS) return;
    const t = setTimeout(() => cargar(jobId), REINTENTO_MS);
    return () => clearTimeout(t);
  }, [calculando, estado, jobId, cargar]);

  async function actualizar() {
    setAviso(null);
    try {
      const r = await api.post<{ queued: boolean; remaining_today: number }>(`/me/company/jobs/${jobId}/recommendations/refresh`);
      setAviso(`Lo estamos recalculando. Te quedan ${r.data.remaining_today} actualizaciones hoy.`);
      inicio.current = Date.now();
      setTimeout(() => cargar(jobId), REINTENTO_MS);
    } catch (e) {
      setAviso(detalleError(e, "No se pudo actualizar."));
    }
  }

  async function feedback(r: Recomendado, value: -1 | 0 | 1) {
    try {
      await api.post(`/me/company/jobs/${jobId}/recommendations/feedback`, { candidate_ref: r.candidate_ref, value });
      setEstado(prev => prev.tipo !== "listo" ? prev : {
        tipo: "listo",
        datos: {
          ...prev.datos,
          applicants: prev.datos.applicants.map(a => a.candidate_ref === r.candidate_ref ? { ...a, feedback: value || null } : a),
          talent: prev.datos.talent.map(a => a.candidate_ref === r.candidate_ref ? { ...a, feedback: value || null } : a),
        },
      });
    } catch (e) {
      setAviso(detalleError(e));
    }
  }

  if (estado.tipo === "en_desarrollo") {
    return <EnDesarrollo titulo="Candidatos recomendados" descripcion="Muy pronto vas a ver a tus postulantes ordenados por qué tan bien encajan con cada búsqueda." />;
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1 flex items-center gap-2">
        <SparklesIcon className="w-6 h-6 text-[#187B8E]" /> Candidatos recomendados
      </h1>
      <p className="text-[#1C2230] text-sm mb-5">Tus postulantes ordenados por cuánto encajan con la búsqueda. Ves a todos: ordenar no es descartar.</p>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={jobId} onChange={e => setJobId(e.target.value)} disabled={!busquedas?.length}
                className="border border-[#DDE3EC] rounded-xl px-3 py-2.5 text-sm bg-white text-[#1C2230] min-w-[240px]">
          {(busquedas ?? []).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        {estado.tipo === "listo" && estado.datos.enabled && estado.datos.status === "ok" && (
          <button onClick={actualizar} className="flex items-center gap-1.5 text-sm font-bold border border-[#9ED4DF] bg-[#E6F4F7] text-[#187B8E] px-4 py-2.5 rounded-xl hover:bg-[#D5EBF1]">
            <ArrowPathIcon className="w-4 h-4" /> Actualizar
          </button>
        )}
        {aviso && <p className="text-sm text-[#1C2230]">{aviso}</p>}
      </div>

      {estado.tipo === "cargando" && <div className="text-[#1C2230]">Cargando…</div>}
      {estado.tipo === "error" && <div className="text-red-600">{estado.mensaje}</div>}

      {estado.tipo === "listo" && busquedas && busquedas.length === 0 && (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-[#1C2230]">Todavía no publicaste búsquedas.</div>
      )}

      {estado.tipo === "listo" && busquedas && busquedas.length > 0 && (() => {
        const d = estado.datos;
        if (!d.enabled) {
          return <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-[#1C2230]">Las recomendaciones todavía no están activas.</div>;
        }
        return (
          <>
            {d.disclaimer && (
              <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-2xl p-4 mb-5 flex gap-3">
                <InformationCircleIcon className="w-5 h-5 text-[#187B8E] shrink-0 mt-0.5" />
                <p className="text-sm text-[#1C2230]">{d.disclaimer}</p>
              </div>
            )}

            {d.status === "calculando" ? (
              <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 flex items-center gap-3 text-[#1C2230]">
                <div className="w-5 h-5 border-2 border-[#187B8E] border-t-transparent rounded-full animate-spin" />
                Estamos calculando las recomendaciones de esta búsqueda…
              </div>
            ) : (
              <>
                {(d.requirements.length > 0 || d.discarded_requirements.length > 0) && (
                  <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-5">
                    <p className="font-bold text-[#1C2230] mb-2">Requisitos que se tienen en cuenta</p>
                    <ul className="flex flex-wrap gap-2 mb-1">
                      {d.requirements.map(q => (
                        <li key={q.id} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${q.tipo === "excluyente" ? "border-[#187B8E] text-[#187B8E]" : "border-[#DDE3EC] text-[#1C2230]"}`}>
                          {q.texto}{q.tipo === "excluyente" ? " · excluyente" : ""}
                        </li>
                      ))}
                    </ul>
                    {d.discarded_requirements.length > 0 && (
                      <p className="text-sm text-[#1C2230] mt-3">
                        <strong>No se usan para ordenar</strong> (son datos protegidos):{" "}
                        {d.discarded_requirements.map(x => x.texto).join(" · ")}
                      </p>
                    )}
                  </div>
                )}

                <h2 className="font-display font-bold text-lg text-[#1C2230] mb-2">Postulantes ({d.applicants.length})</h2>
                <div className="bg-white border border-[#DDE3EC] rounded-2xl divide-y divide-[#DDE3EC]/60 overflow-hidden mb-8 shadow-sm">
                  {d.applicants.length === 0 ? (
                    <p className="p-8 text-center text-[#1C2230]">Esta búsqueda todavía no tiene postulantes.</p>
                  ) : d.applicants.map(r => <Fila key={r.candidate_ref} r={r} requisitos={d.requirements} onFeedback={feedback} jobId={jobId} />)}
                </div>

                <h2 className="font-display font-bold text-lg text-[#1C2230] mb-1">De la Base de Talento</h2>
                <p className="text-sm text-[#1C2230] mb-2">
                  Perfiles que no se postularon pero encajan (hasta {d.talent_limit}). Los datos se ven al desbloquearlos en la{" "}
                  <Link href="/dashboard/company/talento" className="font-bold text-[#187B8E] underline">Base de Talento</Link>.
                </p>
                <div className="bg-white border border-[#DDE3EC] rounded-2xl divide-y divide-[#DDE3EC]/60 overflow-hidden shadow-sm">
                  {d.talent.length === 0 ? (
                    <p className="p-8 text-center text-[#1C2230]">Por ahora no hay perfiles de la Base de Talento para esta búsqueda.</p>
                  ) : d.talent.map(r => <Fila key={r.candidate_ref} r={r} requisitos={d.requirements} onFeedback={feedback} jobId={jobId} />)}
                </div>
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
