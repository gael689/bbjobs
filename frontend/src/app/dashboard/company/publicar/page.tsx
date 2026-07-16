"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  CheckCircleIcon, PlusIcon, XMarkIcon, BoltIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon,
} from "@heroicons/react/24/outline";
import {
  EMPTY_JOB_FORM, MAX_JOB_DURATION_DAYS, MODALITIES, FEATURED_JOB_PRICE,
  type Catalog, type CompanyProfile, type JobForm,
} from "../types";

interface SelectedSkill {
  skill_id: string;
  skill_name: string;
  is_required: boolean;
}

const STEPS = [
  { key: "basico", label: "Título y modalidad" },
  { key: "clasificacion", label: "Categoría" },
  { key: "detalle", label: "Descripción" },
  { key: "condiciones", label: "Condiciones" },
  { key: "revision", label: "Revisión" },
];

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
  const [destacar, setDestacar] = useState(false);
  const [step, setStep] = useState(0);

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

  const stepValid: boolean[] = [
    form.title.trim().length > 0 && !!form.modality,
    !!form.industry_id && !!form.zone_id && !!form.contract_type_id,
    form.description.trim().length > 0 && form.requirements.trim().length > 0,
    true, // condiciones — todo opcional (salario, habilidades, duración ya tiene default)
    true,
  ];

  function goNext() {
    if (!stepValid[step]) return;
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep(s => Math.max(s - 1, 0));
  }

  async function handleCreateJob() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        salary_min: form.salary_min ? Number(form.salary_min) : undefined,
        salary_max: form.salary_max ? Number(form.salary_max) : undefined,
        skills: selectedSkills.map(s => ({ skill_id: s.skill_id, is_required: s.is_required })),
      };
      const created = await api.post("/me/company/jobs", payload);

      if (destacar) {
        try {
          const feature = await api.post(`/me/company/jobs/${created.data.id}/feature`);
          window.location.href = feature.data.init_point;
          return;
        } catch {
          toast("La búsqueda se publicó, pero no pudimos iniciar el pago del destacado — probá de nuevo desde Búsquedas");
          router.push("/dashboard/company/busquedas");
          return;
        }
      }

      toast("Búsqueda enviada — queda pendiente de aprobación de Talency antes de publicarse");
      router.push("/dashboard/company/busquedas");
    } catch {
      toast("Error al publicar la búsqueda");
    } finally {
      setSaving(false);
    }
  }

  const isVerified = profile?.verification_status === "verified";
  const modalityLabel = MODALITIES.find(m => m.value === form.modality)?.label || form.modality;
  const industryLabel = industries.find(i => i.id === form.industry_id)?.name;
  const zoneLabel = zones.find(z => z.id === form.zone_id)?.name;
  const contractLabel = contractTypes.find(c => c.id === form.contract_type_id)?.name;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230] flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {toastMsg}
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Publicar búsqueda</h1>
      <p className="text-[#64748B] text-sm mb-6">Te guiamos paso a paso — te toma un par de minutos.</p>

      {profile && !isVerified ? (
        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl px-6 py-5 text-sm text-[#1C2230]">
          Tu empresa todavía no está verificada. Solicitá la verificación desde{" "}
          <a href="/dashboard/company/perfil" className="font-bold text-[#1E8EA3] hover:underline">tu perfil</a>{" "}
          para poder publicar búsquedas.
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    i < step ? "bg-[#1E8EA3] text-white" :
                    i === step ? "bg-[#1E8EA3] text-white ring-4 ring-[#E6F4F7]" :
                    "bg-[#EEF2F7] text-[#94A3B8]"
                  }`}>
                    {i < step ? <CheckIcon className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10.5px] font-bold text-center hidden sm:block ${i === step ? "text-[#1E8EA3]" : "text-[#94A3B8]"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-colors ${i < step ? "bg-[#1E8EA3]" : "bg-[#EEF2F7]"}`} />
                )}
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 sm:p-8 min-h-[380px] flex flex-col">
            <div className="flex-1">
              {/* Step 0 — Título y modalidad */}
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Título del puesto *</label>
                    <input
                      autoFocus
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Ej: Desarrollador Frontend React"
                      className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-base text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Modalidad *</label>
                    <div className="grid grid-cols-3 gap-3">
                      {MODALITIES.map(m => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, modality: m.value }))}
                          className={`rounded-xl border-2 py-3.5 text-sm font-bold transition-colors ${
                            form.modality === m.value
                              ? "border-[#1E8EA3] bg-[#E6F4F7] text-[#1E8EA3]"
                              : "border-[#DDE3EC] text-[#64748B] hover:border-[#9ED4DF]"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1 — Clasificación */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Industria *</label>
                    <select
                      value={form.industry_id}
                      onChange={e => setForm(f => ({ ...f, industry_id: e.target.value }))}
                      className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors bg-white"
                    >
                      <option value="">Seleccionar</option>
                      {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Zona *</label>
                    <select
                      value={form.zone_id}
                      onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}
                      className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors bg-white"
                    >
                      <option value="">Seleccionar</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Tipo de contrato *</label>
                    <select
                      value={form.contract_type_id}
                      onChange={e => setForm(f => ({ ...f, contract_type_id: e.target.value }))}
                      className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors bg-white"
                    >
                      <option value="">Seleccionar</option>
                      {contractTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Step 2 — Descripción y requisitos */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Descripción del puesto *</label>
                    <textarea
                      autoFocus
                      rows={5}
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Describí las responsabilidades, el contexto del equipo, etc."
                      className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Requisitos *</label>
                    <textarea
                      rows={4}
                      value={form.requirements}
                      onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
                      placeholder="Experiencia requerida, tecnologías, habilidades, etc."
                      className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 3 — Condiciones: salario, duración, habilidades */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Salario mínimo (ARS)</label>
                      <input
                        type="number" min={0}
                        value={form.salary_min}
                        onChange={e => setForm(f => ({ ...f, salary_min: e.target.value }))}
                        placeholder="Ej: 400000"
                        className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Salario máximo (ARS)</label>
                      <input
                        type="number" min={0}
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

                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Duración de la búsqueda</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={1} max={MAX_JOB_DURATION_DAYS}
                        value={form.duration_days}
                        onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))}
                        className="flex-1 accent-[#1E8EA3]"
                      />
                      <span className="text-sm font-bold text-[#1E8EA3] w-16 text-right shrink-0">{form.duration_days} días</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Habilidades buscadas</label>
                    <p className="text-xs text-[#64748B] mb-3">
                      Elegí del catálogo qué sabe hacer el candidato ideal. Marcá cada una como
                      &quot;Requisito&quot; (excluyente) o &quot;Deseable&quot; (suma, no descarta).
                    </p>
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
                </div>
              )}

              {/* Step 4 — Revisión + destacar */}
              {step === 4 && (
                <div className="space-y-5">
                  <div className="border border-[#DDE3EC] rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display font-bold text-[#1C2230] text-lg">{form.title || "—"}</p>
                        <p className="text-sm text-[#64748B] mt-0.5">
                          {modalityLabel} · {industryLabel || "—"} · {zoneLabel || "—"} · {contractLabel || "—"}
                        </p>
                      </div>
                      <button type="button" onClick={() => setStep(0)} className="text-xs font-bold text-[#1E8EA3] hover:underline shrink-0">Editar</button>
                    </div>
                    <p className="text-sm text-[#1C2230] leading-relaxed line-clamp-3">{form.description || "—"}</p>
                    {selectedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSkills.map(s => (
                          <span key={s.skill_id} className="text-xs font-semibold bg-[#E6F4F7] text-[#1C2230] px-2.5 py-1 rounded-full">{s.skill_name}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-[#64748B]">
                      Dura {form.duration_days} días
                      {form.salary_visible && form.salary_min ? ` · ARS ${Number(form.salary_min).toLocaleString("es-AR")}${form.salary_max ? ` - ${Number(form.salary_max).toLocaleString("es-AR")}` : ""}` : ""}
                    </p>
                  </div>

                  <label className="flex items-center justify-between gap-3 bg-[#F7EFE9] border border-[#D4B7A2] rounded-xl px-4 py-3.5 cursor-pointer">
                    <span className="flex items-start gap-2.5">
                      <BoltIcon className="w-5 h-5 text-[#B98F72] shrink-0 mt-0.5" />
                      <span>
                        <span className="block text-sm font-bold text-[#8A6A54]">
                          Destacar esta búsqueda — ${FEATURED_JOB_PRICE.toLocaleString("es-AR")} ARS
                        </span>
                        <span className="block text-xs text-[#64748B] mt-0.5">
                          Prioridad en la revisión de Talency y en el listado público. Te lleva al pago de Mercado Pago al enviar.
                        </span>
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={destacar}
                      onChange={e => setDestacar(e.target.checked)}
                      className="w-5 h-5 accent-[#D4B7A2] shrink-0"
                    />
                  </label>

                  <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl px-4 py-3 text-xs text-[#1C2230]">
                    Antes de aparecer en el portal, el equipo de Talency revisa toda búsqueda nueva.
                    Te avisamos apenas quede aprobada.
                  </div>
                </div>
              )}
            </div>

            {/* Nav */}
            <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-[#DDE3EC]">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748B] px-4 py-2.5 rounded-xl hover:bg-[#FAFBFD] disabled:opacity-0 disabled:pointer-events-none transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" /> Atrás
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!stepValid[step]}
                  className="inline-flex items-center gap-1.5 bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-40 text-white font-bold rounded-xl px-6 py-2.5 text-sm transition-colors"
                >
                  Siguiente <ArrowRightIcon className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateJob}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl px-6 py-2.5 text-sm transition-colors"
                >
                  {saving ? "Enviando..." : destacar ? "Enviar y pagar destacado" : "Enviar para revisión"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
