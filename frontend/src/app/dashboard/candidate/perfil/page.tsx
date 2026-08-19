"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { abrirCv } from "@/lib/cv";
import { achicarImagen } from "@/lib/imagen";
import {
  DocumentTextIcon, CloudArrowUpIcon, CheckCircleIcon,
  XMarkIcon, AcademicCapIcon, WrenchScrewdriverIcon,
  LanguageIcon, TrashIcon, UserCircleIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";
import ProfileCompletionRing from "@/components/ui/ProfileCompletionRing";
import SkillPicker from "@/components/dashboard/SkillPicker";
import {
  GENDER_LABEL, AVAILABILITY_LABEL, SUMMARY_MAX_LENGTH, SLUG_IDIOMAS, SLUG_OTRA,
  OTRO_IDIOMA,
  EDUCATION_STATUS_LABEL, type EducationStatus,
  type CandidateProfile, type Education, type Experience, type Language, type Zone,
  type Gender, type Availability, type SkillCatalog, type SkillCatalogItem,
  type CandidateSkills,
} from "../types";

type PersonalForm = {
  birth_date: string;
  gender: "" | Gender;
  has_own_transport: "" | "true" | "false";
  availability: "" | Availability;
  immediate_availability: boolean;
  summary: string;
  location_zone_id: string;
  accepts_remote: boolean;
  accepts_hybrid: boolean;
  accepts_onsite: boolean;
  visible_in_talent_pool: boolean;
};

/** Hoy en formato YYYY-MM-DD, para el atributo `max` de los <input type="date">.
 *  El backend valida lo mismo: el tope del formulario se puede saltear. */
const HOY = new Date().toISOString().slice(0, 10);

/** Fecha de nacimiento más reciente admitida: hay que tener 18 años cumplidos. */
const MAX_FECHA_NACIMIENTO = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
})();

const EMPTY_PERSONAL_FORM: PersonalForm = {
  birth_date: "", gender: "", has_own_transport: "", availability: "",
  immediate_availability: false, summary: "", location_zone_id: "",
  accepts_remote: false, accepts_hybrid: false, accepts_onsite: false,
  visible_in_talent_pool: false,
};

/** El motivo real de un error de la API, listo para mostrarle al candidato.
 *
 * FastAPI devuelve el detalle en `detail`: una cadena cuando lo levanta el
 * endpoint, o una lista de errores de Pydantic cuando es validación (422).
 * Todos los `catch` de esta pantalla decían "Error al guardar" a secas y se
 * tragaban ese texto — que es justo el que explica QUÉ corregir ("si está en
 * curso, no corresponde cargar fecha de fin"). Sin él, el candidato reintenta
 * a ciegas, se rinde y avanza de paso creyendo que guardó.
 */
function motivoDelError(err: unknown, porDefecto: string): string {
  const detalle = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  if (typeof detalle === "string" && detalle.trim()) return detalle;
  if (Array.isArray(detalle)) {
    const msg = (detalle[0] as { msg?: string })?.msg;
    if (msg) return msg.replace(/^Value error,\s*/, "");
  }
  return porDefecto;
}

const STEPS: { key: string; label: string; missingKeys: string[] }[] = [
  { key: "personal", label: "Datos personales", missingKeys: ["photo_url", "birth_date", "gender", "location_zone_id", "has_own_transport", "availability", "summary", "modality_pref"] },
  { key: "cv", label: "CV", missingKeys: ["cv_file_url"] },
  { key: "experience", label: "Experiencia", missingKeys: ["experience"] },
  { key: "education", label: "Educación", missingKeys: ["education"] },
  // Idiomas no es un paso propio pero SIGUE contando para el % — se cargan dentro de
  // Habilidades, en su propia sección. Estuvieron escondidos detrás de tildar la
  // habilidad técnica "Idiomas", y así el paso era imposible de completar para
  // quien no la marcaba: guardaba, no veía la tilde y no tenía forma de saber
  // qué faltaba.
  { key: "skills", label: "Habilidades", missingKeys: ["skills", "languages"] },
];

