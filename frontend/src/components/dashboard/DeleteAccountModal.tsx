"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ExclamationTriangleIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface DeletionPreview {
  user_id: string;
  role: "company" | "candidate";
  email: string;
  display_name: string;
  mode: "full" | "tombstone";
  counts: Record<string, number>;
}

const COUNT_LABEL: Record<string, [string, string]> = {
  busquedas: ["búsqueda publicada", "búsquedas publicadas"],
  postulaciones_recibidas: ["postulación recibida", "postulaciones recibidas"],
  postulaciones: ["postulación", "postulaciones"],
  pagos: ["pago registrado", "pagos registrados"],
  desbloqueos: ["desbloqueo en la Base de Talento", "desbloqueos en la Base de Talento"],
};

function errorMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : "No se pudo eliminar la cuenta. Probá de nuevo.";
}

/**
 * Confirmación de "Eliminar cuenta" en el panel de la admin (pedido de Eugenia, 23/09/2026: que
 * quien se registró por error pueda volver a registrarse con el mismo mail).
 *
 * No pide tipear nada: muestra a quién se borra (nombre, mail) y qué tiene la cuenta, y con eso
 * alcanza (decisión D9 del plan). Qué se borra y qué se conserva lo decide el backend.
 */
export default function DeleteAccountModal({
  userId,
  onClose,
  onDeleted,
}: {
  userId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get(`/admin/users/${userId}/deletion-preview`)
      .then(r => setPreview(r.data))
      .catch(err => setLoadError(errorMessage(err)));
  }, [userId]);

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/admin/users/${userId}`);
      setDone(true);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const counts = preview ? Object.entries(preview.counts).filter(([, n]) => n > 0) : [];

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DDE3EC]">
          <h2 className="text-lg font-display font-bold text-[#1C2230]">Eliminar cuenta</h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#1C2230]" aria-label="Cerrar">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="text-center py-2">
              <p className="font-bold text-[#1C2230] mb-1">Cuenta eliminada</p>
              <p className="text-sm text-[#64748B] mb-5">
                Ya puede registrarse de nuevo con <strong>{preview?.email}</strong>.
              </p>
              <button onClick={onClose} className="text-sm font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white px-5 py-2.5 rounded-xl">
                Listo
              </button>
            </div>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : !preview ? (
            <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-4 mb-4">
                <p className="font-bold text-[#1C2230]">{preview.display_name}</p>
                <p className="text-sm text-[#64748B]">{preview.email}</p>
                <p className="text-xs text-[#64748B] mt-2">
                  {preview.role === "company" ? "Empresa" : "Candidato"}
                  {counts.length === 0
                    ? " · sin actividad"
                    : " · " + counts.map(([k, n]) => `${n} ${(COUNT_LABEL[k] ?? [k, k])[n === 1 ? 0 : 1]}`).join(" · ")}
                </p>
              </div>

              <p className="text-sm text-[#1C2230] mb-2">
                {preview.mode === "full"
                  ? "Se borra la cuenta con todos sus datos."
                  : preview.role === "company"
                  ? "Se borran los datos de la empresa y su acceso, y sus búsquedas se dan de baja. Las postulaciones y los pagos quedan registrados, sin datos de la empresa."
                  : "Se borran sus datos personales, su CV y su acceso. Las postulaciones y desbloqueos quedan registrados como “Candidato eliminado”, así las empresas no pierden su historial."}
              </p>
              <p className="text-sm text-[#1C2230] mb-4">
                Después va a poder <strong>registrarse de nuevo con el mismo mail</strong>.
              </p>

              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-5">
                <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                Esta acción no se puede deshacer.
              </div>

              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

              <div className="flex gap-3 justify-end">
                <button onClick={onClose} className="text-sm font-bold border border-[#DDE3EC] text-[#1C2230] px-4 py-2.5 rounded-xl hover:bg-[#FAFBFD]">
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-sm font-bold bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl disabled:opacity-60"
                >
                  <TrashIcon className="w-4 h-4" />
                  {deleting ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Zona de peligro al pie de un perfil del panel de admin, separada de las acciones de rutina. */
export function DeleteAccountZone({ onClick }: { onClick: () => void }) {
  return (
    <div className="mt-8 pt-5 border-t border-[#DDE3EC] flex items-center justify-between gap-4 flex-wrap">
      <p className="text-xs text-[#64748B]">
        ¿Se registró por error? Eliminar la cuenta le permite registrarse de nuevo con el mismo mail.
      </p>
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 text-xs font-bold border border-red-200 text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
      >
        <TrashIcon className="w-4 h-4" />
        Eliminar cuenta
      </button>
    </div>
  );
}
