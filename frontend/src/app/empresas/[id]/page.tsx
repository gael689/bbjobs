import type { Metadata } from "next";
import CompanyProfileClient from "./CompanyProfileClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bbjobs.com.ar";

interface PublicCompany {
  id: string;
  legal_name: string;
  logo_url?: string | null;
  description?: string | null;
  city?: string | null;
  province?: string | null;
}

async function getCompany(id: string): Promise<PublicCompany | null> {
  const res = await fetch(`${API_URL}/companies/${id}`, { next: { revalidate: 3600 } }).catch(() => null);
  if (!res || !res.ok) return null;
  return res.json();
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const company = await getCompany(id);

  if (!company) {
    return { title: "Empresa no encontrada — BBJobs" };
  }

  const title = `${company.legal_name} — Empresa verificada — BBJobs`;
  const location = [company.city, company.province].filter(Boolean).join(", ");
  const description = company.description?.slice(0, 160)
    || `Búsquedas activas de ${company.legal_name}${location ? ` en ${location}` : ""}. Empresa verificada por Talency en BBJobs, el portal de empleos de Bahía Blanca.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/empresas/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/empresas/${id}`,
      type: "website",
      images: company.logo_url
        ? [{ url: company.logo_url }]
        : [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: company.logo_url ? "summary" : "summary_large_image",
      title,
      description,
      images: [company.logo_url || `${SITE_URL}/og-image.png`],
    },
  };
}

export default function CompanyProfilePage() {
  return <CompanyProfileClient />;
}
