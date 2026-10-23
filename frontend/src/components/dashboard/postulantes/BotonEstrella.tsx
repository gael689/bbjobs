"use client";

import { StarIcon as EstrellaLlena } from "@heroicons/react/24/solid";
import { StarIcon as EstrellaVacia } from "@heroicons/react/24/outline";

interface Props {
  marcada: boolean;
  onClick: () => void;
  /** Quién la ve: se aclara en el tooltip para que nadie la confunda con un estado. */
  quienLaVe: string;
}

/** La estrella de una fila de postulantes. No es un estado: no le avisa al postulante. */
export default function BotonEstrella({ marcada, onClick, quienLaVe }: Props) {
  const titulo = marcada
    ? "Sacar la estrella"
    : `Marcar con estrella. ${quienLaVe} El postulante no recibe ningún aviso.`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={marcada ? "Sacar la estrella" : "Marcar con estrella"}
      aria-pressed={marcada}
      className="shrink-0 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
    >
      {marcada
        ? <EstrellaLlena className="w-5 h-5 text-amber-400" />
        : <EstrellaVacia className="w-5 h-5 text-[#9AA6B8] hover:text-amber-400" />}
    </button>
  );
}
