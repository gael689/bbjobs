"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import { MegaphoneIcon, PlusIcon } from "@heroicons/react/24/outline";
import EditorCampana from "./EditorCampana";
import { ESTADOS, ETIQUETAS_STATS, PRODUCTOS, fecha, type Campana } from "./tipos";

// useSearchParams va dentro de <Suspense> (Next 16: si no, falla el build).
export default function AdminCampanasPage() {
  return (
    <Suspense fallback={null}>
      <Campanas />
    </Suspense>
  );
}

function leerSeleccion(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && (Array.isArray(v.ids) || typeof v.filter === "object") ? v : null;
  } catch {
    return null;
  }
}

function Campanas() {
  const lista = useModulo<Campana[]>("/admin/campaigns");
  // "Crear campaña con esta selección" desde Empresas a contactar.
  const seleccion = leerSeleccion(useSearchParams().get("prospectos"));
  const [editando, setEditando] = useState<Campana | "nueva" | null>(seleccion ? "nueva" : null);
  const [detalle, setDetalle] = useState<Campana | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (lista.estado === "en_desarrollo") {
    return (
      <EnDesarrollo
        titulo="Campañas"
        descripcion="Acá vas a poder armar campañas para postulantes, empresas y empresas a contactar, y aprobarlas antes de que salgan."
      />
    );
  }

  async function abrirDetalle(c: Campana) {
    setError(null);
    try {
      const r = await api.get<Campana>(`/admin/campaigns/${c.id}`);
      setDetalle(r.data);
    } catch (e) {
      setError(detalleError(e));
    }
  }

  async function cancelar(c: Campana) {
    if (!confirm(`¿Cancelar "${c.name}"? Lo que todavía no salió no va a salir.`)) return;
    try {
      await api.post(`/admin/campaigns/${c.id}/cancel`);
      setDetalle(null);
      await lista.recargar();
    } catch (e) {
      setError(detalleError(e));
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Campañas</h1>
          <p className="text-[#64748B] text-sm">Nada sale sin tu aprobación. Antes de aprobar ves cuántas personas la reciben.</p>
        </div>
        {!editando && (
          <button onClick={() => { setDetalle(null); setEditando("nueva"); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white">
            <PlusIcon className="w-4 h-4" /> Nueva campaña
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl px-4 py-2.5 text-sm font-medium bg-red-50 text-red-800">{error}</div>}

      {editando && (
        <div className="mb-6">
          <EditorCampana
            campana={editando === "nueva" ? null : editando}
            seleccionProspectos={editando === "nueva" ? seleccion : null}
            onCerrar={() => { setEditando(null); lista.recargar(); }}
            onGuardada={() => lista.recargar()}
          />
        </div>
      )}

      {detalle && !editando && (
        <div className="mb-6 bg-white border border-[#DDE3EC] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-display font-bold text-[#1C2230]">{detalle.name}</h2>
              <p className="text-sm text-[#1C2230]">{detalle.subject}</p>
              <p className="text-xs text-[#64748B]">
                {detalle.target === "prospects" ? "Empresas a contactar" : "Usuarios"} · {PRODUCTOS[detalle.product ?? "portal"] ?? detalle.product}
                {" · "}enviada {fecha(detalle.sent_at)}
              </p>
            </div>
            <button className="text-sm font-bold text-[#64748B] hover:text-[#1C2230]" onClick={() => setDetalle(null)}>Cerrar</button>
          </div>
          {detalle.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(ETIQUETAS_STATS).map(([k, v]) => (
                <div key={k} className="border border-[#DDE3EC] rounded-xl p-3">
                  <p className="text-xl font-display font-extrabold text-[#1C2230]">{detalle.stats?.[k] ?? 0}</p>
                  <p className="text-xs text-[#64748B] font-medium">{v}</p>
                </div>
              ))}
            </div>
          )}
          {["scheduled", "sent", "draft"].includes(detalle.status) && (
            <button onClick={() => cancelar(detalle)} className="mt-4 text-sm font-bold text-red-700 hover:underline">
              Cancelar campaña
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm">
        {lista.estado === "cargando" ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lista.estado === "error" ? (
          <div className="p-8 text-center text-red-800">{lista.mensaje}</div>
        ) : lista.datos.length === 0 ? (
          <div className="p-12 text-center text-[#1C2230]">Todavía no hay campañas.</div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]/60">
            {lista.datos.map(c => {
              const est = ESTADOS[c.status] ?? { label: c.status, cls: "bg-[#F1F5F9] text-[#1C2230]" };
              return (
                <div key={c.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#FAFBFD] transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center shrink-0">
                    <MegaphoneIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#1C2230] truncate">{c.name}{c.generated_by_ai ? " · propuesta por IA" : ""}</p>
                    <p className="text-xs text-[#64748B]">
                      {c.target === "prospects" ? "Empresas a contactar" : "Usuarios"} · {PRODUCTOS[c.product ?? "portal"] ?? c.product}
                      {c.recipients_total ? ` · ${c.recipients_total} destinatarios` : ""}
                      {c.scheduled_at ? ` · programada ${fecha(c.scheduled_at)}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${est.cls}`}>{est.label}</span>
                  {c.status === "draft" ? (
                    <button className="text-sm font-bold text-[#187B8E] hover:underline shrink-0"
                      onClick={() => { setDetalle(null); setEditando(c); }}>Editar</button>
                  ) : (
                    <button className="text-sm font-bold text-[#187B8E] hover:underline shrink-0"
                      onClick={() => { setEditando(null); abrirDetalle(c); }}>Ver</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
