"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { LEGAL_VERSION, LEGAL_VIGENTE_DESDE } from "@/lib/legal";

// Pide aceptar la versión vigente de los términos y la privacidad a quien todavía no la aceptó
// (todas las cuentas creadas antes de la 2.0, y quien se registre con un formulario viejo). El
// backend decide (`GET /me/legal`); a los admins nunca se lo pide. No tapa las páginas públicas.
export default function LegalGate() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [pendiente, setPendiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSignedIn) return;
    api.get("/me/legal")
      .then(r => setPendiente(Boolean(r.data.pendiente)))
      .catch(() => {}); // sin perfil todavía (onboarding) o backend caído: no se bloquea nada
  }, [isSignedIn]);

  async function aceptar() {
    setEnviando(true);
    setError("");
    try {
      await api.post("/me/legal/accept");
      setPendiente(false);
    } catch {
      setError("No pudimos guardar tu aceptación. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!pendiente) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#1C2230]/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="legal-gate-title">
      <div className="bg-white rounded-2xl max-w-lg w-full p-7 shadow-xl">
        <h2 id="legal-gate-title" className="font-display font-bold text-xl text-[#1C2230] mb-3">
          Actualizamos los términos y la política de privacidad
        </h2>
        <p className="text-sm text-[#64748B] mb-3">
          Versión {LEGAL_VERSION}, vigente desde el {LEGAL_VIGENTE_DESDE}. Ahora describen todo lo que hace BBJobs:
        </p>
        <ul className="list-disc pl-5 text-sm text-[#1C2230] space-y-1 mb-4">
          <li>Cómo funciona la Base de Talento y quién puede ver tu perfil.</li>
          <li>Los servicios pagos, Mercado Pago y el botón de arrepentimiento.</li>
          <li>Qué proveedores procesan datos y en qué países.</li>
          <li>Tus derechos sobre tus datos y en qué plazos te respondemos.</li>
        </ul>
        <p className="text-sm text-[#64748B] mb-5">
          Leé los{" "}
          <Link href="/terminos" target="_blank" className="text-[#1E8EA3] font-bold hover:underline">términos</Link> y la{" "}
          <Link href="/privacidad" target="_blank" className="text-[#1E8EA3] font-bold hover:underline">política de privacidad</Link>.
          Si no estás de acuerdo, podés escribirnos a privacidad@bbjobs.com.ar para borrar tu cuenta.
        </p>
        {error && <p className="text-sm text-red-600 font-medium mb-3">{error}</p>}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="text-sm font-bold text-[#64748B] px-4 py-2.5 rounded-xl hover:bg-[#FAFBFD]"
          >
            Salir
          </button>
          <button
            onClick={aceptar}
            disabled={enviando}
            className="bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl px-6 py-2.5 text-sm transition-colors"
          >
            {enviando ? "Guardando..." : "Leí y acepto"}
          </button>
        </div>
      </div>
    </div>
  );
}
