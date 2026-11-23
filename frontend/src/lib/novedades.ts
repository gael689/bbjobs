/** Novedades por versión del panel (candidato, empresa y admin).
 *
 *  v2.1 (23/10/2026): buscador de postulantes, estrella y filtros. v2.2 (23/11/2026): WhatsApp,
 *  filtro de sueldo y "postularte es gratis". Para sacar una
 *  versión nueva alcanza con cambiar `VERSION_ACTUAL` y los textos de `NOVEDADES`: la clave del
 *  "ya lo vio" lleva la versión, así que el cartel vuelve a salir una vez para todos. */

export const VERSION_ACTUAL = "2.2";

export type RolNovedades = "candidate" | "company" | "admin";

export interface Novedad {
  icono: "buscar" | "estrella" | "filtros" | "guardado" | "compartir" | "sueldo" | "gratis";
  titulo: string;
  texto: string;
}

// v2.2 (23/11/2026): lo que se ve con los módulos nuevos apagados. La v2.1 (buscador de
// postulantes, estrella, filtros) está en el historial de git de este archivo.
export const NOVEDADES: Record<RolNovedades, { bajada: string; items: Novedad[]; boton: { texto: string; href: string } }> = {
  candidate: {
    bajada: "Buscar trabajo en Bahía Blanca, un poco más fácil.",
    items: [
      {
        icono: "sueldo",
        titulo: "Filtro “Sólo con sueldo publicado”",
        texto: "En Empleos, marcá la casilla y quedate sólo con los avisos que dicen cuánto pagan.",
      },
      {
        icono: "compartir",
        titulo: "Compartí avisos por WhatsApp",
        texto: "¿Viste un aviso que le sirve a alguien? Tocá “Compartir por WhatsApp” y le llega con el puesto, la empresa y el link.",
      },
      {
        icono: "gratis",
        titulo: "Postularte es gratis",
        texto: "Todas las empresas de BBJobs las verifica Talency. Si alguien te pide plata por postularte, avisanos desde Contacto.",
      },
    ],
    boton: { texto: "Ver empleos", href: "/empleos" },
  },
  company: {
    bajada: "Tus avisos ahora llegan más lejos y se encuentran más fácil.",
    items: [
      {
        icono: "compartir",
        titulo: "Tus avisos se comparten por WhatsApp",
        texto: "Cada aviso tiene el botón “Compartir por WhatsApp”: arma el mensaje con el puesto, tu empresa y el link. Pasalo a tus grupos o pedile a tu equipo que lo reenvíe.",
      },
      {
        icono: "sueldo",
        titulo: "Filtro “Sólo con sueldo publicado”",
        texto: "Los postulantes pueden ver sólo los avisos que muestran el sueldo. Si publicás el rango, tu búsqueda aparece también ahí.",
      },
      {
        icono: "gratis",
        titulo: "“Postularte es gratis”, a la vista",
        texto: "Cada aviso recuerda que postularse no cuesta nada y que tu empresa está verificada por Talency. Más confianza, más postulantes.",
      },
    ],
    boton: { texto: "Publicar una búsqueda", href: "/dashboard/company/publicar" },
  },
  admin: {
    bajada: "Lo nuevo en los avisos públicos de BBJobs.",
    items: [
      {
        icono: "compartir",
        titulo: "Compartir por WhatsApp",
        texto: "Cada aviso tiene un botón que arma el mensaje con el puesto, la empresa y el link, listo para grupos y estados.",
      },
      {
        icono: "sueldo",
        titulo: "Filtro “Sólo con sueldo publicado”",
        texto: "En /empleos los postulantes pueden quedarse sólo con los avisos que muestran el sueldo.",
      },
      {
        icono: "gratis",
        titulo: "Aviso “Postularte es gratis”",
        texto: "Cada aviso lo recuerda, con un link a Contacto para avisar si alguien intenta cobrar por una postulación.",
      },
    ],
    boton: { texto: "Ver los avisos", href: "/empleos" },
  },
};

/** Pasado este día el cartel deja de abrirse solo (la marca de versión sigue abriéndolo a mano). */
export const NOVEDADES_VENCE = new Date("2027-01-10T03:00:00Z");

export function claveNovedades(rol: RolNovedades, userId: string): string {
  return `bbjobs:novedades:v${VERSION_ACTUAL}:${rol}:${userId}`;
}

/** Evento para abrir el cartel desde la marca de versión de la barra lateral. */
export const EVENTO_ABRIR_NOVEDADES = "bbjobs:abrir-novedades";
