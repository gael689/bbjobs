"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useClerk, useAuth } from "@clerk/nextjs";
import { Bars3Icon, XMarkIcon, ArrowLeftIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { api, isSessionExpired } from "@/lib/api";
import NotificationBell from "@/components/notifications/NotificationBell";
import NovedadesVersion, { MarcaVersion } from "@/components/dashboard/NovedadesVersion";
import AvisoEmergente from "@/components/notifications/AvisoEmergente";
import BombitaRecomendados, { type RecomendadosPendientes } from "@/components/notifications/BombitaRecomendados";
import type { NotificationItemData } from "@/hooks/useNotifications";
import { EVENTO_RECOMENDADOS_VISTOS } from "@/lib/eventos";
import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";

const NAV_BADGE_POLL_MS = 45_000;

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Sólo matchea la ruta exacta, no subrutas — para los "Inicio" (`/dashboard/{role}`), que
   * si no quedarían marcados como activos en cualquier subpágina (todas empiezan con ese
   * mismo prefijo). El resto de los ítems no lo necesita. */
  exact?: boolean;
  /** Encabezado de sección que se dibuja *antes* de este ítem. Opcional: un nav sin ninguno
   * se renderiza como lista plana, igual que antes. */
  section?: string;
  /** Etiqueta chica al lado del nombre, p. ej. "En desarrollo" para los módulos nuevos. */
  badge?: string;
  /** Contador fijo al lado del nombre ("Recomendados (5)"): sale del pedido de la campanita. */
  contador?: "recomendados";
}

/** Lo que el panel pregunta cada minuto, en un solo pedido (`/me/notifications/summary`). */
interface ResumenPanel {
  count: number;
  highlights: NotificationItemData[];
  recommended: RecomendadosPendientes | null;
}

const ROLE_LABEL: Record<"candidate" | "company" | "admin", string> = {
  candidate: "Panel candidato",
  company: "Panel de empresa",
  admin: "Panel administrador",
};

function isActive(pathname: string | null, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname?.startsWith(`${href}/`);
}

function NavLinks({
  navItems,
  pathname,
  unreadCount,
  recomendados,
  onNavigate,
}: {
  navItems: DashboardNavItem[];
  pathname: string | null;
  unreadCount: number;
  recomendados: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map(({ href, label: nombre, icon: Icon, exact, section, badge, contador }) => {
        const isNotifications = href.endsWith("/notificaciones");
        const label = contador === "recomendados" && recomendados > 0 ? `${nombre} (${recomendados})` : nombre;
        return (
          <div key={`g-${href}`}>
          {section && (
            <p className="px-3 pt-4 pb-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#5C767D]">
              {section}
            </p>
          )}
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-[11px] text-[15px] font-bold transition-colors ${
              isActive(pathname, href, exact)
                ? "bg-gradient-to-r from-[#1E8EA3]/[0.28] to-[#1E8EA3]/[0.06] text-white shadow-[inset_2px_0_0_#1E8EA3]"
                : "text-[#A9C0C6] hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-white/10 text-[#E6F4F7] text-[9.5px] font-extrabold uppercase tracking-wide leading-none">
                {badge}
              </span>
            )}
            {isNotifications && unreadCount > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#D4B7A2] text-[#241C15] text-[11px] font-extrabold leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          </div>
        );
      })}
    </nav>
  );
}

