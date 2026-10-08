// JSON-LD de BBJobs. Las páginas lo insertan con <JsonLd /> (components/seo/JsonLd.tsx).

import { SITE_URL, SITIO, urlAbs } from "./sitio";
import { companyUrl, jobUrl } from "./urls";
import { localidadDeZona } from "./indice";
import type { Catalogos, PublicCompany, PublicJob } from "./datos";
import { etiquetasJob } from "./datos";

type Json = Record<string, unknown>;

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

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
    areaServed: AREA_SERVIDA,
    parentOrganization: {
      "@type": "Organization",
      name: SITIO.talency.nombre,
      url: SITIO.talency.url,
    },
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

export type Miga = { nombre: string; path: string };

export function breadcrumbSchema(migas: Miga[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: migas.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nombre,
      item: urlAbs(m.path),
    })),
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
    datePosted: job.published_at,
    ...(job.expires_at ? { validThrough: job.expires_at } : {}),
    ...(employmentType ? { employmentType } : {}),
    url: urlAbs(jobUrl(job)),
    identifier: { "@type": "PropertyValue", name: SITIO.nombre, value: job.id },
    directApply: true,
    ...(rubro ? { industry: rubro.name } : {}),
    hiringOrganization: {
      "@type": "Organization",
      name: job.company_legal_name_snapshot,
      ...(job.company_id ? { sameAs: urlAbs(companyUrl(job.company_id)), url: urlAbs(companyUrl(job.company_id)) } : {}),
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
  const url = urlAbs(companyUrl(company.id));
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
    ...(rubro ? { knowsAbout: rubro } : {}),
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
