"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DocumentCheckIcon, InformationCircleIcon, EyeIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";

interface Orden {
  id: string;
  status: string;
  contact_channel: string;
  objective?: string | null;
  price: number;
  currency: string;
  created_at: string;
  paid_at?: string | null;
  taken_at?: string | null;
  delivered_at?: string | null;
}

interface Resumen {
  price: number;
  currency: string;
  can_buy: boolean;
  reason?: string | null;
  orders: Orden[];
}

interface VistaIA {
  cv_status?: string | null;
  chunks: { kind: string; text: string }[];
  indexed_at?: string | null;
  note: string;
}

const ESTADO: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Esperando el pago", cls: "bg-yellow-100 text-yellow-900" },
  paid: { label: "Pagada: Talency te va a contactar", cls: "bg-[#E6F4F7] text-[#187B8E]" },
  in_progress: { label: "En revisión", cls: "bg-[#E6F4F7] text-[#187B8E]" },
  delivered: { label: "Entregada", cls: "bg-green-100 text-green-800" },
  refunded: { label: "Devuelta", cls: "bg-[#F7EFE9] text-[#7A5A44]" },
  canceled: { label: "Cancelada", cls: "bg-slate-100 text-[#1C2230]" },
};

const TIPO_FRAGMENTO: Record<string, string> = {
  perfil: "Perfil", experiencia: "Experiencia", formacion: "Formación", cv: "CV",
};

const POLL_MS = 3000;
const POLL_MAX_MS = 60_000;

