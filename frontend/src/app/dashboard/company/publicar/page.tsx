"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { EMPTY_JOB_FORM, MODALITIES, type Catalog, type CompanyProfile, type JobForm } from "../types";

export default function PublicarBusquedaPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [industries, setIndustries] = useState<Catalog[]>([]);
  const [zones, setZones] = useState<Catalog[]>([]);
  const [contractTypes, setContractTypes] = useState<Catalog[]>([]);
  const [form, setForm] = useState<JobForm>(EMPTY_JOB_FORM);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get("/me/company/profile").then(r => setProfile(r.data)).catch(() => {});
    api.get("/catalogs/industries").then(r => setIndustries(r.data)).catch(() => {});
    api.get("/catalogs/zones").then(r => setZones(r.data)).catch(() => {});
    api.get("/catalogs/contract-types").then(r => setContractTypes(r.data)).catch(() => {});
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        salary_min: form.salary_min ? Number(form.salary_min) : undefined,
        salary_max: form.salary_max ? Number(form.salary_max) : undefined,
        skills: [],
      };
      await api.post("/me/company/jobs", payload);
      toast("Búsqueda publicada correctamente");
      setForm(EMPTY_JOB_FORM);
      router.push("/dashboard/company/estadisticas");
    } catch {
      toast("Error al publicar la búsqueda");
    } finally {
      setSaving(false);
    }
  }

  const isVerified = profile?.verification_status === "verified";

  return (
    <div className="px-4 sm:px-6 py-8 max-w-2xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230] flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {toastMsg}
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Publicar búsqueda</h1>
      <p className="text-[#64748B] text-sm mb-6">Completá los datos de la búsqueda laboral.</p>

      {profile && !isVerified ? (
        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl px-6 py-5 text-sm text-[#1C2230]">
          Tu empresa todavía no está verificada. Solicitá la verificación desde{" "}
          <a href="/dashboard/company/perfil" className="font-bold text-[#1E8EA3] hover:underline">tu perfil</a>{" "}
          para poder publicar búsquedas.
        </div>
      ) : (
        <form onSubmit={handleCreateJob} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Título del puesto *</label>
            <input
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ej: Desarrollador Frontend React"
              className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Industria *</label>
              <select
                required
                value={form.industry_id}
                onChange={e => setForm(f => ({ ...f, industry_id: e.target.value }))}
                className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors bg-white"
              >
                <option value="">Seleccionar</option>
                {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Zona *</label>
              <select
                required
                value={form.zone_id}
                onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}
                className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors bg-white"
              >
                <option value="">Seleccionar</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Modalidad *</label>
              <select
                required
                value={form.modality}
                onChange={e => setForm(f => ({ ...f, modality: e.target.value }))}
                className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors bg-white"
              >
                {MODALITIES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Tipo de contrato *</label>
            <select
              required
              value={form.contract_type_id}
              onChange={e => setForm(f => ({ ...f, contract_type_id: e.target.value }))}
              className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors bg-white"
            >
              <option value="">Seleccionar</option>
              {contractTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Descripción del puesto *</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describí las responsabilidades, el contexto del equipo, etc."
              className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Requisitos *</label>
            <textarea
              required
              rows={3}
              value={form.requirements}
              onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
              placeholder="Experiencia requerida, tecnologías, habilidades, etc."
              className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Salario mínimo (ARS)</label>
              <input
                type="number"
                min={0}
                value={form.salary_min}
                onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))}
                placeholder="Ej: 400000"
                className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Salario máximo (ARS)</label>
              <input
                type="number"
                min={0}
                value={form.salary_max}
                onChange={e => setForm(f => ({ ...f, salary_max: e.target.value }))}
                placeholder="Ej: 600000"
                className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.salary_visible}
              onChange={e => setForm(f => ({ ...f, salary_visible: e.target.checked }))}
              className="w-4 h-4 accent-[#1E8EA3]"
            />
            <span className="text-sm text-[#64748B]">Mostrar salario en la publicación</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl py-3 text-sm transition-colors"
          >
            {saving ? "Publicando..." : "Publicar búsqueda"}
          </button>
        </form>
      )}
    </div>
  );
}
