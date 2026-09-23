"use client";

import { useState, useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { clerkAppearance } from "@/lib/clerk-appearance";
import RoleChooser, { RoleBanner, SIGNUP_ROLE_KEY, type SignupRole } from "@/components/auth/RoleChooser";

function RegisterForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  const paramRole: SignupRole | null = typeParam === "company" || typeParam === "candidate" ? typeParam : null;

  // <SignUp routing="path"> navega a subrutas propias (/register/verify-email-address,
  // /register/sso-callback…) y no garantiza conservar ?type. El selector va SÓLO en /register
  // exacto: si apareciera en una subruta, la persona vería las tarjetas en lugar del campo del
  // código y el alta quedaría trabada. En las subrutas el rol sale del respaldo en localStorage.
  const isRoot = pathname === "/register";
  const [storedRole] = useState<SignupRole | null>(() => {
    if (typeof window === "undefined") return null;
    const r = localStorage.getItem(SIGNUP_ROLE_KEY);
    return r === "company" || r === "candidate" ? r : null;
  });
  const role: SignupRole | null = paramRole ?? (isRoot ? null : storedRole ?? "candidate");

  useEffect(() => {
    if (paramRole) localStorage.setItem(SIGNUP_ROLE_KEY, paramRole);
    // En el selector se borra: un alta abandonada no tiene que decidir el rol de la próxima.
    else if (isRoot) localStorage.removeItem(SIGNUP_ROLE_KEY);
  }, [paramRole, isRoot]);

  // `next` (no `redirect_url`) a propósito — ver comentario en /login/[[...rest]]/page.tsx:
  // un alta nueva siempre pasa por /onboarding primero, recién ahí volvemos al destino real.
  const next = searchParams.get("next");
  const nextQuery = next ? `next=${encodeURIComponent(next)}` : "";
  const fallbackRedirectUrl = next ? `/onboarding?${nextQuery}` : "/onboarding";
  const signInUrl = next ? `/login?redirect_url=${encodeURIComponent(next)}` : "/login";

  function choose(r: SignupRole) {
    router.replace(`/register?type=${r}${nextQuery ? `&${nextQuery}` : ""}`);
  }

  function backToChooser() {
    router.replace(`/register${nextQuery ? `?${nextQuery}` : ""}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-12 pb-12 bg-mesh relative overflow-x-hidden">
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
          <div className="inline-flex items-center gap-2.5 mb-5">
            <Image src="/logo.png" alt="BBJobs" width={36} height={36} className="object-contain" />
            <span className="font-display font-extrabold italic text-2xl tracking-tight">
              <span className="text-[#1E8EA3]">BB</span><span className="text-[#1C2230]">JOBS</span>
            </span>
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#1C2230] mb-2">
            {role ? "Creá tu cuenta" : "¿Cómo querés registrarte?"}
          </h1>
          <p className="text-[#64748B] text-sm">
            {role ? "Es gratis y te lleva un minuto" : "Elegí una opción para crear tu cuenta en BBJobs"}
          </p>
        </div>

        {!role ? (
          <>
            <RoleChooser onChoose={choose} />
            <p className="text-center text-sm text-[#64748B] mt-6">
              ¿Ya tenés cuenta?{" "}
              <Link href={signInUrl} className="font-bold text-[#1E8EA3] hover:underline">Ingresá</Link>
            </p>
          </>
        ) : (
          <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 sm:p-8 shadow-sm overflow-hidden">
            {/* En las subrutas de Clerk no se ofrece "Cambiar": el alta ya está en curso. */}
            {isRoot && <RoleBanner role={role} onChange={backToChooser} />}

            {/* Después de este paso viene el onboarding: ahí se completan los datos de
                negocio (candidato: nombre/apellido/teléfono; empresa: razón social, CUIT,
                industria, ubicación, responsable). unsafeMetadata.role es sólo una intención
                del cliente — el backend decide el rol real en el onboarding (ver plan §8). */}
            <SignUp
              key={role}
              routing="path"
              path="/register"
              signInUrl={signInUrl}
              fallbackRedirectUrl={fallbackRedirectUrl}
              unsafeMetadata={{ role }}
              appearance={clerkAppearance}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#64748B]">Cargando...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
