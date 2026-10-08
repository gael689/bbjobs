// Índice liviano de las páginas de zona y de sector: sólo slug, nombre y a qué entradas del
// catálogo del backend corresponde. Lo importa el Footer (componente cliente), así que no lleva
// los textos largos — esos viven en zonas.ts y rubros.ts.

export type EntradaIndice = {
  /** Slug de la página: /trabajo-en/<slug> o /empleos-de/<slug>. */
  slug: string;
  /** Nombre visible ("Punta Alta", "Gastronomía"). */
  nombre: string;
  /** Slugs del catálogo del backend (/catalogs/zones o /catalogs/industries) que cubre. */
  catalogo: readonly string[];
};

// Zona Norte y Zona Sur son barrios de Bahía Blanca: sus búsquedas aparecen en la página de Bahía.
export const ZONAS_INDICE: readonly EntradaIndice[] = [
  { slug: "bahia-blanca", nombre: "Bahía Blanca", catalogo: ["bahia-blanca", "zona-norte", "zona-sur"] },
  { slug: "punta-alta", nombre: "Punta Alta", catalogo: ["punta-alta"] },
  { slug: "monte-hermoso", nombre: "Monte Hermoso", catalogo: ["monte-hermoso"] },
  { slug: "coronel-suarez", nombre: "Coronel Suárez", catalogo: ["coronel-suarez"] },
];

// Los 11 sectores reales del catálogo, menos "Otro".
export const RUBROS_INDICE: readonly EntradaIndice[] = [
  { slug: "administracion", nombre: "Administración", catalogo: ["administracion"] },
  { slug: "comercio", nombre: "Comercio", catalogo: ["comercio"] },
  { slug: "construccion", nombre: "Construcción", catalogo: ["construccion"] },
  { slug: "educacion", nombre: "Educación", catalogo: ["educacion"] },
  { slug: "gastronomia", nombre: "Gastronomía", catalogo: ["gastronomia"] },
  { slug: "industria", nombre: "Industria", catalogo: ["industria"] },
  { slug: "logistica", nombre: "Logística", catalogo: ["logistica"] },
  { slug: "marketing", nombre: "Marketing", catalogo: ["marketing"] },
  { slug: "recursos-humanos", nombre: "Recursos Humanos", catalogo: ["recursos-humanos"] },
  { slug: "salud", nombre: "Salud", catalogo: ["salud"] },
  { slug: "tecnologia", nombre: "Tecnología", catalogo: ["tecnologia"] },
];

/** Localidad real de una zona del catálogo (para el JobPosting): los barrios → Bahía Blanca. */
export function localidadDeZona(catalogSlug: string | undefined, nombre: string | undefined): string {
  if (catalogSlug === "zona-norte" || catalogSlug === "zona-sur") return "Bahía Blanca";
  return nombre || "Bahía Blanca";
}
