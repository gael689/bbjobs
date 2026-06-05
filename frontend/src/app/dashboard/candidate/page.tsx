"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { DocumentTextIcon, PaperAirplaneIcon, SparklesIcon, CloudArrowUpIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function CandidateDashboard() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
    if (user?.role && user.role !== "candidate") router.push(`/dashboard/${user.role}`);
  }, [user, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "candidate") {
      api.get("/me/candidate/profile")
        .then(res => setProfile(res.data))
        .catch(console.error);
    }
  }, [isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== "candidate") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-[#6b7280] font-medium">Cargando panel...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#fdf6fb] min-h-screen">
      {/* Header de panel */}
      <div className="bg-gradient-to-r from-[#fce4f3] to-[#fdf6fb] border-b border-[#f0d4e8] px-4 sm:px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <p className="text-[#e91e8c] font-bold text-sm uppercase tracking-wider mb-2">Mi Panel</p>
          <h1 className="text-3xl font-display font-bold text-[#1a1a2e]">
            Hola, {profile?.first_name || user?.email?.split("@")[0]} 👋
          </h1>
          <p className="text-[#6b7280] mt-1">Gestioná tu perfil y seguí tus postulaciones.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* CV */}
          <div className="bg-white border border-[#f0d4e8] rounded-2xl p-6 hover:border-[#e91e8c]/30 hover:shadow-sm transition-all">
            <div className="w-12 h-12 bg-[#fce4f3] rounded-xl flex items-center justify-center mb-5">
              <DocumentTextIcon className="w-6 h-6 text-[#e91e8c]" />
            </div>
            <h2 className="text-lg font-display font-bold text-[#1a1a2e] mb-2">Mi Currículum</h2>
            <p className="text-sm text-[#6b7280] mb-6 leading-relaxed">
              Subí o actualizá tu CV en PDF. Solo las empresas a las que te postulés podrán verlo.
            </p>
            <button className="w-full flex items-center justify-center gap-2 border-2 border-[#e91e8c] text-[#e91e8c] font-bold rounded-xl py-2.5 text-sm hover:bg-[#fce4f3] transition-colors">
              <CloudArrowUpIcon className="w-5 h-5" />
              Subir CV
            </button>
          </div>

          {/* Postulaciones */}
          <div className="bg-white border border-[#f0d4e8] rounded-2xl p-6 hover:border-[#e91e8c]/30 hover:shadow-sm transition-all">
            <div className="w-12 h-12 bg-[#fce4f3] rounded-xl flex items-center justify-center mb-5">
              <PaperAirplaneIcon className="w-6 h-6 text-[#e91e8c]" />
            </div>
            <h2 className="text-lg font-display font-bold text-[#1a1a2e] mb-2">Postulaciones</h2>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-display font-extrabold text-[#1a1a2e]">0</span>
              <span className="text-[#6b7280] font-medium text-sm mb-1.5">activas</span>
            </div>
            <p className="text-sm text-[#6b7280]">Empresas revisando tu perfil.</p>
          </div>

          {/* Tests */}
          <div className="bg-white border border-[#f0d4e8] rounded-2xl p-6 hover:border-[#e91e8c]/30 hover:shadow-sm transition-all">
            <div className="w-12 h-12 bg-[#fce4f3] rounded-xl flex items-center justify-center mb-5">
              <SparklesIcon className="w-6 h-6 text-[#e91e8c]" />
            </div>
            <h2 className="text-lg font-display font-bold text-[#1a1a2e] mb-2">Tests Psicométricos</h2>
            <p className="text-sm text-[#6b7280] mb-6 leading-relaxed">
              Completá evaluaciones para destacarte frente a otras candidaturas.
            </p>
            <button className="w-full flex items-center justify-center gap-2 bg-[#fce4f3] text-[#e91e8c] font-bold rounded-xl py-2.5 text-sm hover:bg-[#f9c8e9] transition-colors border border-[#f0d4e8]">
              Ver evaluaciones
            </button>
          </div>
        </div>

        {/* Actividad */}
        <div className="bg-white border border-[#f0d4e8] rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-[#f0d4e8] bg-[#fdf6fb]">
            <h3 className="text-lg font-display font-bold text-[#1a1a2e]">Actividad reciente</h3>
          </div>
          <div className="p-12 flex flex-col items-center text-center">
            <PaperAirplaneIcon className="w-10 h-10 text-[#f0d4e8] mb-4" />
            <p className="text-[#6b7280] font-medium mb-5">Aún no te postulaste a ninguna búsqueda.</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#e91e8c] text-white font-bold rounded-full px-6 py-2.5 text-sm hover:bg-[#c4177a] transition-colors"
            >
              Explorar empleos <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
