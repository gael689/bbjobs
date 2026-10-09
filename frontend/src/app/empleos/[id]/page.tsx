import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import JobDetailClient from "./JobDetailClient";
import JsonLd from "@/components/seo/JsonLd";
import Migas from "@/components/seo/Migas";
import { getCatalogos, getJob, etiquetasJob } from "@/lib/seo/datos";
import { jobPostingSchema } from "@/lib/seo/schema";
import { jobUrl, parseJobParam } from "@/lib/seo/urls";
import { SITIO, urlAbs } from "@/lib/seo/sitio";
import { localidadDeZona, RUBROS_INDICE, ZONAS_INDICE } from "@/lib/seo/indice";

// ISR: cada búsqueda se genera la primera vez que alguien la visita y queda cacheada
// 5 minutos. Sin esto, con el layout raíz sin `force-dynamic`, Next igual la renderizaría en
// cada request por ser una ruta con parámetro.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

// La URL canónica es /empleos/<slug-del-titulo>-<uuid> (lib/seo/urls.ts). El parámetro puede
// venir sólo con el uuid (links viejos, mails ya enviados) o con un slug desactualizado:
// en ese caso, 308 a la canónica.

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: param } = await params;
  const id = parseJobParam(param);
  const job = id ? await getJob(id) : null;

  if (!job) {
    return { title: "Empleo no encontrado — BBJobs", robots: { index: false, follow: true } };
  }

  const cat = await getCatalogos();
  const { zona } = etiquetasJob(job, cat);
  const lugar = job.modality === "remoto" ? "Remoto" : localidadDeZona(zona?.slug, zona?.name);
  const title = `${job.title} en ${lugar} — ${job.company_legal_name_snapshot} | BBJobs`;
  const description = job.description.replace(/\s+/g, " ").trim().slice(0, 157) + (job.description.length > 157 ? "…" : "");
  const canonical = urlAbs(jobUrl(job));

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: SITIO.nombre,
      locale: "es_AR",
      images: job.logo_url
        ? [{ url: job.logo_url }]
        : [{ url: SITIO.ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: job.logo_url ? "summary" : "summary_large_image",
      title,
      description,
      images: [job.logo_url || SITIO.ogImage],
    },
  };
}

export default async function JobDetailPage({ params }: Props) {
  const { id: param } = await params;
  const id = parseJobParam(param);
  if (!id) notFound();

  // Inexistente, cerrada, sin aprobar o vencida → 404 (Google exige sacar los JobPosting vencidos).
  const job = await getJob(id);
  if (!job) notFound();

  const canonica = jobUrl(job);
  if (`/empleos/${param}` !== canonica) permanentRedirect(canonica);

  const cat = await getCatalogos();
  const { zona, rubro, contrato } = etiquetasJob(job, cat);
  const localidad = localidadDeZona(zona?.slug, zona?.name);
  const paginaZona = ZONAS_INDICE.find((z) => zona?.slug && z.catalogo.includes(zona.slug));
  const paginaRubro = RUBROS_INDICE.find((r) => rubro?.slug && r.catalogo.includes(rubro.slug));

  const migas = [
    { nombre: "Inicio", path: "/" },
    { nombre: "Empleos", path: "/empleos" },
    ...(paginaZona ? [{ nombre: `Trabajo en ${paginaZona.nombre}`, path: `/trabajo-en/${paginaZona.slug}` }] : []),
    { nombre: job.title, path: canonica },
  ];

  return (
    <>
      <JsonLd data={jobPostingSchema(job, cat)} />
      <JobDetailClient
        initialJob={job}
        canonicalPath={canonica}
        etiquetas={{
          zona: zona ? (zona.slug === "zona-norte" || zona.slug === "zona-sur" ? `${zona.name}, Bahía Blanca` : localidad) : undefined,
          rubro: rubro?.name,
          contrato: contrato?.name,
          paginaZona: paginaZona ? `/trabajo-en/${paginaZona.slug}` : undefined,
          paginaRubro: paginaRubro ? `/empleos-de/${paginaRubro.slug}` : undefined,
        }}
        migas={<Migas migas={migas} />}
      />
    </>
  );
}
