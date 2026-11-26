/**
 * Módulos nuevos (mails, IA, Revisión de CV, empresas a contactar, campañas).
 *
 * En producción están detrás de la compuerta del backend (`MODULOS_NUEVOS_ACTIVOS`). En el
 * panel de admin se ven siempre, con la etiqueta "En desarrollo" (decisión de Gael: Eugenia los
 * ve así hasta el lanzamiento). A postulantes y empresas **no se les muestra nada** hasta que
 * esta variable esté en `true` (local: true para desarrollar; Vercel: sin definir o false).
 */
// Prendido por defecto (lanzados el 23/11/2026): ya no hace falta la variable en Vercel. Sólo se
// apaga con NEXT_PUBLIC_MODULOS_NUEVOS=false explícito. Lo que de verdad decide si cada módulo
// funciona es el backend (compuerta + interruptores): con ellos apagados, las pantallas no
// muestran nada.
export const MODULOS_NUEVOS_VISIBLES = process.env.NEXT_PUBLIC_MODULOS_NUEVOS !== "false";

export const ETIQUETA_EN_DESARROLLO = "En desarrollo";
