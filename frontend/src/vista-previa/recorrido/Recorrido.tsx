"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { PASOS } from "./pasos";

// Recorrido guiado para Eugenia (11/11/2026). Una idea por pantalla, con la demo al lado.
// Se navega con los botones, con las flechas del teclado o desde el índice. Todo lo que muestra
// sale de INFORME-MAILS-IA-EUGENIA (10/11) y del estado real del lanzamiento; los nombres de
// personas y empresas de las demos son inventados y lo dice en pantalla.

export default function Recorrido({ vistaPrevia }: { vistaPrevia: string }) {
  const [paso, setPaso] = useState(0);
  const [dir, setDir] = useState(1);
  const [indice, setIndice] = useState(false);
  const total = PASOS.length;

  const ir = useCallback(
    (n: number) => {
      const destino = Math.max(0, Math.min(total - 1, n));
      setDir(destino >= paso ? 1 : -1);
      setPaso(destino);
      setIndice(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [total, paso],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") ir(paso + 1);
      if (e.key === "ArrowLeft") ir(paso - 1);
      if (e.key === "Escape") setIndice(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ir, paso]);

  const Actual = PASOS[paso].Componente;
  const avance = paso / (total - 1);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-svh flex-col overflow-x-clip bg-mesh">
        {/* Barra superior: avance + índice */}
        <div className="sticky top-0 z-30 border-b border-border/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
            <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <Image src="/logo.png" alt="" width={22} height={28} className="h-6 w-auto" />
              <span className="font-display text-lg font-extrabold italic tracking-tight text-text">
                <span className="text-primary">BB</span>JOBS
              </span>
            </span>
            <button
              type="button"
              onClick={() => setIndice((v) => !v)}
              aria-expanded={indice}
              className="flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm font-semibold text-text transition hover:border-primary-mid hover:text-primary"
            >
              <span aria-hidden className="grid gap-[3px]">
                <span className="block h-[2px] w-3.5 rounded bg-current" />
                <span className="block h-[2px] w-3.5 rounded bg-current" />
                <span className="block h-[2px] w-2.5 rounded bg-current" />
              </span>
              Índice
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-text">{PASOS[paso].capitulo}</span>
                <span className="shrink-0 tabular-nums text-text-muted">
                  {paso + 1} de {total}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-light">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-[#3FB3C7]"
                  initial={false}
                  animate={{ width: `${Math.max(avance * 100, 3)}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {indice && (
              <motion.nav
                aria-label="Índice del recorrido"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute inset-x-0 top-full border-b border-border bg-white shadow-lg"
              >
                <ol className="mx-auto grid max-w-6xl gap-1 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
                  {PASOS.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => ir(i)}
                        aria-current={i === paso ? "step" : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          i === paso ? "bg-primary-light text-primary-hover" : "hover:bg-bg"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                            i < paso
                              ? "bg-primary text-white"
                              : i === paso
                                ? "border-2 border-primary text-primary"
                                : "border border-border text-text-muted"
                          }`}
                        >
                          {i < paso ? "✓" : i + 1}
                        </span>
                        <span>
                          <span className="block text-[11px] uppercase tracking-wider text-text-muted">{p.capitulo}</span>
                          <span className="font-semibold">{p.corto}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>

        {/* Escena actual */}
        <div className="relative flex flex-1 items-center">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.section
              key={PASOS[paso].id}
              custom={dir}
              variants={{
                entra: (d: number) => ({ opacity: 0, x: d * 60 }),
                quieto: { opacity: 1, x: 0 },
                sale: (d: number) => ({ opacity: 0, x: d * -60 }),
              }}
              initial="entra"
              animate="quieto"
              exit="sale"
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
              aria-live="polite"
            >
              <Actual siguiente={() => ir(paso + 1)} vistaPrevia={vistaPrevia} />
            </motion.section>
          </AnimatePresence>
        </div>

        {/* Navegación inferior */}
        <div className="sticky bottom-0 z-20 border-t border-border/70 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => ir(paso - 1)}
              disabled={paso === 0}
              className="rounded-full px-4 py-2 text-sm font-semibold text-text-muted transition hover:text-text disabled:opacity-0"
            >
              ← Anterior
            </button>
            <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
              {PASOS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => ir(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === paso ? "w-6 bg-primary" : i < paso ? "w-2 bg-primary-mid" : "w-2 bg-border"
                  }`}
                />
              ))}
            </div>
            {paso < total - 1 ? (
              <button
                type="button"
                onClick={() => ir(paso + 1)}
                className="group flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/30 transition hover:bg-primary-hover"
              >
                Siguiente
                <span className="transition group-hover:translate-x-0.5">→</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => ir(0)}
                className="rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-text transition hover:border-primary-mid"
              >
                Volver al inicio
              </button>
            )}
          </div>
          <p className="hidden pb-2 text-center text-[11px] text-text-muted lg:block">
            También podés usar las flechas ← → del teclado
          </p>
        </div>
      </div>
    </MotionConfig>
  );
}
