"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LockClosedIcon, ShieldCheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Botón "Quiero saber más" de la tarjeta de la Base de Talento, con el detalle en un modal.
 *
 * El detalle vive acá y no en la página porque son dos lecturas distintas: la tarjeta tiene que
 * poder compararse de un vistazo con las otras dos, y quien quiere entender cómo funciona el
 * perfil en gris lo pide. Meter todo en la página hacía que las tres columnas dejaran de leerse
 * como un cuadro comparativo.
 */
export default function SaberMasTalento({ credits }: { credits: number }) {
  // El modal se monta en el <body> con un portal, no acá dentro. El header del sitio es
  // `fixed z-50` y algún ancestro de esta tarjeta crea un contexto de apilamiento, así que un
  // z-index más alto no alcanzaba: el navbar quedaba dibujado encima del modal. Sacarlo del
  // árbol lo resuelve de raíz en vez de pelear la cascada.
  //
  // No hace falta el típico estado `montado` para evitar tocar `document` en el servidor:
  // `abierto` sólo se vuelve true desde un click, que ya es del lado del cliente.
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const alEscapar = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("keydown", alEscapar);
    // Sin esto, el fondo hace scroll detrás del modal en celular.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alEscapar);
      document.body.style.overflow = overflow;
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full text-center text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E] underline underline-offset-4 decoration-[#9ED4DF] hover:decoration-[#1E8EA3] py-2 transition-colors"
      >
        Quiero saber más
      </button>

      {abierto && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-[#1C2230]/50 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setAbierto(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Cómo funciona la Base de Talento"
        >
          <div
            className="bg-white rounded-3xl w-full max-w-3xl my-8 overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-7 pt-7 pb-5 border-b border-[#DDE3EC]">
              <div>
                <span className="text-[11px] font-bold text-[#1E8EA3] uppercase tracking-[0.14em]">
                  Base de Talento
                </span>
                <h2 className="font-display font-extrabold text-2xl text-[#1C2230] mt-1.5 leading-tight">
                  Mirás todo. Pagás sólo por a quién querés contactar.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="shrink-0 w-9 h-9 rounded-full border border-[#DDE3EC] text-[#64748B] hover:bg-[#FAFBFD] flex items-center justify-center transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="px-7 py-6 space-y-7">
              <p className="text-[#64748B] leading-relaxed">
                Podés recorrer la base entera y filtrar cuanto quieras <strong className="text-[#1C2230]">sin
                gastar nada</strong>. Cada perfil te muestra la experiencia, los estudios, las
                habilidades y la disponibilidad — todo menos quién es. Cuando encontrás a alguien
                que te sirve, lo desbloqueás y accedés a su nombre, teléfono, mail y CV completo.
                Ese perfil queda tuyo para siempre: volver a abrirlo no cuesta otro desbloqueo.
              </p>

              {/* Ejemplo de perfil en gris */}
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
                  Así se ve un perfil antes de desbloquearlo
                </p>
                <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-2xl p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#EEF2F7] flex items-center justify-center shrink-0">
                      <LockClosedIcon className="w-5 h-5 text-[#94A3B8]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-bold text-[#1C2230]">Candidato #A3F91C</p>
                      <p className="text-xs text-[#64748B]">34 años · Bahía Blanca · Disp. inmediata</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-extrabold text-sm text-[#1E8EA3] leading-none">85%</p>
                      <p className="text-[9px] text-[#94A3B8] uppercase tracking-wide mt-0.5">completo</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-[#1C2230] mb-4">
                    <p><strong>6 años</strong> de experiencia</p>
                    <p>Vendedor — 2 años y 4 meses</p>
                    <p>Repositor — 3 años y 1 mes</p>
                    <p className="text-[#64748B]">Técnico en Administración · Secundario, graduado</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {["Excel", "Atención al cliente", "Trabajo en equipo", "Inglés"].map(s => (
                      <span key={s} className="text-[11px] font-medium bg-white text-[#64748B] border border-[#DDE3EC] px-2.5 py-1 rounded-full">{s}</span>
                    ))}
                  </div>
                  <div className="border-t border-[#DDE3EC] pt-3 flex items-start gap-2 text-xs text-[#94A3B8]">
                    <LockClosedIcon className="w-4 h-4 shrink-0 mt-px" />
                    Ocultos: nombre, foto, teléfono, mail, CV, dónde trabajó y dónde estudió.
                  </div>
                </div>
              </div>

              {/* Campo por campo */}
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
                  Campo por campo
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-[#9ED4DF] bg-[#E6F4F7] rounded-2xl p-4">
                    <p className="text-xs font-bold text-[#1E8EA3] uppercase tracking-wide mb-2.5">
                      Se ve sin pagar
                    </p>
                    <ul className="space-y-1.5 text-sm text-[#1C2230]">
                      {[
                        "Edad y zona",
                        "Disponibilidad y movilidad",
                        "Años de experiencia",
                        "Los puestos que ocupó y cuánto duró cada uno",
                        "Nivel educativo y título",
                        "Habilidades e idiomas",
                        "Qué tan completo está el perfil",
                      ].map(t => <li key={t}>· {t}</li>)}
                    </ul>
                  </div>
                  <div className="border border-[#DDE3EC] bg-[#FAFBFD] rounded-2xl p-4">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-2.5">
                      Se revela al desbloquear
                    </p>
                    <ul className="space-y-1.5 text-sm text-[#64748B]">
                      {[
                        "Nombre y apellido",
                        "Foto",
                        "Teléfono y mail",
                        "CV completo en PDF",
                        "En qué empresas trabajó",
                        "En qué institución estudió",
                        "Su texto de presentación",
                      ].map(t => <li key={t}>· {t}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-[#FAFBFD] border border-[#DDE3EC] rounded-2xl p-5">
                <p className="text-sm font-bold text-[#1C2230] mb-1.5">
                  ¿Por qué no se ve dónde trabajó?
                </p>
                <p className="text-sm text-[#64748B] leading-relaxed">
                  Porque en Bahía Blanca «Vendedor en tal comercio, 2024–2026» alcanza para saber
                  de quién se trata sin pagar nada. El puesto y cuánto lo ejerció sí se ven, que es
                  lo que sirve para decidir si te interesa.
                </p>
              </div>

              <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl p-5 flex items-start gap-3">
                <ShieldCheckIcon className="w-7 h-7 text-[#1E8EA3] shrink-0" />
                <div>
                  <p className="font-display font-bold text-[#1C2230] mb-1">
                    No es una base de datos comprada
                  </p>
                  <p className="text-sm text-[#64748B] leading-relaxed">
                    Cada persona que aparece autorizó expresamente que las empresas verificadas la
                    encuentren y la contacten, y puede darse de baja cuando quiera. Por eso el
                    acceso está reservado a empresas verificadas por Talency: no alcanza con pagar.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-7 py-5 bg-[#FAFBFD] border-t border-[#DDE3EC] flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#64748B]">
                <strong className="text-[#1C2230]">{credits} desbloqueos</strong> · sin vencimiento
              </p>
              <Link
                href="/register"
                className="text-sm font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] px-6 py-3 rounded-xl transition-colors"
              >
                Empezar
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
