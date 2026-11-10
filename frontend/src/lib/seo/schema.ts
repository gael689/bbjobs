// JSON-LD de BBJobs. Las páginas lo insertan con <JsonLd /> (components/seo/JsonLd.tsx).

import { SITE_URL, SITIO, urlAbs } from "./sitio";
import { companyUrl, jobUrl } from "./urls";
import { localidadDeZona } from "./indice";
import type { Catalogos, PublicCompany, PublicJob } from "./datos";
import { etiquetasJob } from "./datos";

type Json = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
// Talency es una sola entidad en todo el sitio: la Organization de BBJobs la nombra como
// parentOrganization y los Service de selección como provider, siempre por este @id. Antes eran
// dos objetos sueltos sin @id y para un buscador podían ser dos "Talency" distintas.
const TALENCY_ID = `${SITE_URL}/#talency`;

const AREA_SERVIDA = [
  { "@type": "City", name: "Bahía Blanca" },
  { "@type": "City", name: "Punta Alta" },
  { "@type": "City", name: "Monte Hermoso" },
  { "@type": "City", name: "Coronel Suárez" },
  { "@type": "AdministrativeArea", name: "Sudoeste de la provincia de Buenos Aires" },
];

export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITIO.nombre,
    url: SITE_URL,
    logo: SITIO.logo,
    description: `${SITIO.descripcion} ${SITIO.iniciativa}.`,
    slogan: SITIO.lema,
    email: SITIO.email,
    areaServed: AREA_SERVIDA,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SITIO.email,
      url: urlAbs("/contacto"),
      availableLanguage: "es",
      areaServed: "AR",
    },
    parentOrganization: { "@id": TALENCY_ID },
  };
}

/** Talency, la consultora de recursos humanos detrás de BBJobs. Sólo lo comprobable: nombre, sitio
 *  y ciudad. Es EmploymentAgency (agencia de selección), no la propia BBJobs, que es el portal. */
export function talencySchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "EmploymentAgency",
    "@id": TALENCY_ID,
    name: SITIO.talency.nombre,
    url: SITIO.talency.url,
    sameAs: [SITIO.talency.url],
    description: "Consultora de recursos humanos de Bahía Blanca. Verifica a las empresas que publican en BBJobs y hace búsquedas de selección de personal.",
    address: { "@type": "PostalAddress", addressLocality: "Bahía Blanca", addressRegion: "Buenos Aires", addressCountry: "AR" },
    areaServed: AREA_SERVIDA,
    subOrganization: { "@id": ORG_ID },
  };
}

export function websiteSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITIO.nombre,
    url: SITE_URL,
    inLanguage: "es-AR",
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/empleos?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Servicio de selección de personal de Talency (/seleccion-de-personal y sus sectores). Talency
 *  es el proveedor; BBJobs (la Organization del sitio) es el canal por el que se consulta. */
export function serviceSchema(s: { nombre: string; descripcion: string; path: string; sector?: string }): Json {
  const url = urlAbs(s.path);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: s.nombre,
    serviceType: "Selección de personal",
    description: s.descripcion,
    url,
    inLanguage: "es-AR",
    // El nodo completo de Talency sale en todas las páginas desde el layout (talencySchema).
    provider: { "@id": TALENCY_ID },
    broker: { "@id": ORG_ID },
    areaServed: AREA_SERVIDA,
    audience: { "@type": "BusinessAudience", audienceType: s.sector ? `Empresas del sector ${s.sector}` : "Empresas" },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: `${url}#consulta`,
      name: "Formulario de consulta en BBJobs",
    },
  };
}

export type Miga = { nombre: string; path: string };

export function breadcrumbSchema(migas: Miga[]): Json {
  const actual = migas[migas.length - 1];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    ...(actual ? { "@id": `${urlAbs(actual.path)}#breadcrumb` } : {}),
    itemListElement: migas.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nombre,
      item: urlAbs(m.path),
    })),
  };
}

/** Página de listado (/empleos, /empresas, /trabajo-en/…, /empleos-de/…): CollectionPage cuyo
 *  contenido principal es la lista de fichas que muestra el HTML, con su URL canónica. Le dice al
 *  buscador qué es la página (un índice de avisos o de empresas, parte del sitio BBJobs) y qué
 *  fichas cuelgan de ella. Si la página tiene migas, se enlaza su BreadcrumbList por @id. */
export function coleccionSchema(p: {
  path: string;
  nombre: string;
  descripcion: string;
  items: { url: string; nombre: string }[];
  conMigas?: boolean;
}): Json {
  const url = urlAbs(p.path);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#webpage`,
    url,
    name: p.nombre,
    description: p.descripcion,
    inLanguage: "es-AR",
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@type": "City", name: "Bahía Blanca" },
    ...(p.conMigas ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: p.items.length,
      itemListElement: p.items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: urlAbs(it.url),
        name: it.nombre,
      })),
    },
  };
}