function RevisionCv() {
  const resumen = useModulo<Resumen>("/me/candidate/cv-review");
  const params = useSearchParams();
  const volvioDePago = params.has("payment_id");
  const [vencido, setVencido] = useState(false);
  const [objetivo, setObjetivo] = useState("");
  const [canal, setCanal] = useState<"whatsapp" | "email">("whatsapp");
  const [contacto, setContacto] = useState("");
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vistaIA, setVistaIA] = useState<VistaIA | null>(null);
  const inicioPoll = useRef<number>(0);

  const recargar = resumen.recargar;
  const ultima = resumen.estado === "listo" ? resumen.datos.orders[0] : undefined;
  // Al volver de Mercado Pago: el webhook confirma el pago, la pantalla espera hasta 60 s.
  const confirmando = volvioDePago && !vencido && (!ultima || ultima.status === "pending_payment");

  useEffect(() => {
    if (!confirmando) return;
    if (!inicioPoll.current) inicioPoll.current = Date.now();
    const t = setTimeout(() => {
      if (Date.now() - inicioPoll.current > POLL_MAX_MS) setVencido(true);
      else recargar();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [confirmando, ultima, recargar]);

  useEffect(() => {
    api.get<VistaIA>("/me/candidate/ai-view").then(r => setVistaIA(r.data)).catch(() => setVistaIA(null));
  }, []);

  if (resumen.estado === "cargando") return <div className="px-4 sm:px-6 py-8 text-[#1C2230]">Cargando…</div>;
  if (resumen.estado === "en_desarrollo") {
    return <EnDesarrollo titulo="Revisión de CV" descripcion="Muy pronto vas a poder pedir que Talency revise tu CV." />;
  }
  if (resumen.estado === "error") return <div className="px-4 sm:px-6 py-8 text-red-600">{resumen.mensaje}</div>;

  const d = resumen.datos;
  const precio = `$${d.price.toLocaleString("es-AR")} ${d.currency}`;

  async function comprar(e: React.FormEvent) {
    e.preventDefault();
    if (!acepto) { setError("Necesitamos tu permiso para que Talency te contacte."); return; }
    setEnviando(true);
    setError(null);
    try {
      const r = await api.post<{ init_point: string }>("/me/candidate/cv-review/checkout", {
        objective: objetivo.trim() || null, contact_channel: canal, contact_value: contacto.trim() || null, consent: acepto,
      });
      window.location.href = r.data.init_point;
    } catch (err) {
      setError(detalleError(err, "No se pudo iniciar el pago. Probá de nuevo."));
      setEnviando(false);
    }
  }

  const inputCls = "w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Revisión de CV</h1>
      <p className="text-[#1C2230] text-sm mb-6">Una persona de Talency revisa tu CV y te da su devolución para mejorarlo.</p>

      {confirmando && (
        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#187B8E] border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-[#1C2230] font-semibold">Estamos confirmando tu pago…</p>
        </div>
      )}

      <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-2xl p-4 mb-6 flex gap-3">
        <InformationCircleIcon className="w-5 h-5 text-[#187B8E] shrink-0 mt-0.5" />
        <p className="text-sm text-[#1C2230]">
          El contacto y la devolución son <strong>por fuera de la plataforma</strong>, por WhatsApp o mail.
          La revisión te ayuda a presentar mejor tu experiencia, pero <strong>no garantiza</strong> entrevistas ni empleo.
        </p>
      </div>

      {d.can_buy ? (
        <form onSubmit={comprar} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center">
              <DocumentCheckIcon className="w-5 h-5" />
            </div>
            <p className="text-xl font-display font-extrabold text-[#1C2230]">{precio}</p>
          </div>
          <label className="block text-sm font-bold text-[#1C2230] mb-1">¿Para qué puesto o rubro querés tu CV?</label>
          <textarea value={objetivo} onChange={e => setObjetivo(e.target.value.slice(0, 500))} rows={3}
                    placeholder="Por ejemplo: administrativa contable, atención al público…" className={`${inputCls} mb-1`} />
          <p className="text-xs text-[#1C2230] mb-4 text-right">{objetivo.length}/500</p>

          <p className="text-sm font-bold text-[#1C2230] mb-2">¿Cómo te contactamos?</p>
          <div className="flex gap-4 mb-3">
            {(["whatsapp", "email"] as const).map(c => (
              <label key={c} className="flex items-center gap-2 text-sm text-[#1C2230]">
                <input type="radio" name="canal" checked={canal === c} onChange={() => setCanal(c)} className="accent-[#187B8E]" />
                {c === "whatsapp" ? "WhatsApp" : "Mail"}
              </label>
            ))}
          </div>
          <input value={contacto} onChange={e => setContacto(e.target.value)} maxLength={255}
                 placeholder={canal === "whatsapp" ? "Tu WhatsApp (si lo dejás vacío, usamos el de tu perfil)" : "Tu mail (si lo dejás vacío, usamos el de tu cuenta)"}
                 className={`${inputCls} mb-4`} />

          <label className="flex items-start gap-2 text-sm text-[#1C2230] mb-4">
            <input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} className="mt-0.5 accent-[#187B8E]" />
            Acepto que Talency me contacte por ese medio para hacer la revisión.
          </label>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button disabled={enviando || !acepto}
                  className="bg-[#187B8E] hover:bg-[#126474] text-white font-bold px-6 py-3 rounded-xl disabled:opacity-60">
            {enviando ? "Yendo a Mercado Pago..." : `Pagar ${precio}`}
          </button>
        </form>
      ) : (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 mb-8">
          <p className="text-[#1C2230] font-semibold">{d.reason ?? "La revisión no está disponible en este momento."}</p>
        </div>
      )}

      {d.orders.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display font-bold text-lg text-[#1C2230] mb-3">Tus revisiones</h2>
          <div className="bg-white border border-[#DDE3EC] rounded-2xl divide-y divide-[#DDE3EC]/60 overflow-hidden">
            {d.orders.map(o => {
              const e = ESTADO[o.status] ?? { label: o.status, cls: "bg-slate-100 text-[#1C2230]" };
              return (
                <div key={o.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-bold text-[#1C2230]">{o.objective || "Revisión de CV"}</p>
                    <p className="text-xs text-[#1C2230]">
                      {new Date(o.created_at).toLocaleDateString("es-AR")} · ${o.price.toLocaleString("es-AR")} {o.currency} · por {o.contact_channel === "whatsapp" ? "WhatsApp" : "mail"}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${e.cls}`}>{e.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vistaIA && (
        <div>
          <h2 className="font-display font-bold text-lg text-[#1C2230] mb-1 flex items-center gap-2">
            <EyeIcon className="w-5 h-5 text-[#187B8E]" /> Lo que lee la IA de tu perfil
          </h2>
          <p className="text-sm text-[#1C2230] mb-3">{vistaIA.note}</p>
          {vistaIA.chunks.length === 0 ? (
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 text-sm text-[#1C2230]">Todavía no procesamos tu perfil.</div>
          ) : (
            <div className="space-y-2">
              {vistaIA.chunks.map((c, i) => (
                <div key={i} className="bg-white border border-[#DDE3EC] rounded-xl p-4">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#187B8E] mb-1">{TIPO_FRAGMENTO[c.kind] ?? c.kind}</p>
                  <p className="text-sm text-[#1C2230] whitespace-pre-wrap">{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RevisionCvPage() {
  return (
    <Suspense fallback={<div className="px-4 sm:px-6 py-8 text-[#1C2230]">Cargando…</div>}>
      <RevisionCv />
    </Suspense>
  );
}
