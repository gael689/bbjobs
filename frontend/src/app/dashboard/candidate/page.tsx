"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import {
  MagnifyingGlassIcon, PaperAirplaneIcon, ArrowRightIcon, DocumentTextIcon,
  ShieldCheckIcon, CheckIcon, XMarkIcon, EyeIcon, ClockIcon, BriefcaseIcon,
} from "@heroicons/react/24/outline";
import ProfileCompletionRing from "@/components/ui/ProfileCompletionRing";
import { APP_STATUS, type CandidateProfile, type Application } from "./types";

interface RecentJob {
  id: string;
  title: string;
  company_legal_name_snapshot: string;
  modality?: string;
}

export default function CandidateInicioPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [talentSaving, setTalentSaving] = useState(false);

  useEffect(() => {
    api.get("/me/candidate/profile").then(r => setProfile(r.data)).catch(() => {});
    api.get("/me/candidate/applications").then(r => setApplications(r.data)).catch(() => {});
    api.get("/jobs?page=1&page_size=4").then(r => setRecentJobs(r.data.items)).catch(() => {});
  }, []);

  const firstName = profile?.first_name || (user?.firstName ?? "");
  const percent = profile?.completion_percent ?? 0;
  const nextMissing = profile?.missing_fields?.[0];

  // El aviso de la Base de Talento sólo aparece si nunca se le preguntó. Los que ya
  // decidieron (en el registro o acá) lo gestionan desde su perfil.
  const showTalentPrompt = !!profile && !profile.talent_pool_asked_at;

  const activeApps = applications.filter(a => a.status !== "discarded");
  const seenApps = applications.filter(a => ["seen", "in_process", "contacted"].includes(a.status));

  async function decideTalentPool(accepted: boolean) {
    setTalentSaving(true);
    try {
      const r = await api.post("/me/candidate/talent-pool", { accepted });
      setProfile(r.data);
    } catch {
      setTalentSaving(false);
    }
  }

  async function dismissTalentPool() {
    setTalentSaving(true);
    try {
      const r = await api.post("/me/candidate/talent-pool/dismiss");
      setProfile(r.data);
    } catch {
      setTalentSaving(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">
        Hola{firstName ? `, ${firstName}` : ""} 👋
      </h1>
      <p className="text-[#64748B] text-sm mb-6">Así está tu actividad en BBJobs.</p>

      {/* Aviso — Base de Talento (consentimiento) */}
      {showTalentPrompt && (
        <div className="bg-white border border-[#9ED4DF] rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
              <ShieldCheckIcon className="w-6 h-6 text-[#1E8EA3]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-[#1C2230] text-[16.5px] mb-1.5">
                ¿Querés que las empresas puedan encontrarte?
              </p>
              <p className="text-[13.5px] text-[#64748B] leading-relaxed mb-2">
                Si lo autorizás, las empresas verificadas van a poder encontrar tu perfil y tu CV en la
                Base de Talento de BBJobs y contactarte por oportunidades laborales, aunque no te hayas
                postulado a esa búsqueda.
              </p>
              <p className="text-[12.5px] text-[#94A3B8] leading-relaxed mb-4">
                Es opcional y no afecta en nada tus postulaciones. Podés cambiar esta decisión cuando
                quieras desde tu perfil.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => decideTalentPool(true)}
                  disabled={talentSaving}
                  className="inline-flex items-center gap-1.5 bg-[#1E8EA3] text-white font-bold text-sm rounded-xl px-5 py-2.5 hover:bg-[#187B8E] disabled:opacity-50 transition-colors"
                >
                  <CheckIcon className="w-4 h-4" /> Sí, quiero aparecer
                </button>
                <button
                  onClick={() => decideTalentPool(false)}
                  disabled={talentSaving}
                  className="inline-flex items-center gap-1.5 border border-[#DDE3EC] text-[#64748B] font-bold text-sm rounded-xl px-5 py-2.5 hover:bg-[#FAFBFD] disabled:opacity-50 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" /> No, gracias
                </button>
                <button
                  onClick={dismissTalentPool}
                  disabled={talentSaving}
                  className="text-sm font-bold text-[#94A3B8] hover:text-[#64748B] px-3 py-2.5 disabled:opacity-50 transition-colors"
                >
                  Decidir después
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero — perfil */}
      <Link
        href="/dashboard/candidate/perfil"
        className="group flex items-center gap-5 sm:gap-6 bg-gradient-to-br from-[#E6F4F7] to-white border border-[#9ED4DF]/60 rounded-2xl p-6 mb-4 hover:border-[#1E8EA3] transition-colors"
      >
        <ProfileCompletionRing percent={percent} size={78} strokeWidth={7} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-[#1C2230] text-[16.5px]">
            {percent >= 100 ? "¡Tu perfil está completo!" : `Tu perfil está al ${percent}%`}
          </p>
          <p className="text-[13px] text-[#64748B] mt-1">
            {/* Nada de "las empresas ven tu porcentaje": el % se sacó de la vista
                de empresa en agosto/2026 y estos textos quedaron afirmando algo
                que ya no pasa. Se habla de las chances del candidato, que es lo
                que sigue siendo cierto y lo que de verdad le importa. */}
            {percent >= 100
              ? "Ya está todo cargado — seguí así."
              : nextMissing
              ? `Te falta: ${nextMissing.label}. Cuanto más completo, más chances de quedar seleccionado.`
              : "Completá los datos que faltan: un perfil completo tiene más chances de quedar seleccionado."}
          </p>
        </div>
        <span className="hidden sm:flex items-center gap-1 text-[13px] font-bold text-[#1E8EA3] shrink-0">
          Completar perfil <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>

      {/* Números reales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Link
          href="/dashboard/candidate/postulaciones"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center mb-3">
            <PaperAirplaneIcon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-display font-extrabold text-[#1C2230]">{applications.length}</p>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">Postulaciones enviadas</p>
        </Link>

        <Link
          href="/dashboard/candidate/postulaciones"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F7EFE9] text-[#B98F72] flex items-center justify-center mb-3">
            <EyeIcon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-display font-extrabold text-[#1C2230]">{seenApps.length}</p>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">Vistas por la empresa</p>
        </Link>

        <Link
          href="/dashboard/candidate/postulaciones"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#1E8EA3] flex items-center justify-center mb-3">
            <ClockIcon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-display font-extrabold text-[#1C2230]">{activeApps.length}</p>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">En curso</p>
        </Link>

        <Link
          href="/dashboard/candidate/perfil"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#1E8EA3] flex items-center justify-center mb-3">
            <DocumentTextIcon className="w-5 h-5" />
          </div>
          <p className="text-sm font-display font-extrabold text-[#1C2230] mt-1">
            {profile?.cv_file_url ? "CV cargado" : "Sin CV"}
          </p>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">
            {profile?.cv_file_url ? "Actualizalo cuando quieras" : "Subilo para postularte más rápido"}
          </p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Últimas postulaciones */}
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-[#1C2230]">Tus últimas postulaciones</h2>
            {applications.length > 0 && (
              <Link href="/dashboard/candidate/postulaciones" className="text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E]">
                Ver todas
              </Link>
            )}
          </div>
          {applications.length === 0 ? (
            <div className="text-center py-8">
              <PaperAirplaneIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#1C2230] mb-1">Todavía no te postulaste</p>
              <p className="text-xs text-[#64748B] mb-4">Explorá las búsquedas activas y postulate con un click.</p>
              <Link href="/dashboard/candidate/empleos" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E]">
                Ver empleos <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {applications.slice(0, 4).map(app => {
                const st = APP_STATUS[app.status] || { label: app.status, cls: "bg-gray-100 text-gray-600" };
                return (
                  <div key={app.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-[#DDE3EC] last:border-0">
                    <p className="text-sm text-[#1C2230] font-medium truncate">
                      {new Date(app.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                    </p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Empleos recientes */}
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-[#1C2230]">Últimas búsquedas publicadas</h2>
            <Link href="/dashboard/candidate/empleos" className="text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E]">
              Explorar
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <BriefcaseIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-3" />
              <p className="text-xs text-[#64748B]">Todavía no hay búsquedas activas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentJobs.slice(0, 4).map(job => (
                <Link
                  key={job.id}
                  href={`/empleos/${job.id}`}
                  className="flex items-center gap-3 py-2.5 border-b border-[#DDE3EC] last:border-0 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#E6F4F7] flex items-center justify-center shrink-0">
                    <BriefcaseIcon className="w-4 h-4 text-[#1E8EA3]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1C2230] truncate group-hover:text-[#1E8EA3] transition-colors">
                      {job.title}
                    </p>
                    <p className="text-xs text-[#64748B] truncate">{job.company_legal_name_snapshot}</p>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-[#94A3B8] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Accesos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <Link
          href="/dashboard/candidate/empleos"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex items-center gap-4 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center shrink-0">
            <MagnifyingGlassIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-[15.5px] text-[#1C2230]">Explorar empleos</p>
            <p className="text-xs text-[#64748B]">Búsquedas activas en Bahía Blanca y alrededores</p>
          </div>
        </Link>

        <Link
          href="/dashboard/candidate/perfil"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex items-center gap-4 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F7EFE9] text-[#B98F72] flex items-center justify-center shrink-0">
            <DocumentTextIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-[15.5px] text-[#1C2230]">Mi perfil y CV</p>
            <p className="text-xs text-[#64748B]">Mantené tus datos y tu CV al día</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
