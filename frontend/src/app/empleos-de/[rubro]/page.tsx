import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PaginaListado from "@/components/seo/PaginaListado";
import { RUBROS, getRubro } from "@/lib/seo/rubros";
import { RUBROS_INDICE, ZONAS_INDICE, seleccionHref } from "@/lib/seo/indice";
import { getActiveJobs, getCatalogos, idsPorSlug } from "@/lib/seo/datos";
import { metaPagina } from "@/lib/seo/meta";

// /empleos-de/<sector>: los 11 sectores de lib/seo/rubros.ts (cualquier otro → 404). Se
// regenera cada 30 minutos (eran 15 hasta el 19/10/2026: 11 sectores + 4 zonas regenerándose
// cada 15 minutos era CPU de Vercel para listas que cambian unas pocas veces por día).
// Sin búsquedas activas, noindex,follow y fuera del sitemap.
export const revalidate = 1800;
export const dynamicParams = false;

export function generateStaticParams() {
  return RUBROS.map((r) => ({ rubro: r.slug }));
}

type Props = { params: Promise<{ rubro: string }> };

async function datos(slug: string) {
  const rubro = getRubro(slug);
  if (!rubro) return null;
  const [jobs, cat] = await Promise.all([getActiveJobs(1800), getCatalogos()]);
  const ids = idsPorSlug(cat.rubros, rubro.catalogo);
  return { rubro, cat, jobs: jobs.filter((j) => j.industry_id && ids.has(j.industry_id)) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { rubro: slug } = await params;
  const d = await datos(slug);
  if (!d) return {};
  return metaPagina({
    title: d.rubro.title,
    description: d.rubro.description,
    path: `/empleos-de/${slug}`,
    indexable: d.jobs.length > 0,
  });
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
      otros={RUBROS_INDICE.filter((r) => r.slug !== slug).map((r) => ({ href: `/empleos-de/${r.slug}`, nombre: `Empleos de ${r.nombre.toLowerCase()}` }))}
      cruzadosTitulo="Trabajo por zona"
      cruzados={ZONAS_INDICE.map((z) => ({ href: `/trabajo-en/${z.slug}`, nombre: `Trabajo en ${z.nombre}` }))}
      filtroEmpleos="/empleos"
      empresas={{ titulo: `¿Buscás personal de ${d.rubro.nombre.toLowerCase()}?`, seleccionHref: seleccionHref(slug) }}
    />
  );
}