export default function CandidatePerfilPage() {
  const { user } = useUser();
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [educations, setEducations] = useState<Education[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalog | null>(null);
  const [mySkills, setMySkills] = useState<CandidateSkills>({ soft: [], technical: [], other_skill: null });
  const [otherSkill, setOtherSkill] = useState("");
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [expForm, setExpForm] = useState({ company_name: "", role_title: "", start_date: "", end_date: "", description: "", trabajo_actual: false });
  const [eduForm, setEduForm] = useState({ institution: "", degree: "", level: "secundario", start_date: "", end_date: "", status: "graduado" as EducationStatus });
  const [langForm, setLangForm] = useState({ language_name: "", level: "básico" });
  // El idioma escrito a mano cuando se elige "Otro" en el selector.
  const [otroIdioma, setOtroIdioma] = useState("");
  const esOtroIdioma = langForm.language_name === OTRO_IDIOMA;
  const [savingProfile, setSavingProfile] = useState(false);

  const [personalForm, setPersonalForm] = useState<PersonalForm>(EMPTY_PERSONAL_FORM);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [step, setStep] = useState(0);
  const stepInitialized = useRef(false);

  const cvRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get("/me/candidate/profile").then(r => {
      const data: CandidateProfile = r.data;
      setProfile(data);
      setPersonalForm({
        birth_date: data.birth_date || "",
        gender: data.gender || "",
        has_own_transport: data.has_own_transport == null ? "" : (data.has_own_transport ? "true" : "false"),
        availability: data.availability || "",
        immediate_availability: !!data.immediate_availability,
        summary: data.summary || "",
        location_zone_id: data.location_zone_id || "",
        accepts_remote: !!data.accepts_remote,
        accepts_hybrid: !!data.accepts_hybrid,
        accepts_onsite: !!data.accepts_onsite,
        visible_in_talent_pool: !!data.visible_in_talent_pool,
      });
      if (!stepInitialized.current) {
        stepInitialized.current = true;
        const firstIncomplete = STEPS.findIndex(s => data.missing_fields.some(m => s.missingKeys.includes(m.key)));
        setStep(firstIncomplete === -1 ? 0 : firstIncomplete);
      }
    }).catch(() => {});
    api.get("/me/candidate/experience").then(r => setExperiences(r.data)).catch(() => {});
    api.get("/me/candidate/education").then(r => setEducations(r.data)).catch(() => {});
    api.get("/me/candidate/languages").then(r => setLanguages(r.data)).catch(() => {});
    api.get("/skills").then(r => setSkillsCatalog(r.data)).catch(() => {});
    api.get("/me/candidate/skills").then(r => {
      setMySkills(r.data);
      setOtherSkill(r.data.other_skill || "");
    }).catch(() => {});
    api.get("/catalogs/zones").then(r => setZones(r.data)).catch(() => {});
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  /** Vuelve a pedir el perfil para refrescar el % de completitud y los ítems que faltan.
   *  No toca `step`: `stepInitialized` ya está en true, así que no salta de paso solo. */
  function refreshProfile() {
    api.get("/me/candidate/profile").then(r => setProfile(r.data)).catch(() => {});
  }

  async function savePersonalData(): Promise<boolean> {
    setSavingPersonal(true);
    try {
      const r = await api.patch("/me/candidate/profile", {
        birth_date: personalForm.birth_date || null,
        gender: personalForm.gender || null,
        has_own_transport: personalForm.has_own_transport === "" ? null : personalForm.has_own_transport === "true",
        availability: personalForm.availability || null,
        immediate_availability: personalForm.immediate_availability,
        summary: personalForm.summary || null,
        location_zone_id: personalForm.location_zone_id || null,
        accepts_remote: personalForm.accepts_remote,
        accepts_hybrid: personalForm.accepts_hybrid,
        accepts_onsite: personalForm.accepts_onsite,
        visible_in_talent_pool: personalForm.visible_in_talent_pool,
      });
      setProfile(r.data);
      toast("Datos personales guardados");
      return true;
    } catch {
      toast("Error al guardar los datos personales");
      return false;
    } finally {
      setSavingPersonal(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Solo se permiten imágenes"); return; }
    setPhotoUploading(true);
    // Se achica en el navegador antes de subirla: una foto de celular pesa 4-6 MB y el tope
    // del backend son 2 MB.
    const fd = new FormData();
    try {
      fd.append("file", await achicarImagen(file));
      const r = await api.post("/me/candidate/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setProfile(r.data);
      toast("Foto de perfil actualizada");
    } catch {
      toast("Error al subir la foto");
    } finally {
      setPhotoUploading(false);
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
      // `trabajo_actual` es sólo del formulario: al backend le llega end_date vacío, que es
      // como se representa "sigo trabajando acá".
      const { trabajo_actual, ...datos } = expForm;
      const r = await api.post("/me/candidate/experience", {
        ...datos,
        end_date: trabajo_actual ? null : (datos.end_date || null),
      });
      setExperiences(prev => [...prev, r.data]);
      refreshProfile();
      setExpForm({ company_name: "", role_title: "", start_date: "", end_date: "", description: "", trabajo_actual: false });
      toast("Experiencia agregada");
    } catch (err) {
      toast(motivoDelError(err, "No pudimos guardar la experiencia."));
    } finally { setSavingProfile(false); }
  }

  async function deleteExperience(id: string) {
    try {
      await api.delete(`/me/candidate/experience/${id}`);
      setExperiences(prev => prev.filter(e => e.id !== id));
      refreshProfile();
      toast("Experiencia eliminada");
    } catch { toast("Error al eliminar"); }
  }

  async function addEducation(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      // `end_date` vacío tiene que viajar como null y no como "": el schema lo
      // declara `Optional[date]` y Pydantic rechaza la cadena vacía con un 422.
      // Pasaba con cualquier título sin fecha de egreso — que es el caso normal
      // de "en curso" y también el de quien no se acuerda del mes exacto.
      // `addExperience` ya lo hacía; acá se había quedado sin hacer.
      const r = await api.post("/me/candidate/education", {
        ...eduForm,
        end_date: eduForm.end_date || null,
      });
      setEducations(prev => [...prev, r.data]);
      refreshProfile();
      setEduForm({ institution: "", degree: "", level: "secundario", start_date: "", end_date: "", status: "graduado" });
      toast("Educación agregada");
    } catch (err) {
      toast(motivoDelError(err, "No pudimos guardar la educación."));
    } finally { setSavingProfile(false); }
  }

  async function deleteEducation(id: string) {
    try {
      await api.delete(`/me/candidate/education/${id}`);
      setEducations(prev => prev.filter(e => e.id !== id));
      refreshProfile();
      toast("Educación eliminada");
    } catch { toast("Error al eliminar"); }
  }

  async function addLanguage(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      // Con "Otro" viaja lo que escribió, no la palabra "Otro". El backend
      // guarda el nombre como texto libre, así que no hay nada que agregar
      // de su lado.
      const nombre = esOtroIdioma ? otroIdioma.trim() : langForm.language_name;
      const r = await api.post("/me/candidate/languages", {
        ...langForm,
        language_name: nombre,
      });
      setLanguages(prev => [...prev, r.data]);
      refreshProfile();
      setLangForm({ language_name: "", level: "básico" });
      setOtroIdioma("");
      toast("Idioma agregado");
    } catch (err) {
      toast(motivoDelError(err, "No pudimos guardar el idioma."));
    } finally { setSavingProfile(false); }
  }

  async function deleteLanguage(id: string) {
    try {
      await api.delete(`/me/candidate/languages/${id}`);
      setLanguages(prev => prev.filter(l => l.id !== id));
      refreshProfile();
      toast("Idioma eliminado");
    } catch { toast("Error al eliminar"); }
  }

  const selectedSkillIds = [...mySkills.soft, ...mySkills.technical].map(s => s.skill_id);
  // `eligioIdiomas` ya no existe: los idiomas dejaron de estar detrás de una
  // tilde del listado técnico y tienen su propia sección. La habilidad "Idiomas"
  // se saca del catálogo que se ofrece, para no dejar dos lugares que parecen
  // hacer lo mismo. Lo que un candidato ya tenga tildado NO se toca: sigue
  // guardado y sigue contando, sólo deja de ofrecerse a los que vienen.
  //
  // Con `useMemo` y no un objeto suelto: el picker recibe `catalog` por prop y
  // recrearlo en cada render lo haría re-renderizar de más al tildar cualquier
  // habilidad.
  const catalogoVisible = useMemo(
    () =>
      skillsCatalog && {
        ...skillsCatalog,
        technical: skillsCatalog.technical.filter(s => s.slug !== SLUG_IDIOMAS),
      },
    [skillsCatalog],
  );
  const eligioOtra = mySkills.technical.some(s => s.slug === SLUG_OTRA);

  /** Tilda o destilda una habilidad. Sólo toca el estado local: se guarda con "Guardar
   *  habilidades", porque el backend recibe la selección completa de una (el tope de 6 no se
   *  puede validar de a una habilidad por vez). */
  function toggleSkill(skill: SkillCatalogItem) {
    setSkillsError(null);
    setMySkills(prev => {
      const grupo = skill.category === "soft" ? prev.soft : prev.technical;
      const yaEsta = grupo.some(s => s.skill_id === skill.id);
      const nuevoGrupo = yaEsta
        ? grupo.filter(s => s.skill_id !== skill.id)
        : [...grupo, { skill_id: skill.id, skill_name: skill.name, slug: skill.slug, category: skill.category }];
      return skill.category === "soft"
        ? { ...prev, soft: nuevoGrupo }
        : { ...prev, technical: nuevoGrupo };
    });
  }

  async function saveSkills() {
    setSavingProfile(true);
    setSkillsError(null);
    try {
      const r = await api.put("/me/candidate/skills", {
        skill_ids: selectedSkillIds,
        other_skill: otherSkill.trim() || null,
      });
      setMySkills(r.data);
      setOtherSkill(r.data.other_skill || "");
      refreshProfile();
      // Si el paso queda incompleto igual, se dice acá y no al final del
      // recorrido. Guardar y que después te manden de vuelta al primer paso
      // sin explicación es lo que hacía parecer que el guardado había fallado.
      toast(
        languages.length === 0
          ? "Habilidades guardadas. Falta cargar los idiomas para completar este paso."
          : "Habilidades guardadas",
      );
    } catch (e: unknown) {
      const detalle = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSkillsError(detalle || "No pudimos guardar tus habilidades.");
    } finally {
      setSavingProfile(false);
    }
  }

  function stepComplete(i: number) {
    if (!profile) return false;
    return !profile.missing_fields.some(m => STEPS[i].missingKeys.includes(m.key));
  }

  function goToStep(i: number) {
    setStep(Math.max(0, Math.min(i, STEPS.length - 1)));
  }

  async function handlePrimaryAction() {
    if (step === 0) {
      const ok = await savePersonalData();
      if (!ok) return;
    }
    if (step === STEPS.length - 1) {
      // Antes acá sólo salía un toast y el candidato se quedaba parado en
      // Habilidades sin saber si había terminado, si faltaba algo o adónde ir.
      // "Recorriste todo tu perfil" encima no era cierto cuando quedaban
      // secciones sin completar: sonaba a felicitación y el perfil estaba a
      // medias.
      //
      // Ahora el botón hace lo que corresponde según el estado real:
      //  · perfil completo  → a buscar empleos, que es para lo que vino;
      //  · perfil incompleto → al primer paso que falta, diciendo cuál es.
      const faltan = STEPS.findIndex(
        s => profile?.missing_fields.some(m => s.missingKeys.includes(m.key)),
      );
      if (faltan === -1) {
        toast("¡Perfil completo! Te llevamos a los empleos.");
        router.push("/empleos");
        return;
      }
      // Se nombran los CAMPOS que faltan, no la sección. "Te falta completar
      // datos personales" a alguien que acaba de llenar esa pantalla se lee
      // como un error del sistema; "te falta: Sexo, Zona" se entiende y se
      // arregla. Los labels vienen del backend ya escritos para leer.
      const pendientes = (profile?.missing_fields ?? [])
        .filter(m => STEPS[faltan].missingKeys.includes(m.key))
        .map(m => m.label);
      toast(
        pendientes.length
          ? `Te falta: ${pendientes.join(", ")}.`
          : `Te falta completar ${STEPS[faltan].label.toLowerCase()}.`,
      );
      goToStep(faltan);
      return;
    }
    goToStep(step + 1);
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-3xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230] flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {toastMsg}
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">
        Hola, {profile?.first_name || user?.primaryEmailAddress?.emailAddress?.split("@")[0]}
      </h1>
      <p className="text-[#64748B] text-sm mb-6">Completá tu perfil paso a paso — cada sección suma para que las empresas te encuentren.</p>

      {profile && (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <ProfileCompletionRing percent={profile.completion_percent} size={92} />
          <div className="flex-1 text-center sm:text-left">
            {profile.completion_percent >= 100 ? (
              /* Los dos textos hablaban de lo que "ven las empresas" sobre el
                 estado del perfil. Dejó de ser cierto cuando se sacó el % de la
                 vista de empresa (pedido de Eugenia, agosto/2026): el candidato
                 leía una advertencia sobre algo que ya no pasa. Ahora hablan de
                 lo único que sigue siendo verdad y además le importa más — sus
                 chances de quedar seleccionado. */
              <>
                <p className="font-display font-bold text-[#16A34A]">¡Perfil completo!</p>
                <p className="text-sm text-[#64748B] mt-1">
                  Ya está todo cargado. Es el mejor momento para postularte.
                </p>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-[#1C2230]">Tu perfil está {profile.completion_percent}% completo</p>
                <p className="text-sm text-[#64748B] mt-1">
                  Cuanto más completo esté, más chances tenés de quedar seleccionado:
                  quien decide te elige por lo que puede leer de vos.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Progress stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => goToStep(i)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                stepComplete(i) ? "bg-green-600 text-white" :
                i === step ? "bg-[#1E8EA3] text-white ring-4 ring-[#E6F4F7]" :
                "bg-[#EEF2F7] text-[#94A3B8]"
              }`}>
                {stepComplete(i) ? <CheckIcon className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[10.5px] font-bold text-center hidden sm:block ${i === step ? "text-[#1E8EA3]" : "text-[#94A3B8]"}`}>
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-colors ${stepComplete(i) ? "bg-green-600" : "bg-[#EEF2F7]"}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 sm:p-8 min-h-[380px] flex flex-col">
        <div className="flex-1">
          {/* Step 0 — Datos personales */}
          {step === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <UserCircleIcon className="w-5 h-5 text-[#1E8EA3]" />
                <h3 className="font-display font-bold text-[#1C2230]">Datos personales</h3>
              </div>
              <p className="text-xs text-[#64748B] mb-4">
                Estos datos son opcionales, pero completarlos te ayuda a destacar frente a las empresas
                y habilita más filtros de búsqueda a tu favor.
              </p>

              <div className="flex items-center gap-4 mb-5">
                <div
                  className="relative w-16 h-16 rounded-full border-2 border-[#9ED4DF] bg-white flex items-center justify-center cursor-pointer group overflow-hidden shrink-0"
                  onClick={() => photoRef.current?.click()}
                  title="Cambiar foto"
                >
                  {profile?.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.photo_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircleIcon className="w-9 h-9 text-[#9ED4DF]" />
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <CloudArrowUpIcon className="w-5 h-5 text-white" />
                  </div>
                  {photoUploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <div>
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    className="text-sm font-bold text-[#1E8EA3] hover:underline"
                  >
                    {profile?.photo_url ? "Cambiar foto" : "Subir foto de perfil"}
                  </button>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    JPG, PNG o WEBP, máx. 2MB.
                    {!profile?.photo_url && " Los perfiles con foto llaman más la atención de las empresas."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Fecha de nacimiento</label>
                  <input
                    type="date"
                    max={MAX_FECHA_NACIMIENTO}
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
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Zona</label>
                  <select
                    value={personalForm.location_zone_id}
                    onChange={e => setPersonalForm(f => ({ ...f, location_zone_id: e.target.value }))}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white"
                  >
                    <option value="">Sin especificar</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
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
                <label className="text-xs font-bold text-[#64748B] mb-1.5 block">Modalidad de trabajo que aceptás</label>
                <div className="flex flex-wrap gap-3">
                  {([
                    ["accepts_onsite", "Presencial"],
                    ["accepts_remote", "Remoto"],
                    ["accepts_hybrid", "Híbrido"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-[#1C2230] border border-[#DDE3EC] rounded-lg px-3 py-2">
                      <input
                        type="checkbox"
                        checked={personalForm[key]}
                        onChange={e => setPersonalForm(f => ({ ...f, [key]: e.target.checked }))}
                        className="w-4 h-4 accent-[#1E8EA3]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

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

              <div className="mt-6 bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={personalForm.visible_in_talent_pool}
                    // Va por su endpoint propio, no por el PATCH general del perfil: es un
                    // consentimiento sobre el que se cobra un plan y tiene que quedar fechado.
                    onChange={e => {
                      const accepted = e.target.checked;
                      setPersonalForm(f => ({ ...f, visible_in_talent_pool: accepted }));
                      api.post("/me/candidate/talent-pool", { accepted }).catch(() => {
                        setPersonalForm(f => ({ ...f, visible_in_talent_pool: !accepted }));
                      });
                    }}
                    className="w-5 h-5 accent-[#1E8EA3] mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-bold text-[#1C2230] mb-1">
                      Quiero que empresas verificadas puedan encontrar mi perfil en la Base de Talento de BBJobs y contactarme por oportunidades laborales.
                    </p>
                    <p className="text-xs text-[#64748B]">
                      Podés cambiar esta opción cuando quieras. Se guarda al instante.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Step 1 — CV */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DocumentTextIcon className="w-5 h-5 text-[#1E8EA3]" />
                <h3 className="font-display font-bold text-[#1C2230]">CV</h3>
              </div>
              <p className="text-xs text-[#64748B] mb-4">
                Subí tu currículum en PDF — es lo primero que revisa la empresa al ver tu postulación.
              </p>
              <div className="border-2 border-dashed border-[#DDE3EC] rounded-2xl p-8 text-center">
                {profile?.cv_file_url ? (
                  <>
                    <CheckCircleIcon className="w-10 h-10 text-green-600 mx-auto mb-3" />
                    <p className="font-bold text-[#1C2230] mb-1">Tenés un CV cargado</p>
                    <p className="text-xs text-[#64748B] mb-4">
                      {profile.cv_uploaded_at && `Subido el ${new Date(profile.cv_uploaded_at).toLocaleDateString("es-AR")}`}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => abrirCv("/me/candidate/cv/link").catch(() => toast("No pudimos abrir tu CV"))}
                        className="text-sm font-bold text-[#1E8EA3] hover:underline flex items-center gap-1">
                        <DocumentTextIcon className="w-4 h-4" /> Ver CV
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <CloudArrowUpIcon className="w-10 h-10 text-[#9ED4DF] mx-auto mb-3" />
                    <p className="font-bold text-[#1C2230] mb-1">Todavía no subiste tu CV</p>
                    <p className="text-xs text-[#64748B] mb-4">Formato PDF, hasta un par de MB.</p>
                  </>
                )}
                {cvUploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-[#64748B] mt-2">
                    <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                    Subiendo...
                  </div>
                ) : (
                  <button
                    onClick={() => cvRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-2 border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-[#E6F4F7] transition-colors"
                  >
                    <CloudArrowUpIcon className="w-4 h-4" />
                    {profile?.cv_file_url ? "Actualizar CV" : "Subir CV"}
                  </button>
                )}
                <input ref={cvRef} type="file" accept="application/pdf" className="hidden" onChange={handleCvUpload} />
              </div>
            </div>
          )}

          {/* Step 2 — Experiencia */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BriefcaseIcon className="w-5 h-5 text-[#1E8EA3]" />
                <h3 className="font-display font-bold text-[#1C2230]">Experiencia laboral</h3>
              </div>

              {/* Siempre se pudieron cargar varias —el formulario acumula y se limpia—
                  pero la lista sólo aparece con la primera cargada, así que el que
                  entra ve un formulario suelto y asume que va una sola. El renglón
                  lo dice antes de que tenga que descubrirlo. */}
              <p className="text-sm text-[#64748B] mb-4">
                Podés cargar todas las que quieras: completá una, tocá{" "}
                <span className="font-bold">Agregar experiencia</span> y se suma a la
                lista. Después seguís con la siguiente.
              </p>

              {experiences.length > 0 && (
                <div className="space-y-2 mb-4">
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
              )}

              <form onSubmit={addExperience} className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">
                  {experiences.length > 0 ? "Agregar otra experiencia" : "Agregar experiencia"}
                </p>
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
                    <input required type="date" max={HOY} value={expForm.start_date} onChange={e => setExpForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#64748B] mb-1 block">Fin</label>
                    <input type="date" max={HOY} value={expForm.end_date}
                      onChange={e => setExpForm(f => ({ ...f, end_date: e.target.value }))}
                      disabled={expForm.trabajo_actual}
                      className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] disabled:opacity-50" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#64748B]">
                  <input type="checkbox" checked={expForm.trabajo_actual}
                    onChange={e => setExpForm(f => ({ ...f, trabajo_actual: e.target.checked, end_date: e.target.checked ? "" : f.end_date }))}
                    className="w-4 h-4 accent-[#1E8EA3]" />
                  Trabajo actualmente acá
                </label>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1 block">Descripción</label>
                  <textarea value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] resize-none" placeholder="Descripción breve del rol..." />
                </div>
                <button type="submit" disabled={savingProfile}
                  className="text-sm bg-[#1E8EA3] text-white font-bold rounded-lg px-4 py-2 hover:bg-[#187B8E] disabled:opacity-60 transition-colors">
                  {savingProfile
                    ? "Guardando..."
                    : experiences.length > 0 ? "Agregar otra" : "Agregar experiencia"}
                </button>
              </form>
            </div>
          )}

          {/* Step 3 — Educación */}
          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AcademicCapIcon className="w-5 h-5 text-[#1E8EA3]" />
                <h3 className="font-display font-bold text-[#1C2230]">Educación</h3>
              </div>

              {educations.length > 0 && (
                <div className="space-y-2 mb-4">
                  {educations.map(edu => (
                    <div key={edu.id} className="flex items-start justify-between border border-[#DDE3EC] rounded-xl p-4">
                      <div>
                        <p className="font-bold text-[#1C2230]">{edu.degree || edu.level}</p>
                        <p className="text-sm text-[#64748B]">{edu.institution} · {edu.start_date?.slice(0, 7)} · {EDUCATION_STATUS_LABEL[edu.status] || edu.status}{edu.end_date ? ` · ${edu.end_date.slice(0, 7)}` : ""}</p>
                      </div>
                      <button onClick={() => deleteEducation(edu.id)} className="ml-3 p-1.5 text-[#64748B] hover:text-red-500 transition-colors shrink-0">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={addEducation} className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Agregar educación</p>
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
                    <input required type="date" max={HOY} value={eduForm.start_date} onChange={e => setEduForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#64748B] mb-1 block">Fin</label>
                    <input type="date" max={HOY} value={eduForm.end_date} onChange={e => setEduForm(f => ({ ...f, end_date: e.target.value }))}
                      disabled={eduForm.status === "en_curso"}
                      className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] disabled:opacity-50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1.5 block">Estado *</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(EDUCATION_STATUS_LABEL) as EducationStatus[]).map(estado => (
                      <button
                        key={estado}
                        type="button"
                        onClick={() => setEduForm(f => ({
                          ...f,
                          status: estado,
                          // "En curso" no lleva fecha de egreso.
                          end_date: estado === "en_curso" ? "" : f.end_date,
                        }))}
                        className={`text-sm font-medium px-3.5 py-1.5 rounded-full border-2 transition-colors ${
                          eduForm.status === estado
                            ? "border-[#1E8EA3] bg-[#E6F4F7] text-[#1C2230]"
                            : "border-[#DDE3EC] text-[#64748B] hover:border-[#9ED4DF]"
                        }`}
                      >
                        {EDUCATION_STATUS_LABEL[estado]}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={savingProfile}
                  className="text-sm bg-[#1E8EA3] text-white font-bold rounded-lg px-4 py-2 hover:bg-[#187B8E] disabled:opacity-60 transition-colors">
                  {savingProfile ? "Guardando..." : "Agregar educación"}
                </button>
              </form>
            </div>
          )}

          {/* Step 4 — Habilidades (blandas + técnicas, con idiomas y "Otra" adentro) */}
          {step === 4 && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <WrenchScrewdriverIcon className="w-5 h-5 text-[#1E8EA3]" />
                <h3 className="font-display font-bold text-[#1C2230]">Habilidades</h3>
              </div>
              <p className="text-xs text-[#64748B] mb-5">
                Elegí hasta {skillsCatalog?.max_per_category ?? 6} de cada grupo — las que mejor
                te representen. Las empresas filtran por estas.
              </p>

              {!skillsCatalog ? (
                <div className="py-10 flex justify-center">
                  <div className="w-5 h-5 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <SkillPicker
                    catalog={catalogoVisible!}
                    selectedIds={selectedSkillIds}
                    onToggle={toggleSkill}
                    renderAfterGroup={category => {
                      if (category !== "technical") return null;
                      return (
                        <>
                          {/* Los idiomas son su propia sección y ya no dependen de
                              tildar la habilidad "Idiomas" en la lista técnica.
                              Con aquel diseño el cuadro para cargarlos estaba
                              escondido detrás de una tilde: el que no la marcaba
                              guardaba, no veía completarse el paso y no tenía cómo
                              saber por qué — y los idiomas cuentan para el 100%.
                              Tampoco son una habilidad técnica más: llevan nivel
                              por idioma, que ninguna otra tiene. */}
                          {(
                            <div className="mt-6 pt-5 border-t-2 border-[#DDE3EC]">
                              <div className="flex items-center gap-2 mb-1">
                                <LanguageIcon className="w-4 h-4 text-[#1E8EA3]" />
                                <p className="text-sm font-bold text-[#1C2230]">Idiomas</p>
                              </div>
                              <p className="text-[13px] text-[#64748B] mb-3">
                                Cuáles hablás y en qué nivel. Cuenta para completar tu perfil.
                              </p>

                              {languages.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                  {languages.map(lang => (
                                    <div key={lang.id} className="flex items-center gap-1.5 bg-[#E6F4F7] text-[#1C2230] text-sm font-medium px-3 py-1.5 rounded-full">
                                      {lang.language_name} · {lang.level}
                                      <button onClick={() => deleteLanguage(lang.id)} className="ml-1 text-[#64748B] hover:text-red-500 transition-colors">
                                        <XMarkIcon className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <form onSubmit={addLanguage} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                                <select required value={langForm.language_name}
                                  onChange={e => setLangForm(f => ({ ...f, language_name: e.target.value }))}
                                  className="border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white">
                                  <option value="">Elegí un idioma</option>
                                  {skillsCatalog.languages.map(idioma => (
                                    <option key={idioma} value={idioma}>{idioma}</option>
                                  ))}
                                  {/* La lista no puede cubrir todos los idiomas y el
                                      backend guarda el nombre como texto libre, así que
                                      el que hable algo que no está lo escribe. La lista
                                      igual manda para la mayoría: sin ella entran
                                      "ingles", "Ingles" e "INGLÉS" como tres idiomas
                                      distintos y después nada se puede filtrar. */}
                                  <option value={OTRO_IDIOMA}>Otro…</option>
                                </select>
                                <select required value={langForm.level}
                                  onChange={e => setLangForm(f => ({ ...f, level: e.target.value }))}
                                  className="border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] bg-white">
                                  <option value="básico">Básico</option>
                                  <option value="intermedio">Intermedio</option>
                                  <option value="avanzado">Avanzado</option>
                                  <option value="nativo">Nativo</option>
                                </select>
                                <button type="submit"
                                  disabled={!langForm.language_name || (esOtroIdioma && !otroIdioma.trim())}
                                  className="text-sm bg-[#1E8EA3] text-white font-bold rounded-lg px-4 py-2 hover:bg-[#187B8E] disabled:opacity-50 transition-colors">
                                  Agregar
                                </button>

                                {esOtroIdioma && (
                                  <input
                                    value={otroIdioma}
                                    onChange={e => setOtroIdioma(e.target.value)}
                                    maxLength={40}
                                    autoFocus
                                    placeholder="¿Cuál? Por ejemplo: Sueco"
                                    className="sm:col-span-3 border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                                  />
                                )}
                              </form>
                            </div>
                          )}

                          {eligioOtra && (
                            <div className="mt-4 bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4">
                              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2 block">
                                ¿Cuál es esa otra habilidad?
                              </label>
                              <input
                                value={otherSkill}
                                onChange={e => setOtherSkill(e.target.value)}
                                maxLength={skillsCatalog.other_skill_max_length}
                                placeholder="Ej: manejo de drones, tornería"
                                className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                              />
                              <p className="text-[11px] text-[#64748B] mt-1.5">
                                {otherSkill.length}/{skillsCatalog.other_skill_max_length} caracteres
                              </p>
                            </div>
                          )}
                        </>
                      );
                    }}
                  />

                  {skillsError && (
                    <p className="text-sm text-red-600 mt-4">{skillsError}</p>
                  )}

                  <button
                    type="button"
                    onClick={saveSkills}
                    disabled={savingProfile}
                    className="mt-6 inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-xl px-5 py-2.5 text-sm hover:bg-[#187B8E] disabled:opacity-60 transition-colors"
                  >
                    {savingProfile ? "Guardando..." : "Guardar habilidades"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-[#DDE3EC]">
          <button
            type="button"
            onClick={() => goToStep(step - 1)}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748B] px-4 py-2.5 rounded-xl hover:bg-[#FAFBFD] disabled:opacity-0 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Atrás
          </button>

          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={savingPersonal}
            className="inline-flex items-center gap-1.5 bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl px-6 py-2.5 text-sm transition-colors"
          >
            {step === 0
              ? (savingPersonal ? "Guardando..." : "Guardar y continuar")
              : step === STEPS.length - 1 ? "Listo" : "Siguiente"}
            {step !== STEPS.length - 1 && <ArrowRightIcon className="w-4 h-4" />}
            {step === STEPS.length - 1 && <CheckIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
