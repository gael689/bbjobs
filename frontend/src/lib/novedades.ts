/** Novedades por versión del panel (candidato, empresa y admin).
 *
 *  v2.1 (23/10/2026): buscador de postulantes, estrella y filtros. v2.2 (23/11/2026): WhatsApp,
 *  filtro de sueldo y "postularte es gratis". v3.0 (23/11/2026): Revisión de CV, mails e IA (lanzamiento; va con los términos 3.0). Para sacar una
 *  versión nueva alcanza con cambiar `VERSION_ACTUAL` y los textos de `NOVEDADES`: la clave del
 *  "ya lo vio" lleva la versión, así que el cartel vuelve a salir una vez para todos. */

export const VERSION_ACTUAL = "3.0";

export type RolNovedades = "candidate" | "company" | "admin";

export interface Novedad {
  icono: "buscar" | "estrella" | "filtros" | "guardado" | "compartir" | "sueldo" | "gratis" | "revision" | "ia" | "mail";
  titulo: string;
  texto: string;
}

// v3.0 (23/11/2026): se abren los módulos nuevos (Revisión de CV, mails, IA). Las versiones
// anteriores (2.1 buscador de postulantes; 2.2 WhatsApp, filtro de sueldo, "es gratis") están en
// el historial de git de este archivo.
export const NOVEDADES: Record<RolNovedades, { bajada: string; items: Novedad[]; boton: { texto: string; href: string } }> = {
  candidate: {
    bajada: "Más ayuda para conseguir trabajo en Bahía Blanca.",
    items: [
      {
        icono: "revision",
        titulo: "Nuevo: Revisión de CV",
        texto: "Una persona de Talency revisa tu CV pensando en el puesto que buscás y te da su devolución para mejorarlo, por WhatsApp o mail. Lo pedís desde «Revisión de CV» en tu panel.",
      },
      {
        icono: "ia",
        titulo: "Búsquedas para vos",
        texto: "En el inicio de tu panel te mostramos las búsquedas que mejor encajan con tu perfil. Cuanto más completo esté, mejores son.",
      },
      {
        icono: "mail",
        titulo: "Avisos por mail",
        texto: "Te avisamos cuando una empresa mira tu CV o cambia el estado de tu postulación. Elegís qué recibir desde Mi perfil.",
      },
    ],
    boton: { texto: "Pedir mi Revisión de CV", href: "/dashboard/candidate/revision-cv" },
  },
  company: {
    bajada: "Encontrá antes a la persona indicada.",
    items: [
      {
        icono: "ia",
        titulo: "Candidatos recomendados",
        texto: "En «Recomendados» te mostramos los postulantes y perfiles que mejor encajan con cada búsqueda, con el porqué de cada uno. Siempre decidís vos.",
      },
      {
        icono: "mail",
        titulo: "Avisos por mail",
        texto: "Te avisamos por mail de los postulantes nuevos y de cada novedad de tus búsquedas. Elegís qué recibir desde Perfil de empresa.",
      },
      {
        icono: "compartir",
        titulo: "Tus avisos se comparten por WhatsApp",
        texto: "Cada aviso tiene el botón «Compartir por WhatsApp», con el puesto, tu empresa y el link. Pasalo a tus grupos.",
      },
    ],
    boton: { texto: "Ver recomendados", href: "/dashboard/company/recomendados" },
  },
  admin: {
    bajada: "Se abren los módulos nuevos de BBJobs.",
    items: [
      {
        icono: "revision",
        titulo: "Revisión de CV a la venta",
        texto: "Los postulantes la compran con Mercado Pago. Te llega el aviso y la seguís desde «Revisiones de CV»: en curso y entregada.",
      },
      {
        icono: "ia",
        titulo: "Centro de IA",
        texto: "Recomendados por búsqueda con su porqué, el gasto del día y el estado de cada agente.",
      },
      {
        icono: "mail",
        titulo: "Mails",
        texto: "Lo enviado, las respuestas que llegan y la salud de la cuenta, en «Mails». Los avisos salen solos y respetan las preferencias de cada persona.",
      },
    ],
    boton: { texto: "Ir a Revisiones de CV", href: "/dashboard/admin/revisiones-cv" },
  },
};

/** Pasado este día el cartel deja de abrirse solo (la marca de versión sigue abriéndolo a mano). */
export const NOVEDADES_VENCE = new Date("2027-01-10T03:00:00Z");

export function claveNovedades(rol: RolNovedades, userId: string): string {
  return `bbjobs:novedades:v${VERSION_ACTUAL}:${rol}:${userId}`;
}

/** Evento para abrir el cartel desde la marca de versión de la barra lateral. */
export const EVENTO_ABRIR_NOVEDADES = "bbjobs:abrir-novedades";
