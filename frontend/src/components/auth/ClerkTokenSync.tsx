"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setTokenGetter } from "@/lib/api";

/**
 * Registra `getToken()` de Clerk en el módulo `lib/api.ts` para que el interceptor de
 * axios adjunte el session token de Clerk a cada request. No renderiza nada.
 */
export default function ClerkTokenSync() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [isLoaded, getToken]);

  return null;
}
