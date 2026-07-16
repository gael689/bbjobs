"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  BuildingOffice2Icon, UsersIcon, BriefcaseIcon,
  UserPlusIcon, ChartBarIcon, ChatBubbleLeftRightIcon, CreditCardIcon,
} from "@heroicons/react/24/outline";

// "Skills pendientes" se dio de baja: sin flujo de sugerencia de skills de parte de los
// usuarios (decisión de producto, ver FASE1.5-FILTROS-PLAN.md §7b), la pantalla quedaba
// siempre vacía. El backend de sugerencias queda intacto por si se reusa como gestor de
// catálogo más adelante.
const NAV_ITEMS = [
  { href: "/dashboard/admin/empresas", label: "Empresas", icon: BuildingOffice2Icon },
  { href: "/dashboard/admin/candidatos", label: "Candidatos", icon: UsersIcon },
  { href: "/dashboard/admin/busquedas", label: "Búsquedas", icon: BriefcaseIcon },
  { href: "/dashboard/admin/mensajes", label: "Mensajes", icon: ChatBubbleLeftRightIcon },
  { href: "/dashboard/admin/pagos", label: "Pagos", icon: CreditCardIcon },
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
