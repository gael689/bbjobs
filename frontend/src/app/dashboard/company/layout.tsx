"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  BuildingOffice2Icon, PlusCircleIcon, UsersIcon, ChartBarIcon, CreditCardIcon,
} from "@heroicons/react/24/outline";

const NAV_ITEMS = [
  { href: "/dashboard/company/perfil", label: "Perfil de empresa", icon: BuildingOffice2Icon },
  { href: "/dashboard/company/publicar", label: "Publicar búsqueda", icon: PlusCircleIcon },
  { href: "/dashboard/company/postulaciones", label: "Postulaciones", icon: UsersIcon },
  { href: "/dashboard/company/estadisticas", label: "Estadísticas", icon: ChartBarIcon },
  { href: "/dashboard/company/pagos", label: "Pagos", icon: CreditCardIcon },
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
