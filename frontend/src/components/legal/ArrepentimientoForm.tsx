"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

const inputCls =
  "w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors";
const labelCls = "block text-sm font-bold text-[#1C2230] mb-1.5";

type Compra = "destacado" | "pack" | "otro";

export default function ArrepentimientoForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [compra, setCompra] = useState<Compra>("destacado");
  const [detalle, setDetalle] = useState("");
  const [comentario, setComentario] = useState("");
  const [sending, setSending] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const r = await api.post("/contact/arrepentimiento", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        compra,
        detalle: detalle.trim(),
        comentario: comentario.trim() || undefined,
      });
      setCodigo(r.data.codigo);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 422
          ? "Revisá el mail y contanos qué compraste (al menos unas palabras)."
          : status === 429
          ? "Hiciste varios pedidos seguidos. Esperá un minuto y probá de nuevo."
          : "No pudimos registrar tu pedido. Probá de nuevo o escribinos a info@bbjobs.com.ar."
      );
    } finally {
      setSending(false);
    }
  }

  if (codigo) {
    return (
      <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-6 flex items-start gap-3">
        <CheckCircleIcon className="w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Recibimos tu pedido de arrepentimiento.</p>
          <p className="text-sm mt-1">Tu código de trámite es:</p>
          <p className="font-display font-extrabold text-2xl tracking-wider my-2 select-all">{codigo}</p>
          <p className="text-sm">
            Guardalo: es la constancia de tu pedido. El equipo de Talency te va a escribir a <strong>{email}</strong> para
            hacer la devolución por el mismo medio de pago.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Nombre y apellido</label>
          <input required minLength={2} value={name} onChange={e => setName(e.target.value)} autoComplete="name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Mail</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="El que usaste en la compra" autoComplete="email" className={inputCls} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Teléfono (opcional)</label>
          <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="2914 000000" autoComplete="tel" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>¿Qué compraste?</label>
          <select value={compra} onChange={e => setCompra(e.target.value as Compra)} className={inputCls}>
            <option value="destacado">Aviso destacado</option>
            <option value="pack">Pack de la Base de Talento</option>
            <option value="otro">Otro</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Datos de la compra</label>
        <input
          required
          minLength={3}
          maxLength={500}
          value={detalle}
          onChange={e => setDetalle(e.target.value)}
          placeholder="Fecha aproximada, empresa y, si lo tenés, el número de operación de Mercado Pago"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Comentario (opcional)</label>
        <textarea rows={3} maxLength={1000} value={comentario} onChange={e => setComentario(e.target.value)} className={`${inputCls} resize-none`} />
        <p className="text-xs text-[#64748B] mt-1">No hace falta que expliques por qué te arrepentís.</p>
      </div>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="w-full sm:w-auto bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl px-6 py-3 text-sm transition-colors shadow-sm"
      >
        {sending ? "Enviando..." : "Me arrepiento de la compra"}
      </button>
    </form>
  );
}
