// Tipos del contenido de las páginas de zona (/trabajo-en/…) y de sector (/empleos-de/…).
// Las páginas, el JSON-LD (FAQPage) y /llms.txt leen de estos datos.
//
// Regla del contenido: todo tiene que ser verdadero y comprobable. Nada de cifras de mercado sin
// fuente ni empresas reales nombradas; las preguntas explican cómo usar BBJobs, no prometen
// resultados.

export type Pregunta = { p: string; r: string };

export type PaginaSeo = {
  /** Slug de la página; tiene que existir en ZONAS_INDICE / RUBROS_INDICE (lib/seo/indice.ts). */
  slug: string;
  /** <title>, hasta 60 caracteres. */
  title: string;
  /** Meta description, entre 140 y 160 caracteres. */
  description: string;
  h1: string;
  /** Una frase debajo del H1. */
  bajada: string;
  /** 2–3 frases que se entienden solas: lo que un buscador con IA puede citar tal cual. */
  citable: string;
  /** Párrafos propios de la página. */
  textos: string[];
  /** Preguntas frecuentes sobre cómo usar BBJobs en esa zona o sector. */
  preguntas: Pregunta[];
};
