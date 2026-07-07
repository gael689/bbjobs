"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/lib/api";

/**
 * Puente post-login: decide si el usuario va al dashboard (onboarding ya completo)
 * o al onboarding (recién se registró / no había terminado de completar sus datos).
 */
export default function PostLoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    api.get("/me")
      .then(r => {
        router.replace(r.data.onboarding_complete ? `/dashboard/${r.data.role}` : "/onboarding");
      })
      .catch(() => router.replace("/onboarding"));
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-[#64748B] bg-mesh">
      Redirigiendo...
    </div>
  );
}
