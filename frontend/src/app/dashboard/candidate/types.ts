export interface CandidateProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  cv_file_url?: string;
  cv_uploaded_at?: string;
  summary?: string;
}

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
