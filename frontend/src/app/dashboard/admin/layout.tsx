"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  BuildingOffice2Icon, UsersIcon, BriefcaseIcon, WrenchScrewdriverIcon,
  UserPlusIcon, ChartBarIcon,
} from "@heroicons/react/24/outline";

const NAV_ITEMS = [
  { href: "/dashboard/admin/empresas", label: "Empresas", icon: BuildingOffice2Icon },
  { href: "/dashboard/admin/candidatos", label: "Candidatos", icon: UsersIcon },
  { href: "/dashboard/admin/busquedas", label: "Búsquedas", icon: BriefcaseIcon },
  { href: "/dashboard/admin/skills", label: "Skills pendientes", icon: WrenchScrewdriverIcon },
  { href: "/dashboard/admin/nuevo-admin", label: "Nuevo admin", icon: UserPlusIcon },
  { href: "/dashboard/admin/estadisticas", label: "Estadísticas", icon: ChartBarIcon },
];

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useDashboardAuth("admin");

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#64748B] font-medium">Cargando panel admin...</div>
      </div>
    );
  }

  return (
    <DashboardShell role="admin" navItems={NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
