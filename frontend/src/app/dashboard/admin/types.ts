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

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  cv_file_url?: string;
}

export interface Job {
  id: string;
  title: string;
  company_legal_name_snapshot: string;
  status: string;
  published_at?: string;
}

export interface Metrics {
  total_companies: number;
  pending_companies: number;
  verified_companies: number;
  total_candidates: number;
  total_jobs: number;
  total_applications: number;
}

export interface Skill {
  id: string;
  name: string;
  status: string;
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
