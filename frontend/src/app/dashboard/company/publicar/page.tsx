"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { CheckCircleIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { EMPTY_JOB_FORM, MAX_JOB_DURATION_DAYS, MODALITIES, type Catalog, type CompanyProfile, type JobForm } from "../types";

interface SelectedSkill {
  skill_id: string;
  skill_name: string;
  is_required: boolean;
}

export default function PublicarBusquedaPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [industries, setIndustries] = useState<Catalog[]>([]);
  const [zones, setZones] = useState<Catalog[]>([]);
  const [contractTypes, setContractTypes] = useState<Catalog[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<Catalog[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [skillToAdd, setSkillToAdd] = useState("");
  const [form, setForm] = useState<JobForm>(EMPTY_JOB_FORM);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get("/me/company/profile").then(r => setProfile(r.data)).catch(() => {});
    api.get("/catalogs/industries").then(r => setIndustries(r.data)).catch(() => {});
    api.get("/catalogs/zones").then(r => setZones(r.data)).catch(() => {});
    api.get("/catalogs/contract-types").then(r => setContractTypes(r.data)).catch(() => {});
    api.get("/skills").then(r => setSkillsCatalog(r.data)).catch(() => {});
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  function addSelectedSkill() {
    if (!skillToAdd) return;
    const skill = skillsCatalog.find(s => s.id === skillToAdd);
    if (!skill) return;
    setSelectedSkills(prev => [...prev, { skill_id: skill.id, skill_name: skill.name, is_required: true }]);
    setSkillToAdd("");
  }

  function removeSelectedSkill(skillId: string) {
    setSelectedSkills(prev => prev.filter(s => s.skill_id !== skillId));
  }

  function toggleSkillRequired(skillId: string) {
    setSelectedSkills(prev => prev.map(s => s.skill_id === skillId ? { ...s, is_required: !s.is_required } : s));
  }

  const availableSkillsToAdd = skillsCatalog.filter(s => !selectedSkills.some(sel => sel.skill_id === s.id));

  async function handleCreateJob(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        salary_min: form.salary_min ? Number(form.salary_min) : undefined,
        salary_max: form.salary_max ? Number(form.salary_max) : undefined,
        skills: selectedSkills.map(s => ({ skill_id: s.skill_id, is_required: s.is_required })),
      };
      await api.post("/me/company/jobs", payload);
      toast("Búsqueda enviada — queda pendiente de aprobación de Talency antes de publicarse");
      setForm(EMPTY_JOB_FORM);
      setSelectedSkills([]);
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

          <div>
            <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Habilidades buscadas</label>
            <div className="flex gap-2 mb-3">
              <select
                value={skillToAdd}
                onChange={e => setSkillToAdd(e.target.value)}
                className="flex-1 border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors bg-white"
              >
                <option value="">Seleccionar habilidad</option>
                {availableSkillsToAdd.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button
                type="button"
                onClick={addSelectedSkill}
                disabled={!skillToAdd}
                className="shrink-0 inline-flex items-center gap-1 border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-4 py-2.5 text-sm hover:bg-[#E6F4F7] disabled:opacity-50 transition-colors"
              >
                <PlusIcon className="w-4 h-4" /> Agregar
              </button>
            </div>
            {selectedSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedSkills.map(s => (
                  <div key={s.skill_id} className="flex items-center gap-1.5 bg-[#FAFBFD] border border-[#DDE3EC] text-[#1C2230] text-sm font-medium pl-3 pr-2 py-1.5 rounded-full">
                    {s.skill_name}
                    <button
                      type="button"
                      onClick={() => toggleSkillRequired(s.skill_id)}
                      className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors ${
                        s.is_required ? "bg-[#E6F4F7] text-[#1E8EA3]" : "bg-transparent text-[#64748B]"
                      }`}
                      title="Alternar entre requisito excluyente y deseable"
                    >
                      {s.is_required ? "Requisito" : "Deseable"}
                    </button>
                    <button type="button" onClick={() => removeSelectedSkill(s.skill_id)} className="text-[#64748B] hover:text-red-500 transition-colors">
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

          <div>
            <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Duración de la búsqueda</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={MAX_JOB_DURATION_DAYS}
                value={form.duration_days}
                onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))}
                className="flex-1 accent-[#1E8EA3]"
              />
              <span className="text-sm font-bold text-[#1E8EA3] w-16 text-right shrink-0">{form.duration_days} días</span>
            </div>
            <p className="text-xs text-[#64748B] mt-1.5">
              La búsqueda se da de baja automáticamente al cumplirse el plazo (máximo {MAX_JOB_DURATION_DAYS} días). Podés reducirlo si querés cerrarla antes.
            </p>
          </div>

          <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl px-4 py-3 text-xs text-[#1C2230]">
            Antes de aparecer en el portal, el equipo de Talency revisa toda búsqueda nueva.
            Te avisamos apenas quede aprobada.
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl py-3 text-sm transition-colors"
          >
            {saving ? "Enviando..." : "Enviar para revisión"}
          </button>
        </form>
      )}
    </div>
  );
}
