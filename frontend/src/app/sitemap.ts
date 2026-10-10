import type { MetadataRoute } from "next";
import { urlAbs } from "@/lib/seo/sitio";
import { jobUrl, companyUrl } from "@/lib/seo/urls";
import { getActiveJobs, getCatalogos, getVerifiedCompanies, idsPorSlug } from "@/lib/seo/datos";
import { RUBROS_INDICE, SELECCION_INDICE, ZONAS_INDICE } from "@/lib/seo/indice";

// Se regenera cada hora. A la escala de F1 (decenas de búsquedas) un solo archivo alcanza, sin
// generateSitemaps. Todo con el dominio canónico www y la URL con slug de cada búsqueda.
// Las páginas de zona y de sector entran sólo si tienen alguna búsqueda activa (si no, son
// noindex: ver app/trabajo-en/[zona]/page.tsx). /llms.txt no va: no es una página para Google.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, companies, cat] = await Promise.all([
    getActiveJobs(3600),
    getVerifiedCompanies(),
    getCatalogos(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: urlAbs("/"), changeFrequency: "daily", priority: 1 },
    { url: urlAbs("/empleos"), changeFrequency: "hourly", priority: 0.9 },
    { url: urlAbs("/empresas"), changeFrequency: "daily", priority: 0.6 },
    { url: urlAbs("/nosotros"), changeFrequency: "monthly", priority: 0.3 },
    { url: urlAbs("/contacto"), changeFrequency: "monthly", priority: 0.3 },
    { url: urlAbs("/planes"), changeFrequency: "monthly", priority: 0.3 },
    { url: urlAbs("/planes/base-de-talento"), changeFrequency: "monthly", priority: 0.4 },
    // Para empresas (SEO-EMPRESAS-TALENCY-PLAN.md): siempre indexables, no dependen de búsquedas activas.
    { url: urlAbs("/seleccion-de-personal"), changeFrequency: "monthly", priority: 0.7 },
    ...SELECCION_INDICE.map((slug) => ({
      url: urlAbs(`/seleccion-de-personal/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: urlAbs("/publicar-empleo"), changeFrequency: "monthly", priority: 0.6 },
    { url: urlAbs("/privacidad"), changeFrequency: "yearly", priority: 0.1 },
    { url: urlAbs("/terminos"), changeFrequency: "yearly", priority: 0.1 },
    { url: urlAbs("/cookies"), changeFrequency: "yearly", priority: 0.1 },
    { url: urlAbs("/arrepentimiento"), changeFrequency: "yearly", priority: 0.1 },
  ];

  const jobRoutes: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: urlAbs(jobUrl(job)),
    lastModified: job.updated_at || job.published_at ? new Date((job.updated_at || job.published_at)!) : undefined,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const companyRoutes: MetadataRoute.Sitemap = companies.map((company) => ({
    url: urlAbs(companyUrl(company.id)),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const zonaRoutes: MetadataRoute.Sitemap = ZONAS_INDICE.filter((z) => {
    const ids = idsPorSlug(cat.zonas, z.catalogo);
    return jobs.some((j) => j.zone_id && ids.has(j.zone_id));
  }).map((z) => ({ url: urlAbs(`/trabajo-en/${z.slug}`), changeFrequency: "daily", priority: 0.7 }));

  const rubroRoutes: MetadataRoute.Sitemap = RUBROS_INDICE.filter((r) => {
    const ids = idsPorSlug(cat.rubros, r.catalogo);
    return jobs.some((j) => j.industry_id && ids.has(j.industry_id));
  }).map((r) => ({ url: urlAbs(`/empleos-de/${r.slug}`), changeFrequency: "daily", priority: 0.7 }));

  return [...staticRoutes, ...zonaRoutes, ...rubroRoutes, ...jobRoutes, ...companyRoutes];
}
