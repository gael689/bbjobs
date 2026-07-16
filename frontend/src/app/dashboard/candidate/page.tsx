"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useUser } from "@clerk/nextjs";
import {
  MagnifyingGlassIcon, PaperAirplaneIcon, ArrowRightIcon,
} from "@heroicons/react/24/outline";
import ProfileCompletionRing from "@/components/ui/ProfileCompletionRing";
import type { CandidateProfile } from "./types";

export default function CandidateInicioPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);

  useEffect(() => {
    api.get("/me/candidate/profile").then(r => setProfile(r.data)).catch(() => {});
  }, []);

  const firstName = profile?.first_name || (user?.firstName ?? "");
  const percent = profile?.completion_percent ?? 0;
  const nextMissing = profile?.missing_fields?.[0];

  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">
        Hola{firstName ? `, ${firstName}` : ""} 👋
      </h1>
      <p className="text-[#64748B] text-sm mb-6">Así está tu actividad en BBJobs.</p>

      {/* Hero — perfil */}
      <Link
        href="/dashboard/candidate/perfil"
        className="group flex items-center gap-5 sm:gap-6 bg-gradient-to-br from-[#E6F4F7] to-white border border-[#9ED4DF]/60 rounded-2xl p-6 mb-6 hover:border-[#1E8EA3] transition-colors"
      >
        <ProfileCompletionRing percent={percent} size={78} strokeWidth={7} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold text-[#1C2230] text-[16.5px]">
            {percent >= 100 ? "¡Tu perfil está completo!" : `Tu perfil está al ${percent}%`}
          </p>
          <p className="text-[13px] text-[#64748B] mt-1">
            {percent >= 100
              ? "Las empresas ven tu perfil al 100% — seguí así."
              : nextMissing
              ? `Te falta: ${nextMissing.label}. Las empresas ven este número al revisar tu postulación.`
              : "Completá los datos que faltan para que las empresas te vean mejor."}
          </p>
        </div>
        <span className="hidden sm:flex items-center gap-1 text-[13px] font-bold text-[#1E8EA3] shrink-0">
          Completar perfil <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/candidate/empleos"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex flex-col gap-2.5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center">
            <MagnifyingGlassIcon className="w-5 h-5" />
          </div>
          <p className="font-display font-extrabold text-[15.5px] text-[#1C2230]">Explorar empleos</p>
          <p className="text-xs text-[#64748B]">Búsquedas activas en Bahía Blanca y alrededores</p>
        </Link>

        <Link
          href="/dashboard/candidate/postulaciones"
          className="bg-white border border-[#DDE3EC] rounded-2xl p-5 flex flex-col gap-2.5 hover:border-[#9ED4DF] hover:-translate-y-0.5 transition-all shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#F7EFE9] text-[#B98F72] flex items-center justify-center">
            <PaperAirplaneIcon className="w-5 h-5" />
          </div>
          <p className="font-display font-extrabold text-[15.5px] text-[#1C2230]">Mis postulaciones</p>
          <p className="text-xs text-[#64748B]">Seguí el estado de tus postulaciones</p>
        </Link>
      </div>
    </div>
  );
}
