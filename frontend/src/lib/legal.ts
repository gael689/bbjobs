import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";

// Versiones de /terminos y /privacidad. Tienen que coincidir con backend/app/core/legal.py (un
// test del backend lo controla): al subirla, todos vuelven a aceptar al entrar a su panel.
// La 3.0 suma los módulos nuevos (IA, mails, Revisión de CV, observaciones, "Vieron tu CV", aviso
// de otro proceso) y rige sólo con la compuerta abierta; sin ella, sigue la 2.0.
export const LEGAL_VERSION_BASE = "2.0";
export const LEGAL_VERSION_MODULOS = "3.0";
export const LEGAL_VIGENTE_DESDE_BASE = "6 de octubre de 2026";

export const LEGAL_VERSION = MODULOS_NUEVOS_VISIBLES ? LEGAL_VERSION_MODULOS : LEGAL_VERSION_BASE;
// Fecha de la 3.0: el día que se abre la compuerta (variable de Vercel, en texto: "20 de noviembre
// de 2026"). Tiene que coincidir con LEGAL_V3_VIGENTE_DESDE del backend.
// Sin la variable, las páginas muestran sólo la versión.
export const LEGAL_VIGENTE_DESDE: string | null = MODULOS_NUEVOS_VISIBLES
  ? (process.env.NEXT_PUBLIC_LEGAL_V3_VIGENTE_DESDE || null)
  : LEGAL_VIGENTE_DESDE_BASE;

/** "Versión 3.0 · Vigente desde el 20 de noviembre de 2026" (o sólo la versión, sin fecha cargada). */
export const LEGAL_ENCABEZADO = `Versión ${LEGAL_VERSION}${LEGAL_VIGENTE_DESDE ? ` · Vigente desde el ${LEGAL_VIGENTE_DESDE}` : ""}`;
