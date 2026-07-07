"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { UserIcon, BuildingOfficeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { clerkAppearance } from "@/lib/clerk-appearance";

function RegisterForm() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"candidate" | "company">(() => {
    const t = searchParams.get("type");
    return t === "company" ? "company" : "candidate";
  });

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
          <div className="inline-flex items-center gap-2.5 mb-5">
            <Image src="/logo.png" alt="BBJobs" width={36} height={36} className="object-contain" />
            <span className="font-display font-extrabold italic text-2xl tracking-tight">
              <span className="text-[#1E8EA3]">BB</span><span className="text-[#1C2230]">JOBS</span>
            </span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#1C2230] mb-2">Creá tu cuenta</h1>
          <p className="text-[#64748B] text-sm">Elegí cómo querés usar BBJobs</p>
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 shadow-sm">
          {/* Toggle de rol */}
          <div className="flex bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-1.5 mb-6">
            {(["candidate", "company"] as const).map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  role === r ? "bg-white text-[#1E8EA3] shadow-sm border border-[#DDE3EC]" : "text-[#64748B] hover:text-[#1C2230]"
                }`}
              >
                {r === "candidate"
                  ? <><UserIcon className="w-4 h-4" />Candidato</>
                  : <><BuildingOfficeIcon className="w-4 h-4" />Empresa</>}
              </button>
            ))}
          </div>

          <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl p-3.5 mb-6 text-sm text-[#1C2230] font-medium">
            {role === "candidate"
              ? "✓ Subí tu CV  ·  ✓ Postulate con un click  ·  ✓ Tu perfil es privado"
              : "✓ Publicá búsquedas  ·  ✓ Recibí postulaciones  ·  ✓ Empresa verificada por Talency"}
          </div>

          {/* Después de este paso viene el onboarding: ahí se completan los datos de
              negocio (candidato: nombre/apellido/teléfono; empresa: razón social, CUIT,
              industria, ubicación, responsable). unsafeMetadata.role es sólo una intención
              del cliente — el backend decide el rol real en el onboarding (ver plan §8). */}
          <SignUp
            key={role}
            routing="path"
            path="/register"
            signInUrl="/login"
            fallbackRedirectUrl="/onboarding"
            unsafeMetadata={{ role }}
            appearance={clerkAppearance}
          />
        </div>
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
