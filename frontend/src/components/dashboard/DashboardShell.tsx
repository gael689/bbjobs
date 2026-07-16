"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { Bars3Icon, XMarkIcon, ArrowLeftIcon, ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import NotificationBell from "@/components/notifications/NotificationBell";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const ROLE_LABEL: Record<"candidate" | "company" | "admin", string> = {
  candidate: "Panel candidato",
  company: "Panel de empresa",
  admin: "Panel administrador",
};

function isActive(pathname: string | null, href: string) {
  return pathname === href || pathname?.startsWith(`${href}/`);
}

function NavLinks({
  navItems,
  pathname,
  onNavigate,
}: {
  navItems: DashboardNavItem[];
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            isActive(pathname, href)
              ? "bg-[#E6F4F7] text-[#1E8EA3]"
              : "text-[#64748B] hover:bg-[#FAFBFD] hover:text-[#1C2230]"
          }`}
        >
          <Icon className="w-5 h-5 shrink-0" />
          {label}
        </Link>
      ))}
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut({ redirectUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-[#FAFBFD] lg:flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-[#DDE3EC] min-h-screen sticky top-0 self-start">
        <div className="px-5 py-6 border-b border-[#DDE3EC]">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="BBJobs" width={28} height={28} className="object-contain" />
            <span className="font-display font-extrabold italic text-lg tracking-tight">
              <span className="text-[#1E8EA3]">BB</span><span className="text-[#1C2230]">JOBS</span>
            </span>
          </Link>
          <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mt-3">{ROLE_LABEL[role]}</p>
        </div>

        <NavLinks navItems={navItems} pathname={pathname} />

        <div className="px-3 py-4 border-t border-[#DDE3EC] space-y-2">
          <div className="flex items-center justify-between px-1">
            <NotificationBell align="left" openUpward />
            <button
              onClick={handleLogout}
              className="p-2 text-[#64748B] hover:text-red-500 transition-colors"
              title="Salir"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
            </button>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-[#64748B] hover:text-[#1E8EA3] transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </aside>

      {/* Topbar mobile */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-[#DDE3EC] px-4 h-16 flex items-center justify-between">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-[#1C2230]" aria-label="Abrir menú">
          <Bars3Icon className="w-6 h-6" />
        </button>
        <Link href="/" className="flex items-center gap-1.5">
          <Image src="/logo.png" alt="BBJobs" width={24} height={24} className="object-contain" />
          <span className="font-display font-extrabold italic text-base tracking-tight">
            <span className="text-[#1E8EA3]">BB</span><span className="text-[#1C2230]">JOBS</span>
          </span>
        </Link>
        <NotificationBell />
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div
            className="w-72 max-w-[80vw] h-full bg-white flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDE3EC]">
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{ROLE_LABEL[role]}</p>
              <button onClick={() => setMobileOpen(false)} className="p-1 text-[#64748B]" aria-label="Cerrar menú">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <NavLinks navItems={navItems} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div className="px-3 py-4 border-t border-[#DDE3EC] space-y-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#64748B] hover:text-[#1E8EA3] transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Volver al inicio
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                Salir
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
