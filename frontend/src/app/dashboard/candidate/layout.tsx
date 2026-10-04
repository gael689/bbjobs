"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { HomeIcon, BriefcaseIcon, PaperAirplaneIcon, UserIcon, BellIcon, DocumentCheckIcon, BellAlertIcon } from "@heroicons/react/24/outline";
import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";

const NAV_ITEMS = [
  { href: "/dashboard/candidate", label: "Inicio", icon: HomeIcon, exact: true },
  { href: "/dashboard/candidate/perfil", label: "Mi perfil", icon: UserIcon },
  { href: "/dashboard/candidate/empleos", label: "Explorar empleos", icon: BriefcaseIcon },
  { href: "/dashboard/candidate/postulaciones", label: "Mis postulaciones", icon: PaperAirplaneIcon },
  { href: "/dashboard/candidate/notificaciones", label: "Notificaciones", icon: BellIcon },
  // Módulos nuevos: ocultos para postulantes hasta el lanzamiento (NEXT_PUBLIC_MODULOS_NUEVOS).
  ...(MODULOS_NUEVOS_VISIBLES ? [
    { href: "/dashboard/candidate/alertas", label: "Alertas de empleo", icon: BellAlertIcon },
    { href: "/dashboard/candidate/revision-cv", label: "Revisión de CV", icon: DocumentCheckIcon },
  ] : []),
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
