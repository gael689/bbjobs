/** Texto para mostrarle a la persona cuando un pedido a la API falla.
 *
 *  Antes cada pantalla capturaba el error sin mirarlo y mostraba un "Error al guardar…"
 *  igual para todo: una fecha inválida, un servidor caído y una sesión vencida se veían
 *  idénticos, y el usuario no podía arreglar ninguno. */
export function mensajeDeError(e: unknown, fallback: string): string {
  const err = e as {
    response?: { status?: number; data?: { detail?: unknown } };
    request?: unknown;
  };

  const status = err?.response?.status;
  if (status === 401) return "Tu sesión venció. Volvé a iniciar sesión para continuar.";
  if (status === 503) return "No pudimos verificar tu sesión en este momento. Probá de nuevo en unos segundos.";
  if (status === 413) return "El archivo es demasiado grande.";
  if (!err?.response && err?.request) return "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.";

  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  // Errores de validación (422): lista de { msg }. El prefijo "Value error, " lo agrega
  // Pydantic y no le sirve a nadie.
  if (Array.isArray(detail)) {
    const msg = detail
      .map((d) => (d && typeof d.msg === "string" ? d.msg.replace(/^Value error,\s*/, "") : null))
      .filter(Boolean)
      .join(" ");
    if (msg) return msg;
  }
  if (status && status >= 500) return "Tuvimos un problema de nuestro lado. Probá de nuevo en un rato.";
  return fallback;
}

/** Fecha local en formato YYYY-MM-DD. `toISOString()` da la fecha en UTC: en Argentina, después
 *  de las 21 h ya es "mañana", y el tope de un input de fecha quedaba corrido un día. */
export function fechaLocal(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
