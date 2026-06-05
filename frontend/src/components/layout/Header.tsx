"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { api, setAccessToken } from "@/lib/api";
import { UserIcon, ArrowRightOnRectangleIcon, Bars3Icon, XMarkIcon, SparklesIcon } from "@heroicons/react/24/outline";

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
    <div className="sticky top-6 z-50 w-full px-4 flex justify-center pointer-events-none">
      <header className="w-full max-w-5xl bg-white/30 backdrop-blur-xl backdrop-saturate-150 border border-white/60 rounded-full shadow-lg shadow-[#1E8EA3]/10 pointer-events-auto">
        <div className="px-6 flex h-16 items-center justify-between gap-4">

        {/* ── Logo ── */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <Image src="/logo.png" alt="BBJobs" width={32} height={32} className="object-contain" priority />
          <span className="font-display font-extrabold text-[22px] tracking-tight leading-none text-[#1C2230]">
            <span className="text-[#1E8EA3]">BB</span>JOBS
          </span>
        </Link>

        {/* ── Nav links desktop ── */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#64748B]">
          <Link href="/" className="hover:text-[#1E8EA3] transition-colors">Avisos</Link>
          <Link href="/empresas" className="hover:text-[#1E8EA3] transition-colors">Empresas</Link>
          <Link href="/planes" className="hover:text-[#1E8EA3] transition-colors">Planes</Link>
          {/* Badge IA */}
          <Link
            href="/ia"
            className="flex items-center gap-1.5 text-[#1E8EA3] bg-[#E6F4F7] px-3 py-1.5 rounded-full font-bold text-xs border border-[#9ED4DF] hover:bg-[#1E8EA3] hover:text-white transition-all"
          >
            <span className="ai-dot w-1.5 h-1.5 rounded-full bg-[#1E8EA3] inline-block" />
            IA Matching
          </Link>
        </nav>

        {/* ── CTAs desktop ── */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Link
                href={user?.role === "company" ? "/dashboard/company" : "/dashboard/candidate"}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#1C2230] hover:text-[#1E8EA3] transition-colors px-3 py-2"
              >
                <UserIcon className="w-4 h-4" />
                Mi Panel
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-[#64748B] hover:text-red-500 transition-colors"
                title="Salir"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-[#1C2230] hover:text-[#1E8EA3] transition-colors px-3 py-2 rounded-lg"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register?type=candidate"
                className="text-sm font-bold text-[#1E8EA3] border-2 border-[#1E8EA3] rounded-lg px-4 py-2 hover:bg-[#E6F4F7] transition-colors"
              >
                Dejá tu CV
              </Link>
              <Link
                href="/register?type=company"
                className="text-sm font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] rounded-lg px-4 py-2 transition-colors shadow-sm"
              >
                Publicar aviso
              </Link>
            </>
          )}
        </div>

        {/* ── Mobile hamburger ── */}
        <button className="md:hidden p-2 text-[#1C2230]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#DDE3EC] px-4 pb-6 pt-3 space-y-1">
          {[
            { href: "/", label: "Avisos" },
            { href: "/empresas", label: "Empresas" },
            { href: "/planes", label: "Planes" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="block py-2.5 font-semibold text-[#1C2230] hover:text-[#1E8EA3] transition-colors" onClick={() => setMobileOpen(false)}>{label}</Link>
          ))}
          <Link href="/ia" className="flex items-center gap-2 py-2.5 font-bold text-[#1E8EA3]" onClick={() => setMobileOpen(false)}>
            <SparklesIcon className="w-4 h-4" /> IA Matching
          </Link>
          <div className="pt-4 flex flex-col gap-3">
            <Link href="/login" className="text-center font-bold border-2 border-[#1E8EA3] text-[#1E8EA3] rounded-lg py-2.5 hover:bg-[#E6F4F7]">Iniciar sesión</Link>
            <Link href="/register?type=company" className="text-center font-bold bg-[#1E8EA3] text-white rounded-lg py-2.5 hover:bg-[#187B8E]">Publicar aviso</Link>
          </div>
        </div>
      )}
      </header>
    </div>
  );
}
