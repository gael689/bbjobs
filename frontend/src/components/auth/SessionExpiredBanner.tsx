"use client";

import { useSyncExternalStore } from "react";
import { useClerk } from "@clerk/nextjs";
import { SESSION_EXPIRED_EVENT, SESSION_RESTORED_EVENT, isSessionExpired } from "@/lib/api";

function subscribe(onChange: () => void) {
  window.addEventListener(SESSION_EXPIRED_EVENT, onChange);
  window.addEventListener(SESSION_RESTORED_EVENT, onChange);
  return () => {
    window.removeEventListener(SESSION_EXPIRED_EVENT, onChange);
    window.removeEventListener(SESSION_RESTORED_EVENT, onChange);
  };
}

/**
 * Aviso fijo cuando la API rechazó la sesión aun después de reintentar con un token nuevo
 * (ver lib/api.ts). Sin esto la persona veía "Error al guardar" y nada más, sin saber que
 * bastaba con volver a entrar.
 */
export default function SessionExpiredBanner() {
  const { signOut } = useClerk();
  const expired = useSyncExternalStore(subscribe, isSessionExpired, () => false);

  if (!expired) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] bg-[#1C2230] text-white px-4 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm shadow-lg"
    >
      <span>Tu sesión venció. Volvé a iniciar sesión para guardar tus cambios.</span>
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: "/login" })}
        className="bg-white text-[#1C2230] font-bold rounded-lg px-4 py-1.5 hover:bg-[#E6F4F7] transition-colors"
      >
        Iniciar sesión
      </button>
    </div>
  );
}
