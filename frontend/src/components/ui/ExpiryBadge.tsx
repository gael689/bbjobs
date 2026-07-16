interface ExpiryBadgeProps {
  expiresAt?: string;
  status: string;
}

interface ExpiryBadgeConfig {
  label: string;
  cls: string;
}

// Función aparte (no en el cuerpo del componente) para que el llamado impuro a Date.now()
// no quede directamente en el render — mismo patrón que formatRelativeTime en
// components/notifications/notification-config.ts.
function getExpiryBadgeConfig(expiresAt?: string, status?: string): ExpiryBadgeConfig | null {
  if (!expiresAt || status === "closed" || status === "expired") return null;

  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) return { label: "Vencida", cls: "bg-red-100 text-red-700" };
  if (daysLeft <= 5) return { label: `Vence en ${daysLeft}d`, cls: "bg-amber-100 text-amber-700" };
  return { label: `Vence en ${daysLeft}d`, cls: "bg-[#E6F4F7] text-[#1E8EA3]" };
}

/** Cuenta regresiva de vencimiento de una búsqueda — sólo tiene sentido mientras sigue activa
 * o pausada; una vez cerrada/vencida el estado de la búsqueda ya lo dice todo. */
export default function ExpiryBadge({ expiresAt, status }: ExpiryBadgeProps) {
  const config = getExpiryBadgeConfig(expiresAt, status);
  if (!config) return null;

  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${config.cls}`}>{config.label}</span>;
}
