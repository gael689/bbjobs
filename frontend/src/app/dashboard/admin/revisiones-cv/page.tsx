"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import {
  DocumentMagnifyingGlassIcon, EnvelopeIcon, ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

// Espejo de AdminOrder en backend/app/api/v1/cv_review.py.
interface Revision {
  id: string;
  status: string;
  candidate_id: string;
  candidate_name: string;
  candidate_phone: string | null;
  contact_channel: "whatsapp" | "email";
  contact_value: string | null;
  objective: string | null;
  price: number;
  currency: string;
  admin_note: string | null;
  cv_changed: boolean;
  created_at: string;
  paid_at: string | null;
  taken_at: string | null;
  delivered_at: string | null;
  refunded_at: string | null;
}

const ESTADOS: { value: string; label: string }[] = [
  { value: "", label: "Para atender (pagadas y en curso)" },
  { value: "paid", label: "Pagadas, sin tomar" },
  { value: "in_progress", label: "En curso" },
  { value: "delivered", label: "Entregadas" },
  { value: "refunded", label: "Devueltas" },
  { value: "pending_payment", label: "Esperando el pago" },
  { value: "canceled", label: "Canceladas" },
];

const ESTADO_LABEL: Record<string, string> = {
  pending_payment: "Esperando el pago",
  paid: "Pagada",
  in_progress: "En curso",
  delivered: "Entregada",
  refunded: "Devuelta",
  canceled: "Cancelada",
};

const ESTADO_CLS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-900",
  paid: "bg-[#E6F4F7] text-[#187B8E]",
  in_progress: "bg-[#1E8EA3] text-white",
  delivered: "bg-green-100 text-green-900",
  refunded: "bg-[#F7EFE9] text-[#7A5A44]",
  canceled: "bg-gray-100 text-[#1C2230]",
};

function horasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function antiguedad(horas: number): string {
  if (horas < 1) return "hace menos de una hora";
  if (horas < 48) return `hace ${Math.floor(horas)} h`;
  return `hace ${Math.floor(horas / 24)} días`;
}

