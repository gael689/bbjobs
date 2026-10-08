// Datos del sitio que comparten metadata, sitemap, robots, JSON-LD y /llms.txt.
//
// El dominio canónico es https://www.bbjobs.com.ar: bbjobs.com.ar redirige 308 a www, así que
// declarar el apex en canónicas/sitemap/JSON-LD sería una señal cruzada para Google. El fallback
// del código también es www, para que un deploy sin la variable no publique el host equivocado.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.bbjobs.com.ar").replace(/\/+$/, "");
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const SITIO = {
  nombre: "BBJobs",
  lema: "El talento de Bahía, más cerca.",
  iniciativa: "Una iniciativa de Talency",
  descripcion:
    "Portal de empleos local de Bahía Blanca y la región. Empresas verificadas por Talency, postulación con un click y búsquedas de la zona en un solo lugar.",
  logo: `${SITE_URL}/logo.png`,
  ogImage: `${SITE_URL}/og-image.png`,
  talency: { nombre: "Talency", url: "https://talency.com.ar" },
} as const;

/** URL absoluta en el dominio canónico. `path` empieza con "/". */
export function urlAbs(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}
