import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bbjobs.com.ar";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface PublicJob {
  id: string;
  published_at?: string;
}

interface PublicCompany {
  id: string;
}

async function fetchAllActiveJobs(): Promise<PublicJob[]> {
  const jobs: PublicJob[] = [];
  let page = 1;
  const pageSize = 100;

  // Escala de F1: unas pocas búsquedas activas — un puñado de páginas alcanza sin
  // necesidad de generateSitemaps (múltiples archivos), ver docs de Next.js.
  while (page <= 20) {
    const res = await fetch(`${API_URL}/jobs?page=${page}&page_size=${pageSize}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res || !res.ok) break;

    const data = await res.json();
    const items: PublicJob[] = data.items || [];
    jobs.push(...items);

    if (items.length < pageSize) break;
    page += 1;
  }

  return jobs;
}

async function fetchVerifiedCompanies(): Promise<PublicCompany[]> {
  const res = await fetch(`${API_URL}/companies/verified?limit=100`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res || !res.ok) return [];
  return res.json();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, companies] = await Promise.all([
    fetchAllActiveJobs(),
    fetchVerifiedCompanies(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/empleos`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/empresas`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/nosotros`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/contacto`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/planes`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/terminos`, changeFrequency: "yearly", priority: 0.1 },
  ];

  const jobRoutes: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${SITE_URL}/empleos/${job.id}`,
    lastModified: job.published_at ? new Date(job.published_at) : undefined,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const companyRoutes: MetadataRoute.Sitemap = companies.map((company) => ({
    url: `${SITE_URL}/empresas/${company.id}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...jobRoutes, ...companyRoutes];
}
