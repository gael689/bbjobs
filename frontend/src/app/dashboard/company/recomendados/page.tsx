"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SparklesIcon, ArrowPathIcon, HandThumbUpIcon, HandThumbDownIcon, LockClosedIcon, ChevronDownIcon, ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import { NivelChip, PuntajeAnillo, RequisitosBarra, VEREDICTO_DETALLE, type Veredicto } from "@/components/recomendados/Visual";

interface Busqueda { id: string; title: string; status: string }

interface Requisito { id: string; texto: string; tipo: string }

interface Evaluacion { req_id: string; verdict: Veredicto; evidence?: string | null }

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
  // Postulantes sin puntaje: pidieron que su perfil no se use en recomendaciones, o todavía no
  // se calcularon. Se muestran igual: nadie desaparece de la vista de la empresa.
  unscored_applicants?: { candidate_id: string; application_id: string; name: string }[];
  talent: Recomendado[];
  talent_limit: number;
  computed_at?: string | null;
}

const REINTENTO_MS = 5000;
const REINTENTO_MAX_MS = 60_000;
const DESTACADOS = 3;

type Estado =
  | { tipo: "cargando" }
  | { tipo: "en_desarrollo" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; datos: Respuesta };

interface Resumen { lines: { text: string; evidence?: string | null }[]; generated_with_ai: boolean; disclaimer: string }

function hace(iso?: string | null): string {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 2) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function nombre(r: Recomendado) {
  return r.name ?? `Perfil ${r.candidate_ref}`;
}

