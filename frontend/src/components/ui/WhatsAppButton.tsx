import { waLink } from "@/lib/telefono";

/**
 * Botón "WhatsApp" que abre el chat con el teléfono cargado (pedido de Eugenia, 23/09/2026:
 * contactar más rápido desde los listados). Los formularios guardan el teléfono como lo escribe
 * la gente, no un link: `waLink` lo normaliza al formato de wa.me. Si el número no se puede
 * normalizar con confianza, o no hay número, no se muestra nada.
 *
 * Canal asistido: el link sólo abre el chat con un saludo sugerido; el mensaje lo edita y lo
 * envía una persona. Nada se manda solo.
 */
export default function WhatsAppButton({
  phone,
  message,
  size = "sm",
}: {
  phone: string | null | undefined;
  message?: string;
  size?: "xs" | "sm";
}) {
  const base = waLink(phone);
  if (!base) return null;
  const href = message ? `${base}?text=${encodeURIComponent(message)}` : base;
  const cls = size === "xs"
    ? "text-xs px-2.5 py-1 rounded-lg gap-1"
    : "text-sm px-3 py-2 rounded-xl gap-1.5";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`WhatsApp a ${phone}`}
      className={`inline-flex items-center font-bold bg-[#25D366] hover:bg-[#1EBE5A] text-white transition-colors shrink-0 ${cls}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={size === "xs" ? "w-3.5 h-3.5" : "w-4 h-4"} fill="currentColor">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.46-9.45 2.53 0 4.9.99 6.69 2.78a9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.44 9.45zm8.04-17.5A11.3 11.3 0 0 0 12.04.7C5.77.7.66 5.8.66 12.07c0 2 .52 3.96 1.52 5.69L.57 23.3l5.67-1.49a11.34 11.34 0 0 0 5.8 1.48h.01c6.27 0 11.38-5.1 11.38-11.37 0-3.04-1.18-5.9-3.35-8.03z" />
      </svg>
      WhatsApp
    </a>
  );
}
