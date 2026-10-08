"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ChatBubbleLeftEllipsisIcon, LockClosedIcon, EyeIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Notas de la empresa sobre una postulación (módulo nuevo, detrás de NEXT_PUBLIC_MODULOS_NUEVOS).
 *
 * Arrancan **privadas**: para que las lea el postulante hay que tildar la casilla. Una privada
 * no se puede volver visible después y ninguna se edita (ver AVISOS-POR-ACCION-Y-NOTAS-PLAN.md
 * §3). El texto de la nota se muestra como texto plano: React lo escapa y no se arman links.
 */

export const NOTA_MAX = 1000;

export interface NotaPostulacion {
  id: string;
  application_id: string;
  body: string | null;
  visible_to_candidate: boolean;
  status_at_time?: string | null;
  notified_at?: string | null;
  created_at: string;
}

/** La casilla de visibilidad y lo que le explica a la empresa. Compartida entre el cuadro del
 *  cambio de estado y la nota suelta, para que digan exactamente lo mismo. */
export function CasillaVisibilidad({ visible, onChange }: { visible: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-2">
      <label className="flex items-center gap-2 text-xs font-semibold text-[#1C2230] cursor-pointer">
        <input
          type="checkbox"
          checked={visible}
          onChange={e => onChange(e.target.checked)}
          className="w-3.5 h-3.5 accent-[#1E8EA3]"
        />
        Que la vea el postulante
      </label>
      {visible ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#8A6A54] bg-[#D4B7A2]/15 border border-[#D4B7A2]/60 rounded-lg px-2.5 py-1.5">
          La va a leer el postulante. No incluyas motivos como edad, género, estado civil o salud.
        </p>
      ) : (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#64748B]">
          Sin tildar, la nota es privada: sólo la ve tu empresa. No la ve el postulante ni el equipo de BBJobs y Talency.
        </p>
      )}
    </div>
  );
}

function EtiquetaVisibilidad({ visible }: { visible: boolean }) {
  return visible ? (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold bg-[#E6F4F7] text-[#187B8E] border border-[#9ED4DF] px-1.5 py-0.5 rounded-full">
      <EyeIcon className="w-3 h-3" /> La ve el postulante
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold bg-[#F1F5F9] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">
      <LockClosedIcon className="w-3 h-3" /> Privada
    </span>
  );
}

/** Lista de notas de la postulación y el formulario para sumar una suelta. Va al pie de la
 *  ficha del candidato cuando se abre desde una postulación. */
export function NotasPostulacion({ applicationId }: { applicationId: string }) {
  const [notas, setNotas] = useState<NotaPostulacion[] | null>(null);
  const [texto, setTexto] = useState("");
  const [visible, setVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    api.get(`/me/company/applications/${applicationId}/notes`)
      .then(r => { if (vigente) setNotas(r.data); })
      .catch(() => { if (vigente) setNotas([]); });
    return () => { vigente = false; };
  }, [applicationId]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await api.post(`/me/company/applications/${applicationId}/notes`, {
        body: texto.trim(),
        visible_to_candidate: visible,
      });
      setNotas(prev => [...(prev ?? []), r.data]);
      setTexto("");
      setVisible(false);
    } catch {
      setError("No pudimos guardar la nota. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(nota: NotaPostulacion) {
    const aviso = nota.visible_to_candidate
      ? "¿Borrar la nota? Deja de verse en el panel del postulante, pero si ya le llegó el aviso, eso no se deshace."
      : "¿Borrar la nota?";
    if (!window.confirm(aviso)) return;
    try {
      await api.delete(`/me/company/applications/${applicationId}/notes/${nota.id}`);
      setNotas(prev => (prev ?? []).filter(n => n.id !== nota.id));
    } catch {
      setError("No pudimos borrar la nota. Probá de nuevo.");
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-[#DDE3EC]">
      <div className="flex items-center gap-2 mb-3">
        <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-[#1E8EA3]" />
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Notas de la postulación</p>
      </div>

      {notas === null ? (
        <div className="py-4 flex justify-center">
          <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notas.length === 0 ? (
        <p className="text-xs text-[#64748B] mb-3">Todavía no hay notas.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {notas.map(n => (
            <div key={n.id} className="border border-[#DDE3EC] rounded-xl px-4 py-3 bg-[#FAFBFD]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <EtiquetaVisibilidad visible={n.visible_to_candidate} />
                  <span className="text-[11px] text-[#94A3B8]">
                    {new Date(n.created_at).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => borrar(n)}
                  className="text-[#94A3B8] hover:text-red-600 transition-colors"
                  aria-label="Borrar nota"
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
          placeholder="Agregar una nota"
          className="w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-y"
        />
        <CasillaVisibilidad visible={visible} onChange={setVisible} />
        <div className="flex items-center gap-3 mt-3">
          <button
            type="submit"
            disabled={guardando || !texto.trim()}
            className="text-xs font-bold bg-[#1E8EA3] text-white rounded-lg px-3 py-1.5 hover:bg-[#187B8E] transition-colors disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar nota"}
          </button>
          <span className="text-[11px] text-[#94A3B8]">{texto.length}/{NOTA_MAX}</span>
          {error && <span className="text-[11px] text-red-600">{error}</span>}
        </div>
      </form>
    </div>
  );
}

/** Cuadro que se abre al cambiar el estado: confirma el cambio y deja agregar una nota
 *  opcional en el mismo paso (el caso típico: "No avanza" y el motivo). */
interface VistaPreviaMail {
  sends_email: boolean;
  delay_hours: number;
  subject: string | null;
  html: string | null;
}

/** El mail que le llegaría al postulante (pedido de Eugenia, 08/10/2026). Lo arma el backend con
 *  el mismo texto y el mismo diseño que la cola de mails, con el nombre y el puesto reales. Se
 *  vuelve a pedir cuando cambia la nota (con una pausa, para no pedir en cada tecla). */
function useVistaPreviaMail(appId: string, status: string, nota: string, visible: boolean) {
  const [vista, setVista] = useState<VistaPreviaMail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vigente = true;
    const t = setTimeout(() => {
      api.post<VistaPreviaMail>(`/me/company/applications/${appId}/status-preview`, {
        status,
        ...(nota.trim() ? { note: nota.trim(), note_visible: visible } : {}),
      })
        .then(r => { if (vigente) { setVista(r.data); setError(false); } })
        .catch(() => { if (vigente) setError(true); });
    }, nota ? 500 : 0);
    return () => { vigente = false; clearTimeout(t); };
  }, [appId, status, nota, visible]);
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
  onConfirmar: (nota: string, visible: boolean) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [visible, setVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const { vista, error } = useVistaPreviaMail(appId, status, texto, visible);

  async function confirmar() {
    setGuardando(true);
    try {
      await onConfirmar(texto.trim(), visible);
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
          Agregar una nota (opcional)
        </label>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          maxLength={NOTA_MAX}
          rows={3}
          className="w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-y"
        />
        <CasillaVisibilidad visible={visible} onChange={setVisible} />

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
