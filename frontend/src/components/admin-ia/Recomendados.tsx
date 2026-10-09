"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftIcon, ArrowPathIcon, ExclamationTriangleIcon, InformationCircleIcon, LockClosedIcon,
  MagnifyingGlassIcon, EnvelopeIcon, PhoneIcon, UserCircleIcon, DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { detalleError } from "@/hooks/useModulo";
import { useListaPaginada } from "@/hooks/useListaPaginada";
import Paginacion from "@/components/ui/Paginacion";
import {
  Aviso, Confirmar, MOTIVOS, Spinner, fecha, usd, useFichaCandidato,
  type BusquedaIA, type DetalleBusqueda, type RecomendadoAdmin, type Requisito, type Veredicto,
} from "./comun";

const VEREDICTO: Record<Veredicto, { simbolo: string; label: string; cls: string }> = {
  si: { simbolo: "✓", label: "Cumple", cls: "text-green-800" },
  parcial: { simbolo: "~", label: "En parte", cls: "text-yellow-900" },
  no: { simbolo: "✗", label: "No cumple", cls: "text-red-800" },
  sin_datos: { simbolo: "—", label: "Sin datos", cls: "text-[#1C2230]" },
};

interface Resumen { lines: { text: string; evidence?: string | null }[]; generated_with_ai: boolean; disclaimer: string }

function Chip({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "teal" | "naranja" | "rojo" }) {
  const cls = {
    neutro: "border-[#DDE3EC] text-[#1C2230] bg-white",
    teal: "border-[#9ED4DF] text-[#187B8E] bg-[#E6F4F7]",
    naranja: "border-[#D4B7A2] text-[#5C3B22] bg-[#F7EFE9]",
    rojo: "border-red-200 text-red-900 bg-red-50",
  }[tono];
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{children}</span>;
}

