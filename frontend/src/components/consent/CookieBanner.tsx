"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  CONSENT_OPEN_EVENT, parseConsent, rawConsentCookie, saveConsent, subscribeConsent,
} from "@/lib/consent";

// Banner de cookies propio (sin librerías de terceros). Aparece en la primera visita y cuando
// alguien lo reabre desde "Configurar cookies" (footer) o desde /cookies. Es un diálogo NO modal:
// no bloquea el sitio, y hasta que la persona elige no se carga ninguna cookie de medición.
// Aceptar y Rechazar tienen el mismo peso visual a propósito (consentimiento libre).

const noopSubscribe = () => () => {};

export default function CookieBanner() {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(subscribeConsent, rawConsentCookie, () => "");
  const choice = parseConsent(raw);

  const [reopened, setReopened] = useState(false);
  const [configurando, setConfigurando] = useState(false);
  const [medicion, setMedicion] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // La vista previa interna (/vista-previa) es una herramienta de Talency: ahí no hace falta el
  // banner al entrar. Igual se respeta la elección guardada y se puede reabrir.
  const omitirAca = pathname?.startsWith("/vista-previa") ?? false;
  const visible = mounted && (reopened || (!choice && !omitirAca));

  useEffect(() => {
    const onOpen = () => {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setMedicion(parseConsent(rawConsentCookie())?.medicion ?? false);
      setConfigurando(true);
      setReopened(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  // Al reabrirlo a pedido, el foco va al banner (quien lo pidió lo quiere usar). En la primera
  // visita no se roba el foco: el banner queda a mano con Tab sin interrumpir la lectura.
  useEffect(() => {
    if (reopened) dialogRef.current?.focus();
  }, [reopened]);

  const cerrar = useCallback(() => {
    setReopened(false);
    setConfigurando(false);
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target && document.contains(target)) target.focus();
  }, []);

  const elegir = (valor: boolean) => {
    saveConsent(valor);
    cerrar();
  };

  if (!visible) return null;

  const puedeCerrar = !!choice; // sin elección previa hay que elegir (pero nada bloquea el sitio)

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
      onKeyDown={e => { if (e.key === "Escape" && puedeCerrar) cerrar(); }}
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none focus:outline-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl max-h-[85vh] overflow-y-auto bg-white border border-[#DDE3EC] rounded-2xl shadow-[0_8px_30px_rgba(28,34,48,0.14)] p-4 sm:p-5 text-[#1C2230]">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display font-bold text-base sm:text-lg leading-tight">
            Cookies en BBJobs
          </h2>
          {puedeCerrar && (
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar sin cambiar nada"
              className="-mt-1 -mr-1 p-1.5 rounded-lg text-[#1C2230] hover:bg-[#E6F4F7] focus-visible:outline-2 focus-visible:outline-[#1E8EA3]"
            >
              <XMarkIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <p id={descId} className="mt-1.5 text-sm leading-relaxed">
          Usamos las cookies necesarias para que el sitio funcione. Si nos dejás, también usamos Google Analytics
          para saber qué páginas se visitan y mejorar BBJobs. No hacemos publicidad.{" "}
          <Link href="/cookies" className="text-[#1E8EA3] font-semibold underline underline-offset-2 hover:text-[#187B8E]">
            Más info
          </Link>
        </p>

        {configurando && (
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">Elegí qué cookies aceptás</legend>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#DDE3EC] bg-[#FAFBFD] px-4 py-3">
              <div className="text-sm">
                <p className="font-bold">Necesarias</p>
                <p className="leading-relaxed">Para iniciar sesión y recordar esta elección. No se pueden apagar.</p>
              </div>
              <span className="shrink-0 text-xs font-bold text-[#187B8E] bg-[#E6F4F7] border border-[#9ED4DF] rounded-full px-2.5 py-1">
                Siempre activas
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#DDE3EC] bg-[#FAFBFD] px-4 py-3">
              <div className="text-sm">
                <p className="font-bold" id={`${titleId}-medicion`}>Medición</p>
                <p className="leading-relaxed">
                  Google Analytics: cuenta visitas y qué secciones se usan, sin tu nombre ni tu mail.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={medicion}
                aria-labelledby={`${titleId}-medicion`}
                onClick={() => setMedicion(m => !m)}
                className={`relative shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E8EA3] ${medicion ? "bg-[#1E8EA3]" : "bg-[#94A3B8]"}`}
              >
                <span className="sr-only">{medicion ? "Activada" : "Desactivada"}</span>
                <span
                  aria-hidden="true"
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${medicion ? "translate-x-[22px]" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          </fieldset>
        )}

        <div className="mt-4 grid grid-cols-3 sm:flex sm:flex-wrap sm:justify-end gap-2">
          {configurando ? (
            <button
              type="button"
              onClick={() => elegir(medicion)}
              className="col-span-3 sm:order-last rounded-lg bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold px-3 sm:px-5 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E8EA3]"
            >
              Guardar mi elección
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setMedicion(choice?.medicion ?? false); setConfigurando(true); }}
              className="rounded-lg border border-[#DDE3EC] bg-white hover:bg-[#E6F4F7] text-[#1C2230] text-sm font-semibold px-3 sm:px-5 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E8EA3] sm:mr-auto"
            >
              Configurar
            </button>
          )}
          {!configurando && (
            <>
              <button
                type="button"
                onClick={() => elegir(false)}
                className="rounded-lg bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold px-3 sm:px-5 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E8EA3]"
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={() => elegir(true)}
                className="rounded-lg bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-bold px-3 sm:px-5 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E8EA3]"
              >
                Aceptar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
