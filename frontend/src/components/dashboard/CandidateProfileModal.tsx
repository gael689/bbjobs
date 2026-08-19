"use client";

import { useState } from "react";
import {
  XMarkIcon, BriefcaseIcon, AcademicCapIcon, WrenchScrewdriverIcon,
  LanguageIcon, ArrowDownTrayIcon, ClockIcon, UserCircleIcon, EyeIcon,
} from "@heroicons/react/24/outline";
import { abrirCv } from "@/lib/cv";

type Gender = "masculino" | "femenino" | "otro" | "no_declara";
type Availability = "full_time" | "part_time" | "ambos";

const GENDER_LABEL: Record<Gender, string> = {
  masculino: "Masculino", femenino: "Femenino", otro: "Otro", no_declara: "Prefiero no decirlo",
};
/** Cómo terminó cada estudio. Reemplazó al "en curso" sí/no en agosto/2026. */
const ESTADO_EDU: Record<string, string> = {
  graduado: "Graduado", en_curso: "En curso", abandonado: "Abandonado",
};

const AVAILABILITY_LABEL: Record<Availability, string> = {
  full_time: "Full-time", part_time: "Part-time", ambos: "Full-time o part-time",
};

export interface CandidateProfileModalData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  photo_url?: string;
  summary?: string;
  cv_file_url?: string;
  age?: number;
  gender?: Gender;
  has_own_transport?: boolean;
  availability?: Availability;
  immediate_availability?: boolean;
  completion_percent: number;
  accepts_remote: boolean;
  accepts_hybrid: boolean;
  accepts_onsite: boolean;
  experience: { company_name: string; role_title: string; start_date: string; end_date?: string; description?: string }[];
  education: { institution: string; degree: string; level: string; start_date: string; end_date?: string; status: string }[];
  skills: { skill_name: string; category: "soft" | "technical" }[];
  other_skill?: string | null;
  languages: { language_name: string; level: string }[];
}

export interface CandidateProfileActivityItem {
  id: string;
  summary: string;
  created_at: string;
}

interface Props {
  profile: CandidateProfileModalData | null;
  loading: boolean;
  onClose: () => void;
  activity?: CandidateProfileActivityItem[];
  /** Endpoint del link firmado al CV — cambia según quién mira (empresa o admin). Sin esto el
   *  botón no se muestra: la URL cruda de Cloudinary da 401 y no sirve como link directo. */
  cvLinkEndpoint?: string;
  /** Mostrar el % de perfil completo. **Sólo para el panel de admin.**
   *  A la empresa no se le muestra: lo lee como "% de ajuste al puesto" cuando en realidad
   *  mide cuánto cargó el candidato de su propio perfil, y termina descartando buenos
   *  candidatos con el perfil a medio llenar (pedido de Eugenia, agosto/2026). */
  showCompletion?: boolean;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("es-AR", { month: "short", year: "numeric" });
}

