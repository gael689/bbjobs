import { SITIO, urlAbs } from "@/lib/seo/sitio";
import { jobUrl } from "@/lib/seo/urls";
import { getActiveJobs, getCatalogos, etiquetasJob } from "@/lib/seo/datos";
import { localidadDeZona, RUBROS_INDICE, ZONAS_INDICE } from "@/lib/seo/indice";
import { ZONAS } from "@/lib/seo/zonas";
import { RUBROS } from "@/lib/seo/rubros";

// Resumen en Markdown para buscadores y asistentes con IA (llmstxt.org): qué es BBJobs, cómo se
// usa y la lista viva de búsquedas activas por sector, con su link canónico. Se regenera cada hora.
export const revalidate = 3600;

const MODALIDAD: Record<string, string> = { presencial: "presencial", remoto: "remoto", "híbrido": "híbrido" };

export async function GET() {
  const [jobs, cat] = await Promise.all([getActiveJobs(3600), getCatalogos()]);
  const l: string[] = [];

  l.push(`# ${SITIO.nombre}`, "");
  l.push(
    `> ${SITIO.nombre} es el portal de empleos de Bahía Blanca y la región (Punta Alta, Monte Hermoso, Coronel Suárez), ${SITIO.iniciativa.toLowerCase()}, consultora de recursos humanos de Bahía Blanca. Reúne búsquedas laborales de empresas verificadas a mano por Talency; los candidatos se registran gratis, cargan su CV y se postulan con un click. ${SITIO.lema}`,
    "",
  );

  l.push("## Cómo funciona", "");
  l.push("- Candidatos: crean su cuenta gratis, completan su perfil y cargan su CV en PDF. Se postulan a cada búsqueda con un click, con carta de presentación opcional, y siguen el estado de sus postulaciones desde su panel.");
  l.push("- Empresas: se registran, el equipo de Talency las verifica manualmente y, una vez aprobadas, publican búsquedas gratis. Cada búsqueda dura como máximo 20 días.");
  l.push("- Cada aviso indica puesto, empresa, zona, modalidad (presencial, remoto o híbrido), tipo de contratación y, si la empresa lo decide, el sueldo.");
  l.push(`- Postularse: ${urlAbs("/register?type=candidate")} · Publicar una búsqueda: ${urlAbs("/register?type=company")}`, "");

  l.push("## Páginas clave", "");
  l.push(`- [Buscador de empleos](${urlAbs("/empleos")}): todas las búsquedas activas, con filtros por sector, zona, modalidad, contrato y sueldo.`);
  l.push(`- [Empresas verificadas](${urlAbs("/empresas")})`);
  l.push(`- [Planes para empresas](${urlAbs("/planes")})`);
  l.push(`- [Quiénes somos](${urlAbs("/nosotros")})`);
  l.push(`- [Contacto](${urlAbs("/contacto")})`);
  ZONAS.forEach((z) => l.push(`- [${z.h1}](${urlAbs(`/trabajo-en/${z.slug}`)}): ${z.bajada}`));
  RUBROS.forEach((r) => l.push(`- [${r.h1}](${urlAbs(`/empleos-de/${r.slug}`)}): ${r.bajada}`));
  l.push("");

  l.push(`## Búsquedas activas (${jobs.length})`, "");
  if (jobs.length === 0) {
    l.push("Hoy no hay búsquedas activas publicadas.", "");
  } else {
    // Agrupadas por sector, en el orden del catálogo; lo que no tenga sector conocido va al final.
    const grupos = new Map<string, string[]>();
    for (const job of jobs) {
      const { zona, rubro, contrato } = etiquetasJob(job, cat);
      const sector = rubro?.name || "Otros";
      const lugar = job.modality === "remoto" ? "remoto" : `${localidadDeZona(zona?.slug, zona?.name)}, ${MODALIDAD[job.modality] || job.modality}`;
      const linea = `- [${job.title}](${urlAbs(jobUrl(job))}) — ${job.company_legal_name_snapshot} · ${lugar}${contrato ? ` · ${contrato.name}` : ""}`;
      grupos.set(sector, [...(grupos.get(sector) || []), linea]);
    }
    const orden = [...RUBROS_INDICE.map((r) => r.nombre), "Otro", "Otros"];
    const sectores = [...grupos.keys()].sort((a, b) => {
      const ia = orden.indexOf(a), ib = orden.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    for (const s of sectores) l.push(`### ${s}`, "", ...(grupos.get(s) || []), "");
  }

  l.push("## Zonas", "");
  l.push(`${ZONAS_INDICE.map((z) => z.nombre).join(", ")}. Zona Norte y Zona Sur son zonas de Bahía Blanca.`, "");

  return new Response(l.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
