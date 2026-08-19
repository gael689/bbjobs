"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  UsersIcon, UserCircleIcon, CheckCircleIcon,
  BriefcaseIcon, FunnelIcon, ChartBarIcon,
} from "@heroicons/react/24/outline";
import CandidateProfileModal from "@/components/dashboard/CandidateProfileModal";
import PanelEstadisticas from "@/components/stats/PanelEstadisticas";
import Paginacion from "@/components/ui/Paginacion";
import { useListaPaginada, type ValorFiltro } from "@/hooks/useListaPaginada";
import {
  APP_STATUS_LABEL, CANDIDATE_GENDER_LABEL, CANDIDATE_AVAILABILITY_LABEL,
  EMPTY_APPLICANT_FILTERS,
  type Application, type ApplicantFilters, type ApplicantStats, type CandidateFullProfile,
  type CompanyProfile, type JobPosting,
} from "../types";

function buildFilterParams(f: ApplicantFilters): Record<string, ValorFiltro> {
  return {
    age_min: f.age_min || undefined,
    age_max: f.age_max || undefined,
    gender: f.gender || undefined,
    has_own_transport: f.has_own_transport ? f.has_own_transport === "true" : undefined,
    availability: f.availability || undefined,
    immediate_availability: f.immediate_availability || undefined,
    position: f.position?.trim() || undefined,
    experience_min: f.experience_min || undefined,
    experience_max: f.experience_max || undefined,
    zone_id: f.zone_id || undefined,
  };
}

