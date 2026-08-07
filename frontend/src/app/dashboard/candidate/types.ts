export type Gender = "masculino" | "femenino" | "otro" | "no_declara";
export type Availability = "full_time" | "part_time" | "ambos";

export interface ProfileMissingItem {
  key: string;
  label: string;
  link: string;
}

export interface CandidateProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  photo_url?: string;
  cv_file_url?: string;
  cv_uploaded_at?: string;
  summary?: string;
  birth_date?: string;
  gender?: Gender;
  has_own_transport?: boolean;
  availability?: Availability;
  immediate_availability?: boolean;
  location_zone_id?: string;
  accepts_remote: boolean;
  accepts_hybrid: boolean;
  accepts_onsite: boolean;
  visible_in_talent_pool: boolean;
  /** Null = todavía no se le mostró el aviso de la Base de Talento. */
  talent_pool_asked_at?: string | null;
  talent_pool_decided_at?: string | null;
  completion_percent: number;
  missing_fields: ProfileMissingItem[];
}

export interface Zone {
  id: string;
  name: string;
}

export const GENDER_LABEL: Record<Gender, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
  otro: "Otro",
  no_declara: "Prefiero no decirlo",
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  ambos: "Full-time o part-time",
};

export const SUMMARY_MAX_LENGTH = 300;

export interface Job {
  id: string;
  title: string;
  company_legal_name_snapshot: string;
  modality: string;
  status: string;
}

export interface Application {
  id: string;
  job_posting_id: string;
  status: string;
  created_at: string;
}

export interface ApplicationHistoryItem {
  id: string;
  from_status?: string;
  to_status: string;
  created_at: string;
}

export interface Experience {
  id: string;
  company_name: string;
  role_title: string;
  start_date: string;
  end_date?: string;
  description?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree?: string;
  level: string;
  start_date: string;
  end_date?: string;
  status: EducationStatus;
}

export interface Language {
  id: string;
  language_name: string;
  level: string;
}

export type SkillCategory = "soft" | "technical";

export interface SkillCatalogItem {
  id: string;
  name: string;
  slug: string;
  category: SkillCategory;
}

/** El catálogo llega ya agrupado y con sus reglas — el tope, los idiomas disponibles y el
 *  largo del texto libre los define el backend, que es el que después los valida. */
export interface SkillCatalog {
  soft: SkillCatalogItem[];
  technical: SkillCatalogItem[];
  max_per_category: number;
  languages: string[];
  other_skill_max_length: number;
}

export interface CandidateSkillItem {
  skill_id: string;
  skill_name: string;
  slug: string;
  category: SkillCategory;
}

export interface CandidateSkills {
  soft: CandidateSkillItem[];
  technical: CandidateSkillItem[];
  other_skill?: string | null;
}

/** Habilidades con comportamiento propio en el formulario. Se identifican por slug y no por
 *  nombre porque el nombre lo puede editar Talency sin que se rompa nada. */
export const SLUG_IDIOMAS = "idiomas";
export const SLUG_OTRA = "otra";

export const SKILL_CATEGORY_LABEL: Record<SkillCategory, string> = {
  soft: "Habilidades blandas",
  technical: "Habilidades técnicas",
};

export const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  "híbrido": "Híbrido",
};

// El candidato ve exactamente los mismos nombres que la empresa (decisión de Talency,
// agosto/2026) y recibe una notificación en cada cambio de estado.
export const APP_STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Nueva", cls: "bg-blue-100 text-blue-700" },
  seen: { label: "Perfil revisado", cls: "bg-amber-100 text-amber-700" },
  contacted: { label: "Contactado", cls: "bg-green-100 text-green-700" },
  in_process: { label: "En proceso", cls: "bg-purple-100 text-purple-700" },
  finalist: { label: "Finalista", cls: "bg-[#E6F4F7] text-[#187B8E]" },
  selected: { label: "Seleccionado", cls: "bg-[#D4B7A2]/30 text-[#8A6A54]" },
  discarded: { label: "No avanza", cls: "bg-red-100 text-red-700" },
};

export type EducationStatus = "graduado" | "en_curso" | "abandonado";

export const EDUCATION_STATUS_LABEL: Record<EducationStatus, string> = {
  graduado: "Graduado",
  en_curso: "En curso",
  abandonado: "Abandonado",
};
