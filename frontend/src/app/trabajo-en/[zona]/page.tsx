import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PaginaListado from "@/components/seo/PaginaListado";
import { ZONAS, getZona } from "@/lib/seo/zonas";
import { RUBROS_INDICE, ZONAS_INDICE } from "@/lib/seo/indice";
import { getActiveJobs, getCatalogos, idsPorSlug } from "@/lib/seo/datos";
import { SITIO, urlAbs } from "@/lib/seo/sitio";

// /trabajo-en/<zona>: sólo las zonas de lib/seo/zonas.ts (cualquier otra → 404). Se regenera
// cada 15 minutos. Sin búsquedas activas, la página queda noindex,follow y fuera del sitemap;
// se indexa sola cuando aparece una.
export const revalidate = 900;
export const dynamicParams = false;

export function generateStaticParams() {
  return ZONAS.map((z) => ({ zona: z.slug }));
}

type Props = { params: Promise<{ zona: string }> };

async function datos(slug: string) {
  const zona = getZona(slug);
  if (!zona) return null;
  const [jobs, cat] = await Promise.all([getActiveJobs(900), getCatalogos()]);
  const ids = idsPorSlug(cat.zonas, zona.catalogo);
  return { zona, cat, jobs: jobs.filter((j) => j.zone_id && ids.has(j.zone_id)) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zona: slug } = await params;
  const d = await datos(slug);
  if (!d) return {};
  const url = urlAbs(`/trabajo-en/${slug}`);
  return {
    title: d.zona.title,
    description: d.zona.description,
    alternates: { canonical: url },
    robots: d.jobs.length > 0 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: d.zona.title,
      description: d.zona.description,
      url,
      type: "website",
      siteName: SITIO.nombre,
      locale: "es_AR",
      images: [{ url: SITIO.ogImage, width: 1200, height: 630 }],
    },
  };
}

export default async function TrabajoEnZonaPage({ params }: Props) {
  const { zona: slug } = await params;
  const d = await datos(slug);
  if (!d) notFound();

  return (
    <PaginaListado
      contenido={d.zona}
      jobs={d.jobs}
      cat={d.cat}
      migas={[
        { nombre: "Inicio", path: "/" },
        { nombre: "Empleos", path: "/empleos" },
        { nombre: `Trabajo en ${d.zona.nombre}`, path: `/trabajo-en/${slug}` },
      ]}
      otrosTitulo="Trabajo en otras zonas"
      otros={ZONAS_INDICE.filter((z) => z.slug !== slug).map((z) => ({ href: `/trabajo-en/${z.slug}`, nombre: `Trabajo en ${z.nombre}` }))}
      cruzadosTitulo="Empleos por sector"
      cruzados={RUBROS_INDICE.map((r) => ({ href: `/empleos-de/${r.slug}`, nombre: r.nombre }))}
      filtroEmpleos="/empleos"
    />
  );
}
