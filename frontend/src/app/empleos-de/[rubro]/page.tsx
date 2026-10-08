import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PaginaListado from "@/components/seo/PaginaListado";
import { RUBROS, getRubro } from "@/lib/seo/rubros";
import { RUBROS_INDICE, ZONAS_INDICE } from "@/lib/seo/indice";
import { getActiveJobs, getCatalogos, idsPorSlug } from "@/lib/seo/datos";
import { SITIO, urlAbs } from "@/lib/seo/sitio";

// /empleos-de/<sector>: los 11 sectores de lib/seo/rubros.ts (cualquier otro → 404). Se
// regenera cada 15 minutos. Sin búsquedas activas, noindex,follow y fuera del sitemap.
export const revalidate = 900;
export const dynamicParams = false;

export function generateStaticParams() {
  return RUBROS.map((r) => ({ rubro: r.slug }));
}

type Props = { params: Promise<{ rubro: string }> };

async function datos(slug: string) {
  const rubro = getRubro(slug);
  if (!rubro) return null;
  const [jobs, cat] = await Promise.all([getActiveJobs(900), getCatalogos()]);
  const ids = idsPorSlug(cat.rubros, rubro.catalogo);
  return { rubro, cat, jobs: jobs.filter((j) => j.industry_id && ids.has(j.industry_id)) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rubro: slug } = await params;
  const d = await datos(slug);
  if (!d) return {};
  const url = urlAbs(`/empleos-de/${slug}`);
  return {
    title: d.rubro.title,
    description: d.rubro.description,
    alternates: { canonical: url },
    robots: d.jobs.length > 0 ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: d.rubro.title,
      description: d.rubro.description,
      url,
      type: "website",
      siteName: SITIO.nombre,
      locale: "es_AR",
      images: [{ url: SITIO.ogImage, width: 1200, height: 630 }],
    },
  };
}

export default async function EmpleosDeRubroPage({ params }: Props) {
  const { rubro: slug } = await params;
  const d = await datos(slug);
  if (!d) notFound();

  return (
    <PaginaListado
      contenido={d.rubro}
      jobs={d.jobs}
      cat={d.cat}
      migas={[
        { nombre: "Inicio", path: "/" },
        { nombre: "Empleos", path: "/empleos" },
        { nombre: `Empleos de ${d.rubro.nombre.toLowerCase()}`, path: `/empleos-de/${slug}` },
      ]}
      otrosTitulo="Otros sectores"
      otros={RUBROS_INDICE.filter((r) => r.slug !== slug).map((r) => ({ href: `/empleos-de/${r.slug}`, nombre: r.nombre }))}
      cruzadosTitulo="Trabajo por zona"
      cruzados={ZONAS_INDICE.map((z) => ({ href: `/trabajo-en/${z.slug}`, nombre: `Trabajo en ${z.nombre}` }))}
      filtroEmpleos="/empleos"
    />
  );
}
