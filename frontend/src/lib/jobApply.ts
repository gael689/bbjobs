import { isAxiosError } from "axios";
import { api } from "@/lib/api";

export async function applyToJob(jobId: string, coverLetter: string): Promise<void> {
  await api.post(`/jobs/${jobId}/apply`, { cover_letter: coverLetter || undefined });
}

export function getApplyErrorMessage(err: unknown): string {
  const detail = isAxiosError(err) ? err.response?.data?.detail : undefined;
  return typeof detail === "string" ? detail : "Error al postularse";
}

export function loginUrlWithReturn(returnPath: string): string {
  return `/login?redirect_url=${encodeURIComponent(returnPath)}`;
}
