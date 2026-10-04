"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";
import { detalleError } from "@/hooks/useModulo";

interface Preferencia {
  category: string;
  enabled: boolean;
  locked: boolean;
}

const NOMBRE: Record<string, { titulo: string; detalle: string }> = {
  cuenta: { titulo: "Avisos de tu cuenta y pagos", detalle: "Siempre llegan: verificación, pagos y seguridad." },
  postulaciones: { titulo: "Postulaciones", detalle: "Cambios de estado y postulaciones nuevas." },
  busquedas: { titulo: "Tus búsquedas", detalle: "Aprobación, vencimiento y cambios de tus búsquedas." },
  alertas: { titulo: "Alertas y resúmenes", detalle: "Búsquedas nuevas que coinciden con lo que buscás." },
  recordatorios: { titulo: "Recordatorios", detalle: "Por ejemplo, completar el perfil." },
  novedades: { titulo: "Novedades y ofertas de BBJobs", detalle: "Como mucho un mail por semana." },
  admin: { titulo: "Avisos del equipo", detalle: "Pagos, revisiones y pendientes del panel." },
};

/**
 * Qué mails recibe la persona. Módulo nuevo: si está oculto (variable de entorno) o el backend
 * responde 404 (compuerta cerrada), no se muestra nada.
 */
export default function PreferenciasMail() {
  const [prefs, setPrefs] = useState<Preferencia[] | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!MODULOS_NUEVOS_VISIBLES) return;
    api.get<Preferencia[]>("/me/email-preferences")
      .then(r => setPrefs(r.data))
      .catch(() => setPrefs(null));
  }, []);

  if (!MODULOS_NUEVOS_VISIBLES || !prefs || prefs.length === 0) return null;

  async function cambiar(categoria: string, enabled: boolean) {
    setGuardando(categoria);
    setError(null);
    try {
      const r = await api.put<Preferencia[]>("/me/email-preferences", { preferences: { [categoria]: enabled } });
      setPrefs(r.data);
    } catch (e) {
      setError(detalleError(e, "No se pudo guardar. Probá de nuevo."));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="pb-5 mb-5 border-b border-[#DDE3EC]">
      <p className="text-sm font-bold text-[#1C2230] mb-1">Mails que recibís</p>
      <p className="text-sm text-[#1C2230] mb-3">Elegí qué avisos te llegan por mail. En la plataforma los vas a ver igual.</p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="space-y-2">
        {prefs.map(p => {
          const n = NOMBRE[p.category] ?? { titulo: p.category, detalle: "" };
          return (
            <label key={p.category} className={`flex items-start gap-3 rounded-xl border border-[#DDE3EC] px-4 py-3 ${p.locked ? "bg-[#FAFBFD]" : "bg-white cursor-pointer hover:border-[#9ED4DF]"}`}>
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-[#187B8E]"
                checked={p.enabled}
                disabled={p.locked || guardando === p.category}
                onChange={e => cambiar(p.category, e.target.checked)}
              />
              <span className="flex-1">
                <span className="block text-sm font-bold text-[#1C2230]">{n.titulo}</span>
                <span className="block text-xs text-[#1C2230]">{p.locked ? "Siempre llegan." : n.detalle}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
