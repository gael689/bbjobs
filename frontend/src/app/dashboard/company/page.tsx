"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  BriefcaseIcon, UsersIcon, PlusCircleIcon, ArrowRightIcon,
  CheckCircleIcon, ClockIcon, XCircleIcon, BuildingOffice2Icon, ChartBarIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import type { CompanyProfile, JobPosting, ApplicantStats } from "./types";

export default function CompanyInicioPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [stats, setStats] = useState<ApplicantStats | null>(null);

  useEffect(() => {
    api.get("/me/company/profile").then(r => setProfile(r.data)).catch(() => {});
    api.get("/me/company/jobs").then(r => setJobs(r.data)).catch(() => {});
    api.get("/me/company/applications/stats").then(r => setStats(r.data)).catch(() => {});
  }, []);

  const isVerified = profile?.verification_status === "verified";
  const isPending = profile?.verification_status === "pending";
  const activeJobs = jobs.filter(j => j.status === "active");
  const pendingReview = jobs.filter(j => j.moderation_status === "pending_review");
  const featuredJobs = jobs.filter(j => j.is_featured);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">
        {profile?.legal_name ? `Hola, ${profile.legal_name}` : "Panel de empresa"}
      </h1>
      <p className="text-[#64748B] text-sm mb-6">Así está la actividad de tu empresa en BBJobs.</p>

      {/* Hero — estado de verificación / CTA principal.
          Publicar ya no depende de estar verificada (ver A2 del plan del 14/08): una empresa
          sin verificar sigue yendo a /publicar, no a /perfil. La verificación sólo destraba
          ver postulantes, CV y pagos — se lo recordamos acá, no le bloqueamos el camino. */}
      {!isVerified ? (
        <Link
          href="/dashboard/company/publicar"
          className="group flex items-center gap-5 sm:gap-6 bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-2xl p-6 mb-6 hover:border-amber-400 transition-colors"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <ClockIcon className="w-7 h-7 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-[#1C2230] text-[16.5px]">
              {isPending ? "Ya podés publicar — tu empresa sigue en revisión" : "Publicá tu primera búsqueda"}
            </p>
            <p className="text-[13px] text-[#64748B] mt-1">
              {isPending
                ? "Talency la modera igual. Para ver los postulantes vas a necesitar la verificación — pedila desde tu perfil."
                : "No hace falta esperar la verificación para publicar. Para ver los postulantes sí la vas a necesitar."}
            </p>
          </div>
          <span className="hidden sm:flex items-center gap-1 text-[13px] font-bold text-amber-700 shrink-0">
            Publicar <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      ) : (
        <Link
          href="/dashboard/company/publicar"
          className="group flex items-center gap-5 sm:gap-6 bg-gradient-to-br from-[#E6F4F7] to-white border border-[#9ED4DF]/60 rounded-2xl p-6 mb-6 hover:border-[#1E8EA3] transition-colors"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#1E8EA3] flex items-center justify-center shrink-0">
            <PlusCircleIcon className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-[#1C2230] text-[16.5px]">Publicar una nueva búsqueda</p>
            <p className="text-[13px] text-[#64748B] mt-1">
              Empresa verificada — te guiamos paso a paso, te toma un par de minutos.
            </p>
          </div>
          <span className="hidden sm:flex items-center gap-1 text-[13px] font-bold text-[#1E8EA3] shrink-0">
            Publicar <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {/* Acceso a la Base de Talento.
          Sólo para empresa verificada: es el mismo requisito que exige el backend, y mostrar
          una puerta que después da 403 es peor que no mostrarla. Va acá arriba porque es lo
          único del panel que la empresa no descubre sola — publicar y postulaciones son
          obvios, "buscar candidatos que no se postularon" no. */}
      {isVerified && (
        <Link
          href="/dashboard/company/talento"
          className="group flex items-center gap-5 sm:gap-6 bg-white border border-[#DDE3EC] rounded-2xl p-6 mb-6 hover:border-[#1E8EA3] transition-colors"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#E6F4F7] flex items-center justify-center shrink-0">
            <UserGroupIcon className="w-7 h-7 text-[#1E8EA3]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-[#1C2230] text-[16.5px]">
              Buscá en la Base de Talento
            </p>
            <p className="text-[13px] text-[#64748B] mt-1">
              No esperes a que se postulen. Explorá los perfiles gratis y usá un contacto sólo
              cuando quieras los datos de alguien.
            </p>
          </div>
          <span className="hidden sm:flex items-center gap-1 text-[13px] font-bold text-[#1E8EA3] shrink-0">
            Explorar <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      )}

      {/* Bento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/dashboard/company/busquedas"
          className="col-span-2 sm:col-span-2 bg-white border border-[#DDE3EC] rounded-2xl p-5 flex flex-col gap-2.5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center">
              <BriefcaseIcon className="w-5 h-5" />
            </div>
            {pendingReview.length > 0 && (
              <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {pendingReview.length} por revisar
              </span>
            )}
          </div>
          <p className="text-2xl font-display font-extrabold text-[#1C2230]">{activeJobs.length}</p>
          <p className="text-xs text-[#64748B] font-medium -mt-1.5">Búsquedas activas · {jobs.length} en total{featuredJobs.length > 0 && ` · ${featuredJobs.length} destacada${featuredJobs.length > 1 ? "s" : ""}`}</p>
        </Link>

        <Link
          href="/dashboard/company/postulaciones"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex flex-col gap-2.5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F7EFE9] text-[#B98F72] flex items-center justify-center">
            <UsersIcon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-display font-extrabold text-[#1C2230]">{stats?.total ?? "—"}</p>
          <p className="text-xs text-[#64748B] font-medium -mt-1.5">Postulaciones</p>
        </Link>

        <Link
          href="/dashboard/company/estadisticas"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex flex-col gap-2.5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#1E8EA3] flex items-center justify-center">
            <ChartBarIcon className="w-5 h-5" />
          </div>
          <p className="text-sm font-display font-extrabold text-[#1C2230] mt-1">Estadísticas</p>
          <p className="text-xs text-[#64748B] font-medium -mt-1.5">Resumen y tendencia</p>
        </Link>

        <Link
          href="/dashboard/company/perfil"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex flex-col gap-2.5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#1E8EA3] flex items-center justify-center">
            <BuildingOffice2Icon className="w-5 h-5" />
          </div>
          <p className="text-sm font-display font-extrabold text-[#1C2230] mt-1 flex items-center gap-1.5">
            Perfil
            {isVerified ? <CheckCircleIcon className="w-4 h-4 text-green-600" /> : <XCircleIcon className="w-4 h-4 text-amber-500" />}
          </p>
          <p className="text-xs text-[#64748B] font-medium -mt-1.5">{isVerified ? "Verificado" : "Sin verificar"}</p>
        </Link>
      </div>
    </div>
  );
}