export function faqSchema(preguntas: { p: string; r: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: preguntas.map((q) => ({
      "@type": "Question",
      name: q.p,
      acceptedAnswer: { "@type": "Answer", text: q.r },
    })),
  };
}

// Tipo de contrato del catálogo → employmentType de Google (valores sensibles a mayúsculas).
const EMPLOYMENT_TYPE: Record<string, string> = {
  "relación de dependencia": "FULL_TIME",
  freelance: "CONTRACTOR",
  "pasantía": "INTERN",
  temporal: "TEMPORARY",
};

// Nivel educativo mínimo del backend → credentialCategory de Google.
const CREDENCIAL: Record<string, string> = {
  secundario: "high school",
  terciario: "associate degree",
  universitario: "bachelor degree",
  posgrado: "postgraduate degree",
};

function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texto plano del aviso → HTML con párrafos (lo que pide Google en `description`). */
export function textoAHtml(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escaparHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function jobPostingSchema(job: PublicJob, cat: Catalogos): Json {
  const { zona, rubro, contrato } = etiquetasJob(job, cat);
  const localidad = localidadDeZona(zona?.slug, zona?.name);
  const employmentType = contrato ? EMPLOYMENT_TYPE[contrato.name.toLowerCase()] : undefined;

  let descripcion = textoAHtml(job.description);
  if (job.benefits) descripcion += `<p>Beneficios:</p>${textoAHtml(job.benefits)}`;

  const salarioVisible = job.salary_visible && (job.salary_min || job.salary_max);
  const credencial = job.min_education_level ? CREDENCIAL[job.min_education_level] : undefined;

  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: descripcion,
    // datePosted es obligatorio para Google: si por algún motivo falta published_at, la fecha de la
    // última actualización es la mejor aproximación verdadera que tenemos.
    datePosted: job.published_at || job.updated_at,
    ...(job.expires_at ? { validThrough: job.expires_at } : {}),
    ...(employmentType ? { employmentType } : {}),
    url: urlAbs(jobUrl(job)),
    identifier: { "@type": "PropertyValue", name: SITIO.nombre, value: job.id },
    directApply: true,
    ...(rubro && rubro.slug !== "otro" ? { industry: rubro.name } : {}),
    hiringOrganization: {
      "@type": "Organization",
      // Mismo @id que la Organization de la ficha de la empresa (companySchema): la empresa que
      // contrata y la de /empresas/<slug> son la misma entidad para el buscador.
      ...(job.company_id ? { "@id": `${urlAbs(companyUrl({ id: job.company_id, legal_name: job.company_legal_name_snapshot }))}#organization` } : {}),
      name: job.company_legal_name_snapshot,
      // `url` es la ficha de la empresa en BBJobs. Sin `sameAs`: esa propiedad es para el sitio o
      // perfil propio de la empresa, y la ficha de BBJobs no "es la misma" entidad.
      ...(job.company_id ? { url: urlAbs(companyUrl({ id: job.company_id, legal_name: job.company_legal_name_snapshot })) } : {}),
      ...(job.logo_url ? { logo: job.logo_url } : {}),
    },
    ...(job.modality === "remoto"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "Argentina" },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: localidad,
              addressRegion: "Buenos Aires",
              addressCountry: "AR",
            },
          },
        }),
    ...(salarioVisible
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: job.salary_currency || "ARS",
            value: {
              "@type": "QuantitativeValue",
              ...(job.salary_min ? { minValue: job.salary_min } : {}),
              ...(job.salary_max ? { maxValue: job.salary_max } : {}),
              unitText: "MONTH",
            },
          },
        }
      : {}),
    ...(typeof job.min_experience_years === "number" && job.min_experience_years > 0
      ? {
          experienceRequirements: {
            "@type": "OccupationalExperienceRequirements",
            monthsOfExperience: job.min_experience_years * 12,
          },
        }
      : {}),
    ...(credencial
      ? {
          educationRequirements: {
            "@type": "EducationalOccupationalCredential",
            credentialCategory: credencial,
          },
        }
      : {}),
  };
}

export function companySchema(company: PublicCompany, rubro?: string): Json {
  const url = urlAbs(companyUrl(company));
  const web = company.website
    ? company.website.startsWith("http") ? company.website : `https://${company.website}`
    : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}#organization`,
    name: company.legal_name,
    url,
    ...(company.logo_url ? { logo: company.logo_url } : {}),
    ...(company.description ? { description: company.description } : {}),
    ...(web ? { sameAs: [web] } : {}),
    // "Otro" es el comodín del catálogo, no un sector: no dice nada de la empresa.
    ...(rubro && rubro.toLowerCase() !== "otro" ? { knowsAbout: rubro } : {}),
    ...(company.city || company.province
      ? {
          address: {
            "@type": "PostalAddress",
            ...(company.city ? { addressLocality: company.city } : {}),
            ...(company.province ? { addressRegion: company.province } : {}),
            addressCountry: "AR",
          },
        }
      : {}),
  };
}
