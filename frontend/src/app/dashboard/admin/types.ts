export type VerifStatus = "pending" | "verified" | "rejected" | "suspended";

export interface Company {
  id: string;
  legal_name: string;
  cuit: string;
  responsible_full_name: string;
  responsible_email: string;
  responsible_phone: string;
  website?: string;
  description?: string;
  logo_url?: string;
  verification_status: VerifStatus;
  verified_at?: string;
  verification_notes?: string;
}

export type CandidateGender = "masculino" | "femenino" | "otro" | "no_declara";
export type CandidateAvailability = "full_time" | "part_time" | "ambos";

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  cv_file_url?: string;
  age?: number;
  gender?: CandidateGender;
  has_own_transport?: boolean;
  availability?: CandidateAvailability;
  immediate_availability?: boolean;
  highest_education_level?: string;
  completion_percent: number;
}

export interface CandidateFilters {
  q: string;
  age_min: string;
  age_max: string;
  gender: "" | CandidateGender;
  has_own_transport: "" | "true" | "false";
  availability: "" | CandidateAvailability;
  immediate_availability: boolean;
  zone_id: string;
  has_cv: "" | "true" | "false";
  education_level: string;
}

export const EMPTY_CANDIDATE_FILTERS: CandidateFilters = {
  q: "", age_min: "", age_max: "", gender: "", has_own_transport: "", availability: "",
  immediate_availability: false, zone_id: "", has_cv: "", education_level: "",
};

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

export const EDUCATION_LEVEL_LABEL: Record<string, string> = {
  secundario: "Secundario",
  terciario: "Terciario",
  universitario: "Universitario",
  posgrado: "Posgrado",
};

export interface AdminApplication {
  id: string;
  candidate_id: string;
  job_posting_id: string;
  status: string;
  created_at: string;
  cover_letter?: string;
  candidate?: {
    id: string;
    first_name: string;
    last_name: string;
    cv_file_url?: string;
    completion_percent: number;
    age?: number;
    gender?: CandidateGender;
    has_own_transport?: boolean;
    availability?: CandidateAvailability;
    immediate_availability?: boolean;
  };
}

export interface CandidateActivityItem {
  id: string;
  event_type: string;
  summary: string;
  created_at: string;
}

export const APP_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  new: { label: "Nueva", cls: "bg-blue-100 text-blue-700" },
  seen: { label: "Vista", cls: "bg-amber-100 text-amber-700" },
  in_process: { label: "En proceso", cls: "bg-purple-100 text-purple-700" },
  contacted: { label: "Contactado", cls: "bg-green-100 text-green-700" },
  discarded: { label: "Descartada", cls: "bg-red-100 text-red-700" },
};

export interface CandidateFullProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
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
  education: { institution: string; degree: string; level: string; start_date: string; end_date?: string; in_progress: boolean }[];
  skills: { skill_name: string; level: string }[];
  languages: { language_name: string; level: string }[];
}

export type ModerationStatus = "pending_review" | "approved" | "rejected";

export interface Job {
  id: string;
  title: string;
  company_legal_name_snapshot: string;
  status: string;
  published_at?: string;
  expires_at?: string;
  moderation_status: ModerationStatus;
  moderation_notes?: string;
  is_featured?: boolean;
}

export const MODERATION_LABEL: Record<ModerationStatus, string> = {
  pending_review: "Por revisar",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export const MODERATION_CLS: Record<ModerationStatus, string> = {
  pending_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export interface Metrics {
  total_companies: number;
  pending_companies: number;
  verified_companies: number;
  total_candidates: number;
  total_jobs: number;
  pending_jobs: number;
  total_applications: number;
  pending_contact_messages: number;
  total_revenue_featured: number;
}

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

export interface Skill {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  topic: "general" | "empresa";
  message: string;
  resolved: boolean;
  created_at: string;
}

export const VERIF_LABEL: Record<VerifStatus, string> = {
  pending: "Pendiente",
  verified: "Verificada",
  rejected: "Rechazada",
  suspended: "Suspendida",
};

export const VERIF_CLS: Record<VerifStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  verified: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-800",
};
