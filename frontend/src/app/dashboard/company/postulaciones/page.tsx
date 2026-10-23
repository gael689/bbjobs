"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  UsersIcon, UserCircleIcon, CheckCircleIcon,
  BriefcaseIcon, ChartBarIcon,
} from "@heroicons/react/24/outline";
import CandidateProfileModal from "@/components/dashboard/CandidateProfileModal";
import BuscadorPostulantes from "@/components/dashboard/postulantes/BuscadorPostulantes";
import BotonEstrella from "@/components/dashboard/postulantes/BotonEstrella";
import {
  FILTROS_VACIOS, aParametros, desdeUrl, hayFiltros, type FiltrosPostulantes,
} from "@/components/dashboard/postulantes/filtros";
import { usePostulantes } from "@/components/dashboard/postulantes/usePostulantes";
import PanelEstadisticas from "@/components/stats/PanelEstadisticas";
import Paginacion from "@/components/ui/Paginacion";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import {
  APP_STATUS_LABEL, CANDIDATE_GENDER_LABEL, CANDIDATE_AVAILABILITY_LABEL,
  type Application, type ApplicantStats, type CandidateFullProfile,
  type CompanyProfile, type JobPosting,
} from "../types";

// `useSearchParams` necesita un <Suspense> alrededor (Next 16): sin él, la página entera deja
// de prerenderizarse.
export default function CompanyPostulacionesPage() {
  return (
    <Suspense fallback={null}>
      <Postulaciones />
    </Suspense>
  );
}

function Postulaciones() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [zonas, setZonas] = useState<{ id: string; name: string }[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  // La búsqueda y los filtros arrancan de la URL y se escriben en ella: volver atrás desde otra
  // pantalla, recargar o compartir el link deja todo como estaba. Era el "tengo que volver a
  // buscar el CV" del pedido de Eugenia (22/10/2026).
  const [seleccionManual, setSeleccionManual] = useState<string>(() => searchParams.get("busqueda") ?? "");
  const [filtros, setFiltros] = useState<FiltrosPostulantes>(() => desdeUrl(new URLSearchParams(searchParams.toString())));
  const [stats, setStats] = useState<Record<string, ApplicantStats | null>>({});
  const [showStats, setShowStats] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateFullProfile | null>(null);
  const [abiertaDesde, setAbiertaDesde] = useState<string | null>(null);
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
  const postulaciones = usePostulantes<Application>(
    "empresa", selectedJobId && isVerified ? selectedJobId : null, filtros,
  );

  function escribirUrl(jobId: string, f: FiltrosPostulantes) {
    const params = new URLSearchParams();
    if (jobId) params.set("busqueda", jobId);
    for (const [clave, valor] of Object.entries(aParametros(f))) params.set(clave, String(valor));
    const qs = params.toString();
    router.replace(`/dashboard/company/postulaciones${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function cambiarFiltros(f: FiltrosPostulantes) {
    setFiltros(f);
    escribirUrl(selectedJobId, f);
  }

  function selectJob(jobId: string) {
    setSeleccionManual(jobId);
    // Al cambiar de búsqueda se va el texto y los chips (son de esa búsqueda); el orden queda.
    const f = { ...FILTROS_VACIOS, orden: filtros.orden };
    setFiltros(f);
    escribirUrl(jobId, f);
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

  async function handleAppStatus(app: Application, status: string) {
    try {
      await api.patch(`/me/company/applications/${app.id}/status`, { status });
      const vistaAhora = !app.seen_at && status !== "new";
      postulaciones.actualizarItems(prev => prev.map(a => (
        a.id === app.id ? { ...a, status, seen_at: vistaAhora ? new Date().toISOString() : a.seen_at } : a
      )));
      postulaciones.retocarConteos(c => ({
        ...c,
        by_status: {
          ...c.by_status,
          [app.status]: Math.max(0, (c.by_status[app.status] ?? 0) - 1),
          [status]: (c.by_status[status] ?? 0) + 1,
        },
        unseen: vistaAhora ? Math.max(0, c.unseen - 1) : c.unseen,
      }));
    } catch {
      toast("Error al actualizar estado");
    }
  }

  async function alternarEstrella(app: Application) {
    if (!(await postulaciones.alternarEstrella(app))) toast("No se pudo guardar la estrella");
  }

  async function openCandidateProfile(app: Application) {
    setLoadingCandidate(true);
    setCandidateProfile(null);
    setAbiertaDesde(app.id);
    try {
      // `application_id`: abrir la ficha marca esta postulación como vista (sin aviso).
      const r = await api.get(`/me/company/candidates/${app.candidate_id}`, { params: { application_id: app.id } });
      setCandidateProfile(r.data);
      postulaciones.marcarVista(app.id);
    } catch {
      toast("Error al cargar el perfil del candidato");
    } finally {
      setLoadingCandidate(false);
    }
  }

  const jobTitle = jobs.find(j => j.id === selectedJobId)?.title ?? "nuestra búsqueda";

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
            <BuscadorPostulantes
              key={selectedJobId}
              filtros={filtros}
              onCambiar={cambiarFiltros}
              conteos={postulaciones.conteos}
              resultado={postulaciones.cargando ? null : postulaciones.total}
              estados={APP_STATUS_LABEL}
              zonas={zonas}
              generos={CANDIDATE_GENDER_LABEL}
              disponibilidades={CANDIDATE_AVAILABILITY_LABEL}
            />
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
                {hayFiltros(filtros) ? "Ningún postulante coincide con estos filtros." : "Sin postulaciones aún para esta búsqueda."}
              </div>
            ) : (
              <div className="divide-y divide-[#DDE3EC]">
                {postulaciones.items.map(app => (
                  <div key={app.id} className="px-4 sm:px-6 py-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <BotonEstrella
                        marcada={!!app.starred_at}
                        onClick={() => alternarEstrella(app)}
                        quienLaVe="Sólo la ve tu empresa."
                      />
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
                        <p className="text-sm font-bold text-[#1C2230] flex items-center gap-1.5">
                          {app.candidate ? `${app.candidate.first_name} ${app.candidate.last_name}` : "Candidato"}
                          {!app.seen_at && (
                            <span className="text-[10px] font-bold text-[#1E8EA3] bg-[#E6F4F7] px-1.5 py-0.5 rounded-full">Sin ver</span>
                          )}
                        </p>
                        <p className="text-xs text-[#64748B]">Postuló el {new Date(app.created_at).toLocaleDateString("es-AR")}</p>
                        {app.match && <p className="text-xs text-[#1C2230] mt-0.5 truncate max-w-md">{app.match}</p>}
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
                        <WhatsAppButton
                          size="xs"
                          phone={app.candidate.phone}
                          message={`Hola ${app.candidate.first_name}, te escribo por tu postulación a "${jobTitle}" en BBJobs.`}
                        />
                      )}
                      {app.candidate && (
                        <button
                          onClick={() => openCandidateProfile(app)}
                          className="text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#E6F4F7] transition-colors"
                        >
                          <UserCircleIcon className="w-3.5 h-3.5" />
                          Ver perfil
                        </button>
                      )}
                      <select
                        value={app.status}
                        onChange={e => handleAppStatus(app, e.target.value)}
                        aria-label="Estado de la postulación"
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
        onClose={() => { setCandidateProfile(null); setAbiertaDesde(null); }}
        cvLinkEndpoint={candidateProfile
          ? `/me/company/candidates/${candidateProfile.id}/cv/link${abiertaDesde ? `?application_id=${abiertaDesde}` : ""}`
          : undefined}
      />
    </div>
  );
}
