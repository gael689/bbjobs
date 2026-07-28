"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useClerk, useAuth } from "@clerk/nextjs";
import { Bars3Icon, XMarkIcon, ArrowLeftIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import NotificationBell from "@/components/notifications/NotificationBell";

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
  onNavigate,
}: {
  navItems: DashboardNavItem[];
  pathname: string | null;
  unreadCount: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map(({ href, label, icon: Icon, exact, section }) => {
        const isNotifications = href.endsWith("/notificaciones");
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

  const handleLogout = async () => {
    await signOut({ redirectUrl: "/" });
  };

  // Poll liviano sólo para el badge del ítem "Notificaciones" del nav — independiente del
  // useNotifications() que ya usa NotificationBell (ver su comentario: no se debe duplicar
  // ese hook, que trae la lista completa además del conteo).
  const navUnreadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    const tick = () => {
      if (document.hidden) return;
      api.get("/me/notifications/unread-count")
        .then(res => { if (!cancelled) setNavUnreadCount(res.data.count ?? 0); })
        .catch(() => {});
    };
    tick();
    navUnreadPollRef.current = setInterval(tick, NAV_BADGE_POLL_MS);
    return () => {
      cancelled = true;
      if (navUnreadPollRef.current) clearInterval(navUnreadPollRef.current);
    };
  }, [isSignedIn]);

  return (
    <div className="min-h-screen bg-[#FAFBFD] lg:flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#0B171D] min-h-screen sticky top-0 self-start">
        <div className="px-5 py-6 border-b border-white/[0.06]">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="BBJobs" width={28} height={28} className="object-contain" />
            <span className="font-display font-extrabold italic text-lg tracking-tight">
              <span className="text-[#5FC4D6]">BB</span><span className="text-[#E8EEF0]">JOBS</span>
            </span>
          </Link>
          <p className="text-xs font-bold text-[#5C767D] uppercase tracking-wider mt-3">{ROLE_LABEL[role]}</p>
        </div>

        <NavLinks navItems={navItems} pathname={pathname} unreadCount={navUnreadCount} />

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
            className="w-72 max-w-[80vw] h-full bg-[#0B171D] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <p className="text-xs font-bold text-[#5C767D] uppercase tracking-wider">{ROLE_LABEL[role]}</p>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-[#A9C0C6]" aria-label="Cerrar menú">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <NavLinks navItems={navItems} pathname={pathname} unreadCount={navUnreadCount} onNavigate={() => setMobileOpen(false)} />
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
    </div>
  );
}
