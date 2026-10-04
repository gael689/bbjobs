"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export type EstadoModulo<T> =
  | { estado: "cargando" }
  | { estado: "en_desarrollo" }      // el backend respondió 404: compuerta cerrada
  | { estado: "error"; mensaje: string }
  | { estado: "listo"; datos: T };

/** Detalle legible de un error de la API (FastAPI manda `detail`). */
export function detalleError(e: unknown, porDefecto = "Algo salió mal. Probá de nuevo."): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof d === "string") return d;
  return porDefecto;
}

function aEstado<T>(e: unknown): EstadoModulo<T> {
  const status = (e as { response?: { status?: number } })?.response?.status;
  return status === 404 ? { estado: "en_desarrollo" } : { estado: "error", mensaje: detalleError(e) };
}

/**
 * Carga un endpoint de un módulo nuevo. Un 404 significa que el módulo está detrás de la
 * compuerta (producción): la pantalla muestra "En desarrollo".
 */
export function useModulo<T>(ruta: string | null, params?: Record<string, unknown>) {
  const [estado, setEstado] = useState<EstadoModulo<T>>({ estado: "cargando" });
  const clave = JSON.stringify(params ?? {});

  // La carga inicial actualiza el estado sólo dentro de la promesa (nunca de forma síncrona en
  // el efecto) y se descarta si la ruta cambió antes de que vuelva.
  useEffect(() => {
    if (!ruta) return;
    let vigente = true;
    api.get<T>(ruta, { params: JSON.parse(clave) })
      .then((r) => { if (vigente) setEstado({ estado: "listo", datos: r.data }); })
      .catch((e) => { if (vigente) setEstado(aEstado<T>(e)); });
    return () => { vigente = false; };
  }, [ruta, clave]);

  const recargar = useCallback(async () => {
    if (!ruta) return;
    try {
      const r = await api.get<T>(ruta, { params: JSON.parse(clave) });
      setEstado({ estado: "listo", datos: r.data });
    } catch (e) {
      setEstado(aEstado<T>(e));
    }
  }, [ruta, clave]);

  return { ...estado, recargar } as EstadoModulo<T> & { recargar: () => Promise<void> };
}
