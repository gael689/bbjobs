"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  BriefcaseIcon,
  SparklesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  CursorArrowRaysIcon,
  ArrowRightIcon,
  FireIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

/* ── tipos ── */
interface Job {
  id: string;
  title: string;
  company_name: string;
  location?: string;
  modality?: string;
  is_featured?: boolean;
  created_at?: string;
}

/* ── helpers ── */
function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
}

/* ── COMPONENTE PRINCIPAL ── */
export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("");

  useEffect(() => {
    api
      .get("/jobs")
      .then((res) => setJobs(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter((j) => {
    const matchSearch =
      !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company_name.toLowerCase().includes(search.toLowerCase());
    const matchModality = !modality || j.modality === modality;
    return matchSearch && matchModality;
  });

  return (
    <>
      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-[#fce4f3] via-[#fdf6fb] to-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="inline-block bg-[#e91e8c]/10 text-[#e91e8c] text-sm font-bold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase">
            🚀 El trabajo que buscás está en Bahía
          </p>
          <h1 className="text-5xl md:text-6xl font-display font-extrabold text-[#1a1a2e] leading-[1.1] mb-6">
            Encontrá tu próximo<br />
            trabajo en{" "}
            <span className="text-[#e91e8c]">Bahía Blanca</span>
          </h1>
          <p className="text-xl text-[#6b7280] max-w-2xl mx-auto mb-10">
            Nos encargamos de reunir y brindarte las búsquedas activas de empleo de la ciudad en un solo lugar, con empresas verificadas.
          </p>

          {/* Buscador hero */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto bg-white border border-[#f0d4e8] rounded-2xl p-2 shadow-md">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#e91e8c]" />
              <input
                type="text"
                placeholder="Puesto, empresa o palabra clave"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-transparent text-[#1a1a2e] placeholder-[#9ca3af] focus:outline-none text-sm font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <a
              href="#avisos"
              className="bg-[#e91e8c] hover:bg-[#c4177a] text-white font-bold rounded-xl px-7 py-3 text-sm transition-colors shrink-0"
            >
              Buscar empleos
            </a>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Link
              href="/register?type=candidate"
              className="inline-flex items-center gap-2 bg-white border-2 border-[#e91e8c] text-[#e91e8c] font-bold rounded-full px-6 py-2.5 text-sm hover:bg-[#fce4f3] transition-colors"
            >
              Subir mi CV
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
            <Link
              href="/register?type=company"
              className="inline-flex items-center gap-2 bg-[#e91e8c] text-white font-bold rounded-full px-6 py-2.5 text-sm hover:bg-[#c4177a] transition-colors shadow-sm"
            >
              Publicar búsqueda
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          AVISOS ACTIVOS + FILTROS
      ══════════════════════════════════════ */}
      <section id="avisos" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Listado ── */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-[#1a1a2e]">Últimos avisos</h2>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-[#6b7280] font-medium">
                  <span className="flex items-center gap-1">
                    <FireIcon className="w-4 h-4 text-[#e91e8c]" />
                    {filtered.filter(j => {
                      const d = new Date(j.created_at || "");
                      return !isNaN(d.getTime()) && Date.now() - d.getTime() < 259200000;
                    }).length} recientes
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckBadgeIcon className="w-4 h-4 text-emerald-500" />
                    {filtered.length} activos
                  </span>
                </div>
              </div>
              <select
                className="text-sm font-semibold bg-white border border-[#f0d4e8] rounded-lg px-3 py-2 text-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/20"
                value={modality}
                onChange={e => setModality(e.target.value)}
              >
                <option value="">Todas las modalidades</option>
                <option value="Remoto">Remoto</option>
                <option value="Híbrido">Híbrido</option>
                <option value="Presencial">Presencial</option>
              </select>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse h-28 bg-white rounded-2xl border border-[#f0d4e8]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-[#f0d4e8] rounded-2xl p-16 text-center">
                <BriefcaseIcon className="w-12 h-12 text-[#f0d4e8] mx-auto mb-4" />
                <p className="font-semibold text-[#1a1a2e] mb-1">Sin resultados</p>
                <p className="text-sm text-[#6b7280]">No hay búsquedas activas que coincidan.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map(job => (
                  <div
                    key={job.id}
                    className="group bg-white border border-[#f0d4e8] hover:border-[#e91e8c]/40 hover:shadow-md rounded-2xl p-5 transition-all flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    {/* Logo empresa placeholder */}
                    <div className="w-12 h-12 rounded-xl bg-[#fce4f3] flex items-center justify-center shrink-0 text-[#e91e8c] font-display font-extrabold text-lg">
                      {job.company_name?.[0] || "?"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-lg font-display font-bold text-[#1a1a2e] group-hover:text-[#e91e8c] transition-colors line-clamp-1"
                      >
                        {job.title}
                      </Link>
                      <p className="text-sm text-[#6b7280] font-medium mt-0.5">{job.company_name}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {job.location && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-[#6b7280] px-2.5 py-1 rounded-full">
                            <MapPinIcon className="w-3.5 h-3.5" />
                            {job.location}
                          </span>
                        )}
                        {job.modality && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-[#6b7280] px-2.5 py-1 rounded-full">
                            <BriefcaseIcon className="w-3.5 h-3.5" />
                            {job.modality}
                          </span>
                        )}
                        {job.is_featured && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-[#fce4f3] text-[#e91e8c] px-2.5 py-1 rounded-full border border-[#f0d4e8]">
                            <FireIcon className="w-3.5 h-3.5" />
                            Destacado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {job.created_at && (
                        <span className="text-xs text-[#6b7280] font-medium">{timeAgo(job.created_at)}</span>
                      )}
                      <Link
                        href={`/jobs/${job.id}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-[#e91e8c] hover:text-[#c4177a] transition-colors"
                      >
                        Ver aviso <ChevronRightIcon className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="w-full lg:w-72 shrink-0 space-y-6">
            {/* Buscador sidebar */}
            <div className="bg-white border border-[#f0d4e8] rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6b7280] mb-3">Buscar</p>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#e91e8c]" />
                <input
                  type="text"
                  placeholder="Puesto o empresa"
                  className="w-full pl-9 pr-3 py-2.5 border border-[#f0d4e8] rounded-xl text-sm text-[#1a1a2e] bg-[#fdf6fb] focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Empresas verificadas CTA */}
            <div className="bg-[#fce4f3] border border-[#f0d4e8] rounded-2xl p-5">
              <ShieldCheckIcon className="w-8 h-8 text-[#e91e8c] mb-3" />
              <h3 className="font-display font-bold text-[#1a1a2e] mb-1">Empresas verificadas</h3>
              <p className="text-xs text-[#6b7280] mb-4">
                Todas las empresas en BBJobs son revisadas y aprobadas por el equipo de Talency.
              </p>
              <Link
                href="/register?type=company"
                className="block text-center bg-[#e91e8c] text-white text-sm font-bold rounded-xl py-2.5 hover:bg-[#c4177a] transition-colors"
              >
                Publicar mi búsqueda
              </Link>
            </div>

            {/* Stats */}
            <div className="bg-white border border-[#f0d4e8] rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6b7280] mb-4">Actividad</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#6b7280] font-medium">Búsquedas activas</span>
                  <span className="font-display font-bold text-[#1a1a2e]">{jobs.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#6b7280] font-medium">Destacadas</span>
                  <span className="font-display font-bold text-[#e91e8c]">{jobs.filter(j => j.is_featured).length}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ══════════════════════════════════════
          SECCIÓN EMPRESAS
      ══════════════════════════════════════ */}
      <section className="bg-white border-t border-[#f0d4e8] py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-[#e91e8c] font-bold text-sm uppercase tracking-wider mb-4">Para empresas</p>
              <h2 className="text-4xl font-display font-extrabold text-[#1a1a2e] leading-tight mb-6">
                Publicá tu primera búsqueda —<br />
                <span className="text-[#e91e8c]">es gratis</span>
              </h2>
              <p className="text-[#6b7280] text-lg mb-8">
                Accedé a los mejores perfiles de Bahía Blanca y la región. Nuestro equipo verifica cada empresa para garantizar un ecosistema seguro y confiable.
              </p>
              <div className="space-y-4 mb-10">
                {[
                  "Publicación de búsquedas en minutos",
                  "Candidatos pre-filtrados con IA (próximamente)",
                  "Acceso a resultados de tests psicométricos",
                  "Panel de gestión de postulaciones centralizado",
                  "Garantía de empresas verificadas por Talency",
                ].map(item => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#fce4f3] flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-[#e91e8c]" />
                    </div>
                    <span className="text-[#1a1a2e] font-medium">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/register?type=company"
                  className="inline-flex items-center gap-2 bg-[#e91e8c] text-white font-bold rounded-full px-7 py-3 hover:bg-[#c4177a] transition-colors shadow-sm"
                >
                  Publicar mi primera búsqueda
                  <ArrowRightIcon className="w-4 h-4" />
                </Link>
                <Link
                  href="/planes"
                  className="inline-flex items-center gap-2 border-2 border-[#e91e8c] text-[#e91e8c] font-bold rounded-full px-7 py-3 hover:bg-[#fce4f3] transition-colors"
                >
                  Ver planes
                </Link>
              </div>
            </div>

            {/* Tarjetas feature */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: ShieldCheckIcon, title: "Empresas verificadas", desc: "Talency revisa y aprueba cada empresa antes de que publique." },
                { icon: CursorArrowRaysIcon, title: "Postulación 1-click", desc: "Los candidatos postulan sin salir de la plataforma." },
                { icon: ChartBarIcon, title: "Observatorio laboral", desc: "Datos del mercado laboral bahiense en tiempo real." },
                { icon: SparklesIcon, title: "IA a futuro", desc: "Pronto: matching automático de perfiles con IA Gemini." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-[#fdf6fb] border border-[#f0d4e8] rounded-2xl p-5 hover:border-[#e91e8c]/30 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 bg-[#fce4f3] rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#e91e8c]" />
                  </div>
                  <h3 className="font-display font-bold text-[#1a1a2e] text-sm mb-1">{title}</h3>
                  <p className="text-xs text-[#6b7280] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          SECCIÓN CANDIDATOS
      ══════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-[#fce4f3] to-[#fdf6fb] py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#e91e8c] font-bold text-sm uppercase tracking-wider mb-4">Para candidatos</p>
          <h2 className="text-4xl font-display font-extrabold text-[#1a1a2e] leading-tight mb-6">
            Subí tu CV en 5 minutos<br />y ya estás dentro
          </h2>
          <p className="text-[#6b7280] text-lg mb-10 max-w-2xl mx-auto">
            Tu perfil queda privado y solo lo ven las empresas a las que vos decidís postularte. Postulación con un click, sin repetir tus datos.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {["CV online privado", "Postulación 1-click", "Tests psicométricos", "Alertas de empleos", "Datos del mercado"].map(f => (
              <span key={f} className="bg-white border border-[#f0d4e8] text-[#1a1a2e] font-semibold text-sm px-4 py-2 rounded-full">
                ✓ {f}
              </span>
            ))}
          </div>
          <Link
            href="/register?type=candidate"
            className="inline-flex items-center gap-2 bg-[#e91e8c] text-white font-bold rounded-full px-8 py-4 text-lg hover:bg-[#c4177a] transition-colors shadow-md"
          >
            Subir mi CV — es gratis
            <ArrowRightIcon className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════
          BANNER TALENCY
      ══════════════════════════════════════ */}
      <section className="bg-[#1a1a2e] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#e91e8c] font-bold text-sm uppercase tracking-wider mb-4">Powered by Talency</p>
          <h2 className="text-3xl font-display font-extrabold text-white mb-4">
            ¿Querés que nos encarguemos de todo?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            El equipo de Talency puede gestionar tu búsqueda de principio a fin. Selección, entrevistas, evaluaciones psicométricas y presentación de candidatos.
          </p>
          <a
            href="https://talency.com.ar"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#e91e8c] text-white font-bold rounded-full px-8 py-3.5 hover:bg-[#c4177a] transition-colors"
          >
            Hablar con Talency
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
      </section>
    </>
  );
}
