"use client";

import { useState } from "react";
import { SignIn } from "@clerk/nextjs";
import { ArrowLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function LoginPage() {
  const [emailCollision] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("reason") === "email_collision";
  });

  // Si venimos de un flujo como "postularme sin sesión" (?redirect_url=/empleos/...), Clerk
  // ya reconoce ese query param por su cuenta, pero lo pasamos también explícito acá para
  // no depender de ese comportamiento implícito.
  const [redirectUrl] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("redirect_url");
  });
  // A /register lo mandamos con `next` (no `redirect_url`) a propósito: un usuario nuevo
  // SIEMPRE tiene que pasar por /onboarding antes de poder postularse (ahí se crea su User
  // local — ver onboarding.py). Si usáramos `redirect_url` ahí, Clerk saltaría directo al
  // destino después del alta y se saltearía el onboarding.
  const signUpUrl = redirectUrl ? `/register?next=${encodeURIComponent(redirectUrl)}` : "/register";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-12 pb-12 bg-mesh relative">
      <Link
        href="/"
        className="fixed top-6 left-6 flex items-center justify-center w-11 h-11 rounded-full bg-white border border-[#DDE3EC] text-[#1C2230] hover:text-[#1E8EA3] shadow-sm transition-colors"
        aria-label="Volver al inicio"
        title="Volver al inicio"
      >
        <ArrowLeftIcon className="w-5 h-5" />
      </Link>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <Image src="/logo.png" alt="BBJobs" width={40} height={40} className="object-contain" />
            <span className="font-display font-extrabold italic text-2xl tracking-tight">
              <span className="text-[#1E8EA3]">BB</span><span className="text-[#1C2230]">JOBS</span>
            </span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#1C2230] mb-2">Bienvenido de vuelta</h1>
          <p className="text-[#64748B]">Ingresá a tu cuenta para continuar</p>
        </div>

        {emailCollision && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-5">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <span>Ya existe una cuenta con ese email. Iniciá sesión con el método original (email/contraseña o Google, el que hayas usado la primera vez).</span>
          </div>
        )}

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 shadow-sm">
          <SignIn
            routing="path"
            path="/login"
            signUpUrl={signUpUrl}
            fallbackRedirectUrl={redirectUrl || "/post-login"}
            appearance={clerkAppearance}
          />
        </div>
      </div>
    </div>
  );
}
