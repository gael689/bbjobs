import { CheckBadgeIcon } from "@heroicons/react/24/solid";

// Toda búsqueda activa proviene por construcción de una empresa verificada: crear una
// búsqueda requiere `require_verified_company` en el backend, y suspender una empresa
// pausa automáticamente sus búsquedas activas (ver backend/app/api/v1/admin.py). Por eso
// este badge no depende de un campo del job — siempre es verdadero para lo que se lista.
//
// Un solo diseño en todos lados (cards, vista previa, detalle) — el "BBJOBS" replica el
// tratamiento del logo del navbar (BB en teal, JOBS en oscuro, extrabold itálica).
export default function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 rounded-full pl-1.5 pr-2.5 py-0.5 whitespace-nowrap ${className}`}
      title="Empresa verificada por el equipo de BBJOBS"
    >
      <CheckBadgeIcon className="w-3.5 h-3.5 shrink-0" />
      <span className="italic text-[11px] font-semibold">
        Verificada por{" "}
        <span className="font-display font-extrabold tracking-tight">
          <span className="text-[#1E8EA3]">BB</span>
          <span className="text-[#1C2230]">JOBS</span>
        </span>
      </span>
    </span>
  );
}
