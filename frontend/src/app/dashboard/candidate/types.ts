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
  in_progress: boolean;
}

export interface Language {
  id: string;
  language_name: string;
  level: string;
}

export type SkillLevel = "básico" | "intermedio" | "avanzado" | "experto";

export interface SkillCatalogItem {
  id: string;
  name: string;
}

export interface CandidateSkillItem {
  skill_id: string;
  skill_name: string;
  level: SkillLevel;
}

export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  "básico": "Básico",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
  experto: "Experto",
};

export const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  "híbrido": "Híbrido",
};

export const APP_STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Enviada", cls: "bg-blue-100 text-blue-700" },
  seen: { label: "Vista", cls: "bg-amber-100 text-amber-700" },
  in_process: { label: "En proceso", cls: "bg-purple-100 text-purple-700" },
  contacted: { label: "Contactado", cls: "bg-green-100 text-green-700" },
  discarded: { label: "Descartada", cls: "bg-red-100 text-red-700" },
};
