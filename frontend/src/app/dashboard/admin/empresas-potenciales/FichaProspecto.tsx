"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { detalleError } from "@/hooks/useModulo";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import { XMarkIcon, PhoneIcon, ChatBubbleLeftEllipsisIcon } from "@heroicons/react/24/outline";
import { ETAPAS, ETAPA_CLS, ETAPA_LABEL, EVENTO_LABEL, fecha, type ProspectDetail } from "./tipos";

/** Panel lateral con la ficha de una empresa: datos, mails, historial, etapa y notas. */
export default function FichaProspecto({ id, onCerrar, onCambio }: {
  id: string;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const [ficha, setFicha] = useState<ProspectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [nota, setNota] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    api.get<ProspectDetail>(`/admin/prospects/${id}`)
      .then(r => { if (vivo) { setFicha(r.data); setNotas(r.data.notes ?? ""); } })
      .catch(e => { if (vivo) setError(detalleError(e)); });
    return () => { vivo = false; };
  }, [id]);

  async function guardar(pedido: () => Promise<{ data: ProspectDetail }>) {
    setOcupado(true);
    setError(null);
    try {
      const r = await pedido();
      setFicha(r.data);
      setNotas(r.data.notes ?? "");
      onCambio();
    } catch (e) {
      setError(detalleError(e));
    } finally {
      setOcupado(false);
    }
  }

  const registrar = (kind: "whatsapp" | "llamada" | "nota", detail?: string) =>
    guardar(() => api.post<ProspectDetail>(`/admin/prospects/${id}/events`, { kind, detail: detail || null }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#1C2230]/40" onClick={onCerrar} />
      <aside className="relative w-full max-w-lg h-full bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#DDE3EC] px-6 py-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-display font-bold text-[#1C2230]">{ficha?.name ?? "Empresa"}</h2>
            {ficha && (
              <p className="text-sm text-[#1C2230]">
                {[ficha.category, ficha.locality].filter(Boolean).join(" · ") || "Sin rubro ni localidad"}
              </p>
            )}
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-1 rounded-lg hover:bg-[#E6F4F7]">
            <XMarkIcon className="w-6 h-6 text-[#1C2230]" />
          </button>
        </div>

        {error && <p className="mx-6 mt-4 text-sm text-red-800 font-semibold">{error}</p>}

        {!ficha ? (
          !error && (
            <div className="py-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
            </div>
          )
        ) : (
          <div className="px-6 py-5 space-y-6">
            {ficha.do_not_contact && (
              <p className="text-sm font-semibold bg-[#F7EFE9] text-[#7A5A44] rounded-xl px-3 py-2">
                Pidió no recibir más mails. No se le escribe por mail.
              </p>
            )}

            <section>
              <h3 className="text-sm font-extrabold text-[#1C2230] mb-2">Contacto</h3>
              <dl className="text-sm text-[#1C2230] space-y-1">
                {ficha.address && <div><dt className="inline font-semibold">Dirección: </dt><dd className="inline">{ficha.address}</dd></div>}
                {ficha.phone && <div><dt className="inline font-semibold">Teléfono: </dt><dd className="inline">{ficha.phone}</dd></div>}
                {ficha.whatsapp && <div><dt className="inline font-semibold">WhatsApp: </dt><dd className="inline">{ficha.whatsapp}</dd></div>}
                {ficha.website && (
                  <div><dt className="inline font-semibold">Web: </dt>
                    <dd className="inline"><a href={ficha.website} target="_blank" rel="noopener noreferrer" className="text-[#187B8E] underline break-all">{ficha.website}</a></dd>
                  </div>
                )}
                {ficha.rating !== null && <div><dt className="inline font-semibold">Puntaje en Google: </dt><dd className="inline">{ficha.rating}</dd></div>}
              </dl>
              <div className="mt-3">
                <p className="text-sm font-semibold text-[#1C2230]">Mails</p>
                {ficha.emails.length === 0 && ficha.suppressed_emails.length === 0 && (
                  <p className="text-sm text-[#1C2230]">Sin mail publicado.</p>
                )}
                <ul className="text-sm text-[#1C2230]">
                  {ficha.emails.map(m => <li key={m} className="break-all">{m}</li>)}
                  {ficha.suppressed_emails.map(m => (
                    <li key={m} className="break-all line-through">{m} <span className="no-underline font-semibold">(dada de baja)</span></li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <WhatsAppButton phone={ficha.whatsapp || ficha.phone} />
                <button disabled={ocupado} onClick={() => registrar("whatsapp")}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-bold border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7] disabled:opacity-50">
                  <ChatBubbleLeftEllipsisIcon className="w-4 h-4" /> Le escribí por WhatsApp
                </button>
                <button disabled={ocupado} onClick={() => registrar("llamada")}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-bold border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7] disabled:opacity-50">
                  <PhoneIcon className="w-4 h-4" /> Lo llamé
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-extrabold text-[#1C2230] mb-2">Etapa</h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ETAPA_CLS[ficha.stage] ?? ""}`}>
                  {ETAPA_LABEL[ficha.stage] ?? ficha.stage}
                </span>
                <select
                  value={ficha.stage}
                  disabled={ocupado}
                  onChange={e => guardar(() => api.patch<ProspectDetail>(`/admin/prospects/${id}`, { stage: e.target.value }))}
                  className="text-sm border border-[#DDE3EC] rounded-xl px-3 py-2 bg-white text-[#1C2230]"
                >
                  {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-extrabold text-[#1C2230] mb-2">Notas</h3>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full text-sm border border-[#DDE3EC] rounded-xl px-3 py-2 text-[#1C2230]"
              />
              <button
                disabled={ocupado || notas === (ficha.notes ?? "")}
                onClick={() => guardar(() => api.patch<ProspectDetail>(`/admin/prospects/${id}`, { notes: notas }))}
                className="mt-2 text-sm px-3 py-2 rounded-xl font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white disabled:opacity-40"
              >
                Guardar notas
              </button>
            </section>

            <section>
              <h3 className="text-sm font-extrabold text-[#1C2230] mb-2">Historial</h3>
              <div className="flex gap-2 mb-3">
                <input
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  maxLength={2000}
                  placeholder="Agregar una nota al historial"
                  className="flex-1 text-sm border border-[#DDE3EC] rounded-xl px-3 py-2 text-[#1C2230]"
                />
                <button
                  disabled={ocupado || !nota.trim()}
                  onClick={() => { registrar("nota", nota.trim()); setNota(""); }}
                  className="text-sm px-3 py-2 rounded-xl font-bold border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7] disabled:opacity-40"
                >
                  Agregar
                </button>
              </div>
              {ficha.events.length === 0 ? (
                <p className="text-sm text-[#1C2230]">Sin movimientos todavía.</p>
              ) : (
                <ol className="space-y-2">
                  {ficha.events.map((ev, i) => (
                    <li key={`${ev.created_at}-${i}`} className="text-sm text-[#1C2230] border-l-2 border-[#9ED4DF] pl-3">
                      <span className="font-semibold">{EVENTO_LABEL[ev.kind] ?? ev.kind}</span>
                      <span> · {fecha(ev.created_at)}</span>
                      {ev.detail && <p>{ev.detail}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
