"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  BuildingOffice2Icon, MapPinIcon, GlobeAltIcon, UsersIcon,
  ArrowLeftIcon, BriefcaseIcon, ArrowRightIcon,
} from "@heroicons/react/24/outline";
import VerifiedBadge from "@/components/jobs/VerifiedBadge";

interface CompanyPublicProfile {
  id: string;
  legal_name: string;
  logo_url?: string | null;
  website?: string | null;
  description?: string | null;
  industry_id: string;
  province?: string | null;
  city?: string | null;
  employee_count?: string | null;
}

interface Job {
  id: string;
  title: string;
  modality: string;
  published_at?: string;
}

interface Industry { id: string; name: string; }

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

export default function CompanyProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<CompanyPublicProfile | null>(null);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/companies/${id}`)
      .then(r => setCompany(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    api.get("/catalogs/industries").then(r => setIndustries(r.data)).catch(() => {});
    api.get(`/jobs?company_id=${id}&page_size=50`).then(r => setJobs(r.data.items)).catch(() => {});
  }, [id]);

  const industryName = industries.find(i => i.id === company?.industry_id)?.name;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFBFD] pt-[140px] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="min-h-screen bg-[#FAFBFD] pt-[140px] flex items-center justify-center">
        <div className="text-center">
          <BuildingOffice2Icon className="w-12 h-12 text-[#DDE3EC] mx-auto mb-4" />
          <p className="font-bold text-[#1C2230] mb-2">Empresa no encontrada</p>
          <p className="text-sm text-[#64748B] mb-6">Puede no estar verificada todavía, o el perfil no existe.</p>
          <Link href="/empleos" className="text-sm font-bold text-[#1E8EA3] hover:underline flex items-center gap-1 justify-center">
            <ArrowLeftIcon className="w-4 h-4" />
            Ver todos los empleos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAFBFD] min-h-screen pt-[140px] pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Link href="/empresas" className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1E8EA3] transition-colors font-medium mb-6">
          <ArrowLeftIcon className="w-4 h-4" />
          Ver todas las empresas
        </Link>

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
                  href={`/empleos/${job.id}`}
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
