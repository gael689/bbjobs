"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChatBubbleLeftEllipsisIcon, LockClosedIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Observaciones de la empresa sobre una persona (módulo nuevo, detrás de NEXT_PUBLIC_MODULOS_NUEVOS).
 *
 * Son **siempre privadas** (Eugenia, 22/10/2026): no hay casilla para que las vea el postulante,
 * que ni siquiera sabe que existen. Las ve la empresa que las escribió, en cualquier búsqueda
 * futura sobre esa persona, y el equipo de Talency en sólo lectura. Ninguna se edita ni vence. El
 * texto se muestra como texto plano: React lo escapa y no se arman links.
 */

export const NOTA_MAX = 1000;

/** Las etiquetas rápidas son una lista cerrada que valida el backend (`NOTE_TAGS`). */
export const ETIQUETAS_NOTA: { valor: string; label: string }[] = [
  { valor: "no_se_presento", label: "No se presentó" },
  { valor: "ya_entrevistado", label: "Ya entrevistado" },
  { valor: "referencias_a_revisar", label: "Referencias a revisar" },
];

const LABEL_ETIQUETA: Record<string, string> = Object.fromEntries(ETIQUETAS_NOTA.map(e => [e.valor, e.label]));

export interface NotaObservacion {
  id: string;
  candidate_id: string;
  application_id?: string | null;
  job_title?: string | null;
  body: string | null;
  tags: string[];
  status_at_time?: string | null;
  created_at: string;
}