export default function DashboardShell({
  role,
  navItems,
  children,
}: {
  role: "candidate" | "company" | "admin";
  navItems: DashboardNavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navUnreadCount, setNavUnreadCount] = useState(0);
  const [resumen, setResumen] = useState<ResumenPanel | null>(null);
  const { userId } = useAuth();

  const handleLogout = async () => {
    await signOut({ redirectUrl: "/" });
  };

  // Poll liviano sólo para el badge del ítem "Notificaciones" del nav — independiente del
  // useNotifications() que ya usa NotificationBell (ver su comentario: no se debe duplicar
  // ese hook, que trae la lista completa además del conteo). Con los módulos nuevos, el mismo
  // pedido trae también los carteles emergentes y (empresas) los recomendados sin mirar: antes
  // el cartel preguntaba aparte.
  const navUnreadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    const tick = () => {
      if (document.hidden || isSessionExpired()) return;
      if (MODULOS_NUEVOS_VISIBLES) {
        api.get<ResumenPanel>("/me/notifications/summary")
          .then(res => {
            if (cancelled) return;
            setNavUnreadCount(res.data.count ?? 0);
            setResumen(res.data);
          })
          .catch(() => {});
        return;
      }
      api.get("/me/notifications/unread-count")
        .then(res => { if (!cancelled) setNavUnreadCount(res.data.count ?? 0); })
        .catch(() => {});
    };
    tick();
    navUnreadPollRef.current = setInterval(tick, NAV_BADGE_POLL_MS);
    // Recomendados avisa cuando la empresa abre una búsqueda: el contador baja en el acto.
    window.addEventListener(EVENTO_RECOMENDADOS_VISTOS, tick);
    return () => {
      cancelled = true;
      if (navUnreadPollRef.current) clearInterval(navUnreadPollRef.current);
      window.removeEventListener(EVENTO_RECOMENDADOS_VISTOS, tick);
    };
  }, [isSignedIn]);
  const recomendados = resumen?.recommended?.total ?? 0;

  return (
    <div className="min-h-screen bg-[#FAFBFD] lg:flex">
      {/* Sidebar desktop */}
      {/* `h-screen` + `overflow-y-auto` y no `min-h-screen`: con el alto mínimo,
          el menú podía ser más largo que la ventana y no tenía scroll propio, así
          que a los ítems de abajo sólo se llegaba scrolleando LA PÁGINA. En una
          sección con contenido largo funcionaba; en una corta —sin scroll de
          página— quedaban inalcanzables. De ahí que pareciera que el menú
          scrollea o no según dónde estés parado.
          `overscroll-contain` evita que al terminar el menú el scroll se
          contagie al contenido de atrás. */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#0B171D] h-screen overflow-y-auto overscroll-contain sticky top-0 self-start">
        <div className="px-5 py-6 border-b border-white/[0.06]">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="BBJobs" width={28} height={28} className="object-contain" />
            <span className="font-display font-extrabold italic text-lg tracking-tight">
              <span className="text-[#5FC4D6]">BB</span><span className="text-[#E8EEF0]">JOBS</span>
            </span>
          </Link>
          <p className="text-xs font-bold text-[#5C767D] uppercase tracking-wider mt-3">{ROLE_LABEL[role]}</p>
          {/* La versión en todos los paneles; las novedades, por ahora, sólo para empresas y
              Talency (v2.1, 23/10/2026). */}
          <MarcaVersion conNovedades={role !== "candidate"} />
        </div>

        <NavLinks navItems={navItems} pathname={pathname} unreadCount={navUnreadCount} recomendados={recomendados} />

        <div className="px-3 py-4 border-t border-white/[0.06] space-y-2.5">
          <NotificationBell variant="prominent" align="left" openUpward />
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-[13px] font-bold text-[#A9C0C6] hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Volver al inicio
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="lg:hidden sticky top-0 z-40 bg-[#0B171D] px-4 h-16 flex items-center justify-between">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-white" aria-label="Abrir menú">
          <Bars3Icon className="w-6 h-6" />
        </button>
        <Link href="/" className="flex items-center gap-1.5">
          <Image src="/logo.png" alt="BBJobs" width={24} height={24} className="object-contain" />
          <span className="font-display font-extrabold italic text-base tracking-tight">
            <span className="text-[#5FC4D6]">BB</span><span className="text-[#E8EEF0]">JOBS</span>
          </span>
        </Link>
        <NotificationBell />
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div
            /* Mismo motivo que el sidebar de escritorio: sin scroll propio, un
               menú más alto que la pantalla deja los últimos ítems —incluido
               "Cerrar sesión"— fuera de alcance. En un teléfono apaisado pasa
               con cualquier rol. */
            className="w-72 max-w-[80vw] h-full bg-[#0B171D] flex flex-col overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <p className="text-xs font-bold text-[#5C767D] uppercase tracking-wider">{ROLE_LABEL[role]}</p>
                <MarcaVersion conNovedades={role !== "candidate"} />
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-[#A9C0C6]" aria-label="Cerrar menú">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <NavLinks navItems={navItems} pathname={pathname} unreadCount={navUnreadCount} recomendados={recomendados}
                      onNavigate={() => setMobileOpen(false)} />
            <div className="px-3 py-4 border-t border-white/[0.06] space-y-2.5">
              <NotificationBell variant="prominent" align="left" openUpward />
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-[13px] font-bold text-[#A9C0C6] hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Volver al inicio
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido */}
      <main className="flex-1 min-w-0">{children}</main>
      {/* Los avisos que salen en pantalla son de los módulos nuevos (IA): con la compuerta cerrada, ni se consultan. */}
      {MODULOS_NUEVOS_VISIBLES && <AvisoEmergente avisos={resumen?.highlights ?? []} />}
      {/* La bombita de la empresa: recomendados que todavía no miró (como mucho una vez por día). */}
      {MODULOS_NUEVOS_VISIBLES && role === "company" && (
        <BombitaRecomendados pendientes={resumen?.recommended ?? null} usuario={userId} />
      )}
      {role !== "candidate" && <NovedadesVersion rol={role} />}
    </div>
  );
}