function FilaRecomendado({ r, requisitos, jobId, onFicha, onReleerCv }: {
  r: RecomendadoAdmin; requisitos: Requisito[]; jobId: string;
  onFicha: (id: string) => void; onReleerCv: (r: RecomendadoAdmin) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [resumen, setResumen] = useState<Resumen | "cargando" | "error" | null>(null);
  const [verResumen, setVerResumen] = useState(false);
  const texto = (id: string) => requisitos.find(q => q.id === id)?.texto ?? id;

  function toggleResumen() {
    setVerResumen(v => !v);
    if (resumen === null || resumen === "error") {
      setResumen("cargando");
      api.get<Resumen>(`/admin/ai/jobs/${jobId}/recommendations/${encodeURIComponent(r.candidate_ref)}/summary`)
        .then(x => setResumen(x.data))
        .catch(() => setResumen("error"));
    }
  }

  return (
    <div className="px-4 sm:px-5 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center shrink-0">
          <span className="text-lg font-display font-extrabold leading-none">{r.score}</span>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="font-bold text-[#1C2230] flex flex-wrap items-center gap-2">
            {r.locked && <LockClosedIcon className="w-4 h-4 text-[#5C3B22]" aria-label="Perfil ciego" />}
            {r.name ?? `Perfil ${r.candidate_ref}`}
            {r.name && <span className="text-xs font-semibold">{r.candidate_ref}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {r.recommended && <Chip tono="teal">Recomendado</Chip>}
            {r.source === "talent" && <Chip tono="naranja">Base de Talento</Chip>}
            {r.unlocked && <Chip tono="teal">Desbloqueado por la empresa</Chip>}
            {r.source === "talent" && !r.shown_to_company && <Chip>La empresa no lo ve (fuera de su cupo)</Chip>}
            {r.feedback === 1 && <Chip tono="teal">A la empresa le sirvió</Chip>}
            {r.feedback === -1 && <Chip tono="rojo">A la empresa no le sirvió</Chip>}
          </div>
          {(r.email || r.phone) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-[#1C2230]">
              {r.email && (
                <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:text-[#187B8E] break-all">
                  <EnvelopeIcon className="w-4 h-4 shrink-0" /> {r.email}
                </a>
              )}
              {r.phone && (
                <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-[#187B8E]">
                  <PhoneIcon className="w-4 h-4 shrink-0" /> {r.phone}
                </a>
              )}
            </div>
          )}
          <p className="text-xs text-[#1C2230] mt-1.5">
            Perfil {Math.round(r.coverage * 100)} % completo · datos cargados {Math.round(r.hybrid_fit * 100)} %
            {r.semantic_pct != null && <> · parecido con los requisitos {Math.round(r.semantic_pct * 100)} %</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button onClick={toggleResumen} className="text-sm font-bold text-[#187B8E] px-3 py-2 rounded-lg hover:bg-[#E6F4F7]">
            {verResumen ? "Ocultar resumen" : "Resumen"}
          </button>
          <button onClick={() => setAbierto(a => !a)} className="text-sm font-bold text-[#187B8E] px-3 py-2 rounded-lg hover:bg-[#E6F4F7]">
            {abierto ? "Cerrar" : "Requisitos"}
          </button>
          {r.candidate_id && (
            <>
              <button onClick={() => onFicha(r.candidate_id!)}
                      className="inline-flex items-center gap-1 text-sm font-bold text-[#187B8E] px-3 py-2 rounded-lg hover:bg-[#E6F4F7]">
                <UserCircleIcon className="w-4 h-4" /> Ficha
              </button>
              <button onClick={() => onReleerCv(r)}
                      className="inline-flex items-center gap-1 text-sm font-bold text-[#187B8E] px-3 py-2 rounded-lg hover:bg-[#E6F4F7]">
                <DocumentArrowDownIcon className="w-4 h-4" /> Releer CV
              </button>
            </>
          )}
        </div>
      </div>

      {r.alerts.length > 0 && (
        <div className="mt-2 flex items-start gap-2 text-sm text-[#5C3B22] bg-[#F7EFE9] border border-[#D4B7A2] rounded-xl px-3 py-2">
          <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{r.alerts.join(" ")}</span>
        </div>
      )}
      {r.reasons.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm text-[#1C2230] space-y-0.5">
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
                    : r.locked ? <em className="block text-xs mt-0.5">Perfil ciego: la cita se ve cuando la empresa lo desbloquea.</em> : null}
                </li>
              ))}
            </ul>
          )}
          {resumen && typeof resumen === "object" && !resumen.generated_with_ai && resumen.lines.length > 0 && (
            <p className="text-xs mt-2">Sin IA en este momento: son los motivos ya calculados.</p>
          )}
          <p className="text-xs font-bold mt-2">Orientativo: decide la empresa.</p>
        </div>
      )}

      {abierto && (
        <div className="mt-3 border border-[#DDE3EC] rounded-xl overflow-x-auto">
          {r.evaluations.length === 0 ? (
            <p className="p-3 text-sm text-[#1C2230]">Todavía no se evaluó requisito por requisito: el orden sale de los datos del perfil.</p>
          ) : (
            <table className="w-full text-sm min-w-[480px]">
              <tbody className="divide-y divide-[#DDE3EC]/60">
                {r.evaluations.map(e => {
                  const v = VEREDICTO[e.verdict] ?? VEREDICTO.sin_datos;
                  return (
                    <tr key={e.req_id}>
                      <td className="p-3 text-[#1C2230] w-1/3">{texto(e.req_id)}</td>
                      <td className={`p-3 font-bold whitespace-nowrap ${v.cls}`}>{v.simbolo} {v.label}</td>
                      <td className="p-3 text-[#1C2230]">
                        {e.verdict === "sin_datos" ? "" : r.locked ? <em>Perfil ciego: la cita no se muestra.</em> : e.evidence ? <q>{e.evidence}</q> : ""}
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

function DetalleRecomendados({ jobId, onVolver }: { jobId: string; onVolver: () => void }) {
  const [estado, setEstado] = useState<{ t: "cargando" } | { t: "error"; m: string } | { t: "listo"; d: DetalleBusqueda }>({ t: "cargando" });
  const [confirmar, setConfirmar] = useState<null | { tipo: "busqueda" } | { tipo: "cv"; r: RecomendadoAdmin }>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const ficha = useFichaCandidato();

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<DetalleBusqueda>(`/admin/ai/jobs/${jobId}/recommendations`);
      setEstado({ t: "listo", d: r.data });
    } catch (e) {
      setEstado({ t: "error", m: detalleError(e) });
    }
  }, [jobId]);

  useEffect(() => {
    let vigente = true;
    api.get<DetalleBusqueda>(`/admin/ai/jobs/${jobId}/recommendations`)
      .then(r => { if (vigente) setEstado({ t: "listo", d: r.data }); })
      .catch(e => { if (vigente) setEstado({ t: "error", m: detalleError(e) }); });
    return () => { vigente = false; };
  }, [jobId]);

  async function lanzar() {
    if (!confirmar) return;
    setOcupado(true);
    setAviso(null);
    try {
      const url = confirmar.tipo === "busqueda"
        ? `/admin/ai/actions/recompute-job/${jobId}`
        : `/admin/ai/actions/reread-cv/${confirmar.r.candidate_id}`;
      const r = await api.post<{ message: string }>(url);
      setAviso({ tono: "ok", texto: r.data.message });
      if (confirmar.tipo === "busqueda") cargar();
    } catch (e) {
      setAviso({ tono: "error", texto: detalleError(e) });
    } finally {
      setOcupado(false);
      setConfirmar(null);
    }
  }

  const volver = (
    <button onClick={onVolver} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#187B8E] mb-4">
      <ArrowLeftIcon className="w-4 h-4" /> Volver a las búsquedas
    </button>
  );
  if (estado.t === "cargando") return <div>{volver}<div className="py-12 flex justify-center"><Spinner /></div></div>;
  if (estado.t === "error") return <div>{volver}<Aviso tono="error">{estado.m}</Aviso></div>;
  const d = estado.d;
  const activa = d.job.status === "active" && d.job.moderation_status === "approved";

  return (
    <div>
      {volver}
      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex flex-wrap items-start gap-3 justify-between">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-xl text-[#1C2230]">{d.job.title}</h2>
            <p className="text-sm text-[#1C2230] font-semibold">{d.job.company_name}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {d.job.moderation_status === "pending_review" ? <Chip tono="naranja">Pendiente de moderación</Chip>
                : activa ? <Chip tono="teal">Activa</Chip> : <Chip>{d.job.status}</Chip>}
              {d.queued && <Chip tono="teal">En cola para recalcular ({MOTIVOS[d.queue_reason ?? ""] ?? d.queue_reason})</Chip>}
            </div>
          </div>
          {d.enabled && activa && (
            <button onClick={() => setConfirmar({ tipo: "busqueda" })}
                    className="inline-flex items-center gap-1.5 text-sm font-bold border border-[#9ED4DF] bg-[#E6F4F7] text-[#187B8E] px-4 py-2.5 rounded-xl hover:bg-[#D5EBF1]">
              <ArrowPathIcon className="w-4 h-4" /> Recalcular esta búsqueda
            </button>
          )}
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm text-[#1C2230]">
          <div><dt className="text-xs font-bold uppercase tracking-wide">Último cálculo</dt><dd>{fecha(d.computed_at)}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wide">Gasto acumulado</dt><dd>{usd(d.cost_usd)}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wide">Evaluados con IA</dt><dd>{d.rerank_counts?.done ?? 0}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wide">Cupo de la empresa</dt><dd>{d.talent_limit} de la Base</dd></div>
        </dl>
      </div>

      {aviso && <div className="mb-4"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}

      {!d.enabled ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-[#1C2230]">
          La IA de recomendados está apagada. Se prende desde <strong>Mails e IA</strong>.
        </div>
      ) : (
        <>
          <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-2xl p-4 mb-4 flex gap-3">
            <InformationCircleIcon className="w-5 h-5 text-[#187B8E] shrink-0 mt-0.5" />
            <p className="text-sm text-[#1C2230]">
              {d.disclaimer} Talency ve el nombre y el contacto sólo de quien se postuló a esta búsqueda o de los perfiles que la empresa ya desbloqueó; los demás siguen ciegos, como los ve la empresa.
            </p>
          </div>

          {(d.job_injection_flags > 0 || (d.requirements.length > 0 && !d.requirements_with_ai)) && (
            <div className="mb-4 flex items-start gap-2 text-sm text-[#5C3B22] bg-[#F7EFE9] border border-[#D4B7A2] rounded-xl px-3 py-2">
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {d.job_injection_flags > 0 && "El texto del aviso tiene frases que parecen órdenes para la IA: se ignoraron. "}
                {d.requirements.length > 0 && !d.requirements_with_ai && "Los requisitos salieron sólo de las habilidades cargadas (la IA no leyó el texto del aviso)."}
              </span>
            </div>
          )}

          {(d.requirements.length > 0 || d.discarded_requirements.length > 0) && (
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-5">
              <p className="font-bold text-[#1C2230] mb-2">Requisitos que se tienen en cuenta</p>
              <ul className="flex flex-wrap gap-2">
                {d.requirements.map(q => (
                  <li key={q.id} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${q.tipo === "excluyente" ? "border-[#187B8E] text-[#187B8E]" : "border-[#DDE3EC] text-[#1C2230]"}`}>
                    {q.texto}{q.tipo === "excluyente" ? " · excluyente" : ""}
                  </li>
                ))}
              </ul>
              {d.discarded_requirements.length > 0 && (
                <p className="text-sm text-[#1C2230] mt-3">
                  <strong>No se usan para ordenar</strong> (son datos protegidos): {d.discarded_requirements.map(x => x.texto).join(" · ")}
                </p>
              )}
            </div>
          )}

          {d.status === "sin_calcular" ? (
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-[#1C2230]">
              Todavía no hay recomendados calculados para esta búsqueda.
              {activa ? " Apretá “Recalcular esta búsqueda” y en unos minutos aparecen." : " Se calculan cuando la búsqueda esté activa y aprobada."}
            </div>
          ) : (
            <>
              <h3 className="font-display font-bold text-lg text-[#1C2230] mb-2">Postulantes ({d.applicants.length})</h3>
              <div className="bg-white border border-[#DDE3EC] rounded-2xl divide-y divide-[#DDE3EC]/60 overflow-hidden mb-8 shadow-sm">
                {d.applicants.length === 0 ? (
                  <p className="p-8 text-center text-[#1C2230]">Esta búsqueda todavía no tiene postulantes.</p>
                ) : d.applicants.map(r => (
                  <FilaRecomendado key={r.candidate_ref} r={r} requisitos={d.requirements} jobId={d.job.id}
                                   onFicha={ficha.abrir} onReleerCv={x => setConfirmar({ tipo: "cv", r: x })} />
                ))}
              </div>
              <h3 className="font-display font-bold text-lg text-[#1C2230] mb-1">De la Base de Talento ({d.talent.length})</h3>
              <p className="text-sm text-[#1C2230] mb-2">
                Los mejores perfiles que no se postularon. La empresa ve los primeros {d.talent_limit}; Talency ve todos, ciegos hasta que la empresa los desbloquea.
              </p>
              <div className="bg-white border border-[#DDE3EC] rounded-2xl divide-y divide-[#DDE3EC]/60 overflow-hidden shadow-sm">
                {d.talent.length === 0 ? (
                  <p className="p-8 text-center text-[#1C2230]">No hay perfiles de la Base de Talento para esta búsqueda.</p>
                ) : d.talent.map(r => (
                  <FilaRecomendado key={r.candidate_ref} r={r} requisitos={d.requirements} jobId={d.job.id}
                                   onFicha={ficha.abrir} onReleerCv={x => setConfirmar({ tipo: "cv", r: x })} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {confirmar && (
        <Confirmar
          titulo={confirmar.tipo === "busqueda" ? "¿Recalcular esta búsqueda?" : "¿Releer el CV?"}
          texto={confirmar.tipo === "busqueda"
            ? "Se pone en la cola y se recalcula en los próximos 10 minutos. Gasta IA sólo en los perfiles que cambiaron, y siempre dentro del tope diario."
            : `Se vuelve a leer y anonimizar el CV de ${confirmar.r.name ?? "este candidato"} y se actualiza lo que lee la IA. El resultado queda en Actividad.`}
          boton={confirmar.tipo === "busqueda" ? "Recalcular" : "Releer CV"}
          ocupado={ocupado} onSi={lanzar} onNo={() => setConfirmar(null)}
        />
      )}
      {ficha.modal}
    </div>
  );
}

export default function Recomendados({ jobInicial, onJobAbierto }: { jobInicial: string | null; onJobAbierto: (id: string | null) => void }) {
  const [estadoFiltro, setEstadoFiltro] = useState<"todas" | "activas" | "pendientes">("todas");
  const [q, setQ] = useState("");
  const lista = useListaPaginada<BusquedaIA>(jobInicial ? null : "/admin/ai/jobs", { estado: estadoFiltro, q: q.trim() || undefined }, { debounceMs: 300 });

  if (jobInicial) return <DetalleRecomendados jobId={jobInicial} onVolver={() => onJobAbierto(null)} />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <span className="sr-only">Buscar por búsqueda o empresa</span>
          <MagnifyingGlassIcon className="w-4 h-4 text-[#1C2230] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por puesto o empresa"
                 className="w-full border border-[#DDE3EC] rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white text-[#1C2230]" />
        </label>
        <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value as typeof estadoFiltro)}
                aria-label="Qué búsquedas mostrar"
                className="border border-[#DDE3EC] rounded-xl px-3 py-2.5 text-sm bg-white text-[#1C2230]">
          <option value="todas">Activas y pendientes</option>
          <option value="activas">Sólo activas</option>
          <option value="pendientes">Sólo pendientes de moderación</option>
        </select>
      </div>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#DDE3EC]/60">
        {lista.cargando ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : lista.error ? (
          <p className="p-8 text-center text-red-800">No se pudo cargar el listado. Probá de nuevo.</p>
        ) : lista.items.length === 0 ? (
          <p className="p-8 text-center text-[#1C2230]">
            {q ? "Ninguna búsqueda coincide con lo que escribiste." : "No hay búsquedas activas ni pendientes."}
          </p>
        ) : lista.items.map(b => (
          <button key={b.job_id} onClick={() => onJobAbierto(b.job_id)}
                  className="w-full text-left px-4 sm:px-5 py-4 hover:bg-[#FAFBFD] focus:bg-[#FAFBFD] flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#1C2230] truncate">{b.title}</p>
              <p className="text-sm text-[#1C2230]">{b.company_name}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {b.moderation_status === "pending_review" ? <Chip tono="naranja">Pendiente de moderación</Chip> : <Chip tono="teal">Activa</Chip>}
                {b.queued && <Chip tono="teal">En cola</Chip>}
              </div>
            </div>
            <dl className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-1 text-sm text-[#1C2230] lg:w-[560px] shrink-0">
              <div><dt className="text-[11px] font-bold uppercase">Postulantes</dt><dd className="font-semibold">{b.applicants}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase">Recomendados</dt><dd className="font-semibold">{b.recommended} de {b.recommendations}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase">Mejor</dt><dd className="font-semibold">{b.best_score ?? "—"}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase">Último cálculo</dt><dd className="font-semibold">{b.last_computed_at ? fecha(b.last_computed_at) : "Sin calcular"}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase">Gasto</dt><dd className="font-semibold">{usd(b.cost_usd)}</dd></div>
            </dl>
          </button>
        ))}
      </div>
      {lista.items.length > 0 && (
        <div className="mt-4">
          <Paginacion pagina={lista.pagina} totalPaginas={lista.totalPaginas} total={lista.total}
                      pageSize={lista.pageSize} etiqueta="búsquedas" onCambiar={lista.irAPagina} />
        </div>
      )}
    </div>
  );
}
