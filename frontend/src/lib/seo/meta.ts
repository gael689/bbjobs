import type { Metadata } from "next";
import { SITIO, urlAbs } from "./sitio";

// Metadata completa de una página pública fija: título, descripción, canónica y Open Graph propios.
//
// Por qué hace falta (09/11/2026): una página que no declara `openGraph` hereda el del layout raíz
// entero, con og:url apuntando a la home, y una que no declara `title` hereda el de la home. Así
// estaban /empresas, /nosotros, /contacto y las legales: el mismo título que la home y sin
// canónica, que para Google es "otra copia de la home".
//
// Las páginas de zona, de sector y /empleos también la usan (09/11/2026): antes armaban su
// Open Graph a mano, sin twitter card ni og:image:alt. `indexable` se usa en las de zona y sector,
// que quedan noindex,follow mientras no tengan búsquedas activas.
export function metaPagina({
  title, description, path, indexable,
}: { title: string; description: string; path: string; indexable?: boolean }): Metadata {
  const url = urlAbs(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(indexable === undefined ? {} : { robots: indexable ? { index: true, follow: true } : { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: SITIO.nombre,
      locale: "es_AR",
      images: [{ url: SITIO.ogImage, width: 1200, height: 630, alt: "BBJobs — Bahía Blanca" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [SITIO.ogImage] },
  };
}
