import { SparklesIcon } from "@heroicons/react/24/outline";

/** Chip "Encaja con tu perfil" de las cards de empleo (ver `useEncajaConTuPerfil`). */
export default function EncajaChip({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E6F4F7] text-[#0F5E6C] border border-[#9ED4DF] ${className}`}
    >
      <SparklesIcon className="w-3.5 h-3.5" aria-hidden="true" />
      Encaja con tu perfil
    </span>
  );
}