/** El resumen de 3 líneas: se pide recién al abrir el detalle (después queda en caché). */
function ResumenIA({ r, jobId }: { r: Recomendado; jobId: string }) {
  const [resumen, setResumen] = useState<Resumen | "cargando" | "error">("cargando");
  useEffect(() => {
    let vigente = true;
    api.get<Resumen>(`/me/company/jobs/${jobId}/recommendations/${encodeURIComponent(r.candidate_ref)}/summary`)
      .then(x => { if (vigente) setResumen(x.data); })
      .catch(() => { if (vigente) setResumen("error"); });
    return () => { vigente = false; };
  }, [jobId, r.candidate_ref]);

  if (resumen === "cargando") {
    return (
      <div className="space-y-2" aria-label="Armando el resumen">
        {[90, 75, 60].map(w => <div key={w} className="h-3 rounded-full bg-[#E6F4F7] animate-pulse" style={{ width: `${w}%` }} />)}
      </div>
    );
  }
  if (resumen === "error") return <p className="text-sm text-[#1C2230]">No se pudo armar el resumen. Probá de nuevo en un rato.</p>;
  if (resumen.lines.length === 0) return <p className="text-sm text-[#1C2230]">Todavía no hay datos suficientes para resumirlo.</p>;
  return (
    <ul className="space-y-2">
      {resumen.lines.map((l, i) => (
        <li key={i} className="flex gap-2 text-sm text-[#1C2230]">
          <SparklesIcon className="w-4 h-4 text-[#1E8EA3] shrink-0 mt-0.5" />
          <span>
            {l.text}
            {l.evidence ? <span className="block text-xs mt-0.5 italic">“{l.evidence}”</span>
              : r.locked ? <span className="block text-xs mt-0.5 italic">La cita se ve al desbloquear el perfil.</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Detalle({ r, requisitos, jobId }: { r: Recomendado; requisitos: Requisito[]; jobId: string }) {
  const texto = (id: string) => requisitos.find(q => q.id === id)?.texto ?? id;
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl bg-gradient-to-br from-[#E6F4F7] to-white border border-[#9ED4DF] p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[#187B8E] mb-2">En 3 líneas</p>
        <ResumenIA r={r} jobId={jobId} />
      </div>
      <div className="rounded-xl border border-[#DDE3EC] p-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-[#187B8E] mb-2">Requisito por requisito</p>
        {r.evaluations.length === 0 ? (
          <p className="text-sm text-[#1C2230]">El orden sale de los datos del perfil.</p>
        ) : (
          <ul className="space-y-2">
            {r.evaluations.map(e => {
              const v = VEREDICTO_DETALLE[e.verdict] ?? VEREDICTO_DETALLE.sin_datos;
              return (
                <li key={e.req_id} className="text-sm text-[#1C2230]">
                  <span className="font-extrabold mr-1.5" style={{ color: v.color }}>{v.simbolo}</span>
                  {texto(e.req_id)}
                  {e.verdict !== "sin_datos" && (r.locked
                    ? <span className="block text-xs italic ml-5">Se ve al desbloquear el perfil.</span>
                    : e.evidence ? <span className="block text-xs italic ml-5">“{e.evidence}”</span> : null)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Pulgares({ r, onFeedback }: { r: Recomendado; onFeedback: (r: Recomendado, v: -1 | 0 | 1) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onFeedback(r, r.feedback === 1 ? 0 : 1)} title="Buena recomendación" aria-pressed={r.feedback === 1}
              className={`p-2 rounded-lg border transition-colors ${r.feedback === 1 ? "border-[#187B8E] bg-[#E6F4F7] text-[#187B8E]" : "border-[#DDE3EC] text-[#1C2230] hover:border-[#9ED4DF]"}`}>
        <HandThumbUpIcon className="w-4 h-4" />
      </button>
      <button onClick={() => onFeedback(r, r.feedback === -1 ? 0 : -1)} title="Mala recomendación" aria-pressed={r.feedback === -1}
              className={`p-2 rounded-lg border transition-colors ${r.feedback === -1 ? "border-red-300 bg-red-50 text-red-700" : "border-[#DDE3EC] text-[#1C2230] hover:border-red-200"}`}>
        <HandThumbDownIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Tarjeta grande para los mejores postulantes: se entiende sin abrir nada. */
function Destacado({ r, puesto, requisitos, onFeedback, onAbrir }: {
  r: Recomendado; puesto: number; requisitos: Requisito[];
  onFeedback: (r: Recomendado, v: -1 | 0 | 1) => void; onAbrir: (ref: string) => void;
}) {
  const texto = (id: string) => requisitos.find(q => q.id === id)?.texto ?? id;
  return (
    <div className="relative bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm hover:shadow-[0_12px_30px_-12px_rgba(30,142,163,0.35)] hover:-translate-y-0.5 transition-all flex flex-col">
      <span className="absolute top-4 right-4 text-xs font-extrabold text-[#187B8E] bg-[#E6F4F7] rounded-full w-7 h-7 flex items-center justify-center">
        {puesto}
      </span>
      <div className="flex items-center gap-3 mb-3 pr-8">
        <PuntajeAnillo score={r.score} size={72} />
        <div className="min-w-0">
          <p className="font-display font-bold text-[#1C2230] text-lg leading-tight truncate">{nombre(r)}</p>
          <div className="mt-1"><NivelChip score={r.score} /></div>
        </div>
      </div>
      {r.reasons.length > 0 && (
        <ul className="space-y-1 mb-3 text-sm text-[#1C2230]">
          {r.reasons.slice(0, 2).map((m, i) => (
            <li key={i} className="flex gap-1.5"><span className="text-[#1E8EA3] font-extrabold">✓</span><span className="line-clamp-2">{m}</span></li>
          ))}
        </ul>
      )}
      <div className="mt-auto space-y-3">
        <RequisitosBarra evaluaciones={r.evaluations} texto={texto} />
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => onAbrir(r.candidate_ref)} className="text-sm font-bold text-[#187B8E] hover:underline">
            Ver por qué
          </button>
          <Pulgares r={r} onFeedback={onFeedback} />
        </div>
      </div>
    </div>
  );
}

function Fila({ r, requisitos, onFeedback, jobId, abierto, onToggle }: {
  r: Recomendado; requisitos: Requisito[]; onFeedback: (r: Recomendado, v: -1 | 0 | 1) => void; jobId: string;
  abierto: boolean; onToggle: () => void;
}) {
  const texto = (id: string) => requisitos.find(q => q.id === id)?.texto ?? id;
  return (
    <div id={`rec-${r.candidate_ref}`} className={`px-4 sm:px-5 py-4 transition-colors ${abierto ? "bg-[#FAFBFD]" : ""}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <PuntajeAnillo score={r.score} size={48} />
        <div className="flex-1 min-w-[180px]">
          <p className="font-bold text-[#1C2230] flex flex-wrap items-center gap-2">
            {r.locked && <LockClosedIcon className="w-4 h-4 text-[#5C3B22]" aria-label="Perfil ciego" />}
            {nombre(r)}
            <NivelChip score={r.score} />
          </p>
          {r.reasons[0] && <p className="text-sm text-[#1C2230] mt-0.5 line-clamp-1">{r.reasons[0]}</p>}
        </div>
        <div className="w-full sm:w-auto sm:min-w-[220px]">
          <RequisitosBarra evaluaciones={r.evaluations} texto={texto} />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Pulgares r={r} onFeedback={onFeedback} />
          <button onClick={onToggle} aria-expanded={abierto}
                  className="inline-flex items-center gap-1 text-sm font-bold text-[#187B8E] px-3 py-2 rounded-lg hover:bg-[#E6F4F7]">
            {abierto ? "Cerrar" : "Por qué"}
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {abierto && <Detalle r={r} requisitos={requisitos} jobId={jobId} />}
    </div>
  );
}

export default function RecomendadosPage() {
  const [busquedas, setBusquedas] = useState<Busqueda[] | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
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
      setAviso(`Recalculando. Te quedan ${r.data.remaining_today} hoy.`);
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

  function abrirDesdeDestacado(ref: string) {
    setAbierto(ref);
    requestAnimationFrame(() => document.getElementById(`rec-${ref}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  if (estado.tipo === "en_desarrollo") {
    return <EnDesarrollo titulo="Candidatos recomendados" descripcion="Muy pronto vas a ver a tus postulantes ordenados por qué tan bien encajan con cada búsqueda." />;
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B171D] via-[#12303A] to-[#16404B] text-white p-6 sm:p-7 mb-6">
        <div aria-hidden className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[#1E8EA3]/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 left-10 w-56 h-56 rounded-full bg-[#D4B7A2]/15 blur-3xl" />
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider bg-white/10 rounded-full px-2.5 py-1 mb-3">
            <SparklesIcon className="w-3.5 h-3.5" /> Recomendados
          </p>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold leading-tight">¿Quién encaja mejor?</h1>
          <p className="text-[#D6E9EE] text-sm mt-1">Tus postulantes, del que más encaja al que menos. Ves a todos.</p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <select value={jobId} onChange={e => { setJobId(e.target.value); setAbierto(null); }} disabled={!busquedas?.length}
                    aria-label="Búsqueda"
                    className="rounded-xl px-3.5 py-2.5 text-sm font-bold bg-white text-[#1C2230] min-w-[240px] max-w-full">
              {(busquedas ?? []).map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            {estado.tipo === "listo" && estado.datos.enabled && estado.datos.status === "ok" && (
              <button onClick={actualizar} className="inline-flex items-center gap-1.5 text-sm font-bold bg-white/10 hover:bg-white/20 px-3.5 py-2.5 rounded-xl transition-colors">
                <ArrowPathIcon className="w-4 h-4" /> Actualizar
              </button>
            )}
            {estado.tipo === "listo" && estado.datos.computed_at && (
              <span className="text-xs text-[#D6E9EE]">Calculado {hace(estado.datos.computed_at)}</span>
            )}
          </div>
          {aviso && <p className="text-sm mt-3 font-semibold">{aviso}</p>}
        </div>
      </div>

      {estado.tipo === "cargando" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(i => <div key={i} className="h-48 rounded-2xl bg-white border border-[#DDE3EC] animate-pulse" />)}
        </div>
      )}
      {estado.tipo === "error" && <div className="text-red-700 font-semibold">{estado.mensaje}</div>}

      {estado.tipo === "listo" && busquedas && busquedas.length === 0 && (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-[#1C2230]">Todavía no publicaste búsquedas.</div>
      )}

      {estado.tipo === "listo" && busquedas && busquedas.length > 0 && (() => {
        const d = estado.datos;
        if (!d.enabled) {
          return <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-[#1C2230]">Las recomendaciones todavía no están activas.</div>;
        }
        if (d.status === "calculando") {
          return (
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 flex items-center gap-4 text-[#1C2230]">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-[#E6F4F7]" />
                <div className="absolute inset-0 rounded-full border-4 border-[#1E8EA3] border-t-transparent animate-spin" />
              </div>
              <div>
                <p className="font-bold">Estamos leyendo los perfiles…</p>
                <p className="text-sm">En un momento aparecen ordenados.</p>
              </div>
            </div>
          );
        }
        const destacados = d.applicants.filter(a => a.recommended).slice(0, DESTACADOS);
        const muyBien = d.applicants.filter(a => a.score >= 80).length;
        return (
          <>
            {d.applicants.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="text-sm font-bold text-[#0F5E6C] bg-[#E6F4F7] rounded-full px-3 py-1.5">
                  {muyBien} {muyBien === 1 ? "encaja" : "encajan"} muy bien
                </span>
                <span className="text-sm font-bold text-[#1C2230] bg-white border border-[#DDE3EC] rounded-full px-3 py-1.5">
                  {d.applicants.length + (d.unscored_applicants?.length ?? 0)} postulantes
                </span>
                {d.talent.length > 0 && (
                  <span className="text-sm font-bold text-[#5C3B22] bg-[#F7EFE9] rounded-full px-3 py-1.5">
                    +{d.talent.length} de la Base de Talento
                  </span>
                )}
              </div>
            )}

            {destacados.length > 0 && (
              <section className="mb-8">
                <h2 className="font-display font-bold text-lg text-[#1C2230] mb-3">Para mirar primero</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {destacados.map((r, i) => (
                    <Destacado key={r.candidate_ref} r={r} puesto={i + 1} requisitos={d.requirements}
                               onFeedback={feedback} onAbrir={abrirDesdeDestacado} />
                  ))}
                </div>
              </section>
            )}

            <section className="mb-8">
              <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                <h2 className="font-display font-bold text-lg text-[#1C2230]">Todos los postulantes</h2>
                <Link href="/dashboard/company/postulaciones" className="inline-flex items-center gap-1 text-sm font-bold text-[#187B8E] hover:underline">
                  Ir a Postulaciones <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="bg-white border border-[#DDE3EC] rounded-2xl divide-y divide-[#DDE3EC]/60 overflow-hidden shadow-sm">
                {d.applicants.length === 0 ? (
                  <p className="p-8 text-center text-[#1C2230]">Esta búsqueda todavía no tiene postulantes.</p>
                ) : d.applicants.map(r => (
                  <Fila key={r.candidate_ref} r={r} requisitos={d.requirements} onFeedback={feedback} jobId={jobId}
                        abierto={abierto === r.candidate_ref} onToggle={() => setAbierto(a => a === r.candidate_ref ? null : r.candidate_ref)} />
                ))}
              </div>

              {(d.unscored_applicants?.length ?? 0) > 0 && (
                <div className="mt-3 bg-white border border-[#DDE3EC] rounded-2xl p-4">
                  <p className="text-sm text-[#1C2230] mb-2">
                    <strong>Sin puntaje ({d.unscored_applicants!.length}):</strong> pidieron no usar su perfil o todavía no se calculó. Revisalos igual en Postulaciones.
                  </p>
                  <ul className="flex flex-wrap gap-2 text-sm text-[#1C2230]">
                    {d.unscored_applicants!.map(u => (
                      <li key={u.application_id} className="px-3 py-1 rounded-full bg-[#FAFBFD] border border-[#DDE3EC]">{u.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="mb-8">
              <h2 className="font-display font-bold text-lg text-[#1C2230]">De la Base de Talento</h2>
              <p className="text-sm text-[#1C2230] mb-2">
                No se postularon pero encajan. Desbloquealos en la{" "}
                <Link href="/dashboard/company/talento" className="font-bold text-[#187B8E] underline">Base de Talento</Link>.
              </p>
              <div className="bg-white border border-[#DDE3EC] rounded-2xl divide-y divide-[#DDE3EC]/60 overflow-hidden shadow-sm">
                {d.talent.length === 0 ? (
                  <p className="p-8 text-center text-[#1C2230]">Por ahora no hay perfiles para esta búsqueda.</p>
                ) : d.talent.map(r => (
                  <Fila key={r.candidate_ref} r={r} requisitos={d.requirements} onFeedback={feedback} jobId={jobId}
                        abierto={abierto === r.candidate_ref} onToggle={() => setAbierto(a => a === r.candidate_ref ? null : r.candidate_ref)} />
                ))}
              </div>
            </section>

            {(d.requirements.length > 0 || d.discarded_requirements.length > 0) && (
              <details className="bg-white border border-[#DDE3EC] rounded-2xl p-4 mb-4 group">
                <summary className="cursor-pointer font-bold text-[#1C2230] text-sm list-none flex items-center justify-between">
                  Qué se tiene en cuenta ({d.requirements.length} requisitos)
                  <ChevronDownIcon className="w-4 h-4 group-open:rotate-180 transition-transform" />
                </summary>
                <ul className="flex flex-wrap gap-2 mt-3">
                  {d.requirements.map(q => (
                    <li key={q.id} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${q.tipo === "excluyente" ? "border-[#187B8E] text-[#187B8E]" : "border-[#DDE3EC] text-[#1C2230]"}`}>
                      {q.texto}{q.tipo === "excluyente" ? " · excluyente" : ""}
                    </li>
                  ))}
                </ul>
                {d.discarded_requirements.length > 0 && (
                  <p className="text-sm text-[#1C2230] mt-3">
                    <strong>No se usan</strong> (datos protegidos): {d.discarded_requirements.map(x => x.texto).join(" · ")}
                  </p>
                )}
              </details>
            )}
            {d.disclaimer && <p className="text-xs text-[#1C2230]">{d.disclaimer}</p>}
          </>
        );
      })()}
    </div>
  );
}
