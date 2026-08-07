"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import InterruptoresEstadisticas from "@/components/dashboard/InterruptoresEstadisticas";
import PanelIndicadoresAdmin from "@/components/dashboard/PanelIndicadoresAdmin";
import {
  PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon,
  BriefcaseIcon, ShieldCheckIcon, UserGroupIcon, SparklesIcon, ChartBarIcon,
  MagnifyingGlassIcon, CursorArrowRaysIcon, CheckBadgeIcon, MapPinIcon,
  ArrowUpIcon, ArrowDownIcon, BoltIcon, PencilSquareIcon,
} from "@heroicons/react/24/outline";

type Source =
  | "manual"
  | "active_jobs"
  | "verified_companies"
  | "registered_candidates"
  | "total_applications";

type LandingStat = {
  id: string;
  icon: string;
  source: Source;
  value: string;
  label: string;
  sort_order: number;
  visible: boolean;
  hide_when_zero: boolean;
  computed_value?: string | null;
  hidden_now?: boolean;
};

/** Mismo mapa que usa la landing (`app/page.tsx`) — si agregás uno acá, agregalo allá. */
const ICONS: { name: string; Cmp: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { name: "BriefcaseIcon", Cmp: BriefcaseIcon },
  { name: "ShieldCheckIcon", Cmp: ShieldCheckIcon },
  { name: "UserGroupIcon", Cmp: UserGroupIcon },
  { name: "CursorArrowRaysIcon", Cmp: CursorArrowRaysIcon },
  { name: "SparklesIcon", Cmp: SparklesIcon },
  { name: "ChartBarIcon", Cmp: ChartBarIcon },
  { name: "MagnifyingGlassIcon", Cmp: MagnifyingGlassIcon },
  { name: "CheckBadgeIcon", Cmp: CheckBadgeIcon },
  { name: "MapPinIcon", Cmp: MapPinIcon },
];

const SOURCES: { value: Source; label: string; hint: string }[] = [
  { value: "active_jobs", label: "Empleos activos", hint: "Búsquedas publicadas y aprobadas, en vivo" },
  { value: "verified_companies", label: "Empresas verificadas", hint: "Empresas aprobadas por Talency, en vivo" },
  { value: "registered_candidates", label: "Candidatos registrados", hint: "Perfiles de candidatos, en vivo" },
  { value: "total_applications", label: "Postulaciones realizadas", hint: "Total histórico de postulaciones, en vivo" },
  { value: "manual", label: "Texto fijo", hint: "Lo escribís vos — ej. “Bahía Blanca y la zona”" },
];

function iconOf(name: string) {
  return ICONS.find(i => i.name === name)?.Cmp ?? BriefcaseIcon;
}

const EMPTY: Partial<LandingStat> = {
  icon: "BriefcaseIcon", source: "manual", value: "", label: "",
  sort_order: 0, visible: true, hide_when_zero: true,
};

const INPUT_CLS =
  "w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors";

