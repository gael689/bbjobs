/** Aviso único "corregimos el error al guardar" (29/09/2026).
 *
 *  Para las cuentas que ya existían cuando se arregló el problema de sesión: son las únicas que
 *  pudieron ver el error. Una cuenta nueva nunca lo vio, así que avisarle sería confundirla. */

/** Momento del arreglo (10:00 hs de Argentina). Las cuentas creadas antes ven el aviso. */
export const AVISO_CUENTAS_ANTERIORES_A = new Date("2026-09-29T13:00:00Z");

/** El aviso se retira solo: pasado este día ya no tiene sentido mostrarlo. */
export const AVISO_VENCE = new Date("2026-10-13T03:00:00Z");

export function claveAviso(userId: string): string {
  return `bbjobs:aviso-correccion-sesion:${userId}`;
}

export function debeMostrarAviso(opts: {
  cuentaCreadaEn: Date | null | undefined;
  ahora: Date;
  yaCerrado: boolean;
}): boolean {
  const { cuentaCreadaEn, ahora, yaCerrado } = opts;
  if (yaCerrado) return false;
  if (ahora >= AVISO_VENCE) return false;
  // Sin fecha de creación no se puede saber si la cuenta es vieja: ante la duda, no molestar.
  if (!cuentaCreadaEn) return false;
  return cuentaCreadaEn < AVISO_CUENTAS_ANTERIORES_A;
}
