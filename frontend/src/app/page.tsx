"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import NeuralCanvas from "@/components/ui/NeuralCanvas";
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
  BoltIcon,
} from "@heroicons/react/24/outline";

interface Job {
  id: string;
  title: string;
  company_legal_name_snapshot: string;
  modality?: string;
  is_featured?: boolean;
  published_at?: string;
}

interface JobSuggestion {
  label: string;
  type: "title" | "company";
}

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
  const [loading, setLoading] = useState(true);

  // Buscador del hero — ahora real: sugiere contra el backend y navega a /empleos.
  const [heroQuery, setHeroQuery] = useState("");
  const [suggestions, setSuggestions] = useState<JobSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroBoxRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", page_size: "6" });
    if (previewModality) params.set("modality", previewModality);
    api.get(`/jobs?${params.toString()}`)
      .then(r => {
        setPreviewJobs(r.data.items);
        setTotalActive(r.data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [previewModality]);

  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (heroQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      api.get(`/jobs/suggest?q=${encodeURIComponent(heroQuery.trim())}`)
        .then(r => setSuggestions(r.data))
        .catch(() => setSuggestions([]));
    }, 400);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [heroQuery]);

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
            Próximamente: Matching con IA · Potenciado por Gemini
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
            Reunimos las búsquedas activas de la ciudad en un solo lugar. Empresas verificadas, postulación con un click.
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
                Buscar empleos
              </button>
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-[#DDE3EC] rounded-2xl shadow-lg overflow-hidden text-left z-20">
                {suggestions.map((s, i) => (
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
              Subir mi CV <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <Link href="/register?type=company" className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-xl px-6 py-2.5 text-sm hover:bg-[#187B8E] transition-colors shadow-sm">
              Publicar búsqueda <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════
          STRIP STATS
      ══════════════════════════════════ */}
      <div className="bg-white border-y border-[#DDE3EC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap justify-center gap-10">
          {[
            { icon: BriefcaseIcon, value: `${totalActive}+`, label: "búsquedas activas" },
            { icon: ShieldCheckIcon, value: "100%", label: "empresas verificadas" },
            { icon: UserGroupIcon, value: "Local", label: "Bahía Blanca y región" },
            { icon: SparklesIcon, value: "IA", label: "matching próximamente" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#1E8EA3]" />
              </div>
              <div>
                <p className="font-display font-extrabold text-[#1C2230] text-lg leading-none">{value}</p>
                <p className="text-xs text-[#64748B] font-medium mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

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
                  <div key={job.id} className="group bg-white border border-[#DDE3EC] hover:border-[#1E8EA3]/40 hover:shadow-sm rounded-2xl p-5 transition-all flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Avatar empresa */}
                    <div className="w-12 h-12 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0 font-display font-extrabold text-[#1E8EA3] text-lg border border-[#9ED4DF]">
                      {job.company_legal_name_snapshot?.[0] || "?"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link href={`/empleos/${job.id}`} className="font-display font-bold text-lg text-[#1C2230] group-hover:text-[#1E8EA3] transition-colors line-clamp-1">
                        {job.title}
                      </Link>
                      <p className="text-sm text-[#64748B] font-medium mt-0.5">{job.company_legal_name_snapshot}</p>
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {job.modality && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[#F1F5F9] text-[#64748B] px-2.5 py-1 rounded-full">
                            <BriefcaseIcon className="w-3.5 h-3.5" />{job.modality}
                          </span>
                        )}
                        {job.is_featured && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#F7EFE9] text-[#C4A490] px-2.5 py-1 rounded-full border border-[#D4B7A2]/50">
                            <BoltIcon className="w-3.5 h-3.5" />Destacado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {job.published_at && <span className="text-xs text-[#94A3B8] font-medium">{timeAgo(job.published_at)}</span>}
                      <Link href={`/empleos/${job.id}`} className="inline-flex items-center gap-1 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] transition-colors">
                        Ver aviso <ChevronRightIcon className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
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
                <h3 className="font-display font-bold text-[#1C2230] mb-2">Matching con IA</h3>
                <p className="text-xs text-[#64748B] mb-4 leading-relaxed">
                  Nuestro motor de IA analizará tu perfil y te conectará con las búsquedas más afines automáticamente.
                </p>
                <button disabled className="w-full bg-[#1E8EA3]/20 text-[#1E8EA3] text-sm font-bold rounded-xl py-2.5 cursor-not-allowed opacity-70">
                  Quiero ser notificado
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
                Publicar mi búsqueda
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
                Publicá tu primera búsqueda —{" "}
                <span className="text-[#1E8EA3]">es gratis</span>
              </h2>
              <p className="text-[#64748B] text-lg mb-8">
                Accedé al talento local de Bahía Blanca. Tu empresa será verificada por Talency antes de operar, garantizando un entorno profesional y confiable.
              </p>
              <div className="space-y-3.5 mb-10">
                {[
                  "Publicación de búsquedas en minutos",
                  "Candidatos pre-filtrados · IA a futuro con Gemini",
                  "Acceso a resultados de tests psicométricos",
                  "Panel centralizado de gestión de postulaciones",
                  "Garantía de empresa verificada por Talency",
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
                  Publicar primera búsqueda <ArrowRightIcon className="w-4 h-4" />
                </Link>
                <Link href="/planes" className="inline-flex items-center gap-2 border-2 border-[#1E8EA3] text-[#1E8EA3] font-bold rounded-xl px-7 py-3 hover:bg-[#E6F4F7] transition-colors">
                  Ver planes
                </Link>
              </div>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: ShieldCheckIcon, title: "Empresas verificadas", desc: "Talency revisa y aprueba cada empresa antes de que publique búsquedas." },
                { icon: CursorArrowRaysIcon, title: "Postulación 1-click", desc: "Los candidatos postulan sin repetir datos. Todo centralizado en la plataforma." },
                { icon: ChartBarIcon, title: "Observatorio laboral", desc: "Datos del mercado laboral bahiense: sueldos, rubros y tendencias." },
                { icon: SparklesIcon, title: "IA · Próximamente", desc: "Matching automático de perfiles usando inteligencia artificial con Gemini." },
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
        <div className="max-w-4xl mx-auto text-center">
          <AIBadge label="Para candidatos" />
          <h2 className="font-display font-extrabold text-4xl text-[#1C2230] leading-tight mt-5 mb-6">
            Subí tu CV en 5 minutos<br />y ya estás dentro
          </h2>
          <p className="text-[#64748B] text-lg mb-10 max-w-2xl mx-auto">
            Tu perfil es privado y solo lo ven las empresas a las que decidís postularte. Sin spam, sin intermediarios innecesarios.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {["CV online privado", "Postulación 1-click", "Tests psicométricos", "Alertas de empleos", "Datos del mercado"].map(f => (
              <span key={f} className="bg-white border border-[#DDE3EC] text-[#1C2230] font-semibold text-sm px-4 py-2 rounded-full shadow-sm">
                ✓ {f}
              </span>
            ))}
          </div>
          <Link href="/register?type=candidate" className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-xl px-8 py-4 text-lg hover:bg-[#187B8E] transition-colors shadow-sm">
            Subir mi CV — es gratis <ArrowRightIcon className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════
          BANNER TALENCY
      ══════════════════════════════════ */}
      <section className="bg-[#1C2230] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#9ED4DF] font-bold text-sm uppercase tracking-wider mb-4">Powered by Talency</p>
          <h2 className="font-display font-extrabold text-3xl text-white mb-4">
            ¿Querés que nos encarguemos de todo?
          </h2>
          <p className="text-[#94A3B8] mb-8 max-w-xl mx-auto">
            El equipo de Talency puede gestionar tu búsqueda de principio a fin: selección, entrevistas, evaluaciones psicométricas y presentación de candidatos.
          </p>
          <a href="https://talency.com.ar" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#1E8EA3] text-white font-bold rounded-xl px-8 py-3.5 hover:bg-[#187B8E] transition-colors">
            Hablar con Talency <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
      </section>
    </>
  );
}