export interface NotaParaTalency extends NotaObservacion {
  company_id: string;
  company_name?: string | null;
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** El cartel que acompaña a cualquier campo de observación: registrar hechos, no datos
 *  sensibles (Ley 23.592), y quién la puede leer. */
export function CartelObservacion() {
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[11.5px] leading-relaxed text-[#8A6A54] bg-[#D4B7A2]/15 border border-[#D4B7A2]/60 rounded-lg px-2.5 py-1.5">
        Registrá hechos, no opiniones. No incluyas edad, género, estado civil, salud ni otros datos sensibles
        (Ley 23.592): un motivo discriminatorio por escrito expone a tu empresa.
      </p>
      <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[#64748B]">
        <LockClosedIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>La observación es privada: no la ve el postulante ni otras empresas. El equipo de Talency puede leerla.</span>
      </p>
    </div>
  );
}

/** Etiquetas rápidas opcionales, para marcar con un toque los casos más comunes. */
export function EtiquetasRapidas({ valor, onChange }: { valor: string[]; onChange: (v: string[]) => void }) {
  function alternar(t: string) {
    onChange(valor.includes(t) ? valor.filter(x => x !== t) : [...valor, t]);
  }
  return (
    <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Etiquetas rápidas">
      {ETIQUETAS_NOTA.map(e => {
        const activa = valor.includes(e.valor);
        return (
          <button
            key={e.valor}
            type="button"
            onClick={() => alternar(e.valor)}
            aria-pressed={activa}
            className={`text-[11.5px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
              activa
                ? "bg-[#1E8EA3] text-white border-[#1E8EA3]"
                : "bg-white text-[#64748B] border-[#DDE3EC] hover:border-[#9ED4DF]"
            }`}
          >
            {e.label}
          </button>
        );
      })}
    </div>
  );
}

function Etiquetas({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <>
      {tags.map(t => (
        <span key={t} className="text-[10.5px] font-bold bg-[#E6F4F7] text-[#187B8E] border border-[#9ED4DF] px-1.5 py-0.5 rounded-full">
          {LABEL_ETIQUETA[t] ?? t}
        </span>
      ))}
    </>
  );
}

/** Observaciones de **tu empresa** sobre esta persona y el formulario para sumar una. Va al pie
 *  de la ficha del candidato; `applicationId` (si la ficha se abrió desde una postulación) deja
 *  registrado de qué búsqueda salió. */
export function NotasPostulacion({ candidateId, applicationId }: { candidateId: string; applicationId?: string | null }) {
  const [notas, setNotas] = useState<NotaObservacion[] | null>(null);
  const [texto, setTexto] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api.get(`/me/company/candidates/${candidateId}/notes`)
      .then(r => { if (vigente) setNotas(r.data); })
      .catch(() => { if (vigente) setNotas([]); });
    return () => { vigente = false; };
  }, [candidateId]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await api.post(`/me/company/candidates/${candidateId}/notes`, {
        body: texto.trim(),
        tags,
        ...(applicationId ? { application_id: applicationId } : {}),
      });
      setNotas(prev => [r.data, ...(prev ?? [])]);
      setTexto("");
      setTags([]);
    } catch {
      setError("No pudimos guardar la observación. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(nota: NotaObservacion) {
    if (!window.confirm("¿Borrar la observación?")) return;
    try {
      await api.delete(`/me/company/notes/${nota.id}`);
      setNotas(prev => (prev ?? []).filter(n => n.id !== nota.id));
    } catch {
      setError("No pudimos borrar la observación. Probá de nuevo.");
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-[#DDE3EC]">
      <div className="flex items-center gap-2 mb-3">
        <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-[#1E8EA3]" />
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Observaciones de tu empresa sobre esta persona</p>
      </div>

      {notas === null ? (
        <div className="py-4 flex justify-center">
          <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notas.length === 0 ? (
        <p className="text-xs text-[#64748B] mb-3">Todavía no hay observaciones.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {notas.map(n => (
            <div key={n.id} className="border border-[#DDE3EC] rounded-xl px-4 py-3 bg-[#FAFBFD]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-[#64748B]">{fechaCorta(n.created_at)}</span>
                  {n.job_title && <span className="text-[11px] text-[#64748B]">· Búsqueda: {n.job_title}</span>}
                  <Etiquetas tags={n.tags} />
                </div>
                <button
                  type="button"
                  onClick={() => borrar(n)}
                  className="text-[#64748B] hover:text-red-600 transition-colors"
                  aria-label="Borrar observación"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-[#1C2230] whitespace-pre-line break-words">{n.body}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={guardar}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          maxLength={NOTA_MAX}
          rows={3}
          placeholder="Agregar una observación"
          className="w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-y"
        />
        <EtiquetasRapidas valor={tags} onChange={setTags} />
        <CartelObservacion />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="submit"
            disabled={guardando || !texto.trim()}
            className="text-xs font-bold bg-[#1E8EA3] text-white rounded-lg px-3 py-1.5 hover:bg-[#187B8E] transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar observación"}
          </button>
          <span className="text-[11px] text-[#64748B]">{texto.length}/{NOTA_MAX}</span>
          {error && <span className="text-[11px] text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}

/** Lo que ve el equipo de Talency en la ficha de un candidato: las observaciones de **todas** las
 *  empresas, en sólo lectura. Cada vez que se abre queda registrado en el backend. */
export function ObservacionesParaTalency({ candidateId }: { candidateId: string }) {
  const [notas, setNotas] = useState<NotaParaTalency[] | null>(null);
  const [error, setError] = useState(false);
  // Con la compuerta de módulos nuevos cerrada el backend responde 404: no hay nada que mostrar.
  const [apagado, setApagado] = useState(false);

  useEffect(() => {
    let vigente = true;
    api.get(`/admin/candidates/${candidateId}/notes`)
      .then(r => { if (vigente) setNotas(r.data); })
      .catch(e => {
        if (!vigente) return;
        if (e?.response?.status === 404) setApagado(true);
        setNotas([]);
        setError(true);
      });
    return () => { vigente = false; };
  }, [candidateId]);

  if (apagado) return null;

  return (
    <div className="mt-8 pt-6 border-t border-[#DDE3EC]">
      <div className="flex items-center gap-2 mb-1">
        <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-[#1E8EA3]" />
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Observaciones de las empresas</p>
      </div>
      <p className="text-[11.5px] text-[#64748B] mb-3">
        Sólo lectura. Son privadas: el postulante y las otras empresas no las ven. Cada lectura queda registrada.
      </p>
      {notas === null ? (
        <div className="py-4 flex justify-center">
          <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-xs text-red-600">No pudimos cargar las observaciones.</p>
      ) : notas.length === 0 ? (
        <p className="text-xs text-[#64748B]">Ninguna empresa dejó observaciones sobre esta persona.</p>
      ) : (
        <div className="space-y-2">
          {notas.map(n => (
            <div key={n.id} className="border border-[#DDE3EC] rounded-xl px-4 py-3 bg-[#FAFBFD]">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-bold text-[#1C2230]">{n.company_name ?? "Empresa"}</span>
                <span className="text-[11px] text-[#64748B]">{fechaCorta(n.created_at)}</span>
                {n.job_title && <span className="text-[11px] text-[#64748B]">· Búsqueda: {n.job_title}</span>}
                <Etiquetas tags={n.tags} />
              </div>
              <p className="text-sm text-[#1C2230] whitespace-pre-line break-words">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cuadro que se abre al cambiar el estado: confirma el cambio y deja agregar una observación
 *  opcional en el mismo paso (el caso típico: "No avanza" y el motivo). */
interface VistaPreviaMail {
  sends_email: boolean;
  delay_hours: number;
  subject: string | null;
  html: string | null;
}

/** El mail que le llegaría al postulante (pedido de Eugenia, 08/10/2026). Lo arma el backend con
 *  el mismo texto y el mismo diseño que la cola de mails, con el nombre y el puesto reales. La
 *  observación nunca entra al mail, así que sólo depende del estado. */
function useVistaPreviaMail(appId: string, status: string) {
  const [vista, setVista] = useState<VistaPreviaMail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vigente = true;
    api.post<VistaPreviaMail>(`/me/company/applications/${appId}/status-preview`, { status })
      .then(r => { if (vigente) { setVista(r.data); setError(false); } })
      .catch(() => { if (vigente) setError(true); });
    return () => { vigente = false; };
  }, [appId, status]);
  return { vista, error };
}

function VistaPreviaDelMail({ vista, error }: { vista: VistaPreviaMail | null; error: boolean }) {
  if (error) {
    return (
      <p className="mt-4 text-xs text-[#1C2230] bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-3 py-2">
        Al guardar, el postulante recibe un aviso con el cambio de estado.
      </p>
    );
  }
  if (!vista) {
    return <div className="mt-4 h-24 rounded-xl bg-[#FAFBFD] border border-[#DDE3EC] animate-pulse" aria-hidden />;
  }
  if (!vista.sends_email || !vista.html) {
    return (
      <p className="mt-4 text-xs text-[#1C2230] bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-3 py-2">
        Este estado no le manda un mail al postulante: lo ve en su panel de postulaciones.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-xs font-bold text-[#1C2230] mb-1.5 uppercase tracking-wide">
        Le va a llegar este mail al postulante
      </p>
      <p className="text-xs text-[#1C2230] mb-2">
        <span className="font-semibold">Asunto:</span> {vista.subject}
        {vista.delay_hours > 0 && (
          <> · Sale {vista.delay_hours} h después, y sólo si no cambiás el estado antes.</>
        )}
      </p>
      <iframe
        title="Vista previa del mail al postulante"
        sandbox=""
        srcDoc={vista.html}
        className="w-full h-72 rounded-xl border border-[#DDE3EC] bg-white"
      />
      <p className="mt-1.5 text-[11.5px] text-[#64748B]">
        Tu observación no aparece en el mail: el postulante no la ve.
      </p>
    </div>
  );
}

export function CambioEstadoConNota({
  appId, status, estadoLabel, onCancelar, onConfirmar,
}: {
  appId: string;
  status: string;
  estadoLabel: string;
  onCancelar: () => void;
  onConfirmar: (nota: string, tags: string[]) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const { vista, error } = useVistaPreviaMail(appId, status);

  async function confirmar() {
    setGuardando(true);
    try {
      await onConfirmar(texto.trim(), tags);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onCancelar}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-display font-bold text-[#1C2230]">Cambiar estado</h2>
            <p className="text-sm text-[#64748B] mt-0.5">
              La postulación pasa a <span className="font-semibold text-[#1C2230]">{estadoLabel}</span>.
            </p>
          </div>
          <button onClick={onCancelar} className="text-[#64748B] hover:text-[#1C2230] transition-colors" aria-label="Cerrar">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">
          Agregar una observación (opcional)
        </label>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          maxLength={NOTA_MAX}
          rows={3}
          className="w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-y"
        />
        <EtiquetasRapidas valor={tags} onChange={setTags} />
        <CartelObservacion />

        <VistaPreviaDelMail vista={vista} error={error} />

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancelar}
            className="text-sm font-bold text-[#64748B] border border-[#DDE3EC] rounded-xl px-4 py-2 hover:bg-[#FAFBFD] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={guardando}
            className="text-sm font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] rounded-xl px-4 py-2 transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