export default function CandidateProfileModal({ profile, loading, onClose, activity = [], cvLinkEndpoint, showCompletion = false }: Props) {
  const [cvError, setCvError] = useState(false);

  if (!profile && !loading) return null;

  const hasContent = profile && (
    profile.summary || profile.experience.length > 0 || profile.education.length > 0 || profile.skills.length > 0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#DDE3EC] px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <h2 className="text-lg font-display font-bold text-[#1C2230]">Perfil del candidato</h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#1C2230] transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : profile && (
          <div className="p-6 sm:p-8">
            {/* Identity bar — full width */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-5 pb-6 border-b border-[#DDE3EC]">
              {profile.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt={`${profile.first_name} ${profile.last_name}`}
                  className="w-16 h-16 rounded-full object-cover shrink-0 border border-[#DDE3EC]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#E6F4F7] flex items-center justify-center shrink-0 text-[#1E8EA3] font-display font-bold text-lg">
                  {profile.first_name.slice(0, 1).toUpperCase()}{profile.last_name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-2xl font-display font-bold text-[#1C2230]">{profile.first_name} {profile.last_name}</h3>
                <p className="text-sm text-[#64748B] mt-0.5">{profile.phone}</p>
                {showCompletion && profile.completion_percent < 100 && (
                  <p className="text-xs text-[#64748B] mt-1">Perfil {profile.completion_percent}% completo</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {profile.accepts_onsite && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Presencial</span>}
                  {profile.accepts_remote && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Remoto</span>}
                  {profile.accepts_hybrid && <span className="text-xs font-medium bg-[#E6F4F7] text-[#1E8EA3] px-2 py-0.5 rounded-full">Híbrido</span>}
                  {profile.age != null && <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2 py-0.5 rounded-full">{profile.age} años</span>}
                  {profile.gender && <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2 py-0.5 rounded-full">{GENDER_LABEL[profile.gender]}</span>}
                  {profile.has_own_transport != null && (
                    <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2 py-0.5 rounded-full">
                      {profile.has_own_transport ? "Con movilidad propia" : "Sin movilidad propia"}
                    </span>
                  )}
                  {profile.availability && <span className="text-xs font-medium bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-2 py-0.5 rounded-full">{AVAILABILITY_LABEL[profile.availability]}</span>}
                  {profile.immediate_availability && <span className="text-xs font-bold bg-[#D4B7A2]/25 text-[#1C2230] border border-[#D4B7A2] px-2 py-0.5 rounded-full">Disponibilidad inmediata</span>}
                </div>
              </div>
              {profile.cv_file_url && cvLinkEndpoint && (
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCvError(false);
                        abrirCv(cvLinkEndpoint).catch(() => setCvError(true));
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#1E8EA3] border border-[#9ED4DF] bg-[#E6F4F7] hover:bg-[#D5EBF1] px-4 py-2.5 rounded-lg transition-colors"
                    >
                      <EyeIcon className="w-4 h-4" />
                      Ver CV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCvError(false);
                        abrirCv(cvLinkEndpoint, { descargar: true }).catch(() => setCvError(true));
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] px-4 py-2.5 rounded-lg transition-colors"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Descargar CV
                    </button>
                  </div>
                  {cvError && <span className="text-[11px] text-red-600">No pudimos abrir el CV. Probá de nuevo.</span>}
                </div>
              )}
            </div>

            {!hasContent ? (
              <div className="py-10 text-center text-sm text-[#64748B]">
                <UserCircleIcon className="w-10 h-10 mx-auto mb-2 text-[#DDE3EC]" />
                El candidato aún no completó su perfil.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 mt-6">
                {/* Left column */}
                <div className="space-y-6">
                  {profile.summary && (
                    <div>
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Sobre el candidato</p>
                      <p className="text-sm text-[#1C2230] leading-relaxed bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4">{profile.summary}</p>
                    </div>
                  )}

                  {profile.experience.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <BriefcaseIcon className="w-4 h-4 text-[#1E8EA3]" />
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Experiencia</p>
                      </div>
                      <div className="space-y-3">
                        {profile.experience.map((exp, i) => (
                          <div key={i} className="border border-[#DDE3EC] rounded-xl p-4">
                            <p className="font-bold text-sm text-[#1C2230]">{exp.role_title}</p>
                            <p className="text-sm text-[#1E8EA3] font-medium">{exp.company_name}</p>
                            <p className="text-xs text-[#64748B] mt-0.5">
                              {fmtDate(exp.start_date)} — {exp.end_date ? fmtDate(exp.end_date) : "Actualidad"}
                            </p>
                            {exp.description && <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{exp.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile.education.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AcademicCapIcon className="w-4 h-4 text-[#1E8EA3]" />
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Educación</p>
                      </div>
                      <div className="space-y-3">
                        {profile.education.map((edu, i) => (
                          <div key={i} className="border border-[#DDE3EC] rounded-xl p-4">
                            <p className="font-bold text-sm text-[#1C2230]">{edu.degree}</p>
                            <p className="text-sm text-[#1E8EA3] font-medium">{edu.institution}</p>
                            <p className="text-xs text-[#64748B] mt-0.5 capitalize">
                              {edu.level} · {ESTADO_EDU[edu.status] || edu.status}{edu.end_date ? ` · ${fmtDate(edu.end_date)}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  {(profile.skills.length > 0 || profile.other_skill) && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <WrenchScrewdriverIcon className="w-4 h-4 text-[#1E8EA3]" />
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Habilidades</p>
                      </div>
                      {([
                        { key: "technical", label: "Técnicas" },
                        { key: "soft", label: "Blandas" },
                      ] as const).map(({ key, label }) => {
                        const delGrupo = profile.skills.filter(sk => sk.category === key);
                        if (delGrupo.length === 0) return null;
                        return (
                          <div key={key} className="mb-3 last:mb-0">
                            <p className="text-[11px] font-bold text-[#94A3B8] mb-1.5">{label}</p>
                            <div className="flex flex-wrap gap-2">
                              {delGrupo.map((sk, i) => (
                                <span key={i} className="text-xs font-semibold bg-[#E6F4F7] text-[#1C2230] border border-[#9ED4DF] px-3 py-1.5 rounded-full">
                                  {sk.skill_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {profile.other_skill && (
                        <p className="text-xs text-[#64748B] mt-2">
                          Otra habilidad: <span className="text-[#1C2230] font-medium">{profile.other_skill}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {profile.languages.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <LanguageIcon className="w-4 h-4 text-[#1E8EA3]" />
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Idiomas</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {profile.languages.map((lang, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#FAFBFD] text-[#1C2230] border border-[#DDE3EC] px-3 py-1.5 rounded-full">
                            {lang.language_name}<span className="text-[#64748B] font-normal">· {lang.level}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activity.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <ClockIcon className="w-4 h-4 text-[#1E8EA3]" />
                        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Actividad reciente</p>
                      </div>
                      <div className="space-y-2">
                        {activity.map(item => (
                          <div key={item.id} className="flex items-start gap-2 text-xs">
                            <span className="text-[#94A3B8] shrink-0 mt-0.5">
                              {new Date(item.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                            </span>
                            <span className="text-[#1C2230]">{item.summary}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
