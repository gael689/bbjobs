"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

type LandingStat = {
  id: string;
  icon: string;
  value: string;
  label: string;
  sort_order: number;
  visible: boolean;
};

export default function IndicadoresPage() {
  const [stats, setStats] = useState<LandingStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<LandingStat> | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  function fetchStats() {
    api.get("/admin/landing-stats").then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
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

  async function deleteStat(id: string) {
    if (!confirm("¿Seguro que querés eliminar este indicador?")) return;
    try {
      await api.delete(`/admin/landing-stats/${id}`);
      toast("Indicador eliminado");
      fetchStats();
    } catch {
      toast("Error al eliminar");
    }
  }

  async function toggleVisibility(stat: LandingStat) {
    try {
      await api.patch(`/admin/landing-stats/${stat.id}`, { visible: !stat.visible });
      fetchStats();
    } catch {
      toast("Error al actualizar visibilidad");
    }
  }

  if (loading) return <div className="p-8">Cargando...</div>;

  return (
    <div className="p-8 max-w-5xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3]" />
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#1C2230]">Indicadores de la Landing</h1>
          <p className="text-[#64748B] text-sm mt-1">Administrá las estadísticas que se muestran en la página principal.</p>
        </div>
        <button
          onClick={() => setForm({ icon: "BriefcaseIcon", value: "", label: "", sort_order: 0, visible: true })}
          className="bg-[#1E8EA3] text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#187B8E]"
        >
          <PlusIcon className="w-4 h-4" /> Nuevo Indicador
        </button>
      </div>

      {form && (
        <form onSubmit={saveStat} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 mb-8 shadow-sm">
          <h3 className="font-bold text-lg mb-4">{form.id ? "Editar Indicador" : "Nuevo Indicador"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-bold text-[#64748B] mb-1 block">Valor (ej: +500, +2000, Bahía Blanca)</label>
              <input required value={form.value || ""} onChange={e => setForm({ ...form, value: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] mb-1 block">Etiqueta (ej: Empresas activas, Candidatos registrados)</label>
              <input required value={form.label || ""} onChange={e => setForm({ ...form, label: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] mb-1 block">Icono (Heroicons outline name)</label>
              <input required value={form.icon || ""} onChange={e => setForm({ ...form, icon: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-[#64748B] mb-1 block">Orden (número menor aparece primero)</label>
              <input required type="number" value={form.sort_order || 0} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={form.visible ?? true} onChange={e => setForm({ ...form, visible: e.target.checked })} className="accent-[#1E8EA3]" />
            <label className="text-sm font-medium">Visible en la landing</label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border rounded-lg text-sm font-bold text-[#64748B]">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[#1E8EA3] text-white rounded-lg text-sm font-bold disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#FAFBFD] border-b border-[#DDE3EC] text-[#64748B]">
              <th className="font-semibold py-3 px-4">Orden</th>
              <th className="font-semibold py-3 px-4">Icono</th>
              <th className="font-semibold py-3 px-4">Valor</th>
              <th className="font-semibold py-3 px-4">Etiqueta</th>
              <th className="font-semibold py-3 px-4">Visible</th>
              <th className="font-semibold py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-[#64748B]">No hay indicadores creados.</td>
              </tr>
            ) : (
              stats.map(stat => (
                <tr key={stat.id} className="border-b border-[#DDE3EC] last:border-0 hover:bg-[#FAFBFD]">
                  <td className="py-3 px-4 text-[#1C2230]">{stat.sort_order}</td>
                  <td className="py-3 px-4 text-[#1C2230] font-mono text-xs">{stat.icon}</td>
                  <td className="py-3 px-4 font-bold text-[#1C2230]">{stat.value}</td>
                  <td className="py-3 px-4 text-[#64748B]">{stat.label}</td>
                  <td className="py-3 px-4">
                    <button onClick={() => toggleVisibility(stat)} className={`px-2 py-1 rounded-full text-xs font-bold ${stat.visible ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {stat.visible ? "Sí" : "No"}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setForm(stat)} className="p-1.5 text-[#64748B] hover:text-[#1E8EA3] transition-colors"><PencilIcon className="w-4 h-4" /></button>
                      <button onClick={() => deleteStat(stat.id)} className="p-1.5 text-[#64748B] hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
