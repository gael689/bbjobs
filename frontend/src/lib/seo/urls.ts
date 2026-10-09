// URLs públicas de fichas. Sin dependencias de servidor: lo usan también componentes cliente
// (cards de /empleos, home, panel del candidato).
//
// Ficha de empleo: /empleos/<slug-del-titulo>-<uuid>. El uuid sigue siendo la clave (el backend
// no cambia); el slug es sólo para la persona y el buscador. La ruta acepta también la forma
// vieja (sólo uuid) o un slug desactualizado y redirige 308 a la canónica.

const UUID_AL_FINAL = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** "Vendedor/a — Bahía Blanca" → "vendedor-a-bahia-blanca". Sin tildes, minúsculas, guiones. */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Ruta canónica (relativa) de la ficha de un empleo. */
export function jobUrl(job: { id: string; title?: string | null }): string {
  const slug = job.title ? slugify(job.title) : "";
  const id = job.id.toLowerCase();
  return slug ? `/empleos/${slug}-${id}` : `/empleos/${id}`;
}

/** Extrae el uuid del parámetro de la ruta (acepta "<slug>-<uuid>" o "<uuid>"). */
export function parseJobParam(param: string): string | null {
  let valor = param;
  try {
    valor = decodeURIComponent(param);
  } catch {
    // parámetro mal codificado: se intenta igual con el crudo
  }
  const m = valor.match(UUID_AL_FINAL);
  return m ? m[1].toLowerCase() : null;
}

/** Ruta de la ficha pública de una empresa. */
export function companyUrl(companyId: string): string {
  return `/empresas/${companyId}`;
}
