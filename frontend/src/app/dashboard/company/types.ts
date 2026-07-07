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

export interface JobPosting {
  id: string;
  title: string;
  status: string;
  published_at?: string;
  modality: string;
}

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
    cv_file_url?: string;
  };
}

export interface Catalog {
  id: string;
  name: string;
}

export interface CandidateFullProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  summary?: string;
  cv_file_url?: string;
  accepts_remote: boolean;
  accepts_hybrid: boolean;
  accepts_onsite: boolean;
  experience: { company_name: string; role_title: string; start_date: string; end_date?: string; description?: string }[];
  education: { institution: string; degree: string; level: string; start_date: string; end_date?: string; in_progress: boolean }[];
  skills: { skill_name: string; level: string }[];
  languages: { language_name: string; level: string }[];
}

export interface JobForm {
  title: string;
  description: string;
  requirements: string;
  industry_id: string;
  zone_id: string;
  contract_type_id: string;
  modality: string;
  salary_min: string;
  salary_max: string;
  salary_visible: boolean;
}

export const EMPTY_JOB_FORM: JobForm = {
  title: "", description: "", requirements: "",
  industry_id: "", zone_id: "", contract_type_id: "",
  modality: "presencial", salary_min: "", salary_max: "", salary_visible: false,
};

export const MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "remoto", label: "Remoto" },
  { value: "híbrido", label: "Híbrido" },
];

// Valores reales del enum ApplicationStatus del backend (app/models/job.py) —
// no confundir con las labels de sólo-lectura que usa el panel de candidato.
export const APP_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  new: { label: "Nueva", cls: "bg-blue-100 text-blue-700" },
  seen: { label: "Vista", cls: "bg-amber-100 text-amber-700" },
  in_process: { label: "En proceso", cls: "bg-purple-100 text-purple-700" },
  contacted: { label: "Contactado", cls: "bg-green-100 text-green-700" },
  discarded: { label: "Descartada", cls: "bg-red-100 text-red-700" },
};
