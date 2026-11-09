"use client";

import { useDashboardAuth } from "@/hooks/useDashboardAuth";
import DashboardShell from "@/components/dashboard/DashboardShell";
import {
  HomeIcon, BuildingOffice2Icon, UsersIcon, BriefcaseIcon,
  UserPlusIcon, ChartBarIcon, ChatBubbleLeftRightIcon, CreditCardIcon, BellIcon, SparklesIcon,
  MagnifyingGlassCircleIcon, MegaphoneIcon, DocumentMagnifyingGlassIcon, BuildingStorefrontIcon, CpuChipIcon, PresentationChartLineIcon, BoltIcon
} from "@heroicons/react/24/outline";
import { ETIQUETA_EN_DESARROLLO } from "@/lib/modulos";

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
  { href: "/dashboard/admin/talento", label: "Base de Talento", icon: MagnifyingGlassCircleIcon },
  { href: "/dashboard/admin/estadisticas", label: "Estadísticas", icon: ChartBarIcon },
  // Medición propia del sitio público (visitas, búsquedas, avisos más vistos). Ver lib/medicion.ts.
  { href: "/dashboard/admin/metricas", label: "Métricas del sitio", icon: PresentationChartLineIcon },

  // Módulos nuevos: Eugenia los ve con la etiqueta hasta el lanzamiento (MODULOS_NUEVOS_ACTIVOS).
  { href: "/dashboard/admin/revisiones-cv", label: "Revisiones de CV", icon: DocumentMagnifyingGlassIcon, section: "Próximamente", badge: ETIQUETA_EN_DESARROLLO },
  { href: "/dashboard/admin/empresas-potenciales", label: "Empresas a contactar", icon: BuildingStorefrontIcon, badge: ETIQUETA_EN_DESARROLLO },
  { href: "/dashboard/admin/campanas", label: "Campañas", icon: MegaphoneIcon, badge: ETIQUETA_EN_DESARROLLO },
  { href: "/dashboard/admin/modulos", label: "Mails e IA", icon: CpuChipIcon, badge: ETIQUETA_EN_DESARROLLO },
  // Centro de IA: qué hizo la IA, recomendados de cualquier búsqueda y acciones a mano.
  { href: "/dashboard/admin/ia", label: "Centro de IA", icon: BoltIcon, badge: ETIQUETA_EN_DESARROLLO },

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
