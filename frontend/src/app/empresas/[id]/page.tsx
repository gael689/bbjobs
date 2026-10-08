import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BuildingOffice2Icon, MapPinIcon, GlobeAltIcon, UsersIcon,
  BriefcaseIcon, ArrowRightIcon,
} from "@heroicons/react/24/outline";
import VerifiedBadge from "@/components/jobs/VerifiedBadge";
import JsonLd from "@/components/seo/JsonLd";
import Migas from "@/components/seo/Migas";
import { getCatalogos, getCompany, getCompanyJobs, nombrePorId } from "@/lib/seo/datos";
import { companySchema } from "@/lib/seo/schema";
import { companyUrl, jobUrl } from "@/lib/seo/urls";
import { SITIO, urlAbs } from "@/lib/seo/sitio";

// ISR: cada empresa se genera la primera vez que alguien la visita y queda cacheada 60 minutos.
// Todo el contenido (datos de la empresa y sus búsquedas activas) sale en el HTML inicial:
// antes lo pedía el navegador y el buscador veía una página vacía.
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  "híbrido": "Híbrido",
};

const EMPLOYEE_LABEL: Record<string, string> = {
  "0-10": "De 0 a 10 empleados",
  "11-50": "De 11 a 50 empleados",
  "51-100": "De 51 a 100 empleados",
  "100+": "Más de 100 empleados",
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const company = UUID.test(id) ? await getCompany(id) : null;

  if (!company) {
    return { title: "Empresa no encontrada — BBJobs", robots: { index: false, follow: true } };
  }

  const title = `${company.legal_name} — Empresa verificada | BBJobs`;
  const location = [company.city, company.province].filter(Boolean).join(", ");
  const description = company.description?.replace(/\s+/g, " ").trim().slice(0, 160)
    || `Búsquedas activas de ${company.legal_name}${location ? ` en ${location}` : ""}. Empresa verificada por Talency en BBJobs, el portal de empleos de Bahía Blanca.`;
  const canonical = urlAbs(companyUrl(company.id));

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
      images: company.logo_url
        ? [{ url: company.logo_url }]
        : [{ url: SITIO.ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: company.logo_url ? "summary" : "summary_large_image",
      title,
      description,
      images: [company.logo_url || SITIO.ogImage],
    },
  };
}

export default async function CompanyProfilePage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Empresas no verificadas o inexistentes: la API devuelve 404 → acá también.
  const [company, jobs, cat] = await Promise.all([getCompany(id), getCompanyJobs(id), getCatalogos()]);
  if (!company) notFound();

  const industryName = nombrePorId(cat.rubros, company.industry_id)?.name;
  const migas = [
    { nombre: "Inicio", path: "/" },
    { nombre: "Empresas", path: "/empresas" },
    { nombre: company.legal_name, path: companyUrl(company.id) },
  ];

  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <JsonLd data={companySchema(company, industryName)} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Migas migas={migas} className="mb-6" />

        {/* Header */}
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <div className="w-20 h-20 rounded-2xl border border-[#DDE3EC] bg-[#FAFBFD] flex items-center justify-center shrink-0 overflow-hidden">
              {company.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logo_url} alt={company.legal_name} className="max-h-full max-w-full object-contain" />
              ) : (
                <BuildingOffice2Icon className="w-9 h-9 text-[#9ED4DF]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-display font-extrabold text-[#1C2230] mb-1">{company.legal_name}</h1>
              <VerifiedBadge className="mb-3" />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-[#64748B]">
                {industryName && (
                  <span className="flex items-center gap-1.5">
                    <BriefcaseIcon className="w-4 h-4" />
                    {industryName}
                  </span>
                )}
                {(company.city || company.province) && (
                  <span className="flex items-center gap-1.5">
                    <MapPinIcon className="w-4 h-4" />
                    {[company.city, company.province].filter(Boolean).join(", ")}
                  </span>
                )}
                {company.employee_count && (
                  <span className="flex items-center gap-1.5">
                    <UsersIcon className="w-4 h-4" />
                    {EMPLOYEE_LABEL[company.employee_count] || company.employee_count}
                  </span>
                )}
                {company.website && (
                  <a
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[#1E8EA3] font-semibold hover:underline"
                  >
                    <GlobeAltIcon className="w-4 h-4" />
                    Sitio web
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sobre la empresa */}
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 mb-8">
          <h2 className="font-display font-bold text-xl text-[#1C2230] mb-4">Sobre la empresa</h2>
          {company.description ? (
            <p className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line">{company.description}</p>
          ) : (
            <p className="text-sm text-[#64748B] italic">Esta empresa todavía no completó su descripción.</p>
          )}
        </div>

        {/* Búsquedas activas */}
        <div>
          <h2 className="font-display font-bold text-xl text-[#1C2230] mb-4">
            Búsquedas activas {jobs.length > 0 && `(${jobs.length})`}
          </h2>
          {jobs.length === 0 ? (
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-10 text-center">
              <BriefcaseIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-3" />
              <p className="text-sm text-[#64748B]">Esta empresa no tiene búsquedas activas en este momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => (
                <Link
                  key={job.id}
                  href={jobUrl(job)}
                  className="group flex items-center justify-between gap-4 bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] rounded-2xl p-5 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-display font-bold text-[#1C2230] group-hover:text-[#1E8EA3] transition-colors">{job.title}</p>
                    <span className="text-xs font-semibold text-[#64748B]">{MODALITY_LABEL[job.modality] || job.modality}</span>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-[#1E8EA3]">
                    Ver aviso <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
