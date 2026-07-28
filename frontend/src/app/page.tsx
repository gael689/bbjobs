"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import NeuralCanvas from "@/components/ui/NeuralCanvas";
import VerifiedBadge from "@/components/jobs/VerifiedBadge";
import JobPreviewPanel, { type PreviewJob } from "@/components/jobs/JobPreviewPanel";
import {
  MagnifyingGlassIcon,
  BriefcaseIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  CursorArrowRaysIcon,
  ArrowRightIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  UserGroupIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

interface Job extends PreviewJob {
  is_featured?: boolean;
}

interface JobSuggestion {
  label: string;
  type: "title" | "company";
}

interface LandingStat {
  id: string;
  icon: string;
  value: string;
  label: string;
  sort_order: number;
  visible: boolean;
}

const ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  BriefcaseIcon: BriefcaseIcon,
  ShieldCheckIcon: ShieldCheckIcon,
  UserGroupIcon: UserGroupIcon,
  SparklesIcon: SparklesIcon,
  ChartBarIcon: ChartBarIcon,
  MagnifyingGlassIcon: MagnifyingGlassIcon,
  CursorArrowRaysIcon: CursorArrowRaysIcon,
  CheckBadgeIcon: CheckBadgeIcon,
  MapPinIcon: MapPinIcon,
};

function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
}

/* ─────────────────────────────────────
   Badge de IA animado
───────────────────────────────────── */
function AIBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E8EA3] bg-[#E6F4F7] border border-[#9ED4DF] px-2.5 py-1 rounded-full">
      <span className="ai-dot w-1.5 h-1.5 rounded-full bg-[#1E8EA3] inline-block" />
      {label}
    </span>
  );
}

