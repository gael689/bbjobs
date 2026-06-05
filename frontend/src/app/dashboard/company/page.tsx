"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { BuildingOffice2Icon, BriefcaseIcon, UsersIcon, PlusIcon, StarIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function CompanyDashboard() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
    if (user?.role && user.role !== "company") router.push(`/dashboard/${user.role}`);
  }, [user, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "company") {
      api.get("/me/company/profile").then(r => setProfile(r.data)).catch(console.error);
      api.get("/me/company/subscription").then(r => setSubscription(r.data)).catch(console.error);
    }
  }, [isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== "company") {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-[#6b7280] font-medium">Cargando panel...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#fdf6fb] min-h-screen">
      {/* Header panel */}
      <div className="bg-gradient-to-r from-[#fce4f3] to-[#fdf6fb] border-b border-[#f0d4e8] px-4 sm:px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <p className="text-[#e91e8c] font-bold text-sm uppercase tracking-wider mb-2">Panel de Empresa</p>
            <h1 className="text-3xl font-display font-bold text-[#1a1a2e] flex items-center gap-3">
              <BuildingOffice2Icon className="w-8 h-8 text-[#e91e8c]" />
              {profile?.legal_name || "Mi empresa"}
            </h1>
            <p className="text-[#6b7280] mt-1">Publicá búsquedas y gestioná candidatos.</p>
          </div>
          <button className="self-start sm:self-auto inline-flex items-center gap-2 bg-[#e91e8c] hover:bg-[#c4177a] text-white font-bold rounded-full px-6 py-3 transition-colors shadow-sm">
            <PlusIcon className="w-5 h-5" />
            Publicar búsqueda
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {/* Plan */}
          <div className="bg-white border border-[#f0d4e8] rounded-2xl p-6 hover:border-[#e91e8c]/30 transition-all">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">Plan actual</p>
              <div className="w-8 h-8 bg-[#fce4f3] rounded-lg flex items-center justify-center">
                <StarIcon className="w-4 h-4 text-[#e91e8c]" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-[#1a1a2e] mb-4">{subscription?.plan?.name || "Free"}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-[#6b7280]">Publicaciones</span>
                <span className="text-[#1a1a2e]">0 / {subscription?.plan?.max_active_job_postings || 1}</span>
              </div>
              <div className="w-full h-2 bg-[#f0d4e8] rounded-full overflow-hidden">
                <div className="h-full bg-[#e91e8c] rounded-full w-0" />
              </div>
            </div>
            <Link href="/planes" className="block text-center mt-5 text-sm font-bold text-[#e91e8c] hover:text-[#c4177a] transition-colors">
              Ver planes →
            </Link>
          </div>

          {/* Stats */}
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white border border-[#f0d4e8] rounded-2xl p-6 hover:border-[#e91e8c]/30 transition-all">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-[#fce4f3] rounded-xl flex items-center justify-center">
                  <BriefcaseIcon className="w-5 h-5 text-[#e91e8c]" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">Búsquedas activas</p>
              </div>
              <p className="text-5xl font-display font-extrabold text-[#1a1a2e]">0</p>
            </div>

            <div className="bg-white border border-[#f0d4e8] rounded-2xl p-6 hover:border-[#e91e8c]/30 transition-all">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-[#fce4f3] rounded-xl flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-[#e91e8c]" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#6b7280]">Postulaciones recibidas</p>
              </div>
              <p className="text-5xl font-display font-extrabold text-[#1a1a2e]">0</p>
            </div>
          </div>
        </div>

        {/* Tabla publicaciones */}
        <div className="bg-white border border-[#f0d4e8] rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-[#f0d4e8] bg-[#fdf6fb] flex justify-between items-center">
            <h3 className="text-lg font-display font-bold text-[#1a1a2e]">Mis búsquedas</h3>
          </div>
          <div className="p-12 flex flex-col items-center text-center">
            <BriefcaseIcon className="w-10 h-10 text-[#f0d4e8] mb-4" />
            <p className="text-[#6b7280] font-medium mb-5">Todavía no publicaste ninguna búsqueda.</p>
            <button className="inline-flex items-center gap-2 bg-[#e91e8c] text-white font-bold rounded-full px-6 py-2.5 text-sm hover:bg-[#c4177a] transition-colors">
              <PlusIcon className="w-4 h-4" />
              Publicar primera búsqueda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
