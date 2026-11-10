"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";

/**
 * Ids de las búsquedas que encajan con el perfil del candidato logueado, para el chip "Encaja con
 * tu perfil" de los listados públicos (/empleos, home).
 *
 * Todo pasa en el navegador y después de cargar: la página sigue estática/ISR (nada de render en
 * servidor ni de trabajo en proxy.ts — Vercel ya nos frenó una vez por CPU). Un solo pedido a
 * `GET /me/candidate/recommended-job-ids`, compartido entre pantallas por 5 minutos. Sin sesión
 * de candidato, o con la compuerta cerrada (404), devuelve un conjunto vacío y no muestra nada.
 */
const VIGENCIA_MS = 5 * 60 * 1000;
let cache: { userId: string; at: number; ids: Promise<Set<string>> } | null = null;

function pedirIds(userId: string): Promise<Set<string>> {
  if (cache && cache.userId === userId && Date.now() - cache.at < VIGENCIA_MS) return cache.ids;
  const ids = api.get<{ job_ids: string[] }>("/me/candidate/recommended-job-ids")
    .then(r => new Set(r.data.job_ids.map(id => id.toLowerCase())))
    .catch(() => new Set<string>());
  cache = { userId, at: Date.now(), ids };
  return ids;
}

const VACIO: ReadonlySet<string> = new Set();

export function useEncajaConTuPerfil(): ReadonlySet<string> {
  const { isSignedIn, user } = useUser();
  const userId = isSignedIn && user?.publicMetadata?.role === "candidate" ? user.id : null;
  const [ids, setIds] = useState<{ userId: string; ids: ReadonlySet<string> } | null>(null);

  useEffect(() => {
    if (!MODULOS_NUEVOS_VISIBLES || !userId) return;
    let vigente = true;
    pedirIds(userId).then(s => { if (vigente) setIds({ userId, ids: s }); });
    return () => { vigente = false; };
  }, [userId]);

  // Si cambió la sesión (salió o entró otro), no se muestra lo del usuario anterior.
  return ids && ids.userId === userId ? ids.ids : VACIO;
}
