"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { PaperAirplaneIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

const inputCls =
  "w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors";
const labelCls = "block text-sm font-bold text-[#1C2230] mb-1.5";

export default function ContactForm({ topic = "general" }: { topic?: "general" | "empresa" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState("");
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
        email,
        phone: phone || undefined,
        company_name: topic === "empresa" ? companyName || undefined : undefined,
        topic,
        message,
      });
      setSent(true);
    } catch {
      setError("No pudimos enviar tu mensaje. Probá de nuevo o escribinos por WhatsApp.");
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
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Nombre</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vos@email.com" className={inputCls} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Teléfono (opcional)</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="2914 000000" className={inputCls} />
        </div>
        {topic === "empresa" && (
          <div>
            <label className={labelCls}>Empresa</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Nombre de tu empresa" className={inputCls} />
          </div>
        )}
      </div>

      <div>
        <label className={labelCls}>Mensaje</label>
        <textarea
          required
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={topic === "empresa" ? "Contanos qué necesitás para publicar tus búsquedas..." : "¿En qué te podemos ayudar?"}
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
        {sending ? "Enviando..." : "Enviar mensaje"}
      </button>
    </form>
  );
}
