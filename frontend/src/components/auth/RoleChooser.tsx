"use client";

import { UserIcon, BuildingOfficeIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

export type SignupRole = "candidate" | "company";

// Respaldo de la intención de rol. `unsafeMetadata` pasado a <SignUp> sólo viaja de forma
// confiable con email/contraseña: con Google hay un redirect de página completa y el widget de
// Clerk no siempre la reenvía. localStorage sí sobrevive el redirect, y /onboarding lo lee.
export const SIGNUP_ROLE_KEY = "bbjobs_signup_role";

export const ROLE_LABEL: Record<SignupRole, string> = {
  candidate: "postulante",
  company: "empresa",
};

const OPCIONES: { role: SignupRole; icon: React.ElementType; titulo: string; detalle: string }[] = [
  {
    role: "candidate",
    icon: UserIcon,
    titulo: "Busco trabajo",
    detalle: "Cargá tu CV y postulate a las búsquedas de Bahía Blanca con un click.",
  },
  {
    role: "company",
    icon: BuildingOfficeIcon,
    titulo: "Soy una empresa",
    detalle: "Publicá búsquedas y recibí postulaciones. Tu empresa la verifica Talency.",
  },
];

/**
 * Las dos tarjetas de "¿Cómo querés registrarte?". Se muestran ANTES de crear la cuenta (en
 * /register) y como red en /onboarding cuando el rol no llegó por ningún lado. Existe porque
 * con un toggle chico y preseleccionado hubo gente que se registró como empresa buscando
 * trabajo (pedido de Eugenia, 23/09/2026).
 */
export default function RoleChooser({ onChoose }: { onChoose: (role: SignupRole) => void }) {
  return (
    <div className="space-y-3">
      {OPCIONES.map(({ role, icon: Icon, titulo, detalle }) => (
        <button
          key={role}
          type="button"
          onClick={() => onChoose(role)}
          className="w-full flex items-center gap-4 text-left bg-white border-2 border-[#DDE3EC] hover:border-[#1E8EA3] hover:bg-[#E6F4F7] rounded-2xl p-5 transition-colors group"
        >
          <span className="w-12 h-12 rounded-xl bg-[#E6F4F7] group-hover:bg-white flex items-center justify-center shrink-0 transition-colors">
            <Icon className="w-6 h-6 text-[#1E8EA3]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display font-bold text-lg text-[#1C2230]">{titulo}</span>
            <span className="block text-sm text-[#64748B] leading-snug">{detalle}</span>
          </span>
          <ChevronRightIcon className="w-5 h-5 text-[#9ED4DF] group-hover:text-[#1E8EA3] shrink-0" />
        </button>
      ))}
    </div>
  );
}

/** "Te estás registrando como empresa · Cambiar": deja a la vista el rol que va a tener la
 *  cuenta, para que quien llegó por un botón preseleccionado lo confirme sin darse cuenta. */
export function RoleBanner({ role, onChange }: { role: SignupRole; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl px-4 py-3 mb-6">
      <span className="text-sm text-[#1C2230]">
        Te estás registrando como <strong>{ROLE_LABEL[role]}</strong>
      </span>
      <button type="button" onClick={onChange} className="text-sm font-bold text-[#1E8EA3] hover:underline shrink-0">
        Cambiar
      </button>
    </div>
  );
}
