import type { PaginaSeo, Pregunta } from "./tipos";
import { RUBROS_INDICE, type EntradaIndice } from "./indice";

// Páginas /empleos-de/<slug>: los 11 sectores reales del catálogo, menos "Otro". Las búsquedas
// salen en vivo de la API. Los ejemplos de puestos describen el sector en general, no búsquedas
// publicadas; nada de cifras ni empresas nombradas.

const PREGUNTA_GRATIS: Pregunta = {
  p: "¿Cuesta algo postularse?",
  r: "No. Crear tu cuenta de candidato, cargar tu CV y postularte en BBJobs es gratis.",
};

const PREGUNTA_FILTRO = (sector: string): Pregunta => ({
  p: `¿Cómo veo sólo las búsquedas de ${sector.toLowerCase()}?`,
  r: `Esta página muestra las búsquedas activas del sector ${sector}. En la sección Empleos también podés elegir el sector en el filtro y combinarlo con zona, modalidad y tipo de contrato.`,
});

const PREGUNTA_PUBLICAR = (sector: string): Pregunta => ({
  p: `Tengo una empresa de ${sector.toLowerCase()}, ¿cómo publico una búsqueda?`,
  r: "Registrate como empresa en BBJobs. El equipo de Talency verifica los datos y, una vez aprobada, publicás la búsqueda eligiendo sector, zona, modalidad y tipo de contrato. Publicar es gratis para las empresas verificadas.",
});

