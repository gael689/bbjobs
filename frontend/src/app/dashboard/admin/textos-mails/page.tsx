"use client";

import { useState } from "react";
import { ChevronDownIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import { Aviso, Spinner } from "@/components/admin-ia/comun";

/**
 * Textos de los mails automáticos (backend: api/v1/admin_textos.py). Eugenia cambia el asunto y
 * el texto de cada mail, o lo apaga; "Volver al original" deshace. Lo editado vale para los mails
 * que se armen desde ese momento.
 */

interface Texto {
  key: string; nombre: string; grupo: string; categoria: string; activo: boolean;
  asunto: string; texto: string; asunto_original: string; texto_original: string;
  editado: boolean; variables: Record<string, string>;
}

const input = "w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]";

function Fila({ t, onCambio }: { t: Texto; onCambio: (t: Texto) => void }) {
  const [abierta, setAbierta] = useState(false);
  const [asunto, setAsunto] = useState(t.asunto);
  const [texto, setTexto] = useState(t.texto);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const cambiado = asunto !== t.asunto || texto !== t.texto;

  async function llamar(fn: () => Promise<{ data: Texto }>, ok: string) {
    setOcupado(true); setMsg(null);
    try {
      const r = await fn();
      onCambio(r.data);
      setAsunto(r.data.asunto); setTexto(r.data.texto);
      setMsg({ tono: "ok", texto: ok });
    } catch (e) {
      setMsg({ tono: "error", texto: detalleError(e) });
    } finally { setOcupado(false); }
  }

  return (
    <li className="bg-white border border-[#DDE3EC] rounded-2xl shadow-sm">
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta}
        className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-[#1C2230] truncate">{t.nombre}</span>
          <span className="block text-xs text-[#64748B] truncate">{t.asunto}</span>
        </span>
        {t.editado && <span className="shrink-0 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#E6F4F7] text-[#187B8E]">Editado</span>}
        {!t.activo && <span className="shrink-0 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-[#1C2230]">Apagado</span>}
        <ChevronDownIcon className={`w-4 h-4 text-[#64748B] transition-transform ${abierta ? "rotate-180" : ""}`} />
      </button>
      {abierta && (
        <div className="border-t border-[#DDE3EC] p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold text-[#1C2230]">
            <input type="checkbox" checked={t.activo} disabled={ocupado}
              onChange={e => llamar(() => api.put(`/admin/mail/templates/${t.key}`, { activo: e.target.checked }),
                e.target.checked ? "Prendido: este mail vuelve a salir." : "Apagado: este mail no sale más hasta que lo prendas.")} />
            Este mail sale
          </label>
          <div>
            <label className="block text-xs font-bold text-[#1C2230] mb-1">Asunto</label>
            <input className={input} value={asunto} maxLength={500} onChange={e => setAsunto(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#1C2230] mb-1">
              Texto <span className="font-normal text-[#64748B]">(párrafos separados por una línea en blanco; **así** queda en negrita)</span>
            </label>
            <textarea className={`${input} min-h-[160px] leading-relaxed`} value={texto} maxLength={8000} onChange={e => setTexto(e.target.value)} />
          </div>
          <p className="text-xs text-[#64748B]">
            Variables: {Object.entries(t.variables).map(([k, v]) => (
              <span key={k} className="mr-2"><code className="rounded bg-[#E6F4F7] px-1.5 py-0.5 text-[#187B8E]">{`{{${k}}}`}</code> {v}</span>
            ))}
            · El saludo, el botón y el pie los agrega el sistema.
          </p>
          {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
          <div className="flex flex-wrap gap-2 justify-end">
            {t.editado && (
              <button type="button" disabled={ocupado}
                onClick={() => llamar(() => api.delete(`/admin/mail/templates/${t.key}`), "Volvió al texto original.")}
                className="rounded-xl border border-[#DDE3EC] px-4 py-2 text-sm font-bold text-[#64748B] hover:bg-[#FAFBFD]">
                Volver al original
              </button>
            )}
            <button type="button" disabled={!cambiado || ocupado}
              onClick={() => llamar(() => api.put(`/admin/mail/templates/${t.key}`, { asunto, texto }), "Guardado. Los próximos mails salen con este texto.")}
              className="rounded-xl bg-[#1E8EA3] px-4 py-2 text-sm font-bold text-white hover:bg-[#187B8E] disabled:opacity-50">
              Guardar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function TextosMailsPage() {
  const estado = useModulo<Texto[]>("/admin/mail/templates");
  const [cambios, setCambios] = useState<Record<string, Texto>>({});
  const [q, setQ] = useState("");

  if (estado.estado === "en_desarrollo") return <EnDesarrollo titulo="Textos de los mails" descripcion="Editar el texto de cada mail automático." />;
  if (estado.estado === "cargando") return <div className="py-16 flex justify-center"><Spinner /></div>;
  if (estado.estado === "error") return <div className="p-8"><Aviso tono="error">{estado.mensaje}</Aviso></div>;

  const lista = estado.datos.map(t => cambios[t.key] ?? t)
    .filter(t => !q.trim() || `${t.nombre} ${t.asunto}`.toLowerCase().includes(q.trim().toLowerCase()));
  const grupos = Array.from(new Set(lista.map(t => t.grupo)));

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1 flex items-center gap-2">
        <PencilSquareIcon className="w-6 h-6 text-[#187B8E]" /> Textos de los mails
      </h1>
      <p className="text-[#64748B] text-sm mb-5">
        Cada mail que BBJobs manda solo. Tocá uno para cambiar su asunto y su texto, o para apagarlo. Lo que guardes vale
        para los próximos mails.
      </p>
      <input className={`${input} mb-6`} placeholder="Buscar un mail (ej.: seleccionado, verificada, búsqueda)…"
        value={q} onChange={e => setQ(e.target.value)} />
      {grupos.map(g => (
        <section key={g} className="mb-8">
          <h2 className="font-display font-bold text-lg text-[#1C2230] mb-3">{g}</h2>
          <ul className="space-y-2">
            {lista.filter(t => t.grupo === g).map(t => (
              <Fila key={t.key} t={t} onCambio={n => setCambios(c => ({ ...c, [n.key]: n }))} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
