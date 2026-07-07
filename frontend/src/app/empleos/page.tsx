"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  BriefcaseIcon, MagnifyingGlassIcon, MapPinIcon,
  BuildingOffice2Icon, FunnelIcon, XMarkIcon,
} from "@heroicons/react/24/outline";

interface Job {
  id: string;
  title: string;
  company_legal_name_snapshot: string;
  modality: string;
  zone_id?: string;
  published_at?: string;
  salary_min?: number;
  salary_max?: number;
  salary_visible?: boolean;
  salary_currency?: string;
}

interface Catalog { id: string; name: string; }

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  "híbrido": "Híbrido",
};

const MODALITY_CLS: Record<string, string> = {
  presencial: "bg-blue-100 text-blue-700",
  remoto: "bg-green-100 text-green-700",
  "híbrido": "bg-purple-100 text-purple-700",
};

const PAGE_SIZE = 20;

export default function EmpleosPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [industries, setIndustries] = useState<Catalog[]>([]);
  const [zones, setZones] = useState<Catalog[]>([]);
  const [contractTypes, setContractTypes] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Prellenado liviano desde la URL (ej. viene de /empleos?q=... del hero de la home) —
  // mismo patrón que /login, evita el boilerplate de Suspense de useSearchParams.
  const [q, setQ] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") || "";
  });
  const [industryId, setIndustryId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [modality, setModality] = useState("");
  const [contractTypeId, setContractTypeId] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

  useEffect(() => {
    api.get("/catalogs/industries").then(r => setIndustries(r.data)).catch(() => {});
    api.get("/catalogs/zones").then(r => setZones(r.data)).catch(() => {});
    api.get("/catalogs/contract-types").then(r => setContractTypes(r.data)).catch(() => {});
  }, []);

  function buildParams(targetPage: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (industryId) params.set("industry_id", industryId);
    if (zoneId) params.set("zone_id", zoneId);
    if (modality) params.set("modality", modality);
    if (contractTypeId) params.set("contract_type_id", contractTypeId);
    if (salaryMin) params.set("salary_min", salaryMin);
    if (salaryMax) params.set("salary_max", salaryMax);
    params.set("page", String(targetPage));
    params.set("page_size", String(PAGE_SIZE));
    return params;
  }

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      api.get(`/jobs?${buildParams(1).toString()}`)
        .then(r => {
          setJobs(r.data.items);
          setTotal(r.data.total);
          setPage(1);
        })
        .catch(() => { setJobs([]); setTotal(0); })
        .finally(() => setLoading(false));
    }, q ? 400 : 0);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, industryId, zoneId, modality, contractTypeId, salaryMin, salaryMax]);

  function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    api.get(`/jobs?${buildParams(nextPage).toString()}`)
      .then(r => {
        setJobs(prev => [...prev, ...r.data.items]);
        setTotal(r.data.total);
        setPage(nextPage);
      })
      .finally(() => setLoadingMore(false));
  }

  function clearFilters() {
    setQ("");
    setIndustryId("");
    setZoneId("");
    setModality("");
    setContractTypeId("");
    setSalaryMin("");
    setSalaryMax("");
  }

  const hasFilters = q || industryId || zoneId || modality || contractTypeId || salaryMin || salaryMax;
  const zoneName = (id: string) => zones.find(z => z.id === id)?.name || "";

  return (
    <div className="bg-[#FAFBFD] min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-r from-[#E6F4F7] to-[#FAFBFD] border-b border-[#9ED4DF] px-4 sm:px-6 py-14">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#1E8EA3] font-bold text-sm uppercase tracking-wider mb-3">Portal de empleos</p>
          <h1 className="text-4xl font-display font-extrabold text-[#1C2230] mb-3">
            Encontrá tu próximo trabajo en Bahía Blanca
          </h1>
          <p className="text-[#64748B] text-lg mb-8">
            Empresas verificadas, búsquedas reales, postulaciones con un click.
          </p>
          {/* Search */}
          <div className="relative max-w-xl mx-auto">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por puesto, empresa o descripción..."
              className="w-full pl-12 pr-4 py-4 border border-[#DDE3EC] rounded-2xl bg-white text-[#1C2230] text-sm focus:outline-none focus:border-[#1E8EA3] shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters sidebar */}
          <aside className="w-full lg:w-60 shrink-0">
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FunnelIcon className="w-4 h-4 text-[#1E8EA3]" />
                  <span className="font-bold text-sm text-[#1C2230]">Filtros</span>
                </div>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-[#64748B] hover:text-red-500 transition-colors flex items-center gap-1">
                    <XMarkIcon className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">Modalidad</label>
                  <div className="space-y-1">
                    {["", "presencial", "remoto", "híbrido"].map(m => (
                      <button
                        key={m}
                        onClick={() => setModality(m)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          modality === m
                            ? "bg-[#E6F4F7] text-[#1E8EA3] font-bold"
                            : "text-[#64748B] hover:bg-[#FAFBFD]"
                        }`}
                      >
                        {m === "" ? "Todas" : MODALITY_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">Industria</label>
                  <select
                    value={industryId}
                    onChange={e => setIndustryId(e.target.value)}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                  >
                    <option value="">Todas</option>
                    {industries.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">Zona</label>
                  <select
                    value={zoneId}
                    onChange={e => setZoneId(e.target.value)}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                  >
                    <option value="">Todas</option>
                    {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">Tipo de contrato</label>
                  <select
                    value={contractTypeId}
                    onChange={e => setContractTypeId(e.target.value)}
                    className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                  >
                    <option value="">Todos</option>
                    {contractTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">Salario (ARS)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="Mín"
                      value={salaryMin}
                      onChange={e => setSalaryMin(e.target.value)}
                      className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                    />
                    <span className="text-[#94A3B8] text-xs shrink-0">a</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="Máx"
                      value={salaryMax}
                      onChange={e => setSalaryMax(e.target.value)}
                      className="w-full border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#64748B]">
                {loading ? "Cargando..." : `${total} ${total === 1 ? "empleo encontrado" : "empleos encontrados"}`}
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-3 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white border border-[#DDE3EC] rounded-2xl p-16 text-center">
                <BriefcaseIcon className="w-12 h-12 text-[#DDE3EC] mx-auto mb-4" />
                <p className="font-bold text-[#1C2230] mb-2">No hay empleos que coincidan</p>
                <p className="text-sm text-[#64748B]">Probá con otros filtros o volvé más tarde.</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="mt-4 text-sm font-bold text-[#1E8EA3] hover:underline">
                    Ver todos los empleos
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <Link
                    key={job.id}
                    href={`/empleos/${job.id}`}
                    className="block bg-white border border-[#DDE3EC] rounded-2xl p-6 hover:border-[#1E8EA3] hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${MODALITY_CLS[job.modality] || "bg-gray-100 text-gray-600"}`}>
                            {MODALITY_LABEL[job.modality] || job.modality}
                          </span>
                          {job.published_at && (
                            <span className="text-xs text-[#64748B]">{new Date(job.published_at).toLocaleDateString("es-AR")}</span>
                          )}
                        </div>
                        <h2 className="text-lg font-display font-bold text-[#1C2230] group-hover:text-[#1E8EA3] transition-colors truncate">
                          {job.title}
                        </h2>
                        <div className="flex items-center gap-3 mt-1.5 text-sm text-[#64748B]">
                          <span className="flex items-center gap-1">
                            <BuildingOffice2Icon className="w-4 h-4" />
                            {job.company_legal_name_snapshot}
                          </span>
                          {job.zone_id && zoneName(job.zone_id) && (
                            <span className="flex items-center gap-1">
                              <MapPinIcon className="w-4 h-4" />
                              {zoneName(job.zone_id)}
                            </span>
                          )}
                        </div>
                        {job.salary_visible && (job.salary_min || job.salary_max) && (
                          <p className="text-sm font-bold text-[#1E8EA3] mt-2">
                            {job.salary_currency || "ARS"} {job.salary_min?.toLocaleString("es-AR")}
                            {job.salary_max ? ` – ${job.salary_max.toLocaleString("es-AR")}` : "+"}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 self-center">
                        <span className="text-xs font-bold text-[#1E8EA3] border border-[#9ED4DF] px-3 py-1.5 rounded-full group-hover:bg-[#1E8EA3] group-hover:text-white group-hover:border-[#1E8EA3] transition-all">
                          Ver empleo
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!loading && jobs.length < total && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-white border border-[#DDE3EC] hover:border-[#1E8EA3] text-[#1E8EA3] font-bold text-sm rounded-2xl px-8 py-3 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? "Cargando..." : "Cargar más"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
