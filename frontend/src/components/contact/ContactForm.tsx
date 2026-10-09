"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { PaperAirplaneIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { RUBROS_INDICE } from "@/lib/seo/indice";

const inputCls =
  "w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors";
const labelCls = "block text-sm font-bold text-[#1C2230] mb-1.5";

type Topic = "general" | "empresa" | "seleccion";

// "seleccion" es la consulta por el servicio de selección de personal de Talency
// (/seleccion-de-personal): suma empresa, puesto, sector y vacantes, todos opcionales. El backend
// los antepone al mensaje para que Talency los vea en el panel de mensajes.
export default function ContactForm({ topic = "general", sectorInicial = "" }: { topic?: Topic; sectorInicial?: string }) {
  const conEmpresa = topic === "empresa" || topic === "seleccion";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState("");
  const [puesto, setPuesto] = useState("");
  const [sector, setSector] = useState(sectorInicial);
  const [vacantes, setVacantes] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      await api.post("/contact", {
        name,
        phone: phone.trim(),
        email: email.trim() || undefined,
        company_name: conEmpresa ? companyName || undefined : undefined,
        topic,
        message,
        ...(topic === "seleccion"
          ? {
              puesto: puesto.trim() || undefined,
              sector: sector || undefined,
              vacantes: vacantes ? Number(vacantes) : undefined,
            }
          : {}),
      });
      setSent(true);
      track("generate_lead", { topic });
    } catch (err: unknown) {
      // El 422 del backend casi siempre es el teléfono (muy corto) o un mail mal escrito.
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 422
          ? "Revisá el teléfono (con característica, ej. 2914 123456) y el mail si lo completaste."
          : "No pudimos enviar tu mensaje. Probá de nuevo o escribinos por WhatsApp."
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl p-6 flex items-start gap-3">
        <CheckCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">¡Gracias por escribirnos!</p>
          <p className="text-sm">Te vamos a responder a la brevedad.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 space-y-4">
      {/* Teléfono obligatorio y mail opcional (pedido de Eugenia, 23/09/2026): Talency responde
          por WhatsApp, y el teléfono es lo único imprescindible para devolver el contacto. */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Nombre</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Teléfono / WhatsApp</label>
          <input
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            minLength={8}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="2914 000000"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Email (opcional)</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@email.com" autoComplete="email" className={inputCls} />
        </div>
        {conEmpresa && (
          <div>
            <label className={labelCls}>Empresa</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Nombre de tu empresa" className={inputCls} />
          </div>
        )}
      </div>

      {topic === "seleccion" && (
        <div className="grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.6fr)] gap-4">
          <div>
            <label htmlFor="cf-puesto" className={labelCls}>Puesto a cubrir (opcional)</label>
            <input id="cf-puesto" maxLength={200} value={puesto} onChange={e => setPuesto(e.target.value)} placeholder="Ej.: chofer de reparto" className={inputCls} />
          </div>
          <div>
            <label htmlFor="cf-sector" className={labelCls}>Sector (opcional)</label>
            <select id="cf-sector" value={sector} onChange={e => setSector(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">Elegí un sector</option>
              {RUBROS_INDICE.map(r => <option key={r.slug} value={r.nombre}>{r.nombre}</option>)}
              <option value="Otro">Otro</option>
            </select>
          </div>
          <div>
            <label htmlFor="cf-vacantes" className={labelCls}>Vacantes</label>
            <input id="cf-vacantes" type="number" inputMode="numeric" min={1} max={999} value={vacantes} onChange={e => setVacantes(e.target.value)} placeholder="1" className={inputCls} />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Mensaje</label>
        <textarea
          required
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={
            topic === "seleccion"
              ? "Contanos qué perfil buscás y cualquier detalle que te parezca importante..."
              : topic === "empresa" ? "Contanos qué necesitás para publicar tus búsquedas..." : "¿En qué te podemos ayudar?"
          }
          className={`${inputCls} resize-none`}
        />
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl px-6 py-3 text-sm transition-colors shadow-sm"
      >
        <PaperAirplaneIcon className="w-4 h-4" />
        {sending ? "Enviando..." : topic === "seleccion" ? "Enviar consulta" : "Enviar mensaje"}
      </button>
    </form>
  );
}