export default function IndicadoresPage() {
  const [stats, setStats] = useState<LandingStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<LandingStat> | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LandingStat | null>(null);

  useEffect(() => { fetchStats(); }, []);

  function fetchStats() {
    api.get("/admin/landing-stats")
      .then(res => { setStats(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function saveStat(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      if (form.id) {
        await api.patch(`/admin/landing-stats/${form.id}`, form);
        toast("Indicador actualizado");
      } else {
        await api.post("/admin/landing-stats", form);
        toast("Indicador creado");
      }
      setForm(null);
      fetchStats();
    } catch {
      toast("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await api.delete(`/admin/landing-stats/${confirmDelete.id}`);
      toast("Indicador eliminado");
      setConfirmDelete(null);
      fetchStats();
    } catch {
      toast("Error al eliminar");
    }
  }

  async function toggleVisibility(stat: LandingStat) {
    // Optimista: la landing es lo que importa, y revertimos si el PATCH falla.
    setStats(prev => prev.map(s => s.id === stat.id ? { ...s, visible: !s.visible } : s));
    try {
      await api.patch(`/admin/landing-stats/${stat.id}`, { visible: !stat.visible });
      fetchStats();
    } catch {
      setStats(prev => prev.map(s => s.id === stat.id ? { ...s, visible: stat.visible } : s));
      toast("Error al actualizar visibilidad");
    }
  }

  async function move(stat: LandingStat, dir: -1 | 1) {
    const ordered = [...stats].sort((a, b) => a.sort_order - b.sort_order);
    const i = ordered.findIndex(s => s.id === stat.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const items = ordered.map((s, idx) => ({ id: s.id, sort_order: (idx + 1) * 10 }));
    setStats(ordered.map((s, idx) => ({ ...s, sort_order: (idx + 1) * 10 })));
    try {
      await api.patch("/admin/landing-stats/reorder", { items });
    } catch {
      toast("Error al reordenar");
      fetchStats();
    }
  }

  const visibleOnLanding = stats.filter(s => s.visible && !s.hidden_now);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-8 max-w-6xl">
        <div className="h-8 w-64 bg-[#EEF2F7] rounded-lg animate-pulse mb-8" />
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white border border-[#DDE3EC] rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3]" />
          {toastMsg}
        </div>
      )}

      {/* El título de la página engloba las DOS cosas que viven acá, y cada una
          se presenta después con su propio encabezado. Antes la página se
          llamaba "Indicadores de la landing" y abajo aparecían las estadísticas
          de los postulantes, que no tienen nada que ver con la landing: leído de
          corrido parecía todo lo mismo. */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Indicadores y estadísticas</h1>
        <p className="text-[#64748B] text-sm">
          Dos cosas distintas: los números que se muestran en la página principal,
          y las estadísticas de la gente que se postula.
        </p>
      </div>

      {/* ── 1 · Landing ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 pb-4 border-b-2 border-[#1C2230]">
        <div>
          <p className="text-[11px] font-extrabold text-[#1E8EA3] uppercase tracking-wider mb-1">Parte 1</p>
          <h2 className="text-xl font-display font-bold text-[#1C2230] mb-1">Indicadores de la landing</h2>
          <p className="text-[#64748B] text-sm">
            La barra de números que ve cualquier visitante en la página principal.
          </p>
        </div>
        <button
          onClick={() => setForm({ ...EMPTY, sort_order: (stats.length + 1) * 10 })}
          className="bg-[#1E8EA3] text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#187B8E] transition-colors shrink-0"
        >
          <PlusIcon className="w-4 h-4" /> Nuevo indicador
        </button>
      </div>

      {/* Vista previa — lo que se ve hoy en bbjobs.com.ar */}
      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-8 shadow-sm">
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4">
          Vista previa — así se ve ahora en la landing
        </p>
        {visibleOnLanding.length === 0 ? (
          <p className="text-sm text-[#64748B] py-4 text-center">
            Ningún indicador se está mostrando. Activá alguno abajo, o agregá uno de texto fijo.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-10 gap-y-5">
            {visibleOnLanding.map(stat => {
              const Icon = iconOf(stat.icon);
              return (
                <div key={stat.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#1E8EA3]" />
                  </div>
                  <div>
                    <p className="font-display font-extrabold text-[#1C2230] text-lg leading-none">
                      {stat.source === "manual" ? stat.value : stat.computed_value}
                    </p>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {form && (
        <form onSubmit={saveStat} className="bg-white border border-[#9ED4DF] rounded-2xl p-6 mb-8 shadow-sm">
          <h3 className="font-display font-bold text-lg text-[#1C2230] mb-5">
            {form.id ? "Editar indicador" : "Nuevo indicador"}
          </h3>

          {/* Fuente */}
          <label className="text-xs font-bold text-[#64748B] mb-2 block">¿De dónde sale el número?</label>
          <div className="grid sm:grid-cols-2 gap-2 mb-5">
            {SOURCES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setForm({ ...form, source: s.value })}
                className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                  form.source === s.value
                    ? "border-[#1E8EA3] bg-[#E6F4F7]"
                    : "border-[#DDE3EC] bg-white hover:border-[#9ED4DF]"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#1C2230]">
                  {s.value === "manual"
                    ? <PencilSquareIcon className="w-4 h-4 text-[#B98F72]" />
                    : <BoltIcon className="w-4 h-4 text-[#1E8EA3]" />}
                  {s.label}
                </span>
                <span className="block text-xs text-[#64748B] mt-0.5">{s.hint}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {form.source === "manual" && (
              <div>
                <label className="text-xs font-bold text-[#64748B] mb-1.5 block">Texto a mostrar</label>
                <input
                  required
                  placeholder="Bahía Blanca y la zona"
                  value={form.value || ""}
                  onChange={e => setForm({ ...form, value: e.target.value })}
                  className={INPUT_CLS}
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-[#64748B] mb-1.5 block">Etiqueta</label>
              <input
                required
                placeholder="empleos activos"
                value={form.label || ""}
                onChange={e => setForm({ ...form, label: e.target.value })}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Icono */}
          <label className="text-xs font-bold text-[#64748B] mb-2 block">Icono</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {ICONS.map(({ name, Cmp }) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => setForm({ ...form, icon: name })}
                className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${
                  form.icon === name
                    ? "border-[#1E8EA3] bg-[#E6F4F7] text-[#1E8EA3]"
                    : "border-[#DDE3EC] bg-white text-[#64748B] hover:border-[#9ED4DF]"
                }`}
              >
                <Cmp className="w-5 h-5" />
              </button>
            ))}
          </div>

          <div className="space-y-2.5 mb-5">
            <label className="flex items-center gap-2.5 text-sm text-[#1C2230] cursor-pointer">
              <input
                type="checkbox"
                checked={form.visible ?? true}
                onChange={e => setForm({ ...form, visible: e.target.checked })}
                className="w-4 h-4 accent-[#1E8EA3]"
              />
              Mostrar en la landing
            </label>
            {form.source !== "manual" && (
              <label className="flex items-center gap-2.5 text-sm text-[#1C2230] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.hide_when_zero ?? true}
                  onChange={e => setForm({ ...form, hide_when_zero: e.target.checked })}
                  className="w-4 h-4 accent-[#1E8EA3]"
                />
                Ocultarlo automáticamente si el número da cero
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2.5 border border-[#DDE3EC] rounded-xl text-sm font-bold text-[#64748B] hover:bg-[#FAFBFD] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#1E8EA3] text-white rounded-xl text-sm font-bold hover:bg-[#187B8E] disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {/* Listado */}
      {stats.length === 0 ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-16 text-center shadow-sm">
          <ChartBarIcon className="w-12 h-12 text-[#DDE3EC] mx-auto mb-4" />
          <p className="font-semibold text-[#1C2230] mb-1">Todavía no hay indicadores</p>
          <p className="text-sm text-[#64748B]">Creá el primero con el botón de arriba.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {[...stats].sort((a, b) => a.sort_order - b.sort_order).map((stat, idx, arr) => {
            const Icon = iconOf(stat.icon);
            const isManual = stat.source === "manual";
            const shown = stat.visible && !stat.hidden_now;
            return (
              <div
                key={stat.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition-colors ${
                  shown ? "border-[#DDE3EC]" : "border-[#DDE3EC] opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#1E8EA3]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-extrabold text-[#1C2230] text-xl leading-none">
                      {isManual ? stat.value : stat.computed_value}
                    </p>
                    <p className="text-sm text-[#64748B] font-medium mt-1 truncate">{stat.label}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => move(stat, -1)} disabled={idx === 0} className="p-1 text-[#94A3B8] hover:text-[#1E8EA3] disabled:opacity-25 transition-colors" title="Subir">
                      <ArrowUpIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => move(stat, 1)} disabled={idx === arr.length - 1} className="p-1 text-[#94A3B8] hover:text-[#1E8EA3] disabled:opacity-25 transition-colors" title="Bajar">
                      <ArrowDownIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <span className={`inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full ${
                    isManual ? "bg-[#F7EFE9] text-[#B98F72]" : "bg-[#E6F4F7] text-[#187B8E]"
                  }`}>
                    {isManual ? <PencilSquareIcon className="w-3 h-3" /> : <BoltIcon className="w-3 h-3" />}
                    {isManual ? "Texto fijo" : "Automático"}
                  </span>
                  {stat.hidden_now && (
                    <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Oculto — da cero
                    </span>
                  )}
                  {!stat.visible && (
                    <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      Desactivado
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 mt-4 pt-4 border-t border-[#DDE3EC]">
                  <button
                    onClick={() => toggleVisibility(stat)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#1E8EA3] px-2 py-1.5 rounded-lg hover:bg-[#FAFBFD] transition-colors"
                  >
                    {stat.visible ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    {stat.visible ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => setForm(stat)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#1E8EA3] px-2 py-1.5 rounded-lg hover:bg-[#FAFBFD] transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" /> Editar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(stat)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors ml-auto"
                  >
                    <TrashIcon className="w-4 h-4" /> Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-[#1C2230] mb-2">Eliminar indicador</h3>
            <p className="text-sm text-[#64748B] mb-6">
              Se va a borrar «{confirmDelete.label}» de la landing. No se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2.5 border border-[#DDE3EC] rounded-xl text-sm font-bold text-[#64748B] hover:bg-[#FAFBFD] transition-colors">
                Cancelar
              </button>
              <button onClick={doDelete} className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2 · Postulantes ─────────────────────────────────────────────────
          Nada que ver con la parte de arriba: esos son números del portal, y
          estos son de la gente que se postula. La separación es visual y
          explícita —franja de corte, "Parte 2", y un texto que dice qué es cada
          cosa— porque leído de corrido se confundían. */}
      <div className="mt-14 pt-8 border-t-4 border-[#1C2230]">
        <p className="text-[11px] font-extrabold text-[#1E8EA3] uppercase tracking-wider mb-1">Parte 2</p>
        <h2 className="text-xl font-display font-bold text-[#1C2230] mb-1">Estadísticas de los postulantes</h2>
        <p className="text-[#64748B] text-sm mb-6">
          Quiénes se están postulando: edad, experiencia, estudios, pretensión de
          sueldo y habilidades. Esto no sale de los avisos sino de los perfiles, y
          es tuyo para mirar aunque no lo publiques.
        </p>

        {/* El panel arriba del interruptor a propósito: primero se mira lo que
            hay, después se decide si sale al portal. Al revés se aprueba a
            ciegas, que es lo que pasaba mientras esta vista no existió. */}
        <PanelIndicadoresAdmin />

        <div className="mt-8">
          <InterruptoresEstadisticas />
        </div>
      </div>
    </div>
  );
}
