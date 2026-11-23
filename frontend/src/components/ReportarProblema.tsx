"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/nextjs";
import { BugAntIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";

/**
 * Botón "Reportar un problema" (pie del sitio y barra de los paneles). El reporte va a
 * Admin → Mensajes con el tema `problema`; la página donde estaba la persona se manda sola y,
 * con sesión iniciada, el backend sabe quién es por el token (acá no se manda).
 */
export default function ReportarProblema({ variante }: { variante: "pie" | "panel" }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      {variante === "panel" ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-bold text-[#A9C0C6] hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors"
        >
          <BugAntIcon className="w-4 h-4" />
          Reportar un problema
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="text-[#64748B] hover:text-[#1E8EA3] transition-colors font-medium"
        >
          Reportar un problema
        </button>
      )}
      {/* En un portal: el pie y la barra del panel arman su propio orden de capas y, adentro de
          ellos, el cartel de cookies quedaba por encima de la ventana. */}
      {abierto && createPortal(<VentanaReporte onCerrar={() => setAbierto(false)} />, document.body)}
    </>
  );
}

function VentanaReporte({ onCerrar }: { onCerrar: () => void }) {
  const { isSignedIn } = useAuth();
  const [descripcion, setDescripcion] = useState("");
  const [contacto, setContacto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const textoRef = useRef<HTMLTextAreaElement>(null);
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => { onCerrarRef.current = onCerrar; }, [onCerrar]);

  useEffect(() => {
    textoRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrarRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (descripcion.trim().length < 5) {
      setError("Contanos un poco más qué pasó.");
      return;
    }
    setEnviando(true);
    setError("");
    try {
      await api.post("/contact/problema", {
        descripcion: descripcion.trim(),
        pagina: (window.location.pathname + window.location.search).slice(0, 500),
        contacto: isSignedIn ? undefined : contacto.trim() || undefined,
      });
      setEnviado(true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 429
          ? "Mandaste varios reportes seguidos. Esperá un minuto y probá de nuevo."
          : "No pudimos enviar el reporte. Probá de nuevo o escribinos desde Contacto.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1C2230]/60 px-4 py-6" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reporte-titulo"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md max-h-full overflow-y-auto rounded-2xl bg-white p-6 text-left shadow-2xl"
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] hover:bg-[#FAFBFD] hover:text-[#1C2230]"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        {enviado ? (
          <div className="py-4 text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-[#1E8EA3]" />
            <h2 id="reporte-titulo" className="mt-3 font-display text-xl font-extrabold text-[#1C2230]">¡Gracias por avisarnos!</h2>
            <p className="mt-2 text-sm text-[#64748B]">
              El equipo de BBJobs ya lo recibió y lo va a revisar.
            </p>
            <button
              type="button"
              onClick={onCerrar}
              className="mt-5 w-full rounded-xl bg-[#1E8EA3] px-4 py-3 text-sm font-bold text-white hover:bg-[#187B8E]"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <div className="pr-8">
              <h2 id="reporte-titulo" className="font-display text-xl font-extrabold text-[#1C2230]">Reportar un problema</h2>
              <p className="mt-1 text-sm text-[#64748B]">
                ¿Algo no anda o se ve mal? Contanos qué estabas haciendo y qué pasó. Ya nos llega en qué página estás.
              </p>
            </div>
            <div>
              <label htmlFor="reporte-descripcion" className="block text-sm font-bold text-[#1C2230] mb-1.5">Qué pasó</label>
              <textarea
                id="reporte-descripcion"
                ref={textoRef}
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                maxLength={2000}
                rows={5}
                required
                placeholder="Ej.: toqué «Postularme» y la pantalla quedó en blanco."
                className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
              />
            </div>
            {!isSignedIn && (
              <div>
                <label htmlFor="reporte-contacto" className="block text-sm font-bold text-[#1C2230] mb-1.5">
                  Tu mail o teléfono <span className="font-normal text-[#64748B]">(opcional, para responderte)</span>
                </label>
                <input
                  id="reporte-contacto"
                  value={contacto}
                  onChange={e => setContacto(e.target.value)}
                  maxLength={255}
                  className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
                />
              </div>
            )}
            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-xl bg-[#1E8EA3] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#187B8E] disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Enviar reporte"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
