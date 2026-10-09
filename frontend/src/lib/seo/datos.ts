// Lecturas públicas de la API para las páginas server-rendered (fichas, zonas, sectores,
// sitemap, llms.txt). Sólo endpoints públicos: búsquedas activas y aprobadas, catálogos y
// empresas verificadas. `fetch` con la misma URL y opciones se memoiza dentro de un mismo render.

import { API_URL } from "./sitio";

export interface PublicJob {
  id: string;
  company_id?: string | null;
  company_legal_name_snapshot: string;
  logo_url?: string | null;
  title: string;
  description: string;
  industry_id?: string | null;
  zone_id?: string | null;
  contract_type_id?: string | null;
  modality: string;
  min_experience_years?: number | null;
  min_education_level?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_visible?: boolean;
  benefits?: string | null;
  status?: string;
  is_featured?: boolean;
  published_at?: string | null;
  expires_at?: string | null;
  updated_at?: string | null;
}

export interface CatalogItem {
  id: string;
  name: string;
  slug?: string;
}

export interface Catalogos {
  zonas: CatalogItem[];
  rubros: CatalogItem[];
  contratos: CatalogItem[];
}

export interface PublicCompany {
  id: string;
  legal_name: string;
  logo_url?: string | null;
  website?: string | null;
  description?: string | null;
  industry_id?: string | null;
  province?: string | null;
  city?: string | null;
  employee_count?: string | null;
}

async function getJson<T>(path: string, revalidate: number): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, {
    next: { revalidate },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/** Una búsqueda vencida (expires_at pasado) se trata como inexistente aunque el job de
 *  vencimiento todavía no la haya cerrado: Google no permite JobPosting vencidos. */
export function estaVencida(job: Pick<PublicJob, "expires_at">): boolean {
  return !!job.expires_at && new Date(job.expires_at).getTime() < Date.now();
}

export async function getJob(id: string): Promise<PublicJob | null> {
  const job = await getJson<PublicJob>(`/jobs/${id}`, 300);
  if (!job || estaVencida(job)) return null;
  return job;
}

/** Todas las búsquedas activas (a la escala de hoy son pocas: se traen enteras y se filtran
 *  en memoria para las páginas de zona y sector). */
export async function getActiveJobs(revalidate = 300): Promise<PublicJob[]> {
  const jobs: PublicJob[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 20; page++) {
    const data = await getJson<{ items: PublicJob[] }>(`/jobs?page=${page}&page_size=${pageSize}`, revalidate);
    const items = data?.items ?? [];
    jobs.push(...items);
    if (items.length < pageSize) break;
  }
  return jobs.filter((j) => !estaVencida(j));
}

export async function getCompanyJobs(companyId: string): Promise<PublicJob[]> {
  const data = await getJson<{ items: PublicJob[] }>(`/jobs?company_id=${companyId}&page_size=50`, 3600);
  return (data?.items ?? []).filter((j) => !estaVencida(j));
}

export async function getCompany(id: string): Promise<PublicCompany | null> {
  return getJson<PublicCompany>(`/companies/${id}`, 3600);
}

export async function getVerifiedCompanies(): Promise<PublicCompany[]> {
  return (await getJson<PublicCompany[]>(`/companies/verified?limit=100`, 3600)) ?? [];
}

export async function getCatalogos(): Promise<Catalogos> {
  const [zonas, rubros, contratos] = await Promise.all([
    getJson<CatalogItem[]>("/catalogs/zones", 3600),
    getJson<CatalogItem[]>("/catalogs/industries", 3600),
    getJson<CatalogItem[]>("/catalogs/contract-types", 3600),
  ]);
  return { zonas: zonas ?? [], rubros: rubros ?? [], contratos: contratos ?? [] };
}

export function nombrePorId(lista: CatalogItem[], id?: string | null): CatalogItem | undefined {
  return id ? lista.find((x) => x.id === id) : undefined;
}

/** Ids del catálogo que corresponden a una lista de slugs de catálogo. */
export function idsPorSlug(lista: CatalogItem[], slugs: readonly string[]): Set<string> {
  return new Set(lista.filter((x) => x.slug && slugs.includes(x.slug)).map((x) => x.id));
}

/** Etiquetas visibles de un job: zona, localidad real, sector y contrato. */
export function etiquetasJob(job: PublicJob, cat: Catalogos) {
  const zona = nombrePorId(cat.zonas, job.zone_id);
  const rubro = nombrePorId(cat.rubros, job.industry_id);
  const contrato = nombrePorId(cat.contratos, job.contract_type_id);
  return { zona, rubro, contrato };
}