/* ─────────────────────────────────────
   HOMEPAGE
───────────────────────────────────── */
export default function Home() {
  const router = useRouter();

  // Vista previa de "Últimos avisos" — ya no precarga todo, trae una página chica.
  const [previewJobs, setPreviewJobs] = useState<Job[]>([]);
  const [totalActive, setTotalActive] = useState(0);
  const [previewModality, setPreviewModality] = useState("");
  const [resolvedModality, setResolvedModality] = useState<string | null>(null);
  const loading = resolvedModality !== previewModality;
  const [previewJob, setPreviewJob] = useState<Job | null>(null);
  const [landingStats, setLandingStats] = useState<LandingStat[]>([]);

  // Si venimos de vuelta de /login?redirect_url=/?job=... reabrimos la misma vista previa.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const jobId = new URLSearchParams(window.location.search).get("job");
    if (!jobId) return;
    api.get(`/jobs/${jobId}`).then(r => setPreviewJob(r.data)).catch(() => {});
  }, []);

  function setJobParam(id: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("job", id); else params.delete("job");
    const qs = params.toString();
    router.replace(`/${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function openPreview(job: Job) {
    setPreviewJob(job);
    setJobParam(job.id);
  }

  function closePreview() {
    setPreviewJob(null);
    setJobParam(null);
  }

  // Buscador del hero — ahora real: sugiere contra el backend y navega a /empleos.
  const [heroQuery, setHeroQuery] = useState("");
  const [suggestions, setSuggestions] = useState<JobSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const heroBoxRef = useRef<HTMLFormElement>(null);

  const trimmedHeroQuery = heroQuery.trim();
  const visibleSuggestions = trimmedHeroQuery.length < 2 ? [] : suggestions;

  useEffect(() => {
    // `ignore` evita que una respuesta vieja pise el resultado si la modalidad cambió
    // de nuevo antes de que la primera request terminara.
    let ignore = false;
    const params = new URLSearchParams({ page: "1", page_size: "6" });
    if (previewModality) params.set("modality", previewModality);
    api.get(`/jobs?${params.toString()}`)
      .then(r => {
        if (ignore) return;
        setPreviewJobs(r.data.items);
        setTotalActive(r.data.total);
      })
      .catch(console.error)
      .finally(() => { if (!ignore) setResolvedModality(previewModality); });
    return () => { ignore = true; };
  }, [previewModality]);

  // Landing stats from admin-configured indicators
  useEffect(() => {
    api.get("/public/landing-stats")
      .then(r => setLandingStats(r.data))
      .catch(() => setLandingStats([]));
  }, []);

  useEffect(() => {
    if (trimmedHeroQuery.length < 2) return;
    let ignore = false;
    const timer = setTimeout(() => {
      api.get(`/jobs/suggest?q=${encodeURIComponent(trimmedHeroQuery)}`)
        .then(r => { if (!ignore) setSuggestions(r.data); })
        .catch(() => { if (!ignore) setSuggestions([]); });
    }, 400);
    return () => { ignore = true; clearTimeout(timer); };
  }, [trimmedHeroQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (heroBoxRef.current && !heroBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToSearch(query: string) {
    const q = query.trim();
    router.push(q ? `/empleos?q=${encodeURIComponent(q)}` : "/empleos");
  }

  function handleHeroSubmit(e: React.FormEvent) {
    e.preventDefault();
    goToSearch(heroQuery);
  }

  return (
    <>
      {/* ══════════════════════════════════
          HERO — Red neuronal + Partículas
      ══════════════════════════════════ */}
      <section className="relative px-4 pt-32 pb-28 overflow-hidden">

        {/* ── Dot-grid de fondo ── */}
        <div className="hero-dot-grid absolute inset-0 pointer-events-none" />

        {/* ── Red neuronal animada (canvas) ── */}
        <div className="absolute inset-0 pointer-events-none">
          <NeuralCanvas className="w-full h-full" />
        </div>

        {/* ── Aurora Sweeping Glow (Roomix style) ── */}
        <div className="hero-aurora" />

        {/* ── Partículas flotantes ── */}
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <div key={n} className={`particle particle-${n}`} />
        ))}

        {/* ── Contenido ── */}
        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Pill IA */}
          <div className="inline-flex items-center gap-2 bg-[#E6F4F7]/80 backdrop-blur-sm text-[#1E8EA3] border border-[#9ED4DF] rounded-full px-4 py-2 text-sm font-bold mb-8 shadow-sm">
            <span className="ai-dot w-2 h-2 rounded-full bg-[#1E8EA3] inline-block" />
            Próximamente: oportunidades recomendadas según tu perfil
          </div>

          <h1 className="font-display font-extrabold text-5xl md:text-[64px] text-[#1C2230] leading-[1.1] tracking-tight mb-6">
            El trabajo que buscás<br />
            está en{" "}
            <span className="text-[#1E8EA3] relative inline-block">
              Bahía Blanca
              <svg className="absolute -bottom-3 left-0 w-full" height="14" viewBox="0 -2 300 14" fill="none" preserveAspectRatio="none">
                <path d="M0 5 Q75 0 150 5 Q225 10 300 5" stroke="#D4B7A2" strokeWidth="3" fill="none" strokeLinecap="round"/>
              </svg>
            </span>
          </h1>
          <p className="text-xl text-[#64748B] max-w-2xl mx-auto mb-10">
            Encontrá oportunidades laborales, postulate de manera simple y gestioná todas tus postulaciones desde un solo lugar.
          </p>

          {/* Buscador hero */}
          <form onSubmit={handleHeroSubmit} className="relative max-w-2xl mx-auto mb-8" ref={heroBoxRef}>
            <div className="flex flex-col sm:flex-row gap-2 bg-white/80 backdrop-blur-sm border border-[#DDE3EC] rounded-2xl p-2 shadow-lg">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E8EA3]" />
                <input
                  type="text"
                  placeholder="Puesto, empresa o palabra clave"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-[#1C2230] placeholder-[#94A3B8] focus:outline-none text-sm font-medium bg-transparent"
                  value={heroQuery}
                  onChange={e => { setHeroQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                />
              </div>
              <button type="submit" className="bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold rounded-xl px-7 py-3 text-sm transition-colors shrink-0">
                Ver empleos
              </button>
            </div>

            {showSuggestions && visibleSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-[#DDE3EC] rounded-2xl shadow-lg overflow-hidden text-left z-20">
                {visibleSuggestions.map((s, i) => (
                  <button
                    key={`${s.type}-${s.label}-${i}`}
                    type="button"
                    onClick={() => { setShowSuggestions(false); goToSearch(s.label); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#FAFBFD] transition-colors text-left"
                  >
                    {s.type === "company" ? (
                      <BriefcaseIcon className="w-4 h-4 text-[#64748B] shrink-0" />
                    ) : (
                      <MagnifyingGlassIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />
                    )}
                    <span className="text-[#1C2230] font-medium truncate">{s.label}</span>
                    {s.type === "company" && <span className="text-xs text-[#94A3B8] ml-auto shrink-0">empresa</span>}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* CTAs secundarios */}
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/register?type=candidate" className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-6 py-2.5 text-sm hover:bg-[#E6F4F7] transition-colors shadow-sm">
              Cargar mi cv <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <Link href="/register?type=company" className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-xl px-6 py-2.5 text-sm hover:bg-[#187B8E] transition-colors shadow-sm">
              Publicar un empleo <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════
          STRIP STATS
      ══════════════════════════════════ */}
      {landingStats.length > 0 && (
        <div className="bg-white border-y border-[#DDE3EC]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 gap-x-4 gap-y-6 justify-items-center sm:flex sm:flex-wrap sm:justify-center sm:gap-10">
            {landingStats.map((stat) => {
              const Icon = ICON_MAP[stat.icon] || BriefcaseIcon;
              return (
                <div key={stat.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#1E8EA3]" />
                  </div>
                  <div>
                    <p className="font-display font-extrabold text-[#1C2230] text-lg leading-none">{stat.value}</p>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════
          AVISOS + SIDEBAR
      ══════════════════════════════════ */}
      <section id="avisos" className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Listado */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display font-bold text-2xl text-[#1C2230]">Últimos avisos</h2>
                <div className="flex items-center gap-4 mt-1 text-sm text-[#64748B] font-medium">
                  <span className="flex items-center gap-1">
                    <CheckBadgeIcon className="w-4 h-4 text-[#1E8EA3]" />
                    {totalActive} activos
                  </span>
                </div>
              </div>
              <select
                className="text-sm font-semibold bg-white border border-[#DDE3EC] rounded-lg px-3 py-2 text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]/20"
                value={previewModality}
                onChange={e => setPreviewModality(e.target.value)}
              >
                <option value="">Todas las modalidades</option>
                <option value="remoto">Remoto</option>
                <option value="híbrido">Híbrido</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="animate-pulse h-28 bg-white rounded-2xl border border-[#DDE3EC]" />)}
              </div>
            ) : previewJobs.length === 0 ? (
              <div className="bg-white border border-[#DDE3EC] rounded-2xl p-16 text-center">
                <BriefcaseIcon className="w-12 h-12 text-[#DDE3EC] mx-auto mb-4" />
                <p className="font-semibold text-[#1C2230] mb-1">Sin resultados</p>
                <p className="text-sm text-[#64748B]">Probá con otra modalidad.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {previewJobs.map(job => (
                  <a
                    key={job.id}
                    href={`/empleos/${job.id}`}
                    onClick={e => { e.preventDefault(); openPreview(job); }}
                    className={`group relative overflow-hidden rounded-2xl p-5 transition-all flex flex-col sm:flex-row sm:items-center gap-4 ${
                      job.is_featured
                        ? "bg-gradient-to-br from-red-50 to-white border-2 border-red-200 hover:border-red-400 hover:shadow-md"
                        : "bg-white border border-[#DDE3EC] hover:border-[#1E8EA3]/40 hover:shadow-sm"
                    }`}
                  >
                    {job.is_featured && (
                      <div className="absolute -right-10 top-4 w-36 rotate-45 bg-red-600 py-1 text-center text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                        Destacado
                      </div>
                    )}
                    {/* Avatar empresa */}
                    <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0 border border-[#9ED4DF] overflow-hidden">
                      {job.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={job.logo_url} alt={job.company_legal_name_snapshot} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="font-display font-extrabold text-[#1E8EA3] text-lg">
                          {job.company_legal_name_snapshot?.[0] || "?"}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-lg text-[#1C2230] group-hover:text-[#1E8EA3] transition-colors line-clamp-1">
                        {job.title}
                      </p>
                      <p className="text-sm text-[#64748B] font-medium mt-0.5 flex items-center flex-wrap gap-x-1.5 gap-y-1">
                        {job.company_legal_name_snapshot}
                        <VerifiedBadge />
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {job.modality && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#F1F5F9] text-[#64748B] px-2.5 py-1 rounded-full">
                            <BriefcaseIcon className="w-3.5 h-3.5" />{job.modality}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {job.published_at && <span className="text-xs text-[#94A3B8] font-medium">{timeAgo(job.published_at)}</span>}
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#1E8EA3] border border-[#9ED4DF] px-3 py-1.5 rounded-full group-hover:bg-[#1E8EA3] group-hover:text-white group-hover:border-[#1E8EA3] transition-all">
                        Postularme <ChevronRightIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {totalActive > previewJobs.length && (
              <Link
                href="/empleos"
                className="mt-6 flex items-center justify-center gap-1.5 w-full bg-white border border-[#DDE3EC] hover:border-[#1E8EA3]/40 text-[#1E8EA3] font-bold text-sm rounded-2xl py-3 transition-colors"
              >
                Ver todos los avisos <ArrowRightIcon className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-[280px] shrink-0 space-y-5">
            {/* IA CTA */}
            <div className="bg-gradient-to-br from-[#E6F4F7] to-[#FAFBFD] border border-[#9ED4DF] rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-[#1E8EA3]/10 rounded-full blur-xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <SparklesIcon className="w-5 h-5 text-[#1E8EA3]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1E8EA3]">Próximamente</span>
                </div>
                <h3 className="font-display font-bold text-[#1C2230] mb-2">Oportunidades para vos</h3>
                <p className="text-xs text-[#64748B] mb-4 leading-relaxed">
                  BBJobs te recomendará búsquedas acordes con tu experiencia, formación e intereses laborales.
                </p>
                <button disabled className="w-full bg-[#1E8EA3]/20 text-[#1E8EA3] text-sm font-bold rounded-xl py-2.5 cursor-not-allowed opacity-70">
                  Quiero recibir novedades
                </button>
              </div>
            </div>

            {/* Verificadas CTA */}
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
              <ShieldCheckIcon className="w-7 h-7 text-[#1E8EA3] mb-3" />
              <h3 className="font-display font-bold text-[#1C2230] mb-1">Empresas verificadas</h3>
              <p className="text-xs text-[#64748B] mb-4 leading-relaxed">
                Cada empresa en BBJobs es revisada y aprobada por el equipo de Talency.
              </p>
              <Link href="/register?type=company" className="block text-center bg-[#1E8EA3] text-white text-sm font-bold rounded-xl py-2.5 hover:bg-[#187B8E] transition-colors">
                Publicar un empleo
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* ══════════════════════════════════
          SECCIÓN EMPRESAS
      ══════════════════════════════════ */}
      <section className="bg-white border-t border-[#DDE3EC] py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <AIBadge label="Para empresas" />
              <h2 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mt-5 mb-6">
                Encontrá el talento que{" "}
                <span className="text-[#1E8EA3]">tu empresa necesita</span>
              </h2>
              <p className="text-[#64748B] text-lg mb-4">
                Publicá tus búsquedas y gestioná todas las postulaciones desde un solo lugar.
              </p>
              <p className="text-sm text-[#64748B] mb-8 bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl px-4 py-3">
                <ShieldCheckIcon className="w-4 h-4 text-[#1E8EA3] inline -mt-0.5 mr-1" />
                Talency revisa cada cuenta empresarial antes de habilitar sus publicaciones para construir un entorno más seguro y confiable.
              </p>
              <div className="space-y-3.5 mb-10">
                {[
                  "Publicación de búsquedas laborales en pocos minutos",
                  "Panel centralizado para gestionar todas las postulaciones",
                  "Herramientas de IA para filtrar y ordenar candidatos según los requisitos del puesto — Próximamente",
                  "Evaluaciones psicométricas opcionales y acceso a resultados — Próximamente",
                  "Verificación de la cuenta empresarial por Talency",
                ].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0 mt-0.5 border border-[#9ED4DF]">
                      <div className="w-2 h-2 rounded-full bg-[#1E8EA3]" />
                    </div>
                    <span className="text-[#1C2230] font-medium">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Link href="/register?type=company" className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-xl px-7 py-3 hover:bg-[#187B8E] transition-colors shadow-sm">
                  Publicar tu búsqueda <ArrowRightIcon className="w-4 h-4" />
                </Link>
                <Link href="/planes" className="inline-flex items-center gap-2 border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-7 py-3 hover:bg-[#E6F4F7] transition-colors">
                  Ver planes
                </Link>
              </div>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: ShieldCheckIcon, title: "Empresas verificadas", desc: "Talency revisa cada cuenta empresarial antes de habilitar la publicación de búsquedas." },
                { icon: CursorArrowRaysIcon, title: "Postulaciones simples y completas", desc: "Los candidatos se postulan utilizando la información de su perfil, sin volver a cargar sus datos en cada búsqueda." },
                { icon: ChartBarIcon, title: "Observatorio laboral", desc: "Indicadores locales generados a partir de las búsquedas publicadas en BBJobs: puestos, rubros, requisitos y rangos salariales." },
                { icon: SparklesIcon, title: "Filtrado inteligente — Próximamente", desc: "Herramientas de IA para filtrar y ordenar candidatos según los requisitos del puesto." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-2xl p-5 hover:border-[#1E8EA3]/30 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 bg-[#E6F4F7] rounded-xl flex items-center justify-center mb-4 border border-[#9ED4DF]">
                    <Icon className="w-5 h-5 text-[#1E8EA3]" />
                  </div>
                  <h3 className="font-display font-bold text-[#1C2230] text-sm mb-1">{title}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          SECCIÓN CANDIDATOS
      ══════════════════════════════════ */}
      <section className="bg-[#FAFBFD] border-t border-[#DDE3EC] py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <AIBadge label="Para candidatos" />
              <h2 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mt-5 mb-6">
                Creá tu perfil laboral{" "}
                <span className="text-[#1E8EA3]">en pocos minutos</span>
              </h2>
              <p className="text-[#64748B] text-lg mb-8">
                Tu información está protegida y vos decidís quién puede verla. Las empresas verificadas podrán acceder a tu perfil cuando te postules y, solo si lo autorizás, también podrán encontrarte en la Base de Talento de BBJobs.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                {["Perfil protegido", "Vos decidís tu visibilidad", "Postulaciones simples", "Alertas de empleos", "Datos del mercado laboral"].map(f => (
                  <span key={f} className="bg-white border border-[#DDE3EC] text-[#1C2230] font-semibold text-sm px-4 py-2 rounded-full shadow-sm">
                    ✓ {f}
                  </span>
                ))}
              </div>
              <Link href="/register?type=candidate" className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-xl px-8 py-4 text-lg hover:bg-[#187B8E] transition-colors shadow-sm">
                Cargar mi cv — es gratis <ArrowRightIcon className="w-5 h-5" />
              </Link>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="relative w-full max-w-xl transform xl:scale-110 z-10">
                <Image
                  src="/candidato-panel.png"
                  alt="Candidato revisando oportunidades laborales en BBJobs"
                  width={700}
                  height={850}
                  className="rounded-2xl shadow-2xl w-full h-auto border-4 border-white"
                  priority={false}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          BANNER TALENCY
      ══════════════════════════════════ */}
      <section className="bg-[#1C2230] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#9ED4DF] font-bold text-sm uppercase tracking-wider mb-4">SELECCIÓN DE PERSONAL POR TALENCY</p>
          <h2 className="font-display font-extrabold text-3xl text-white mb-4">
            ¿Preferís que nos encarguemos de la selección?
          </h2>
          <p className="text-[#94A3B8] mb-8 max-w-xl mx-auto">
            El equipo de Talency puede acompañarte durante todo el proceso: relevamiento del perfil, publicación de la búsqueda, revisión de postulaciones, entrevistas, evaluaciones psicométricas y presentación de candidatos.
          </p>
          <a href="https://talency.com.ar" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-xl px-8 py-3.5 hover:bg-[#187B8E] transition-colors">
            Consultar por el servicio de selección <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
      </section>

      {previewJob && (
        <JobPreviewPanel
          job={previewJob}
          returnPath={`/?job=${previewJob.id}`}
          onClose={closePreview}
        />
      )}
    </>
  );
}
