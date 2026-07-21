"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { UserIcon, ArrowRightOnRectangleIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import NotificationBell from "@/components/notifications/NotificationBell";

export default function Header() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ redirectUrl: "/" });
  };

  // Los paneles (admin/empresa/candidato) y las pantallas de login/registro/onboarding
  // tienen su propia barra simplificada (volver al inicio, sin menú público)
  const hideNavbar =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/register") ||
    pathname?.startsWith("/onboarding");
  if (hideNavbar) return null;

  return (
    <div className="fixed top-6 left-0 right-0 z-50 w-full px-4 flex justify-center pointer-events-none">
      <header className={`w-full max-w-6xl bg-gradient-to-b from-white to-[#F1F5F9] border border-white shadow-[inset_0_2px_4px_rgba(255,255,255,1),0_8px_32px_rgba(30,142,163,0.15)] pointer-events-auto overflow-hidden ${mobileOpen ? "rounded-[32px]" : "rounded-full"}`}>
        <div className="px-8 flex h-[76px] items-center justify-between gap-4">

        <div className="flex items-center gap-8">
          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <Image src="/logo.png" alt="BBJobs" width={32} height={32} className="object-contain" priority />
            <span className="font-display font-extrabold italic text-[24px] tracking-tight leading-none text-[#1C2230]">
              <span className="text-[#1E8EA3]">BB</span>JOBS
            </span>
          </Link>

          {/* ── Nav links desktop ── */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#64748B]">
            <Link href="/empleos" className="hover:text-[#1E8EA3] transition-colors">Empleos</Link>
            <Link href="/empresas" className="hover:text-[#1E8EA3] transition-colors">Empresas</Link>
            <Link href="/contacto" className="hover:text-[#1E8EA3] transition-colors">Contacto</Link>
          </nav>
        </div>

        {/* ── CTAs desktop ── */}
        <div className="hidden md:flex items-center gap-2">
          {isSignedIn ? (
            <>
              <button
                onClick={() => router.push("/post-login")}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#1C2230] hover:text-[#1E8EA3] transition-colors px-3 py-2"
              >
                <UserIcon className="w-4 h-4" />
                Mi Panel
              </button>
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

        {/* ── Notification bell (visible at all breakpoints when authenticated) ── */}
        {isSignedIn && <NotificationBell />}

        {/* ── Mobile hamburger ── */}
        <button className="md:hidden p-2 text-[#1C2230]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-[#DDE3EC] px-4 pb-6 pt-3 space-y-3">
          <div className="flex flex-col gap-1">
            {[
              { href: "/empleos", label: "Empleos" },
              { href: "/empresas", label: "Empresas" },
              { href: "/contacto", label: "Contacto" },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="block text-center py-3 font-bold text-base text-[#1C2230] hover:text-[#1E8EA3] hover:bg-[#F1F5F9] rounded-xl transition-colors" onClick={() => setMobileOpen(false)}>{label}</Link>
            ))}
          </div>
          <div className="pt-1 flex flex-col gap-3">
            {isSignedIn ? (
              <button onClick={handleLogout} className="text-center font-bold border-2 border-red-200 text-red-500 rounded-lg py-2.5 hover:bg-red-50">
                Salir
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="text-center font-bold border-2 border-[#1E8EA3] text-[#1E8EA3] rounded-lg py-2.5 hover:bg-[#E6F4F7]">Iniciar sesión</Link>
                <Link href="/register?type=candidate" onClick={() => setMobileOpen(false)} className="text-center font-bold border-2 border-[#1E8EA3] text-[#1E8EA3] rounded-lg py-2.5 hover:bg-[#E6F4F7]">Dejá tu CV</Link>
                <Link href="/register?type=company" onClick={() => setMobileOpen(false)} className="text-center font-bold bg-[#1E8EA3] text-white rounded-lg py-2.5 hover:bg-[#187B8E]">Publicar aviso</Link>
              </>
            )}
          </div>
        </div>
      )}
      </header>
    </div>
  );
}
