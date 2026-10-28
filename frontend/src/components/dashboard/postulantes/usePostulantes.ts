"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useListaPaginada } from "@/hooks/useListaPaginada";
import { aParametros, type ConteosPostulantes, type FiltrosPostulantes } from "./filtros";

export type Lado = "empresa" | "admin";

/** Lo mínimo que la estrella y la marca de visto necesitan de una fila. */
export interface FilaPostulante {
  id: string;
  seen_at?: string | null;
  starred_at?: string | null;
}

const RUTAS: Record<Lado, { lista: (job: string) => string; conteos: (job: string) => string; estrella: (app: string) => string }> = {
  empresa: {
    lista: job => `/me/company/jobs/${job}/applications`,
    conteos: job => `/me/company/jobs/${job}/applications/counts`,
    estrella: app => `/me/company/applications/${app}/star`,
  },
  admin: {
    lista: job => `/admin/jobs/${job}/applications`,
    conteos: job => `/admin/jobs/${job}/applications/counts`,
    estrella: app => `/admin/applications/${app}/star`,
  },
};

/**
 * Los postulantes de una búsqueda con el buscador, los chips y la estrella, para la empresa o
 * para Talency. Cada lado le pega a sus propios endpoints, y por eso cada uno ve sólo su
 * estrella y su marca de visto.
 */
export function usePostulantes<T extends FilaPostulante>(
  lado: Lado,
  jobId: string | null,
  filtros: FiltrosPostulantes,
  opciones: { pageSize?: number } = {},
) {
  const rutas = RUTAS[lado];
  const lista = useListaPaginada<T>(
    jobId ? rutas.lista(jobId) : null,
    aParametros(filtros),
    { debounceMs: 300, pageSize: opciones.pageSize },
  );

  // Los conteos se piden al cambiar de búsqueda; la estrella y el visto los retocan en el
  // lugar en vez de volver a pedirlos.
  const [conteos, setConteos] = useState<{ job: string; datos: ConteosPostulantes | null } | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let vigente = true;
    api.get<ConteosPostulantes>(rutas.conteos(jobId))
      .then(r => { if (vigente) setConteos({ job: jobId, datos: r.data }); })
      .catch(() => { if (vigente) setConteos({ job: jobId, datos: null }); });
    return () => { vigente = false; };
  }, [jobId, rutas]);
  const conteosVigentes = conteos && conteos.job === jobId ? conteos.datos : null;

  function retocarConteos(fn: (c: ConteosPostulantes) => ConteosPostulantes) {
    setConteos(prev => (prev && prev.datos ? { ...prev, datos: fn(prev.datos) } : prev));
  }

  /** Pone o saca la estrella. Se ve al instante y vuelve atrás si el servidor falla. */
  async function alternarEstrella(fila: T): Promise<boolean> {
    const poner = !fila.starred_at;
    const provisoria = poner ? new Date().toISOString() : null;
    lista.actualizarItems(prev => prev.map(a => (a.id === fila.id ? { ...a, starred_at: provisoria } : a)));
    retocarConteos(c => ({ ...c, starred: c.starred + (poner ? 1 : -1) }));
    try {
      const r = poner ? await api.put(rutas.estrella(fila.id)) : await api.delete(rutas.estrella(fila.id));
      const real = (r.data as { starred_at: string | null }).starred_at;
      lista.actualizarItems(prev => prev.map(a => (a.id === fila.id ? { ...a, starred_at: real } : a)));
      return true;
    } catch {
      lista.actualizarItems(prev => prev.map(a => (a.id === fila.id ? { ...a, starred_at: fila.starred_at } : a)));
      retocarConteos(c => ({ ...c, starred: c.starred + (poner ? -1 : 1) }));
      return false;
    }
  }

  /** Después de abrir la ficha o el CV: el backend ya marcó el visto, acá se refleja. */
  function marcarVista(appId: string) {
    const fila = lista.items.find(a => a.id === appId);
    if (!fila || fila.seen_at) return;
    lista.actualizarItems(prev => prev.map(a => (a.id === appId ? { ...a, seen_at: new Date().toISOString() } : a)));
    retocarConteos(c => ({ ...c, unseen: Math.max(0, c.unseen - 1) }));
  }

  return { ...lista, conteos: conteosVigentes, alternarEstrella, marcarVista, retocarConteos };
}
