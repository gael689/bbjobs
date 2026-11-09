"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CartelAviso } from "@/components/notifications/AvisoEmergente";
import type { NotificationItemData } from "@/hooks/useNotifications";

export interface RecomendadosPendientes {
  total: number;
  jobs: { job_id: string; title: string; count: number }[];
}

/**
 * La "bombita" de la empresa (PLAN-FINAL-IA-Y-MAILS §4): "5 candidatos que encajan con
 * Operario/a. Ver ahora". Depende de lo **pendiente** (recomendados ≥ 70 que todavía no miró, por
 * búsqueda; llegan en el pedido de la campanita) y no de un aviso suelto: deja de salir cuando la
 * empresa abre los Recomendados de esa búsqueda.
 *
 * Como mucho **una vez por día por usuario** (fecha en el navegador). Si al entrar no hay nada
 * pendiente, no se gasta el día: sale cuando aparezca algo, también desde el día 1 de la búsqueda.
 */
const CLAVE = "bbjobs:bombita-recomendados";

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yaSalioHoy(usuario: string): boolean {
  try {
    return localStorage.getItem(`${CLAVE}:${usuario}`) === hoy();
  } catch {
    return false;
  }
}

function recordarHoy(usuario: string) {
  try {
    localStorage.setItem(`${CLAVE}:${usuario}`, hoy());
  } catch {
    // sin almacenamiento: a lo sumo sale de nuevo en la próxima carga del panel
  }
}

export function textoBombita(count: number, puesto: string): string {
  return count === 1 ? `1 candidato que encaja con ${puesto}` : `${count} candidatos que encajan con ${puesto}`;
}

export default function BombitaRecomendados({ pendientes, usuario }: {
  pendientes: RecomendadosPendientes | null;
  usuario: string | null | undefined;
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<NotificationItemData | null>(null);
  const [saliendo, setSaliendo] = useState(false);
  const mostrada = useRef(false);

  useEffect(() => {
    if (mostrada.current || !usuario || !pendientes || pendientes.total === 0) return;
    if (yaSalioHoy(usuario)) {
      mostrada.current = true;
      return;
    }
    // La búsqueda con más candidatos sin mirar (el backend las manda ordenadas).
    const job = pendientes.jobs[0];
    if (!job) return;
    mostrada.current = true;
    recordarHoy(usuario);
    setTimeout(() => {
      setSaliendo(false);
      setAviso({
        id: `bombita-${job.job_id}`, type: "recommended_pending", title: textoBombita(job.count, job.title),
        body: "", link: `/dashboard/company/recomendados?busqueda=${job.job_id}`, is_read: false,
        created_at: new Date().toISOString(),
      });
    }, 0);
  }, [pendientes, usuario]);

  const cerrar = useCallback(() => {
    setSaliendo(true);
    setTimeout(() => { setAviso(null); setSaliendo(false); }, 220);
  }, []);

  function ver() {
    if (aviso?.link) router.push(aviso.link);
    cerrar();
  }

  return (
    <>
      <div aria-live="polite" className="sr-only">{aviso ? aviso.title : ""}</div>
      {aviso && <CartelAviso aviso={aviso} saliendo={saliendo} onVer={ver} onCerrar={cerrar} />}
    </>
  );
}