export const RUBROS: PaginaSeo[] = [
  {
    slug: "administracion",
    title: "Empleos de administración en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de administración en Bahía Blanca y la región: puestos administrativos publicados por empresas verificadas por Talency. Postulate gratis con tu CV.",
    h1: "Empleos de administración en Bahía Blanca",
    bajada: "Puestos administrativos de empresas verificadas de Bahía y la zona.",
    citable:
      "En BBJobs, el portal de empleos de Bahía Blanca, las búsquedas de administración se publican en el sector Administración. Las publican empresas verificadas por Talency y los candidatos se postulan gratis con un click.",
    textos: [
      "El sector Administración agrupa puestos como asistente administrativo, auxiliar contable, facturación, cobranzas o recepción. Cada aviso detalla las tareas, los requisitos y el tipo de contratación.",
      "Si buscás trabajo administrativo, tené tu CV actualizado con los programas que manejás y tu experiencia previa: es lo primero que mira la empresa cuando te postulás.",
    ],
    preguntas: [PREGUNTA_FILTRO("Administración"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Administración")],
  },
  {
    slug: "comercio",
    title: "Empleos de comercio y ventas en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de comercio y ventas en Bahía Blanca y la región, de empresas verificadas por Talency. Vendedores, atención al público y más. Postulate gratis.",
    h1: "Empleos de comercio y ventas en Bahía Blanca",
    bajada: "Ventas, atención al público y comercio, en empresas verificadas.",
    citable:
      "BBJobs reúne las búsquedas de comercio y ventas de Bahía Blanca y la región en el sector Comercio. Todas las empresas que publican pasaron la verificación de Talency y la postulación es gratis.",
    textos: [
      "El sector Comercio incluye puestos de venta, atención al público, caja, repositor o encargado de local. Muchos avisos piden disponibilidad horaria: fijate en la descripción si hay turnos rotativos o fines de semana.",
      "Con tu perfil de candidato cargado te postulás en un click, y si querés podés sumar una carta de presentación corta contando tu experiencia en atención al cliente.",
    ],
    preguntas: [PREGUNTA_FILTRO("Comercio"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Comercio")],
  },
  {
    slug: "construccion",
    title: "Empleos de construcción en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de construcción en Bahía Blanca y la región, publicadas por empresas verificadas por Talency. Oficios, obra y técnicos. Postulate gratis con tu CV.",
    h1: "Empleos de construcción en Bahía Blanca",
    bajada: "Oficios, obra y puestos técnicos, en empresas verificadas.",
    citable:
      "Las búsquedas de construcción de Bahía Blanca y la región se publican en BBJobs en el sector Construcción. Las empresas están verificadas por Talency y los candidatos se postulan gratis desde su perfil.",
    textos: [
      "El sector Construcción abarca oficios de obra, maestros mayores de obra, técnicos, encargados y puestos administrativos de empresas constructoras. Cada aviso aclara la zona donde se trabaja.",
      "Si tenés experiencia en obra, contala en tu CV con los trabajos que hiciste y las herramientas o equipos que manejás.",
    ],
    preguntas: [PREGUNTA_FILTRO("Construcción"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Construcción")],
  },
  {
    slug: "educacion",
    title: "Empleos de educación en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de educación en Bahía Blanca y la región: docentes, institutos y capacitación, de instituciones verificadas por Talency. Postulate gratis con tu CV.",
    h1: "Empleos de educación en Bahía Blanca",
    bajada: "Docencia, institutos y capacitación, con instituciones verificadas.",
    citable:
      "BBJobs publica las búsquedas de educación de Bahía Blanca y la región en el sector Educación. Las instituciones que publican pasan la verificación de Talency y la postulación es gratis para los candidatos.",
    textos: [
      "El sector Educación incluye puestos docentes en instituciones privadas, institutos de idiomas o de capacitación, tutorías y cargos de apoyo administrativo en escuelas.",
      "Cargá en tu perfil tus títulos y tu experiencia frente a curso: es lo que más pesa en este sector.",
    ],
    preguntas: [PREGUNTA_FILTRO("Educación"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Educación")],
  },
  {
    slug: "gastronomia",
    title: "Empleos de gastronomía en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de gastronomía en Bahía Blanca y la región: cocina, salón y delivery, de empresas verificadas por Talency. Mirá los avisos y postulate gratis.",
    h1: "Empleos de gastronomía en Bahía Blanca",
    bajada: "Cocina, salón y atención, en empresas verificadas de la zona.",
    citable:
      "En BBJobs, el portal de empleos de Bahía Blanca, las búsquedas de gastronomía se publican en el sector Gastronomía. Las empresas están verificadas por Talency y los candidatos se postulan gratis con un click.",
    textos: [
      "El sector Gastronomía reúne puestos de cocina, ayudante de cocina, mozo o moza, bacha, barra, cajero y encargado de local. Las búsquedas suelen aclarar los turnos y los días de trabajo.",
      "En Monte Hermoso y otras zonas turísticas muchas búsquedas se mueven con la temporada: tener tu perfil listo te deja postularte apenas aparecen.",
    ],
    preguntas: [PREGUNTA_FILTRO("Gastronomía"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Gastronomía")],
  },
  {
    slug: "industria",
    title: "Empleos en la industria en Bahía Blanca | BBJobs",
    description:
      "Búsquedas del sector industria en Bahía Blanca y la región: operarios, técnicos y mantenimiento, de empresas verificadas por Talency. Postulate gratis.",
    h1: "Empleos en la industria en Bahía Blanca",
    bajada: "Operarios, técnicos y mantenimiento, en empresas verificadas.",
    citable:
      "BBJobs agrupa las búsquedas industriales de Bahía Blanca y la región en el sector Industria. Las empresas que publican están verificadas por Talency y los candidatos se postulan gratis desde su perfil.",
    textos: [
      "Bahía Blanca tiene puerto y polo petroquímico, y alrededor de ellos trabajan empresas industriales y de servicios. En el sector Industria se publican búsquedas de operarios, técnicos, mantenimiento, seguridad e higiene y supervisión.",
      "Si tenés formación técnica o cursos de seguridad, sumalos a tu perfil o a tu CV: muchas búsquedas industriales los piden como requisito.",
    ],
    preguntas: [PREGUNTA_FILTRO("Industria"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Industria")],
  },
  {
    slug: "logistica",
    title: "Empleos de logística en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de logística en Bahía Blanca y la región: depósito, choferes y distribución, de empresas verificadas por Talency. Postulate gratis con tu CV.",
    h1: "Empleos de logística en Bahía Blanca",
    bajada: "Depósito, choferes y distribución, en empresas verificadas.",
    citable:
      "Las búsquedas de logística de Bahía Blanca y la región se publican en BBJobs en el sector Logística. Las empresas están verificadas por Talency y la postulación es gratis para los candidatos.",
    textos: [
      "El sector Logística incluye puestos de depósito, autoelevadoristas, choferes, repartidores, administración de despachos y coordinación de distribución.",
      "Si el puesto pide licencia de conducir profesional o carnet de autoelevador, el aviso lo dice en los requisitos. Si lo tenés, dejalo claro en tu CV.",
    ],
    preguntas: [PREGUNTA_FILTRO("Logística"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Logística")],
  },
  {
    slug: "marketing",
    title: "Empleos de marketing en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de marketing en Bahía Blanca y la región: redes sociales, diseño y comunicación, de empresas verificadas por Talency. Postulate gratis con tu CV.",
    h1: "Empleos de marketing en Bahía Blanca",
    bajada: "Redes, diseño y comunicación, en empresas verificadas.",
    citable:
      "BBJobs publica las búsquedas de marketing y comunicación de Bahía Blanca y la región en el sector Marketing. Las empresas pasan la verificación de Talency y los candidatos se postulan gratis con un click.",
    textos: [
      "El sector Marketing abarca community managers, diseño gráfico, comunicación, publicidad y análisis comercial. Algunas búsquedas son remotas o híbridas: lo ves en la modalidad de cada aviso.",
      "Si tenés trabajos para mostrar, mencioná en tu CV dónde verlos. Ayuda a que la empresa entienda rápido lo que hacés.",
    ],
    preguntas: [PREGUNTA_FILTRO("Marketing"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Marketing")],
  },
  {
    slug: "recursos-humanos",
    title: "Empleos de recursos humanos en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de recursos humanos en Bahía Blanca y la región: selección, liquidación de sueldos y gestión de personal, de empresas verificadas. Postulate gratis.",
    h1: "Empleos de recursos humanos en Bahía Blanca",
    bajada: "Selección, sueldos y gestión de personal, en empresas verificadas.",
    citable:
      "Las búsquedas de recursos humanos de Bahía Blanca y la región se publican en BBJobs en el sector Recursos Humanos. BBJobs es una iniciativa de Talency, consultora bahiense de recursos humanos, y verifica a cada empresa que publica.",
    textos: [
      "El sector Recursos Humanos incluye puestos de selección, liquidación de sueldos, administración de personal, capacitación y relaciones laborales.",
      "Detrás de BBJobs está Talency, una consultora de recursos humanos de Bahía Blanca. Por eso cada empresa que publica en el portal pasa antes por una verificación manual.",
    ],
    preguntas: [PREGUNTA_FILTRO("Recursos Humanos"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Recursos Humanos")],
  },
  {
    slug: "salud",
    title: "Empleos de salud en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de salud en Bahía Blanca y la región: enfermería, consultorios y administración sanitaria, de instituciones verificadas. Postulate gratis con tu CV.",
    h1: "Empleos de salud en Bahía Blanca",
    bajada: "Enfermería, consultorios y administración, con instituciones verificadas.",
    citable:
      "BBJobs reúne las búsquedas de salud de Bahía Blanca y la región en el sector Salud. Las instituciones que publican están verificadas por Talency y los candidatos se postulan gratis desde su perfil.",
    textos: [
      "El sector Salud incluye enfermería, técnicos, profesionales, recepción de consultorios, farmacia y administración de clínicas y centros médicos.",
      "Si el puesto pide matrícula, el aviso lo indica en los requisitos. Mencioná tu título y tu matrícula en el CV que cargás en tu perfil, así la institución lo ve al recibir tu postulación.",
    ],
    preguntas: [PREGUNTA_FILTRO("Salud"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Salud")],
  },
  {
    slug: "tecnologia",
    title: "Empleos de tecnología en Bahía Blanca | BBJobs",
    description:
      "Búsquedas de tecnología en Bahía Blanca y la región: desarrollo, soporte técnico y sistemas, de empresas verificadas por Talency. Postulate gratis con tu CV.",
    h1: "Empleos de tecnología en Bahía Blanca",
    bajada: "Desarrollo, soporte y sistemas, en empresas verificadas.",
    citable:
      "Las búsquedas de tecnología de Bahía Blanca y la región se publican en BBJobs en el sector Tecnología. Las empresas están verificadas por Talency y la postulación es gratis, también para puestos remotos o híbridos.",
    textos: [
      "El sector Tecnología agrupa puestos de desarrollo de software, soporte técnico, redes, infraestructura y análisis de sistemas. Fijate la modalidad de cada aviso: hay presenciales, remotos e híbridos.",
      "En tu perfil podés cargar tus habilidades técnicas; es lo que más rápido mira una empresa de tecnología cuando recibe tu postulación.",
    ],
    preguntas: [PREGUNTA_FILTRO("Tecnología"), PREGUNTA_GRATIS, PREGUNTA_PUBLICAR("Tecnología")],
  },
];

export function getRubro(slug: string): (PaginaSeo & EntradaIndice) | undefined {
  const indice = RUBROS_INDICE.find((r) => r.slug === slug);
  const contenido = RUBROS.find((r) => r.slug === slug);
  return indice && contenido ? { ...indice, ...contenido } : undefined;
}
