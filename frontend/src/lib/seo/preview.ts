import type { PublicJob } from "./datos";
import type { PreviewJob } from "@/components/jobs/JobPreviewPanel";

/** Búsqueda leída en el servidor → la forma que usan las listas cliente (home y /empleos).
 *  La API devuelve null donde PreviewJob espera undefined. */
export function aPreview(j: PublicJob): PreviewJob & { zone_id?: string } {
  return {
    id: j.id,
    title: j.title,
    description: j.description,
    benefits: j.benefits ?? undefined,
    company_id: j.company_id ?? undefined,
    company_legal_name_snapshot: j.company_legal_name_snapshot,
    logo_url: j.logo_url ?? undefined,
    modality: j.modality,
    published_at: j.published_at ?? undefined,
    salary_min: j.salary_min ?? undefined,
    salary_max: j.salary_max ?? undefined,
    salary_visible: j.salary_visible,
    salary_currency: j.salary_currency ?? undefined,
    is_featured: j.is_featured,
    zone_id: j.zone_id ?? undefined,
  };
}
