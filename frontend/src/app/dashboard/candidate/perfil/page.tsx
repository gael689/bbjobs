"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/lib/api";
import {
  DocumentTextIcon, CloudArrowUpIcon, CheckCircleIcon,
  PlusIcon, XMarkIcon, AcademicCapIcon, WrenchScrewdriverIcon,
  LanguageIcon, TrashIcon, UserCircleIcon,
} from "@heroicons/react/24/outline";
import ProfileCompletionRing from "@/components/ui/ProfileCompletionRing";
import {
  GENDER_LABEL, AVAILABILITY_LABEL, SUMMARY_MAX_LENGTH, SKILL_LEVEL_LABEL,
  type CandidateProfile, type Education, type Experience, type Language,
  type Gender, type Availability, type SkillCatalogItem, type CandidateSkillItem, type SkillLevel,
} from "../types";

type PersonalForm = {
  birth_date: string;
  gender: "" | Gender;
  has_own_transport: "" | "true" | "false";
  availability: "" | Availability;
  immediate_availability: boolean;
  summary: string;
};

const EMPTY_PERSONAL_FORM: PersonalForm = {
  birth_date: "", gender: "", has_own_transport: "", availability: "",
  immediate_availability: false, summary: "",
};

export default function CandidatePerfilPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogItem[]>([]);
  const [mySkills, setMySkills] = useState<CandidateSkillItem[]>([]);
  const [cvUploading, setCvUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [showExpForm, setShowExpForm] = useState(false);
  const [showEduForm, setShowEduForm] = useState(false);
  const [showLangForm, setShowLangForm] = useState(false);
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [expForm, setExpForm] = useState({ company_name: "", role_title: "", start_date: "", end_date: "", description: "" });
  const [eduForm, setEduForm] = useState({ institution: "", degree: "", level: "secundario", start_date: "", end_date: "", in_progress: false });
  const [langForm, setLangForm] = useState({ language_name: "", level: "básico" });
  const [skillForm, setSkillForm] = useState<{ skill_id: string; level: SkillLevel }>({ skill_id: "", level: "básico" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [personalForm, setPersonalForm] = useState<PersonalForm>(EMPTY_PERSONAL_FORM);
  const [savingPersonal, setSavingPersonal] = useState(false);

  const cvRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/me/candidate/profile").then(r => {
      setProfile(r.data);
      setPersonalForm({
        birth_date: r.data.birth_date || "",
        gender: r.data.gender || "",
        has_own_transport: r.data.has_own_transport == null ? "" : (r.data.has_own_transport ? "true" : "false"),
        availability: r.data.availability || "",
        immediate_availability: !!r.data.immediate_availability,
        summary: r.data.summary || "",
      });
    }).catch(() => {});
    api.get("/me/candidate/experience").then(r => setExperiences(r.data)).catch(() => {});
    api.get("/me/candidate/education").then(r => setEducations(r.data)).catch(() => {});
    api.get("/me/candidate/languages").then(r => setLanguages(r.data)).catch(() => {});
    api.get("/skills").then(r => setSkillsCatalog(r.data)).catch(() => {});
    api.get("/me/candidate/skills").then(r => setMySkills(r.data)).catch(() => {});
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function savePersonalData(e: React.FormEvent) {
    e.preventDefault();
    setSavingPersonal(true);
    try {
      const r = await api.patch("/me/candidate/profile", {
        birth_date: personalForm.birth_date || null,
        gender: personalForm.gender || null,
        has_own_transport: personalForm.has_own_transport === "" ? null : personalForm.has_own_transport === "true",
        availability: personalForm.availability || null,
        immediate_availability: personalForm.immediate_availability,
        summary: personalForm.summary || null,
      });
      setProfile(r.data);
      toast("Datos personales actualizados");
    } catch {
      toast("Error al guardar los datos personales");
    } finally {
      setSavingPersonal(false);
    }
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast("Solo se permiten archivos PDF"); return; }
    setCvUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post("/me/candidate/cv", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setProfile(r.data);
      toast("CV actualizado correctamente");
    } catch {
      toast("Error al subir el CV");
    } finally {
      setCvUploading(false);
    }
  }

  async function addExperience(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const r = await api.post("/me/candidate/experience", expForm);
      setExperiences(prev => [...prev, r.data]);
      setShowExpForm(false);
      setExpForm({ company_name: "", role_title: "", start_date: "", end_date: "", description: "" });
      toast("Experiencia agregada");
    } catch { toast("Error al guardar"); } finally { setSavingProfile(false); }
  }

  async function deleteExperience(id: string) {
    try {
      await api.delete(`/me/candidate/experience/${id}`);
      setExperiences(prev => prev.filter(e => e.id !== id));
      toast("Experiencia eliminada");
    } catch { toast("Error al eliminar"); }
  }

  async function addEducation(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const r = await api.post("/me/candidate/education", eduForm);
      setEducations(prev => [...prev, r.data]);
      setShowEduForm(false);
      setEduForm({ institution: "", degree: "", level: "secundario", start_date: "", end_date: "", in_progress: false });
      toast("Educación agregada");
    } catch { toast("Error al guardar"); } finally { setSavingProfile(false); }
  }

  async function deleteEducation(id: string) {
    try {
      await api.delete(`/me/candidate/education/${id}`);
      setEducations(prev => prev.filter(e => e.id !== id));
      toast("Educación eliminada");
    } catch { toast("Error al eliminar"); }
  }

  async function addLanguage(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const r = await api.post("/me/candidate/languages", langForm);
      setLanguages(prev => [...prev, r.data]);
      setShowLangForm(false);
      setLangForm({ language_name: "", level: "básico" });
      toast("Idioma agregado");
    } catch { toast("Error al guardar"); } finally { setSavingProfile(false); }
  }

  async function deleteLanguage(id: string) {
    try {
      await api.delete(`/me/candidate/languages/${id}`);
      setLanguages(prev => prev.filter(l => l.id !== id));
      toast("Idioma eliminado");
    } catch { toast("Error al eliminar"); }
  }

  async function addSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!skillForm.skill_id) return;
    setSavingProfile(true);
    try {
      await api.post("/me/candidate/skills", skillForm);
      const skill = skillsCatalog.find(s => s.id === skillForm.skill_id);
      setMySkills(prev => [...prev, { skill_id: skillForm.skill_id, skill_name: skill?.name || "", level: skillForm.level }]);
      setShowSkillForm(false);
      setSkillForm({ skill_id: "", level: "básico" });
      toast("Habilidad agregada");
    } catch { toast("Error al guardar"); } finally { setSavingProfile(false); }
  }

  async function deleteSkill(skillId: string) {
    try {
      await api.delete(`/me/candidate/skills/${skillId}`);
      setMySkills(prev => prev.filter(s => s.skill_id !== skillId));
      toast("Habilidad eliminada");
    } catch { toast("Error al eliminar"); }
  }

  const availableSkillsForPicker = skillsCatalog.filter(s => !mySkills.some(ms => ms.skill_id === s.id));

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230] flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {toastMsg}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#1C2230]">
            Hola, {profile?.first_name || user?.primaryEmailAddress?.emailAddress?.split("@")[0]}
          </h1>
          <p className="text-[#64748B] text-sm mt-1">Mi perfil, CV y experiencia.</p>
        </div>
        <div className="flex items-center gap-3">
          {cvUploading ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
              Subiendo...
            </div>
          ) : (
            <button
              onClick={() => cvRef.current?.click()}
              className="inline-flex items-center gap-2 border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-[#E6F4F7] transition-colors"
            >
              <CloudArrowUpIcon className="w-4 h-4" />
              {profile?.cv_file_url ? "Actualizar CV" : "Subir CV"}
            </button>
          )}
          <input ref={cvRef} type="file" accept="application/pdf" className="hidden" onChange={handleCvUpload} />
          {profile?.cv_file_url && (
            <a href={profile.cv_file_url} target="_blank" rel="noreferrer"
              className="text-sm font-bold text-[#1E8EA3] hover:underline flex items-center gap-1">
              <DocumentTextIcon className="w-4 h-4" />
              Ver CV
            </a>
          )}
        </div>
      </div>

      {profile && (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <ProfileCompletionRing percent={profile.completion_percent} size={92} />
          <div className="flex-1 text-center sm:text-left">
            {profile.completion_percent >= 100 ? (
              <>
                <p className="font-display font-bold text-[#16A34A]">¡Perfil completo!</p>
                <p className="text-sm text-[#64748B] mt-1">
                  Las empresas ven tu perfil al 100% — es el mejor momento para postularte.
                </p>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-[#1C2230]">Tu perfil está {profile.completion_percent}% completo</p>
                <p className="text-sm text-[#64748B] mt-1">
                  Las empresas ven cuando tu perfil está incompleto. Completalo para destacar frente a otros candidatos.
                </p>
                {profile.missing_fields.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 justify-center sm:justify-start">
                    {profile.missing_fields.map(m => (
                      <span key={m.key} className="text-xs font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-2.5 py-1 rounded-full">
                        Falta: {m.label}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <form onSubmit={savePersonalData} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <UserCircleIcon className="w-5 h-5 text-[#1E8EA3]" />
          <h3 className="font-display font-bold text-[#1C2230]">Datos personales</h3>
        </div>
        <p className="text-xs text-[#64748B] mb-4">
          Estos datos son opcionales, pero completarlos te ayuda a destacar frente a las empresas
          y habilita más filtros de búsqueda a tu favor.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#64748B] mb-1 block">Fecha de nacimiento</label>
            <input
              type="date"
              value={personalForm.birth_date}
              onChange={e => setPersonalForm(f => ({ ...f, birth_date: e.target.value }))}
              className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748B] mb-1 block">Sexo</label>
            <select
              value={personalForm.gender}
              onChange={e => setPersonalForm(f => ({ ...f, gender: e.target.value as PersonalForm["gender"] }))}
              className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white"
            >
              <option value="">Sin especificar</option>
              {Object.entries(GENDER_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748B] mb-1 block">Movilidad propia</label>
            <select
              value={personalForm.has_own_transport}
              onChange={e => setPersonalForm(f => ({ ...f, has_own_transport: e.target.value as PersonalForm["has_own_transport"] }))}
              className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white"
            >
              <option value="">Sin especificar</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[#64748B] mb-1 block">Disponibilidad</label>
            <select
              value={personalForm.availability}
              onChange={e => setPersonalForm(f => ({ ...f, availability: e.target.value as PersonalForm["availability"] }))}
              className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white"
            >
              <option value="">Sin especificar</option>
              {Object.entries(AVAILABILITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1C2230] mt-4">
          <input
            type="checkbox"
            checked={personalForm.immediate_availability}
            onChange={e => setPersonalForm(f => ({ ...f, immediate_availability: e.target.checked }))}
            className="w-4 h-4 accent-[#1E8EA3]"
          />
          Tengo disponibilidad inmediata
        </label>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-[#64748B] block">Descripción personal</label>
            <span className={`text-xs ${personalForm.summary.length > SUMMARY_MAX_LENGTH ? "text-red-500" : "text-[#64748B]"}`}>
              {personalForm.summary.length}/{SUMMARY_MAX_LENGTH}
            </span>
          </div>
          <textarea
            value={personalForm.summary}
            onChange={e => setPersonalForm(f => ({ ...f, summary: e.target.value.slice(0, SUMMARY_MAX_LENGTH) }))}
            maxLength={SUMMARY_MAX_LENGTH}
            rows={3}
            placeholder="Contale a las empresas quién sos, en pocas palabras..."
            className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-none"
          />
          <p className="text-xs text-[#64748B] mt-1">Esto lo ve la empresa cuando revisa tu postulación.</p>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            disabled={savingPersonal}
            className="text-sm bg-[#1E8EA3] text-white font-bold rounded-lg px-5 py-2.5 hover:bg-[#187B8E] disabled:opacity-60 transition-colors"
          >
            {savingPersonal ? "Guardando..." : "Guardar datos personales"}
          </button>
        </div>
      </form>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 space-y-8">
        {/* Experience */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WrenchScrewdriverIcon className="w-5 h-5 text-[#1E8EA3]" />
              <h3 className="font-display font-bold text-[#1C2230]">Experiencia laboral</h3>
            </div>
            <button onClick={() => setShowExpForm(v => !v)}
              className="text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] flex items-center gap-1">
              <PlusIcon className="w-4 h-4" /> Agregar
            </button>
          </div>
          {showExpForm && (
            <form onSubmit={addExperience} className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Empresa *</label>
                  <input required value={expForm.company_name} onChange={e => setExpForm(f => ({ ...f, company_name: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" placeholder="Nombre de la empresa" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Cargo *</label>
                  <input required value={expForm.role_title} onChange={e => setExpForm(f => ({ ...f, role_title: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" placeholder="Tu rol" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Inicio *</label>
                  <input required type="date" value={expForm.start_date} onChange={e => setExpForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Fin (vacío = actual)</label>
                  <input type="date" value={expForm.end_date} onChange={e => setExpForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#64748B] mb-1 block">Descripción</label>
                <textarea value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-none" placeholder="Descripción breve del rol..." />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowExpForm(false)}
                  className="text-sm text-[#64748B] border border-[#DDE3EC] rounded-lg px-4 py-2 hover:bg-white transition-colors">Cancelar</button>
                <button type="submit" disabled={savingProfile}
                  className="text-sm bg-[#1E8EA3] text-white font-bold rounded-lg px-4 py-2 hover:bg-[#187B8E] disabled:opacity-60 transition-colors">
                  {savingProfile ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          )}
          {experiences.length === 0 && !showExpForm && (
            <p className="text-sm text-[#64748B]">No hay experiencia cargada.</p>
          )}
          <div className="space-y-2">
            {experiences.map(exp => (
              <div key={exp.id} className="flex items-start justify-between border border-[#DDE3EC] rounded-xl p-4">
                <div>
                  <p className="font-bold text-[#1C2230]">{exp.role_title}</p>
                  <p className="text-sm text-[#64748B]">{exp.company_name} · {exp.start_date?.slice(0, 7)} – {exp.end_date?.slice(0, 7) || "Actual"}</p>
                  {exp.description && <p className="text-xs text-[#64748B] mt-1">{exp.description}</p>}
                </div>
                <button onClick={() => deleteExperience(exp.id)} className="ml-3 p-1.5 text-[#64748B] hover:text-red-500 transition-colors shrink-0">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AcademicCapIcon className="w-5 h-5 text-[#1E8EA3]" />
              <h3 className="font-display font-bold text-[#1C2230]">Educación</h3>
            </div>
            <button onClick={() => setShowEduForm(v => !v)}
              className="text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] flex items-center gap-1">
              <PlusIcon className="w-4 h-4" /> Agregar
            </button>
          </div>
          {showEduForm && (
            <form onSubmit={addEducation} className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Institución *</label>
                  <input required value={eduForm.institution} onChange={e => setEduForm(f => ({ ...f, institution: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" placeholder="Universidad, colegio..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Título / Carrera</label>
                  <input value={eduForm.degree} onChange={e => setEduForm(f => ({ ...f, degree: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" placeholder="Lic. en..." />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Nivel *</label>
                  <select required value={eduForm.level} onChange={e => setEduForm(f => ({ ...f, level: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white">
                    <option value="secundario">Secundario</option>
                    <option value="terciario">Terciario</option>
                    <option value="universitario">Universitario</option>
                    <option value="posgrado">Posgrado</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Inicio *</label>
                  <input required type="date" value={eduForm.start_date} onChange={e => setEduForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Fin</label>
                  <input type="date" value={eduForm.end_date} onChange={e => setEduForm(f => ({ ...f, end_date: e.target.value }))}
                    disabled={eduForm.in_progress}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] disabled:opacity-50" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[#64748B]">
                <input type="checkbox" checked={eduForm.in_progress} onChange={e => setEduForm(f => ({ ...f, in_progress: e.target.checked }))} className="w-4 h-4 accent-[#1E8EA3]" />
                En curso
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowEduForm(false)}
                  className="text-sm text-[#64748B] border border-[#DDE3EC] rounded-lg px-4 py-2 hover:bg-white transition-colors">Cancelar</button>
                <button type="submit" disabled={savingProfile}
                  className="text-sm bg-[#1E8EA3] text-white font-bold rounded-lg px-4 py-2 hover:bg-[#187B8E] disabled:opacity-60 transition-colors">
                  {savingProfile ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          )}
          {educations.length === 0 && !showEduForm && (
            <p className="text-sm text-[#64748B]">No hay educación cargada.</p>
          )}
          <div className="space-y-2">
            {educations.map(edu => (
              <div key={edu.id} className="flex items-start justify-between border border-[#DDE3EC] rounded-xl p-4">
                <div>
                  <p className="font-bold text-[#1C2230]">{edu.degree || edu.level}</p>
                  <p className="text-sm text-[#64748B]">{edu.institution} · {edu.start_date?.slice(0, 7)} – {edu.in_progress ? "En curso" : edu.end_date?.slice(0, 7) || "—"}</p>
                </div>
                <button onClick={() => deleteEducation(edu.id)} className="ml-3 p-1.5 text-[#64748B] hover:text-red-500 transition-colors shrink-0">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <WrenchScrewdriverIcon className="w-5 h-5 text-[#1E8EA3]" />
              <h3 className="font-display font-bold text-[#1C2230]">Habilidades</h3>
            </div>
            <button onClick={() => setShowSkillForm(v => !v)}
              className="text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] flex items-center gap-1">
              <PlusIcon className="w-4 h-4" /> Agregar
            </button>
          </div>
          {showSkillForm && (
            <form onSubmit={addSkill} className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Habilidad *</label>
                  <select required value={skillForm.skill_id} onChange={e => setSkillForm(f => ({ ...f, skill_id: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white">
                    <option value="">Seleccionar</option>
                    {availableSkillsForPicker.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Nivel *</label>
                  <select required value={skillForm.level} onChange={e => setSkillForm(f => ({ ...f, level: e.target.value as SkillLevel }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white">
                    {Object.entries(SKILL_LEVEL_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-[#64748B]">
                ¿No encontrás tu habilidad? Contala en tu descripción personal o en el CV.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowSkillForm(false)}
                  className="text-sm text-[#64748B] border border-[#DDE3EC] rounded-lg px-4 py-2 hover:bg-white transition-colors">Cancelar</button>
                <button type="submit" disabled={savingProfile || !skillForm.skill_id}
                  className="text-sm bg-[#1E8EA3] text-white font-bold rounded-lg px-4 py-2 hover:bg-[#187B8E] disabled:opacity-60 transition-colors">
                  {savingProfile ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          )}
          {mySkills.length === 0 && !showSkillForm ? (
            <p className="text-sm text-[#64748B]">No hay habilidades cargadas.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {mySkills.map(sk => (
                <div key={sk.skill_id} className="flex items-center gap-1.5 bg-[#E6F4F7] text-[#1C2230] text-sm font-medium px-3 py-1.5 rounded-full">
                  {sk.skill_name} · {SKILL_LEVEL_LABEL[sk.level]}
                  <button onClick={() => deleteSkill(sk.skill_id)} className="ml-1 text-[#64748B] hover:text-red-500 transition-colors">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Languages */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LanguageIcon className="w-5 h-5 text-[#1E8EA3]" />
              <h3 className="font-display font-bold text-[#1C2230]">Idiomas</h3>
            </div>
            <button onClick={() => setShowLangForm(v => !v)}
              className="text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] flex items-center gap-1">
              <PlusIcon className="w-4 h-4" /> Agregar
            </button>
          </div>
          {showLangForm && (
            <form onSubmit={addLanguage} className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Idioma *</label>
                  <input required value={langForm.language_name} onChange={e => setLangForm(f => ({ ...f, language_name: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" placeholder="Inglés, Portugués..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Nivel *</label>
                  <select required value={langForm.level} onChange={e => setLangForm(f => ({ ...f, level: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white">
                    <option value="básico">Básico</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
                    <option value="nativo">Nativo</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowLangForm(false)}
                  className="text-sm text-[#64748B] border border-[#DDE3EC] rounded-lg px-4 py-2 hover:bg-white transition-colors">Cancelar</button>
                <button type="submit" disabled={savingProfile}
                  className="text-sm bg-[#1E8EA3] text-white font-bold rounded-lg px-4 py-2 hover:bg-[#187B8E] disabled:opacity-60 transition-colors">
                  {savingProfile ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          )}
          {languages.length === 0 && !showLangForm ? (
            <p className="text-sm text-[#64748B]">No hay idiomas cargados.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {languages.map(lang => (
                <div key={lang.id} className="flex items-center gap-1.5 bg-[#E6F4F7] text-[#1C2230] text-sm font-medium px-3 py-1.5 rounded-full">
                  <LanguageIcon className="w-3.5 h-3.5 text-[#1E8EA3]" />
                  {lang.language_name} · {lang.level}
                  <button onClick={() => deleteLanguage(lang.id)} className="ml-1 text-[#64748B] hover:text-red-500 transition-colors">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