function FilaRevision({ r, onCambio }: { r: Revision; onCambio: () => void }) {
  const [nota, setNota] = useState(r.admin_note ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const horas = r.status === "paid" ? horasDesde(r.paid_at) : null;
  const urgente = horas !== null && horas > 48;
  const atrasada = horas !== null && horas > 24 && !urgente;

  async function cambiar(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setError(null);
    try {
      await api.patch(`/admin/cv-reviews/${r.id}`, cuerpo);
      onCambio();
    } catch (e) {
      setError(detalleError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function verCv() {
    setError(null);
    try {
      const res = await api.get<{ url: string; cv_changed: boolean }>(`/admin/cv-reviews/${r.id}/cv`);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(detalleError(e, "No se pudo abrir el CV."));
    }
  }

  function devolver() {
    if (!confirm(
      `¿Marcar la revisión de ${r.candidate_name} como devuelta?\n\n` +
      "La devolución del dinero se hace desde el panel de Mercado Pago: esto sólo la registra acá.",
    )) return;
    cambiar({ status: "refunded" });
  }

  return (
    <div className={`px-6 py-5 ${urgente ? "bg-red-50" : atrasada ? "bg-yellow-50" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-[#1C2230]">{r.candidate_name}</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ESTADO_CLS[r.status] ?? "bg-gray-100 text-[#1C2230]"}`}>
              {ESTADO_LABEL[r.status] ?? r.status}
            </span>
            {horas !== null && (
              <span className={`text-xs font-bold ${urgente ? "text-red-800" : atrasada ? "text-yellow-900" : "text-[#1C2230]"}`}>
                Pagó {antiguedad(horas)}{urgente ? " · más de 48 h sin tomar" : atrasada ? " · más de 24 h sin tomar" : ""}
              </span>
            )}
          </div>
          <p className="text-sm text-[#1C2230] mt-1">
            <span className="font-semibold">Busca: </span>{r.objective || "no lo indicó"}
          </p>
          <p className="text-sm text-[#1C2230] mt-0.5">
            <span className="font-semibold">Contacto por {r.contact_channel === "whatsapp" ? "WhatsApp" : "mail"}: </span>
            {r.contact_value || "sin dato"}
          </p>
          {r.cv_changed && (
            <p className="text-sm text-yellow-900 font-semibold mt-1 inline-flex items-center gap-1">
              <ExclamationTriangleIcon className="w-4 h-4" /> El postulante cambió el CV después de pagar.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={verCv} className="text-sm px-3 py-2 rounded-xl font-bold border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7]">
            Ver CV
          </button>
          {r.contact_channel === "whatsapp" ? (
            <WhatsAppButton phone={r.contact_value || r.candidate_phone} />
          ) : r.contact_value ? (
            <a href={`mailto:${r.contact_value}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-bold border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7]">
              <EnvelopeIcon className="w-4 h-4" /> Mail
            </a>
          ) : null}
          {r.status === "paid" && (
            <button disabled={ocupado} onClick={() => cambiar({ status: "in_progress" })}
              className="text-sm px-3 py-2 rounded-xl font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white disabled:opacity-50">
              Tomar
            </button>
          )}
          {r.status === "in_progress" && (
            <button disabled={ocupado} onClick={() => cambiar({ status: "delivered" })}
              className="text-sm px-3 py-2 rounded-xl font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white disabled:opacity-50">
              Entregada
            </button>
          )}
          {["paid", "in_progress", "delivered"].includes(r.status) && (
            <button disabled={ocupado} onClick={devolver}
              className="text-sm px-3 py-2 rounded-xl font-bold border border-[#DDE3EC] text-[#1C2230] hover:bg-[#F7EFE9] disabled:opacity-50">
              Devuelta
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={nota}
          onChange={e => setNota(e.target.value)}
          maxLength={2000}
          placeholder="Nota interna (sólo la ve Talency)"
          className="flex-1 min-w-[220px] text-sm border border-[#DDE3EC] rounded-xl px-3 py-2 text-[#1C2230]"
        />
        <button
          disabled={ocupado || nota === (r.admin_note ?? "")}
          onClick={() => cambiar({ admin_note: nota })}
          className="text-sm px-3 py-2 rounded-xl font-bold border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7] disabled:opacity-40"
        >
          Guardar nota
        </button>
      </div>
      {error && <p className="text-sm text-red-800 font-semibold mt-2">{error}</p>}
    </div>
  );
}

export default function AdminRevisionesCvPage() {
  const [estado, setEstado] = useState("");
  const modulo = useModulo<Revision[]>("/admin/cv-reviews", estado ? { status: estado } : undefined);

  if (modulo.estado === "en_desarrollo") {
    return (
      <EnDesarrollo
        titulo="Revisiones de CV"
        descripcion="Acá vas a ver los postulantes que pagaron la revisión de su CV, para contactarlos por WhatsApp o mail y llevar el registro."
      />
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Revisiones de CV</h1>
      <p className="text-[#1C2230] text-sm mb-6">
        Postulantes que pagaron la revisión. El contacto y la devolución son por fuera de la plataforma: acá se toma el caso y se registra.
      </p>

      <div className="mb-4">
        <select value={estado} onChange={e => setEstado(e.target.value)}
          className="text-sm border border-[#DDE3EC] rounded-xl px-3 py-2 bg-white text-[#1C2230] font-semibold">
          {ESTADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm">
        {modulo.estado === "cargando" ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : modulo.estado === "error" ? (
          <div className="p-12 text-center text-red-800 font-semibold">{modulo.mensaje}</div>
        ) : modulo.datos.length === 0 ? (
          <div className="p-12 text-center text-[#1C2230]">
            <DocumentMagnifyingGlassIcon className="w-8 h-8 mx-auto mb-2 text-[#187B8E]" />
            No hay revisiones en este estado.
          </div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]/60">
            {modulo.datos.map(r => <FilaRevision key={`${r.id}-${r.status}`} r={r} onCambio={modulo.recargar} />)}
          </div>
        )}
      </div>
    </div>
  );
}
