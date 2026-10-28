/** Novedades por versión del panel (empresa y admin).
 *
 *  Arranca en la v2.1 (23/10/2026): buscador de postulantes, estrella y filtros. Para sacar una
 *  versión nueva alcanza con cambiar `VERSION_ACTUAL` y los textos de `NOVEDADES`: la clave del
 *  "ya lo vio" lleva la versión, así que el cartel vuelve a salir una vez para todos. */

export const VERSION_ACTUAL = "2.1";

export type RolNovedades = "company" | "admin";

export interface Novedad {
  icono: "buscar" | "estrella" | "filtros" | "guardado";
  titulo: string;
  texto: string;
}

export const NOVEDADES: Record<RolNovedades, { bajada: string; items: Novedad[]; boton: { texto: string; href: string } }> = {
  company: {
    bajada: "Encontrar al postulante que ya habías visto ahora lleva segundos.",
    items: [
      {
        icono: "buscar",
        titulo: "Buscador de postulantes",
        texto: "En cada búsqueda, buscá por nombre, apellido, puesto, empresa donde trabajó o estudios. Por ejemplo: “técnico electromecánico”.",
      },
      {
        icono: "estrella",
        titulo: "Marcá con estrella",
        texto: "Tocá la ☆ en quien te interese y después filtrá “Con estrella”. Sólo la ve tu empresa: el postulante no recibe ningún aviso.",
      },
      {
        icono: "filtros",
        titulo: "Filtros por estado y “Sin ver”",
        texto: "Mirá sólo los que están En proceso, los Seleccionados o los perfiles que todavía no abriste.",
      },
      {
        icono: "guardado",
        titulo: "Tu búsqueda queda guardada",
        texto: "Si salís de la pantalla o recargás, los filtros siguen donde los dejaste.",
      },
    ],
    boton: { texto: "Ver mis postulaciones", href: "/dashboard/company/postulaciones" },
  },
  admin: {
    bajada: "Lo nuevo para revisar postulantes desde el panel de Talency.",
    items: [
      {
        icono: "buscar",
        titulo: "Buscador en cada búsqueda",
        texto: "Por nombre, apellido, puesto, empresa donde trabajó o estudios, con los mismos filtros que tienen las empresas.",
      },
      {
        icono: "estrella",
        titulo: "Estrella de Talency",
        texto: "Marcá a quien te interese y filtralo después. Es del equipo de Talency: las empresas no la ven y el postulante no recibe aviso.",
      },
      {
        icono: "filtros",
        titulo: "Filtros por estado y “Sin ver”",
        texto: "Cada estado muestra cuántos hay, y “Sin ver” te deja sólo los perfiles que todavía no abriste desde tu panel.",
      },
    ],
    boton: { texto: "Ir a Búsquedas", href: "/dashboard/admin/busquedas" },
  },
};

/** Pasado este día el cartel deja de abrirse solo (la marca de versión sigue abriéndolo a mano). */
export const NOVEDADES_VENCE = new Date("2026-12-01T03:00:00Z");

export function claveNovedades(rol: RolNovedades, userId: string): string {
  return `bbjobs:novedades:v${VERSION_ACTUAL}:${rol}:${userId}`;
}

/** Evento para abrir el cartel desde la marca de versión de la barra lateral. */
export const EVENTO_ABRIR_NOVEDADES = "bbjobs:abrir-novedades";
