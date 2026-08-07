"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  HomeIcon, BuildingOffice2Icon, UsersIcon, BriefcaseIcon,
  UserPlusIcon, ChartBarIcon, ChatBubbleLeftRightIcon, CreditCardIcon, BellIcon, SparklesIcon
} from "@heroicons/react/24/outline";

// "Skills pendientes" se dio de baja: sin flujo de sugerencia de skills de parte de los
// usuarios (decisión de producto, ver FASE1.5-FILTROS-PLAN.md §7b), la pantalla quedaba
// siempre vacía. El backend de sugerencias queda intacto por si se reusa como gestor de
// catálogo más adelante.
// Agrupado por lo que se viene a hacer, no por orden de construcción: primero lo que se
// revisa todos los días (moderación), después lo que se consulta, y al final lo que se
// configura una vez cada tanto.
const NAV_ITEMS = [
  { href: "/dashboard/admin", label: "Inicio", icon: HomeIcon, exact: true },

  { href: "/dashboard/admin/empresas", label: "Empresas", icon: BuildingOffice2Icon, section: "Moderación" },
  { href: "/dashboard/admin/candidatos", label: "Candidatos", icon: UsersIcon },
  { href: "/dashboard/admin/busquedas", label: "Búsquedas y postulantes", icon: BriefcaseIcon },

  { href: "/dashboard/admin/mensajes", label: "Mensajes", icon: ChatBubbleLeftRightIcon, section: "Comunicación" },
  { href: "/dashboard/admin/notificaciones", label: "Notificaciones", icon: BellIcon },

  { href: "/dashboard/admin/pagos", label: "Pagos", icon: CreditCardIcon, section: "Negocio" },
  { href: "/dashboard/admin/estadisticas", label: "Estadísticas", icon: ChartBarIcon },

  // "de la landing" se quedó corto: la pantalla tiene además las estadísticas de
  // los postulantes, que no son de la landing. Con el nombre viejo no había forma
  // de adivinar que estaban ahí.
  { href: "/dashboard/admin/indicadores", label: "Indicadores y estadísticas", icon: SparklesIcon, section: "Configuración" },
  { href: "/dashboard/admin/nuevo-admin", label: "Nuevo admin", icon: UserPlusIcon },
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
