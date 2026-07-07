"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { BriefcaseIcon, PaperAirplaneIcon, UserIcon } from "@heroicons/react/24/outline";

const NAV_ITEMS = [
  { href: "/dashboard/candidate/empleos", label: "Explorar empleos", icon: BriefcaseIcon },
  { href: "/dashboard/candidate/postulaciones", label: "Mis postulaciones", icon: PaperAirplaneIcon },
  { href: "/dashboard/candidate/perfil", label: "Mi perfil", icon: UserIcon },
];

export default function CandidateDashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useDashboardAuth("candidate");

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#64748B] font-medium">Cargando panel...</div>
      </div>
    );
  }

  return (
    <DashboardShell role="candidate" navItems={NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
