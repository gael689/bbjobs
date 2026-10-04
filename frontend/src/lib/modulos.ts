/**
 * Módulos nuevos (mails, IA, Revisión de CV, empresas a contactar, campañas).
 *
 * En producción están detrás de la compuerta del backend (`MODULOS_NUEVOS_ACTIVOS`). En el
 * panel de admin se ven siempre, con la etiqueta "En desarrollo" (decisión de Gael: Eugenia los
 * ve así hasta el lanzamiento). A postulantes y empresas **no se les muestra nada** hasta que
 * esta variable esté en `true` (local: true para desarrollar; Vercel: sin definir o false).
 */
export const MODULOS_NUEVOS_VISIBLES = process.env.NEXT_PUBLIC_MODULOS_NUEVOS === "true";

export const ETIQUETA_EN_DESARROLLO = "En desarrollo";
