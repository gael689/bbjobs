"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { abrirCv } from "@/lib/cv";
import {
  DocumentTextIcon, FunnelIcon, UserCircleIcon,
} from "@heroicons/react/24/outline";
import ProfileCompletionRing from "@/components/ui/ProfileCompletionRing";
import CandidateProfileModal from "@/components/dashboard/CandidateProfileModal";
import {
  CANDIDATE_GENDER_LABEL, CANDIDATE_AVAILABILITY_LABEL, EDUCATION_LEVEL_LABEL,
  EMPTY_CANDIDATE_FILTERS,
  type Candidate, type CandidateFilters, type CandidateFullProfile, type CandidateActivityItem,
} from "../types";

interface Zone {
  id: string;
  name: string;
}

export default function AdminCandidatosPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_CANDIDATE_FILTERS);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CandidateFullProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [activity, setActivity] = useState<CandidateActivityItem[]>([]);

  useEffect(() => {
    api.get("/catalogs/zones").then(r => setZones(r.data)).catch(() => {});
    loadCandidates(EMPTY_CANDIDATE_FILTERS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function buildParams(f: CandidateFilters) {
    const params: Record<string, string | boolean> = {};
    if (f.q) params.q = f.q;
    if (f.age_min) params.age_min = f.age_min;
    if (f.age_max) params.age_max = f.age_max;
    if (f.gender) params.gender = f.gender;
    if (f.has_own_transport) params.has_own_transport = f.has_own_transport === "true";
    if (f.availability) params.availability = f.availability;
    if (f.immediate_availability) params.immediate_availability = true;
    if (f.zone_id) params.zone_id = f.zone_id;
    if (f.has_cv) params.has_cv = f.has_cv === "true";
    if (f.education_level) params.education_level = f.education_level;
    return params;
  }

  function loadCandidates(f: CandidateFilters) {
    setLoading(true);
    api.get("/admin/candidates", { params: buildParams(f) })
      .then(r => setCandidates(r.data))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    loadCandidates(filters);
  }

  function clearFilters() {
    setFilters(EMPTY_CANDIDATE_FILTERS);
    loadCandidates(EMPTY_CANDIDATE_FILTERS);
  }

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => v !== EMPTY_CANDIDATE_FILTERS[k as keyof CandidateFilters]);

  async function openProfile(id: string) {
    setLoadingProfile(true);
    setProfile(null);
    setActivity([]);
    try {
      const r = await api.get(`/admin/candidates/${id}`);
      setProfile(r.data);
    } catch {
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
    api.get(`/admin/candidates/${id}/activity`).then(r => setActivity(r.data)).catch(() => {});
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Candidatos</h1>
      <p className="text-[#64748B] text-sm mb-6">Candidatos registrados en la plataforma.</p>

      {candidates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-[#DDE3EC] rounded-xl px-4 py-3">
            <p className="text-lg font-display font-extrabold text-[#1C2230]">{candidates.length}</p>
            <p className="text-[11px] text-[#64748B]">En esta vista</p>
          </div>
          <div className="bg-[#E6F4F7] border border-[#9ED4DF]/50 rounded-xl px-4 py-3">
            <p className="text-lg font-display font-extrabold text-[#187B8E]">
              {candidates.filter(c => !!c.cv_file_url).length}
            </p>
            <p className="text-[11px] text-[#187B8E]/80">Con CV cargado</p>
          </div>
          <div className="bg-[#F7EFE9] border border-[#D4B7A2]/40 rounded-xl px-4 py-3">
            <p className="text-lg font-display font-extrabold text-[#B98F72]">
              {Math.round(candidates.reduce((s, c) => s + c.completion_percent, 0) / candidates.length)}%
            </p>
            <p className="text-[11px] text-[#B98F72]/90">Perfil completo prom.</p>
          </div>
        </div>
      )}

      <form onSubmit={applyFilters} className="bg-white border border-[#DDE3EC] rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <FunnelIcon className="w-4 h-4 text-[#1E8EA3]" />
          <span className="text-sm font-bold text-[#1C2230]">Filtrar candidatos</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <input
            placeholder="Nombre..."
            value={filters.q}
            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
            className="col-span-2 border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
          />
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
            onChange={e => setFilters(f => ({ ...f, gender: e.target.value as CandidateFilters["gender"] }))}
            className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
          >
            <option value="">Sexo (todos)</option>
            {Object.entries(CANDIDATE_GENDER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select
            value={filters.has_own_transport}
            onChange={e => setFilters(f => ({ ...f, has_own_transport: e.target.value as CandidateFilters["has_own_transport"] }))}
            className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
          >
            <option value="">Movilidad (todas)</option>
            <option value="true">Con movilidad</option>
            <option value="false">Sin movilidad</option>
          </select>
          <select
            value={filters.availability}
            onChange={e => setFilters(f => ({ ...f, availability: e.target.value as CandidateFilters["availability"] }))}
            className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
          >
            <option value="">Disponibilidad (todas)</option>
            {Object.entries(CANDIDATE_AVAILABILITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select
            value={filters.zone_id}
            onChange={e => setFilters(f => ({ ...f, zone_id: e.target.value }))}
            className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
          >
            <option value="">Zona (todas)</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select
            value={filters.education_level}
            onChange={e => setFilters(f => ({ ...f, education_level: e.target.value }))}
            className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
          >
            <option value="">Título (todos)</option>
            {Object.entries(EDUCATION_LEVEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select
            value={filters.has_cv}
            onChange={e => setFilters(f => ({ ...f, has_cv: e.target.value as CandidateFilters["has_cv"] }))}
            className="border border-[#DDE3EC] rounded-lg px-2.5 py-1.5 text-xs text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
          >
            <option value="">CV (todos)</option>
            <option value="true">Con CV</option>
            <option value="false">Sin CV</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
            <input
              type="checkbox"
              checked={filters.immediate_availability}
              onChange={e => setFilters(f => ({ ...f, immediate_availability: e.target.checked }))}
              className="w-3.5 h-3.5 accent-[#1E8EA3]"
            />
            Disp. inmediata
          </label>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit" className="text-xs font-bold bg-[#1E8EA3] text-white rounded-lg px-3 py-1.5 hover:bg-[#187B8E] transition-colors">
            Filtrar
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-xs font-bold text-[#64748B] border border-[#DDE3EC] rounded-lg px-3 py-1.5 hover:bg-[#FAFBFD] transition-colors">
              Limpiar
            </button>
          )}
        </div>
      </form>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm divide-y divide-[#DDE3EC]/60">
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">Sin candidatos que coincidan con los filtros.</div>
        ) : (
          candidates.map(c => (
            <div key={c.id} className="px-6 py-4 flex items-center justify-between gap-3 hover:bg-[#FAFBFD] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                {/* Foto + anillo de %: el anillo se mantiene acá (a diferencia del panel de
                    empresa) porque Talency sabe qué mide — ver B4 del plan del 14/08. La
                    foto es lo nuevo, antes no llegaba a ninguna vista aunque ya se subía. */}
                {c.photo_url ? (
                  <img
                    src={c.photo_url}
                    alt={`${c.first_name} ${c.last_name}`}
                    className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#DDE3EC]"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0 text-[#1E8EA3] font-display font-bold text-xs">
                    {c.first_name.slice(0, 1)}{c.last_name.slice(0, 1)}
                  </div>
                )}
                <ProfileCompletionRing percent={c.completion_percent} size={36} strokeWidth={4} />
                <div className="min-w-0">
                  <p className="font-bold text-[#1C2230] truncate">{c.first_name} {c.last_name}</p>
                  <p className="text-sm text-[#64748B]">{c.phone}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.age != null && <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">{c.age} años</span>}
                    {c.gender && <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">{CANDIDATE_GENDER_LABEL[c.gender]}</span>}
                    {c.highest_education_level && <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">{EDUCATION_LEVEL_LABEL[c.highest_education_level] || c.highest_education_level}</span>}
                    {c.has_own_transport != null && <span className="text-[10px] font-medium bg-[#FAFBFD] text-[#64748B] border border-[#DDE3EC] px-1.5 py-0.5 rounded-full">{c.has_own_transport ? "Con movilidad" : "Sin movilidad"}</span>}
                    {c.immediate_availability && <span className="text-[10px] font-bold bg-[#D4B7A2]/25 text-[#1C2230] border border-[#D4B7A2] px-1.5 py-0.5 rounded-full">Disp. inmediata</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => openProfile(c.id)}
                  className="text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#E6F4F7] transition-colors"
                >
                  <UserCircleIcon className="w-3.5 h-3.5" />
                  Ver perfil
                </button>
                {c.cv_file_url && (
                  <button
                    type="button"
                    onClick={() => abrirCv(`/admin/candidates/${c.id}/cv/link`)}
                    className="text-xs font-bold text-[#1E8EA3] hover:underline flex items-center gap-1">
                    <DocumentTextIcon className="w-3.5 h-3.5" />
                    Ver CV
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <CandidateProfileModal
        profile={profile}
        loading={loadingProfile}
        onClose={() => setProfile(null)}
        activity={activity}
        cvLinkEndpoint={profile ? `/admin/candidates/${profile.id}/cv/link` : undefined}
        showCompletion
      />
    </div>
  );
}

