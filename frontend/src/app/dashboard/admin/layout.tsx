"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell, { type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { ADMIN_GROUPS, ADMIN_INICIO } from "@/lib/adminMenu";

// Agrupado por área (pedido de Gael, 23/11/2026): el mismo mapa que muestra el Inicio
// (lib/adminMenu.ts). Cada grupo se pliega; el de la pantalla abierta queda siempre visible.
const NAV_ITEMS: DashboardNavItem[] = [
  { href: ADMIN_INICIO.href, label: ADMIN_INICIO.label, icon: ADMIN_INICIO.icon, exact: true },
  ...ADMIN_GROUPS.flatMap(g => g.links.map((l, i) => ({
    href: l.href, label: l.label, icon: l.icon, exact: l.exact,
    group: g.key, ...(i === 0 ? { section: g.title } : {}),
  }))),
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
