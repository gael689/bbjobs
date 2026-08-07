"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { api } from "@/lib/api";

/**
 * Puente post-login: decide si el usuario va al dashboard (onboarding ya completo)
 * o al onboarding (recién se registró / no había terminado de completar sus datos).
 *
 * La decisión depende de `GET /me`, y por eso esta pantalla reintenta en vez de
 * resolver al primer intento. El backend duerme cuando no tiene tráfico: la
 * primera llamada después de un rato puede tardar decenas de segundos, y antes
 * esta página se quedaba en "Redirigiendo…" sin decir nada ni ofrecer salida.
 *
 * Y sobre todo: un fallo de red YA NO manda al onboarding. El `.catch` que hacía
 * eso mandaba a rehacer el alta a alguien que la tenía terminada hace meses,
 * sólo porque la API no contestó a tiempo. Ante un error se muestra el error.
 */
const INTENTOS = 4;
const ESPERA_MS = 2000;

export default function PostLoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [demorando, setDemorando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const resolverDestino = useCallback(async () => {
    // El `setFallo(false)` de reinicio iba acá y disparaba la regla de React
    // sobre setState síncrono dentro de un efecto (rompía el lint del CI). No
    // hace falta: el estado sólo se ensucia cuando falla, y el botón de
    // reintentar lo limpia antes de volver a llamar.
    for (let intento = 1; intento <= INTENTOS; intento++) {
      try {
        const r = await api.get("/me", { timeout: 15000 });
        router.replace(
          r.data.onboarding_complete ? `/dashboard/${r.data.role}` : "/onboarding",
        );
        return;
      } catch {
        // Del segundo intento en adelante se avisa que está tardando: sin esto
        // la pantalla parece colgada y el usuario recarga, que es lo peor que
        // puede hacer justo cuando el backend está despertando.
        setDemorando(true);
        if (intento < INTENTOS) {
          await new Promise(r => setTimeout(r, ESPERA_MS * intento));
        }
      }
    }
    setFallo(true);
  }, [router]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    // La regla apunta a los setState sincrónicos, que encadenan renders. Acá
    // no hay ninguno: `resolverDestino` sólo toca el estado DESPUÉS de que la
    // llamada a la API falla o termina, o sea después de I/O. El análisis
    // estático no puede ver esa diferencia — sólo ve que la función llama a
    // setState en algún lado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resolverDestino();
  }, [isLoaded, isSignedIn, router, resolverDestino]);

  if (fallo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mesh px-4">
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 max-w-md text-center">
          <p className="font-display font-bold text-[#1C2230]">
            No pudimos abrir tu panel
          </p>
          <p className="text-sm text-[#64748B] mt-2">
            Tu sesión está iniciada, pero el servidor no respondió. Suele ser
            momentáneo.
          </p>
          <button
            onClick={() => {
              setFallo(false);
              setDemorando(false);
              resolverDestino();
            }}
            className="mt-5 bg-[#1E8EA3] text-white font-bold rounded-lg px-5 py-2.5 text-sm hover:bg-[#187B8E] transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-[#64748B] bg-mesh px-4 text-center">
      <p>Redirigiendo…</p>
      {demorando && (
        <p className="text-sm">
          Está tardando un poco más de lo normal. Ya casi.
        </p>
      )}
    </div>
  );
}
