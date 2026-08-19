"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  HomeIcon, BuildingOffice2Icon, PlusCircleIcon, BriefcaseIcon, UsersIcon, ChartBarIcon, CreditCardIcon, BellIcon,
  MagnifyingGlassCircleIcon,
} from "@heroicons/react/24/outline";

const NAV_ITEMS = [
  { href: "/dashboard/company", label: "Inicio", icon: HomeIcon, exact: true },
  { href: "/dashboard/company/busquedas", label: "Búsquedas", icon: BriefcaseIcon },
  { href: "/dashboard/company/publicar", label: "Publicar búsqueda", icon: PlusCircleIcon },
  { href: "/dashboard/company/postulaciones", label: "Postulaciones", icon: UsersIcon },
  { href: "/dashboard/company/talento", label: "Base de Talento", icon: MagnifyingGlassCircleIcon },
  { href: "/dashboard/company/perfil", label: "Perfil de empresa", icon: BuildingOffice2Icon },
  { href: "/dashboard/company/estadisticas", label: "Estadísticas", icon: ChartBarIcon },
  { href: "/dashboard/company/pagos", label: "Pagos", icon: CreditCardIcon },
  { href: "/dashboard/company/notificaciones", label: "Notificaciones", icon: BellIcon },
];

export default function CompanyDashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useDashboardAuth("company");

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#64748B] font-medium">Cargando panel...</div>
      </div>
    );
  }

  return (
    <DashboardShell role="company" navItems={NAV_ITEMS}>
      {children}
    </DashboardShell>
  );
}
