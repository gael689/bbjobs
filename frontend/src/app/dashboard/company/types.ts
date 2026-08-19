export type VerificationStatus = "pending" | "verified" | "rejected" | "suspended";

export interface CompanyProfile {
  id: string;
  legal_name: string;
  cuit: string;
  responsible_full_name: string;
  responsible_phone: string;
  responsible_email: string;
  website?: string;
  description?: string;
  logo_url?: string;
  verification_status: VerificationStatus;
  verified_at?: string;
}

export type JobModerationStatus = "pending_review" | "approved" | "rejected";

export interface JobPosting {
  id: string;
  title: string;
  description: string;
  status: string;
  published_at?: string;
  modality: string;
  duration_days?: number;
  expires_at?: string;
  moderation_status?: JobModerationStatus;
  moderation_notes?: string;
  is_featured?: boolean;
  featured_until?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  salary_visible?: boolean;
  benefits?: string;
}

// Precio fijo de destacar una búsqueda — espejo de FEATURED_JOB_PRICE en
// backend/app/schemas/payment.py. No es configurable, es el único producto pago de Fase 1.
export const FEATURED_JOB_PRICE = 5000;
export const FEATURED_JOB_CURRENCY = "ARS";

export type FeatureStatus = "pending_payment" | "active" | "expired" | "canceled";

export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  pending_payment: "Pago pendiente",
  active: "Activo",
  expired: "Vencido",
  canceled: "Rechazado",
};

export const FEATURE_STATUS_CLS: Record<FeatureStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  canceled: "bg-red-100 text-red-700",
};

export interface FeatureStatusResponse {
  payment_status?: string;
  feature_status?: FeatureStatus;
  is_featured: boolean;
  featured_until?: string;
}

export interface FeatureHistoryItem {
  payment_id: string;
  job_posting_id: string;
  job_title: string;
  company_name?: string;
  amount: number;
  currency: string;
  payment_status?: string;
  feature_status: FeatureStatus;
  purchased_at: string;
  starts_at?: string;
  ends_at?: string;
}

export const JOB_MODERATION_LABEL: Record<JobModerationStatus, string> = {
  pending_review: "Pendiente de aprobación",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export const JOB_MODERATION_CLS: Record<JobModerationStatus, string> = {
  pending_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export interface Application {
  id: string;
  candidate_id: string;
  status: string;
  created_at: string;
  status_updated_at?: string;
  cover_letter?: string;
  candidate?: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url?: string;
    cv_file_url?: string;
    completion_percent: number;
    age?: number;
    gender?: CandidateGender;
    has_own_transport?: boolean;
    availability?: CandidateAvailability;
    immediate_availability?: boolean;
  };
}

export interface ApplicantFilters {
  age_min?: string;
  age_max?: string;
  gender?: "" | CandidateGender;
  has_own_transport?: "" | "true" | "false";
  availability?: "" | CandidateAvailability;
  immediate_availability?: boolean;
  position?: string;
  experience_min?: string;
  experience_max?: string;
  zone_id?: string;
}

export const EMPTY_APPLICANT_FILTERS: ApplicantFilters = {
  age_min: "", age_max: "", gender: "", has_own_transport: "", availability: "",
  immediate_availability: false, position: "", experience_min: "", experience_max: "",
  zone_id: "",
};

export interface Bucket {
  label: string;
  count: number;
  percent: number;
}

export interface ApplicantStats {
  total: number;
  avg_age?: number;
  avg_experience_years?: number;
  expected_salary_min_avg?: number;
  expected_salary_max_avg?: number;
  expected_salary_reported: number;
  top_education_level?: string;
  immediate_availability_count: number;
  age_buckets: Bucket[];
  experience_buckets: Bucket[];
  education_buckets: Bucket[];
  top_skills: Bucket[];
  education_distribution: Record<string, number>;
  mobility: Record<string, number>;
  availability: Record<string, number>;
}

export const EDUCATION_LEVEL_LABEL: Record<string, string> = {
  secundario: "Secundario",
  terciario: "Terciario",
  universitario: "Universitario",
  posgrado: "Posgrado",
};

export interface Catalog {
  id: string;
  name: string;
}

export type CandidateGender = "masculino" | "femenino" | "otro" | "no_declara";
export type CandidateAvailability = "full_time" | "part_time" | "ambos";

export interface CandidateFullProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  photo_url?: string;
  summary?: string;
  cv_file_url?: string;
  age?: number;
  gender?: CandidateGender;
  has_own_transport?: boolean;
  availability?: CandidateAvailability;
  immediate_availability?: boolean;
  completion_percent: number;
  accepts_remote: boolean;
  accepts_hybrid: boolean;
  accepts_onsite: boolean;
  experience: { company_name: string; role_title: string; start_date: string; end_date?: string; description?: string }[];
  education: { institution: string; degree: string; level: string; start_date: string; end_date?: string; status: string }[];
  skills: { skill_name: string; category: "soft" | "technical" }[];
  other_skill?: string | null;
  languages: { language_name: string; level: string }[];
}

export const CANDIDATE_GENDER_LABEL: Record<CandidateGender, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
  otro: "Otro",
  no_declara: "Prefiero no decirlo",
};

export const CANDIDATE_AVAILABILITY_LABEL: Record<CandidateAvailability, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  ambos: "Full-time o part-time",
};

export interface JobForm {
  title: string;
  description: string;
  industry_id: string;
  zone_id: string;
  contract_type_id: string;
  modality: string;
  salary_min: string;
  salary_max: string;
  salary_visible: boolean;
  duration_days: number;
}

export const MAX_JOB_DURATION_DAYS = 20;

export const EMPTY_JOB_FORM: JobForm = {
  title: "", description: "",
  industry_id: "", zone_id: "", contract_type_id: "",
  modality: "presencial", salary_min: "", salary_max: "", salary_visible: false,
  duration_days: MAX_JOB_DURATION_DAYS,
};

export const MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "remoto", label: "Remoto" },
  { value: "híbrido", label: "Híbrido" },
];

// Valores reales del enum ApplicationStatus del backend (app/models/job.py).
// El ORDEN de este objeto es el orden del desplegable que ve la empresa: es el embudo
// tal cual lo definió Talency (primero se contacta, después la persona entra al proceso).
export const APP_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  new: { label: "Nueva", cls: "bg-blue-100 text-blue-700" },
  seen: { label: "Perfil revisado", cls: "bg-amber-100 text-amber-700" },
  contacted: { label: "Contactado", cls: "bg-green-100 text-green-700" },
  in_process: { label: "En proceso", cls: "bg-purple-100 text-purple-700" },
  finalist: { label: "Finalista", cls: "bg-[#E6F4F7] text-[#187B8E]" },
  selected: { label: "Seleccionado", cls: "bg-[#D4B7A2]/30 text-[#8A6A54]" },
  discarded: { label: "No avanza", cls: "bg-red-100 text-red-700" },
};
