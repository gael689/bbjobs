"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { api, setAccessToken } from "@/lib/api";
import {
  UserIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setAccessToken(null);
    logout();
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-[#f0d4e8] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-20 items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/logo.png"
            alt="BBJobs"
            width={38}
            height={38}
            className="object-contain"
          />
          <span className="text-[1.45rem] font-display font-extrabold tracking-tight leading-none">
            <span className="text-[#e91e8c]">BB</span>
            <span className="text-[#1a1a2e]">JOBS</span>
          </span>
        </Link>

        {/* Nav links — desktop */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#1a1a2e]">
          <Link href="/" className="hover:text-[#e91e8c] transition-colors">Avisos</Link>
          <Link href="/empresas" className="hover:text-[#e91e8c] transition-colors">Empresas</Link>
          <Link href="/planes" className="hover:text-[#e91e8c] transition-colors">Planes</Link>
          <Link href="/nosotros" className="hover:text-[#e91e8c] transition-colors">Nosotros</Link>
        </nav>

        {/* CTAs — desktop */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <Link
                href={user?.role === "company" ? "/dashboard/company" : "/dashboard/candidate"}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#1a1a2e] hover:text-[#e91e8c] transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                Mi Panel
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-[#6b7280] hover:text-red-500 transition-colors p-2"
                title="Salir"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-[#1a1a2e] hover:text-[#e91e8c] transition-colors px-3 py-2 rounded-full border border-transparent hover:border-[#f0d4e8]"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register?type=candidate"
                className="text-sm font-bold text-[#1a1a2e] bg-white border-2 border-[#e91e8c] rounded-full px-5 py-2 hover:bg-[#fce4f3] transition-colors"
              >
                Dejá tu CV
              </Link>
              <Link
                href="/register?type=company"
                className="text-sm font-bold text-white bg-[#e91e8c] rounded-full px-5 py-2 hover:bg-[#c4177a] transition-colors shadow-sm"
              >
                Publicar aviso
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-[#1a1a2e]"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#f0d4e8] px-4 pb-5 pt-3 space-y-2">
          <Link href="/" className="block py-2 font-semibold text-[#1a1a2e]" onClick={() => setMobileOpen(false)}>Avisos</Link>
          <Link href="/empresas" className="block py-2 font-semibold text-[#1a1a2e]" onClick={() => setMobileOpen(false)}>Empresas</Link>
          <Link href="/planes" className="block py-2 font-semibold text-[#1a1a2e]" onClick={() => setMobileOpen(false)}>Planes</Link>
          <div className="pt-3 flex flex-col gap-3">
            <Link href="/login" className="text-center font-bold border-2 border-[#e91e8c] text-[#e91e8c] rounded-full py-2.5">Iniciar sesión</Link>
            <Link href="/register?type=company" className="text-center font-bold bg-[#e91e8c] text-white rounded-full py-2.5">Publicar aviso</Link>
          </div>
        </div>
      )}
    </header>
  );
}
