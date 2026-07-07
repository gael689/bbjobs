"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/lib/api";
import {
  DocumentTextIcon, CloudArrowUpIcon, CheckCircleIcon,
  PlusIcon, XMarkIcon, AcademicCapIcon, WrenchScrewdriverIcon,
  LanguageIcon, TrashIcon,
} from "@heroicons/react/24/outline";
import type { CandidateProfile, Education, Experience, Language } from "../types";

export default function CandidatePerfilPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [cvUploading, setCvUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [showExpForm, setShowExpForm] = useState(false);
  const [showEduForm, setShowEduForm] = useState(false);
  const [showLangForm, setShowLangForm] = useState(false);
  const [expForm, setExpForm] = useState({ company_name: "", role_title: "", start_date: "", end_date: "", description: "" });
  const [eduForm, setEduForm] = useState({ institution: "", degree: "", level: "secondary", start_date: "", end_date: "", in_progress: false });
  const [langForm, setLangForm] = useState({ language_name: "", level: "basic" });
  const [savingProfile, setSavingProfile] = useState(false);

  const cvRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/me/candidate/profile").then(r => setProfile(r.data)).catch(() => {});
    api.get("/me/candidate/experience").then(r => setExperiences(r.data)).catch(() => {});
    api.get("/me/candidate/education").then(r => setEducations(r.data)).catch(() => {});
    api.get("/me/candidate/languages").then(r => setLanguages(r.data)).catch(() => {});
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
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
      setEduForm({ institution: "", degree: "", level: "secondary", start_date: "", end_date: "", in_progress: false });
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
      setLangForm({ language_name: "", level: "basic" });
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
                    <option value="primary">Primario</option>
                    <option value="secondary">Secundario</option>
                    <option value="tertiary">Terciario</option>
                    <option value="university">Universitario</option>
                    <option value="postgraduate">Posgrado</option>
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
                    <option value="basic">Básico</option>
                    <option value="intermediate">Intermedio</option>
                    <option value="advanced">Avanzado</option>
                    <option value="native">Nativo</option>
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
