"use client";

import { useEffect, useState } from "react";
import { BellAlertIcon, TrashIcon, PauseIcon, PlayIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";

interface Alerta {
  id: string;
  industry_id?: string | null;
  zone_id?: string | null;
  modality?: string | null;
  frequency: "instant" | "daily" | "weekly";
  is_active: boolean;
  last_sent_at?: string | null;
}

interface Item { id: string; name: string }

const FRECUENCIA: Record<Alerta["frequency"], string> = {
  instant: "En el momento",
  daily: "Una vez por día",
  weekly: "Una vez por semana",
};

const MODALIDADES = [
  { value: "presencial", label: "Presencial" },
  { value: "híbrido", label: "Híbrido" },
  { value: "remoto", label: "Remoto" },
];

const MAX_ALERTAS = 5;

export default function AlertasPage() {
  const alertas = useModulo<Alerta[]>("/me/candidate/job-alerts");
  const [rubros, setRubros] = useState<Item[]>([]);
  const [zonas, setZonas] = useState<Item[]>([]);
  const [rubro, setRubro] = useState("");
  const [zona, setZona] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [frecuencia, setFrecuencia] = useState<Alerta["frequency"]>("daily");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Item[]>("/catalogs/industries").then(r => setRubros(r.data)).catch(() => {});
    api.get<Item[]>("/catalogs/zones").then(r => setZonas(r.data)).catch(() => {});
  }, []);

  if (alertas.estado === "cargando") {
    return <div className="px-4 sm:px-6 py-8 text-[#1C2230]">Cargando…</div>;
  }
  if (alertas.estado === "en_desarrollo") {
    return <EnDesarrollo titulo="Alertas de empleo" descripcion="Muy pronto vas a poder recibir por mail las búsquedas nuevas que coincidan con lo que buscás." />;
  }
  if (alertas.estado === "error") {
    return <div className="px-4 sm:px-6 py-8 text-red-600">{alertas.mensaje}</div>;
  }

  const lista = alertas.datos;
  const nombre = (items: Item[], id?: string | null) => items.find(i => i.id === id)?.name;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!rubro && !zona && !modalidad) {
      setError("Elegí al menos un rubro, una zona o una modalidad.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await api.post("/me/candidate/job-alerts", {
        industry_id: rubro || null, zone_id: zona || null, modality: modalidad || null, frequency: frecuencia,
      });
      setRubro(""); setZona(""); setModalidad(""); setFrecuencia("daily");
      await alertas.recargar();
    } catch (err) {
      setError(detalleError(err, "No se pudo crear la alerta."));
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(a: Alerta) {
    try {
      await api.patch(`/me/candidate/job-alerts/${a.id}`, { is_active: !a.is_active });
      await alertas.recargar();
    } catch (err) {
      setError(detalleError(err));
    }
  }

  async function cambiarFrecuencia(a: Alerta, f: Alerta["frequency"]) {
    try {
      await api.patch(`/me/candidate/job-alerts/${a.id}`, { frequency: f });
      await alertas.recargar();
    } catch (err) {
      setError(detalleError(err));
    }
  }

  async function borrar(a: Alerta) {
    if (!confirm("¿Borrar esta alerta?")) return;
    try {
      await api.delete(`/me/candidate/job-alerts/${a.id}`);
      await alertas.recargar();
    } catch (err) {
      setError(detalleError(err));
    }
  }

  const selectCls = "w-full border border-[#DDE3EC] rounded-xl px-3 py-2.5 text-sm bg-white text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Alertas de empleo</h1>
      <p className="text-[#1C2230] text-sm mb-6">Te avisamos por mail cuando se publica una búsqueda que coincide. Podés tener hasta {MAX_ALERTAS}.</p>

      {lista.length < MAX_ALERTAS && (
        <form onSubmit={crear} className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-6 shadow-sm">
          <p className="font-bold text-[#1C2230] mb-3">Nueva alerta</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <label className="text-sm text-[#1C2230]">Rubro
              <select value={rubro} onChange={e => setRubro(e.target.value)} className={selectCls}>
                <option value="">Cualquiera</option>
                {rubros.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-[#1C2230]">Zona
              <select value={zona} onChange={e => setZona(e.target.value)} className={selectCls}>
                <option value="">Cualquiera</option>
                {zonas.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-[#1C2230]">Modalidad
              <select value={modalidad} onChange={e => setModalidad(e.target.value)} className={selectCls}>
                <option value="">Cualquiera</option>
                {MODALIDADES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            <label className="text-sm text-[#1C2230]">Frecuencia
              <select value={frecuencia} onChange={e => setFrecuencia(e.target.value as Alerta["frequency"])} className={selectCls}>
                {Object.entries(FRECUENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <button disabled={guardando} className="bg-[#187B8E] hover:bg-[#126474] text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-60">
            {guardando ? "Creando..." : "Crear alerta"}
          </button>
        </form>
      )}

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm">
        {lista.length === 0 ? (
          <div className="p-10 text-center text-[#1C2230]">Todavía no tenés alertas.</div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]/60">
            {lista.map(a => {
              const partes = [nombre(rubros, a.industry_id), nombre(zonas, a.zone_id),
                MODALIDADES.find(m => m.value === a.modality)?.label].filter(Boolean);
              return (
                <div key={a.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center shrink-0">
                    <BellAlertIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-bold text-[#1C2230]">{partes.join(" · ") || "Todas las búsquedas"}</p>
                    <p className="text-xs text-[#1C2230]">{a.is_active ? "Activa" : "Pausada"}</p>
                  </div>
                  <select value={a.frequency} onChange={e => cambiarFrecuencia(a, e.target.value as Alerta["frequency"])}
                          className="border border-[#DDE3EC] rounded-lg px-2 py-1.5 text-sm text-[#1C2230] bg-white">
                    {Object.entries(FRECUENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={() => alternar(a)} title={a.is_active ? "Pausar" : "Activar"}
                          className="p-2 rounded-lg border border-[#DDE3EC] text-[#1C2230] hover:bg-[#FAFBFD]">
                    {a.is_active ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                  </button>
                  <button onClick={() => borrar(a)} title="Borrar"
                          className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {lista.length >= MAX_ALERTAS && error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