export default function CompanyPostulacionesPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [zonas, setZonas] = useState<{ id: string; name: string }[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [seleccionManual, setSeleccionManual] = useState<string>("");
  // `filters` es el formulario; `aplicados` es lo que se está pidiendo. La pantalla filtra al
  // apretar "Filtrar", no al tipear.
  const [filters, setFilters] = useState<ApplicantFilters>(EMPTY_APPLICANT_FILTERS);
  const [aplicados, setAplicados] = useState<ApplicantFilters>(EMPTY_APPLICANT_FILTERS);
  const [stats, setStats] = useState<Record<string, ApplicantStats | null>>({});
  const [showStats, setShowStats] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateFullProfile | null>(null);
  const [loadingCandidate, setLoadingCandidate] = useState(false);

  const isVerified = profile?.verification_status === "verified";
  // La búsqueda elegida se deriva: si la de la lista desapareció (se cerró, se dio de baja),
  // cae sola en la primera en vez de quedar apuntando a un id que ya no está.
  const selectedJobId = jobs.some(j => j.id === seleccionManual) ? seleccionManual : (jobs[0]?.id ?? "");

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  // Ver postulantes sigue exigiendo empresa verificada (a diferencia de publicar, ver A2 del
  // plan del 14/08): con `null` el hook no pide nada y así no se dispara un request que
  // siempre daría 403.
  const postulaciones = useListaPaginada<Application>(
    selectedJobId && isVerified ? `/me/company/jobs/${selectedJobId}/applications` : null,
    buildFilterParams(aplicados),
  );

  function selectJob(jobId: string) {
    setSeleccionManual(jobId);
    setFilters(EMPTY_APPLICANT_FILTERS);
    setAplicados(EMPTY_APPLICANT_FILTERS);
  }

  useEffect(() => {
    api.get("/catalogs/zones").then(r => setZonas(r.data)).catch(() => {});
    Promise.all([
      api.get("/me/company/profile").then(r => r.data as CompanyProfile).catch(() => null),
      api.get("/me/company/jobs").then(r => r.data as JobPosting[]).catch(() => []),
    ]).then(([p, jobList]) => {
      setProfile(p);
      setJobs(jobList);
    });
  }, []);

  // Las estadísticas del aviso van aparte del listado: son agregados de TODOS los postulantes,
  // no de la página que se está viendo. Cacheadas por id, una sola llamada por aviso.
  useEffect(() => {
    if (!selectedJobId || !isVerified || stats[selectedJobId] !== undefined) return;
    api.get(`/me/company/jobs/${selectedJobId}/applications/stats`)
      .then(r => setStats(prev => ({ ...prev, [selectedJobId]: r.data })))
      .catch(() => setStats(prev => ({ ...prev, [selectedJobId]: null })));
  }, [selectedJobId, isVerified, stats]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setAplicados(filters);
  }

  function clearFilters() {
    setFilters(EMPTY_APPLICANT_FILTERS);
    setAplicados(EMPTY_APPLICANT_FILTERS);
  }

  const hasActiveFilters = !!(
    filters.age_min || filters.age_max || filters.gender ||
    filters.has_own_transport || filters.availability || filters.immediate_availability ||
    filters.position?.trim() || filters.experience_min || filters.experience_max ||
    filters.zone_id
  );

  async function handleAppStatus(appId: string, status: string) {
    try {
      await api.patch(`/me/company/applications/${appId}/status`, { status });
      postulaciones.actualizarItems(prev => prev.map(a => (a.id === appId ? { ...a, status } : a)));
    } catch {
      toast("Error al actualizar estado");
    }
  }

  async function openCandidateProfile(candidateId: string) {
    setLoadingCandidate(true);
    setCandidateProfile(null);
    try {
      const r = await api.get(`/me/company/candidates/${candidateId}`);
      setCandidateProfile(r.data);
    } catch {
      toast("Error al cargar el perfil del candidato");
    } finally {
      setLoadingCandidate(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-white border border-[#9ED4DF] shadow-lg rounded-xl px-5 py-3 text-sm font-medium text-[#1C2230] flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
          {toastMsg}
        </div>
      )}

      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Postulaciones</h1>
      <p className="text-[#64748B] text-sm mb-6">Revisá y gestioná las postulaciones por búsqueda.</p>

      {jobs.length === 0 ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-12 text-center">
          <BriefcaseIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-4" />
          <p className="text-[#64748B] font-medium">Todavía no publicaste ninguna búsqueda.</p>
        </div>
      ) : !isVerified ? (
        <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-8 text-center">
          <UsersIcon className="w-10 h-10 text-[#1E8EA3] mx-auto mb-3" />
          <p className="text-[#1C2230] font-bold mb-1">Necesitás tu empresa verificada para ver postulantes</p>
          <p className="text-[#64748B] text-sm mb-4">
            Tus búsquedas ya se publican y reciben postulaciones — para ver quién se postuló,
            su CV y su perfil hace falta la verificación.
          </p>
          <a
            href="/dashboard/company/perfil"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] px-5 py-2.5 rounded-xl transition-colors"
          >
            Pedir verificación
          </a>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-[#64748B] mb-1.5 block uppercase tracking-wide">Búsqueda</label>
              <select
                value={selectedJobId}
                onChange={e => selectJob(e.target.value)}
                className="w-full sm:w-80 border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
              >
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <button
              onClick={() => setShowStats(v => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] border border-[#9ED4DF] bg-[#E6F4F7] rounded-xl px-4 py-2.5 transition-colors"
            >
              <ChartBarIcon className="w-4 h-4" />
              {showStats ? "Ocultar estadísticas" : "Ver estadísticas"}
            </button>
          </div>

          <div className="mb-5">
            <form onSubmit={applyFilters} className="bg-white border border-[#DDE3EC] rounded-2xl p-4 h-fit">
              <div className="flex items-center gap-2 mb-3">
                <FunnelIcon className="w-4 h-4 text-[#1E8EA3]" />
                <span className="text-sm font-bold text-[#1C2230]">Filtrar postulantes</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <input
                  type="text" placeholder="Posición (ej: comercial)"
                  value={filters.position}
                  onChange={e => setFilters(f => ({ ...f, position: e.target.value }))}
                  className="col-span-2 border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                />
                <input
                  type="number" min={0} step={0.5} placeholder="Exp. mín. (años)"
                  value={filters.experience_min}
                  onChange={e => setFilters(f => ({ ...f, experience_min: e.target.value }))}
                  className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                />
                <input
                  type="number" min={0} step={0.5} placeholder="Exp. máx. (años)"
                  value={filters.experience_max}
                  onChange={e => setFilters(f => ({ ...f, experience_max: e.target.value }))}
                  className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                />
                <select
                  value={filters.zone_id}
                  onChange={e => setFilters(f => ({ ...f, zone_id: e.target.value }))}
                  className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                >
                  <option value="">Zona (todas)</option>
                  {zonas.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
                <input
                  type="number" min={0} placeholder="Edad mín."
                  value={filters.age_min}
                  onChange={e => setFilters(f => ({ ...f, age_min: e.target.value }))}
                  className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                />
                <input
                  type="number" min={0} placeholder="Edad máx."
                  value={filters.age_max}
                  onChange={e => setFilters(f => ({ ...f, age_max: e.target.value }))}
                  className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                />
                <select
                  value={filters.gender}
                  onChange={e => setFilters(f => ({ ...f, gender: e.target.value as ApplicantFilters["gender"] }))}
                  className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                >
                  <option value="">Sexo (todos)</option>
                  {Object.entries(CANDIDATE_GENDER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select
                  value={filters.has_own_transport}
                  onChange={e => setFilters(f => ({ ...f, has_own_transport: e.target.value as ApplicantFilters["has_own_transport"] }))}
                  className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                >
                  <option value="">Movilidad (todas)</option>
                  <option value="true">Con movilidad</option>
                  <option value="false">Sin movilidad</option>
                </select>
                <select
                  value={filters.availability}
                  onChange={e => setFilters(f => ({ ...f, availability: e.target.value as ApplicantFilters["availability"] }))}
                  className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
                >
                  <option value="">Disponibilidad (todas)</option>
                  {Object.entries(CANDIDATE_AVAILABILITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!filters.immediate_availability}
                    onChange={e => setFilters(f => ({ ...f, immediate_availability: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-[#1E8EA3]"
                  />
                  Disp. inmediata
                </label>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button type="submit" className="text-xs font-bold bg-[#1E8EA3] text-white rounded-lg px-3 py-1.5 hover:bg-[#187B8E] transition-colors">
                  Filtrar
                </button>
                {hasActiveFilters && (
                  <button type="button" onClick={clearFilters} className="text-xs font-bold text-[#64748B] border border-[#DDE3EC] rounded-lg px-3 py-1.5 hover:bg-[#FAFBFD] transition-colors">
                    Limpiar
                  </button>
                )}
                {/* Sin esto, filtrar y no ver ningún cambio visible es indistinguible de que el
                    filtro no hizo nada (ver B4 del plan del 14/08). */}
                {!postulaciones.cargando && (
                  <span className="text-xs text-[#64748B]">
                    {`${postulaciones.total} postulante${postulaciones.total === 1 ? "" : "s"}`}
                    {hasActiveFilters && " con estos filtros"}
                  </span>
                )}
              </div>
            </form>

          </div>

          {showStats && stats[selectedJobId] && (
            <div className="mb-5">
              <PanelEstadisticas stats={stats[selectedJobId]!} />
            </div>
          )}

          <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden">
            {postulaciones.cargando ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : postulaciones.items.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#64748B]">
                <UsersIcon className="w-10 h-10 mx-auto mb-3 text-[#DDE3EC]" />
                Sin postulaciones aún para esta búsqueda.
              </div>
            ) : (
              <div className="divide-y divide-[#DDE3EC]">
                {postulaciones.items.map(app => (
                  <div key={app.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Sin anillo de % de perfil: la empresa lo leía como "% de ajuste al
                          puesto" cuando en realidad mide cuánto cargó el candidato de su propio
                          perfil (pedido de Eugenia, agosto/2026). Sigue visible en el panel de
                          Talency, que sabe qué mide. En su lugar, la foto del candidato — antes
                          nunca llegaba a la empresa aunque ya se subía (ver B3 del plan del
                          14/08). */}
                      {app.candidate?.photo_url ? (
                        <img
                          src={app.candidate.photo_url}
                          alt={`${app.candidate.first_name} ${app.candidate.last_name}`}
                          className="w-9 h-9 rounded-lg object-cover shrink-0 border border-[#DDE3EC]"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#E6F4F7] flex items-center justify-center shrink-0 text-[#1E8EA3] font-display font-bold text-xs">
                          {app.candidate
                            ? `${app.candidate.first_name.slice(0, 1)}${app.candidate.last_name.slice(0, 1)}`.toUpperCase()
                            : <UsersIcon className="w-4 h-4" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1C2230]">
                          {app.candidate ? `${app.candidate.first_name} ${app.candidate.last_name}` : "Candidato"}
                        </p>
                        <p className="text-xs text-[#64748B]">{new Date(app.created_at).toLocaleDateString("es-AR")}</p>
                        {app.candidate && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {app.candidate.age != null && (
                              <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">{app.candidate.age} años</span>
                            )}
                            {app.candidate.gender && (
                              <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">{CANDIDATE_GENDER_LABEL[app.candidate.gender]}</span>
                            )}
                            {app.candidate.has_own_transport != null && (
                              <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">
                                {app.candidate.has_own_transport ? "Con movilidad" : "Sin movilidad"}
                              </span>
                            )}
                            {app.candidate.immediate_availability && (
                              <span className="text-[10px] font-bold bg-[#D4B7A2]/25 text-[#1C2230] border border-[#D4B7A2] px-1.5 py-0.5 rounded-full">Disp. inmediata</span>
                            )}
                          </div>
                        )}
                        {app.cover_letter && (
                          <p className="text-xs text-[#64748B] truncate mt-0.5 max-w-xs">{app.cover_letter}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {app.candidate && (
                        <button
                          onClick={() => openCandidateProfile(app.candidate!.id)}
                          className="text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#E6F4F7] transition-colors"
                        >
                          <UserCircleIcon className="w-3.5 h-3.5" />
                          Ver perfil
                        </button>
                      )}
                      <select
                        value={app.status}
                        onChange={e => handleAppStatus(app.id, e.target.value)}
                        className="text-xs border border-[#DDE3EC] rounded-lg px-2 py-1 bg-white text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                      >
                        {Object.entries(APP_STATUS_LABEL).map(([value, { label }]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!postulaciones.cargando && (
            <Paginacion
              pagina={postulaciones.pagina}
              totalPaginas={postulaciones.totalPaginas}
              total={postulaciones.total}
              pageSize={postulaciones.pageSize}
              etiqueta="postulantes"
              onCambiar={postulaciones.irAPagina}
            />
          )}
        </>
      )}

      <CandidateProfileModal
        profile={candidateProfile}
        loading={loadingCandidate}
        onClose={() => setCandidateProfile(null)}
        cvLinkEndpoint={candidateProfile ? `/me/company/candidates/${candidateProfile.id}/cv/link` : undefined}
      />
    </div>
  );
}
