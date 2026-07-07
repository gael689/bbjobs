"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/lib/api";

/**
 * Gating compartido por los 3 paneles: exige sesión de Clerk, onboarding completo,
 * y que el rol autoritativo (según nuestra DB, vía GET /me) coincida con el del panel.
 * Si algo no calza, redirige al lugar correcto en vez de dejar la pantalla a medio cargar.
 */
export function useDashboardAuth(expectedRole: "candidate" | "company" | "admin") {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    api.get("/me")
      .then(r => {
        if (cancelled) return;
        if (!r.data.onboarding_complete) {
          router.replace("/onboarding");
        } else if (r.data.role !== expectedRole) {
          router.replace(`/dashboard/${r.data.role}`);
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, expectedRole, router]);

  return { ready };
}
