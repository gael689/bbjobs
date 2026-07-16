import type { Metadata } from "next";
import JobDetailClient from "./JobDetailClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bbjobs.com.ar";

interface PublicJob {
  id: string;
  title: string;
  description: string;
  company_legal_name_snapshot: string;
  logo_url?: string | null;
  modality: string;
  published_at?: string;
  expires_at?: string;
  salary_min?: number;
  salary_max?: number;
  salary_visible?: boolean;
  salary_currency?: string;
}

// `fetch` con la misma URL se memoiza automáticamente entre generateMetadata y el Server
// Component en el mismo request (ver docs de Next.js) — no dispara dos requests reales.
async function getJob(id: string): Promise<PublicJob | null> {
  const res = await fetch(`${API_URL}/jobs/${id}`, { next: { revalidate: 300 } }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json();
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    return { title: "Empleo no encontrado — BBJobs" };
  }

  const title = `${job.title} — ${job.company_legal_name_snapshot} — BBJobs`;
  const description = job.description.slice(0, 160);

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/empleos/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/empleos/${id}`,
      type: "website",
      images: job.logo_url ? [{ url: job.logo_url }] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function JobDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await getJob(id);

  const jsonLd = job && {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.published_at,
    validThrough: job.expires_at,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company_legal_name_snapshot,
      ...(job.logo_url ? { logo: job.logo_url } : {}),
    },
    ...(job.modality === "remoto"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "Argentina" },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: "Bahía Blanca",
              addressRegion: "Buenos Aires",
              addressCountry: "AR",
            },
          },
        }),
    ...(job.salary_visible && (job.salary_min || job.salary_max)
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.salary_currency || "ARS",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salary_min,
              maxValue: job.salary_max,
              unitText: "MONTH",
            },
          },
        }
      : {}),
  };

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // JSON.stringify escapa comillas pero no "<" — sin este reemplazo, un job.description
          // con "</script><script>..." cerraría este tag antes de tiempo y ejecutaría lo que
          // sigue (XSS). "<" es válido dentro de un string JSON y decodifica de vuelta a
          // "<", así que el JSON-LD sigue siendo idéntico para los crawlers.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      <JobDetailClient />
    </>
  );
}
