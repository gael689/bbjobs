// Contenido de las páginas para empresas: /seleccion-de-personal (el servicio de Talency),
// /seleccion-de-personal/<sector> y /publicar-empleo. Ver SEO-EMPRESAS-TALENCY-PLAN.md.
//
// Poco texto y con gancho (reescrito el 10/10/2026): cada página muestra el problema de la empresa
// y cómo se resuelve, no el proceso entero. El detalle largo quedó en `citable` y PASOS_SELECCION,
// que alimentan sólo el JSON-LD y /llms.txt (no se ven en pantalla).
//
// Regla dura: nada inventado. Los pasos del servicio son los del banner de la home; lo que se
// dice de publicar sale del código (verificación manual, publicar gratis, revisión de cada
// búsqueda, 20 días máximos, etapas de la postulación, destacar pago). Sin años de experiencia,
// cantidad de búsquedas, clientes, plazos ni precios del servicio: esos datos los tiene que dar
// Talency y están anotados como pendientes en el plan, no en la página.

import type { Pregunta } from "./tipos";
import { RUBROS_INDICE, SELECCION_INDICE, type EntradaIndice } from "./indice";

export type Paso = { titulo: string; texto: string };
/** Un dolor de la empresa y cómo se resuelve. */
export type Par = { problema: string; solucion: string };

/** El proceso completo, en el orden del banner de la home. No se muestra: lo lee /llms.txt. */
export const PASOS_SELECCION: Paso[] = [
  { titulo: "Relevamiento del perfil", texto: "Talency define con la empresa qué puesto hay que cubrir y qué requisitos son indispensables." },
  { titulo: "Publicación de la búsqueda", texto: "Talency redacta el aviso y publica la búsqueda." },
  { titulo: "Revisión de postulaciones", texto: "Talency lee los CV y separa a quienes cumplen con lo que pide el puesto." },
  { titulo: "Entrevistas", texto: "Talency entrevista a los candidatos que pasaron el primer filtro." },
  { titulo: "Evaluaciones psicométricas", texto: "Se suman evaluaciones para conocer aspectos del candidato que no aparecen en un CV." },
  { titulo: "Presentación de candidatos", texto: "La empresa recibe a los que mejor se ajustan al perfil y decide." },
];

/** Los mismos seis pasos, en tres, para la página. */
export const PASOS_CORTOS: Paso[] = [
  { titulo: "Nos contás el puesto", texto: "Definimos juntos qué perfil necesitás." },
  { titulo: "Nosotros hacemos el trabajo", texto: "Publicamos, filtramos, entrevistamos y evaluamos." },
  { titulo: "Vos elegís", texto: "Te presentamos a los que mejor encajan. La decisión es tuya." },
];

export const PARA_QUIEN: string[] = [
  "No tenés área de RR.HH.",
  "No te alcanza el tiempo para filtrar CV",
  "El puesto es clave o difícil de cubrir",
  "Querés sumar evaluaciones psicométricas",
];

export const SELECCION_HUB = {
  title: "Selección de personal en Bahía Blanca | Talency · BBJobs",
  description:
    "Talency, la consultora de recursos humanos detrás de BBJobs, se encarga de búsquedas en Bahía Blanca: perfil, avisos, entrevistas y evaluaciones psicométricas.",
  h1: "Selección de personal en Bahía Blanca",
  bajada: "Vos atendés tu negocio. Talency encuentra a la persona que necesitás.",
  citable:
    "Talency es una consultora de recursos humanos de Bahía Blanca y la organización detrás de BBJobs, el portal de empleos de la ciudad. Su servicio de selección de personal cubre todo el proceso: relevamiento del perfil, publicación de la búsqueda, revisión de postulaciones, entrevistas, evaluaciones psicométricas y presentación de candidatos. Las empresas lo consultan desde el formulario de BBJobs.",
  dolores: [
    { problema: "Cientos de CV y ninguna hora libre", solucion: "Talency los lee y deja sólo a quienes cumplen el perfil." },
    { problema: "Entrevistas que no llevan a nada", solucion: "Entrevistamos nosotros. Vos conocés a los candidatos que valen la pena." },
    { problema: "Un CV no cuenta cómo trabaja alguien", solucion: "Evaluaciones psicométricas para ver lo que el CV no muestra." },
  ] satisfies Par[],
  preguntas: [
    {
      p: "¿Qué incluye el servicio de selección de personal de Talency?",
      r: "Todo el proceso: relevamiento del perfil, publicación, revisión de postulaciones, entrevistas, evaluaciones psicométricas y presentación de candidatos. La empresa elige entre los presentados.",
    },
    {
      p: "¿Cuánto cuesta?",
      r: "No forma parte de la publicación gratuita de BBJobs. Dejá tu consulta con el puesto y Talency te responde con el costo para tu búsqueda.",
    },
    {
      p: "¿Puedo publicar por mi cuenta y pedir ayuda después?",
      r: "Sí. Publicar en BBJobs y consultar por la selección son cosas independientes: si la búsqueda se complica, escribile a Talency desde esta página.",
    },
  ] satisfies Pregunta[],
};

export type PaginaSeleccionRubro = {
  /** Slug del sector: el mismo que /empleos-de/<slug>. Tiene que estar en SELECCION_INDICE. */
  slug: string;
  title: string;
  description: string;
  h1: string;
  /** El gancho del sector, una línea. También lo usa /llms.txt. */
  bajada: string;
  /** Para el JSON-LD y /llms.txt; no se muestra. */
  citable: string;
  /** Perfiles que suelen buscarse en el sector (descripción general, no búsquedas publicadas). */
  perfiles: string[];
  /** Tres dolores del sector y cómo se resuelven. */
  dolores: Par[];
  preguntas: Pregunta[];
};

const PREGUNTA_CONSULTA = (sector: string): Pregunta => ({
  p: `¿Cómo consulto por una búsqueda de ${sector.toLowerCase()}?`,
  r: "Con el formulario de esta página: el sector ya viene elegido. Dejá tu teléfono y, si querés, el puesto y las vacantes. Talency te responde por WhatsApp o por teléfono.",
});

export const SELECCION_RUBROS: PaginaSeleccionRubro[] = [
  {
    slug: "industria",
    title: "Selección de personal industrial en Bahía Blanca | Talency",
    description:
      "Talency busca operarios, técnicos y supervisores para empresas industriales de Bahía Blanca y la región: perfil, entrevistas y evaluaciones psicométricas.",
    h1: "Selección de personal para la industria en Bahía Blanca",
    bajada: "Operarios y técnicos que saben hacer el trabajo y cumplen tus turnos.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para empresas industriales de Bahía Blanca y la región. Releva el perfil, publica la búsqueda, revisa postulaciones, entrevista, evalúa y presenta a los candidatos.",
    perfiles: [
      "Operarios de producción",
      "Técnicos de mantenimiento",
      "Supervisores y jefes de turno",
      "Seguridad e higiene",
      "Laboratorio y calidad",
    ],
    dolores: [
      { problema: "Una mala incorporación se paga en seguridad", solucion: "Definimos con vos los requisitos indispensables antes de buscar." },
      { problema: "Turnos que nadie quiere cubrir", solucion: "Buscamos gente que pueda cumplir tu esquema de turnos." },
      { problema: "El CV no dice cómo trabaja en equipo", solucion: "Las evaluaciones psicométricas muestran lo que el CV no." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Industria"),
      {
        p: "¿Se puede buscar personal para trabajar por turnos?",
        r: "Sí. En el relevamiento se define el esquema de turnos y horarios, y la búsqueda apunta a candidatos que puedan cumplirlo.",
      },
    ],
  },
  {
    slug: "logistica",
    title: "Selección de personal de logística en Bahía Blanca | Talency",
    description:
      "Talency busca choferes, personal de depósito y coordinadores de distribución para empresas de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal para logística en Bahía Blanca",
    bajada: "Choferes y personal de depósito con lo que pide el puesto.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de logística para empresas de Bahía Blanca y la región: choferes, operarios de depósito, autoelevadoristas y coordinación de distribución.",
    perfiles: [
      "Choferes con licencia profesional",
      "Repartidores",
      "Autoelevadoristas",
      "Depósito",
      "Coordinadores de distribución",
    ],
    dolores: [
      { problema: "Licencias y carnets que no están al día", solucion: "Los requisitos del puesto se definen antes de publicar." },
      { problema: "Un reparto frenado por una vacante", solucion: "Filtramos nosotros para que no pierdas tiempo con quienes no cumplen." },
      { problema: "Cuesta saber quién es responsable de verdad", solucion: "Entrevistas y evaluaciones para conocer a cada candidato." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Logística"),
      {
        p: "¿Qué conviene tener claro para pedir un chofer o un operario de depósito?",
        r: "El carnet que hace falta, el vehículo o equipo, la zona de trabajo y los horarios. Con eso el relevamiento es más rápido.",
      },
    ],
  },
  {
    slug: "comercio",
    title: "Selección de vendedores y personal de comercio | Talency",
    description:
      "Talency busca vendedores, cajeros, repositores y encargados de local para comercios de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal para comercio en Bahía Blanca",
    bajada: "Gente que atiende bien a tus clientes.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para comercios de Bahía Blanca y la región: vendedores, cajeros, repositores, atención al público y encargados de local.",
    perfiles: [
      "Vendedores",
      "Atención al público",
      "Cajeros",
      "Repositores",
      "Encargados de local",
    ],
    dolores: [
      { problema: "Quien atiende es la cara de tu negocio", solucion: "Entrevistamos para ver la actitud, no sólo la experiencia." },
      { problema: "Necesitás varias personas a la vez", solucion: "Un solo relevamiento sirve para cubrir todas las vacantes." },
      { problema: "Los CV de vendedores se parecen todos", solucion: "Las evaluaciones muestran las diferencias." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Comercio"),
      {
        p: "¿Y si necesito varias personas a la vez?",
        r: "Indicá la cantidad de vacantes en el formulario. El relevamiento sirve para todas y la búsqueda se arma para cubrirlas.",
      },
    ],
  },
  {
    slug: "gastronomia",
    title: "Selección de personal gastronómico en Bahía Blanca | Talency",
    description:
      "Talency busca cocineros, ayudantes, mozos y encargados para locales gastronómicos de Bahía Blanca y la región. Perfil, entrevistas y presentación de candidatos.",
    h1: "Selección de personal gastronómico en Bahía Blanca",
    bajada: "Cocina y salón completos antes de abrir.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal gastronómico para Bahía Blanca y la región: cocineros, ayudantes de cocina, mozos, barra y encargados de local.",
    perfiles: [
      "Cocineros y ayudantes",
      "Mozos y mozas",
      "Bacheros",
      "Barra y cafetería",
      "Encargados de local",
    ],
    dolores: [
      { problema: "Llega la temporada y el equipo no", solucion: "Empezás con tiempo y entrevistamos sin apuro." },
      { problema: "Turnos de noche, fines de semana y feriados", solucion: "Buscamos gente con la disponibilidad que necesitás." },
      { problema: "En el pico de trabajo se nota quién aguanta", solucion: "Evaluaciones para conocer cómo trabaja cada candidato." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Gastronomía"),
      {
        p: "¿Conviene empezar la búsqueda antes de la temporada?",
        r: "Sí. Armar el equipo con tiempo deja margen para entrevistar y evaluar con calma, sobre todo en zonas turísticas como Monte Hermoso.",
      },
    ],
  },
  {
    slug: "construccion",
    title: "Personal para construcción en Bahía Blanca | Talency",
    description:
      "Talency busca oficiales, capataces, técnicos y personal de obra para empresas constructoras de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal para construcción en Bahía Blanca",
    bajada: "Oficios y conducción de obra, con el perfil claro.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para empresas constructoras de Bahía Blanca y la región: oficiales, ayudantes, capataces, maestros mayores de obra, técnicos y administrativos de obra.",
    perfiles: [
      "Oficiales y ayudantes",
      "Capataces y encargados",
      "Maestros mayores de obra",
      "Seguridad e higiene",
      "Administrativos de obra",
    ],
    dolores: [
      { problema: "Alguien sin el oficio atrasa a toda la obra", solucion: "Definimos las tareas y la etapa de obra antes de buscar." },
      { problema: "Entrevistas que no llevan a nada", solucion: "Filtramos nosotros y te presentamos sólo a quienes encajan." },
      { problema: "La obra queda lejos", solucion: "El traslado se tiene en cuenta desde el perfil." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Construcción"),
      {
        p: "¿Se puede buscar personal para una obra fuera de Bahía Blanca?",
        r: "Contá la localidad de la obra en la consulta. BBJobs cubre Bahía Blanca, Punta Alta, Monte Hermoso y Coronel Suárez.",
      },
    ],
  },
  {
    slug: "administracion",
    title: "Selección de administrativos en Bahía Blanca | Talency",
    description:
      "Talency busca administrativos, auxiliares contables, recepcionistas y asistentes para empresas de Bahía Blanca y la región. Perfil, entrevistas y evaluaciones.",
    h1: "Selección de personal administrativo en Bahía Blanca",
    bajada: "Administrativos que manejan las tareas de verdad.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal administrativo para empresas de Bahía Blanca y la región: administrativos, auxiliares contables, facturación, cobranzas, recepción y asistentes.",
    perfiles: [
      "Administrativos",
      "Auxiliares contables",
      "Facturación y cobranzas",
      "Recepcionistas",
      "Asistentes de gerencia",
    ],
    dolores: [
      { problema: "Cientos de CV para un solo puesto", solucion: "Los leemos nosotros y separamos a quienes cumplen." },
      { problema: "Cuesta saber quién maneja tu sistema", solucion: "Entrevistamos sobre las tareas y los programas que usás." },
      { problema: "Vas a confiarle información de tu empresa", solucion: "Entrevistas y evaluaciones para conocer a cada persona antes de sumarla." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Administración"),
      {
        p: "¿Qué conviene contar en la consulta para un puesto administrativo?",
        r: "Las tareas, los programas que se usan, el horario y si es un reemplazo o un puesto nuevo.",
      },
    ],
  },
  {
    slug: "tecnologia",
    title: "Selección de personal IT en Bahía Blanca | Talency",
    description:
      "Talency busca desarrolladores, soporte técnico y administradores de sistemas para empresas de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal de tecnología en Bahía Blanca",
    bajada: "Perfiles técnicos que saben lo que dicen saber y encajan con tu equipo.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de tecnología para empresas de Bahía Blanca y la región: desarrolladores, soporte técnico, administradores de sistemas, testers y analistas de datos.",
    perfiles: [
      "Desarrolladores",
      "Soporte técnico",
      "Administradores de sistemas",
      "Testers y QA",
      "Analistas de datos",
    ],
    dolores: [
      { problema: "Un CV lleno de siglas", solucion: "Definimos con vos qué necesitás de verdad antes de buscar." },
      { problema: "Cuesta saber si alguien sabe lo que dice saber", solucion: "Entrevistamos sobre las tecnologías que realmente usás." },
      { problema: "Un buen técnico que no encaja en el equipo", solucion: "Las evaluaciones psicométricas muestran cómo trabaja cada persona." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Tecnología"),
      {
        p: "¿Se puede buscar personal remoto o híbrido?",
        r: "Sí. Indicá la modalidad (presencial, remoto o híbrido) en la consulta y se define en el relevamiento del perfil.",
      },
    ],
  },
  {
    slug: "salud",
    title: "Selección de personal de salud en Bahía Blanca | Talency",
    description:
      "Talency busca enfermeros, administrativos de salud, técnicos y personal de consultorios para empresas de Bahía Blanca y la región. Perfil y entrevistas.",
    h1: "Selección de personal de salud en Bahía Blanca",
    bajada: "Personal con la formación que pide el puesto y buen trato con las personas.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de salud para clínicas, consultorios y empresas de Bahía Blanca y la región: enfermería, técnicos, administrativos de salud y recepción.",
    perfiles: [
      "Enfermería",
      "Técnicos y auxiliares",
      "Administrativos de salud",
      "Recepción de consultorios",
      "Rehabilitación y kinesiología",
    ],
    dolores: [
      { problema: "Títulos y matrículas que hay que tener claros", solucion: "Definimos los requisitos del puesto antes de publicar." },
      { problema: "Turnos rotativos y guardias", solucion: "Buscamos gente con la disponibilidad que pide el puesto." },
      { problema: "El trato con pacientes pesa más que el CV", solucion: "Entrevistas y evaluaciones para conocer cómo trata a las personas." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Salud"),
      {
        p: "¿Y si el puesto exige matrícula?",
        r: "Contalo en la consulta: queda entre los requisitos indispensables del perfil.",
      },
    ],
  },
  {
    slug: "educacion",
    title: "Selección de personal de educación en Bahía Blanca | Talency",
    description:
      "Talency busca docentes, auxiliares, preceptores y administrativos para instituciones de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal de educación en Bahía Blanca",
    bajada: "Docentes y equipos de instituciones, elegidos por cómo trabajan.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de educación para instituciones y empresas de capacitación de Bahía Blanca y la región: docentes, auxiliares, preceptores, coordinadores y administrativos.",
    perfiles: [
      "Docentes",
      "Auxiliares y preceptores",
      "Coordinadores",
      "Capacitadores",
      "Administrativos de instituciones",
    ],
    dolores: [
      { problema: "Un docente se elige por cómo enseña, no sólo por el título", solucion: "Entrevistamos para conocer su forma de trabajar." },
      { problema: "Cargos que hay que cubrir ya", solucion: "Con el perfil definido, la búsqueda no arranca de cero." },
      { problema: "Trato diario con chicos y familias", solucion: "Evaluaciones para conocer a la persona más allá del CV." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Educación"),
      {
        p: "¿Sirve para instituciones y centros de capacitación?",
        r: "Sí. Contá qué tipo de institución sos y qué puesto necesitás en la consulta.",
      },
    ],
  },
  {
    slug: "marketing",
    title: "Selección de personal de marketing en Bahía Blanca | Talency",
    description:
      "Talency busca community managers, diseñadores, redactores y analistas de marketing para empresas de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal de marketing en Bahía Blanca",
    bajada: "Gente creativa que además cumple y encaja en tu equipo.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de marketing para empresas de Bahía Blanca y la región: community managers, diseñadores gráficos, redactores, analistas de marketing digital y producción audiovisual.",
    perfiles: [
      "Community managers",
      "Diseñadores gráficos",
      "Redactores",
      "Marketing digital",
      "Fotografía y video",
    ],
    dolores: [
      { problema: "Portfolios lindos que no dicen cómo trabaja", solucion: "Entrevistamos sobre casos y trabajos concretos." },
      { problema: "No tenés claro qué perfil necesitás", solucion: "El relevamiento define el puesto antes de publicar." },
      { problema: "En un equipo chico cada persona cuenta", solucion: "Evaluaciones para ver cómo encaja con los demás." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Marketing"),
      {
        p: "¿Qué conviene contar en la consulta?",
        r: "El puesto, las herramientas que se usan, si es presencial o remoto y qué conviene que muestre el candidato.",
      },
    ],
  },
  {
    slug: "recursos-humanos",
    title: "Selección de personal de RR.HH. en Bahía Blanca | Talency",
    description:
      "Talency busca analistas de recursos humanos, liquidación de sueldos y reclutadores para empresas de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal de recursos humanos en Bahía Blanca",
    bajada: "Quien busca a las personas de tu empresa tiene que ser la persona indicada.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de recursos humanos para empresas de Bahía Blanca y la región: analistas, liquidación de sueldos, reclutadores, administrativos de personal y capacitación.",
    perfiles: [
      "Analistas de RR.HH.",
      "Liquidación de sueldos",
      "Reclutadores",
      "Administrativos de personal",
      "Capacitación",
    ],
    dolores: [
      { problema: "Va a manejar información sensible de tu gente", solucion: "Entrevistas y evaluaciones para conocer a la persona antes de sumarla." },
      { problema: "Puestos que mezclan administración y trato con personas", solucion: "Definimos qué parte pesa más en tu puesto." },
      { problema: "Buscar a quien va a buscar a otros", solucion: "Talency es una consultora de RR.HH.: conoce el oficio." },
    ],
    preguntas: [
      PREGUNTA_CONSULTA("Recursos Humanos"),
      {
        p: "¿Qué conviene contar en la consulta?",
        r: "Si el puesto es de liquidación, de reclutamiento o mixto, y qué sistemas usa tu empresa.",
      },
    ],
  },
];

export function getSeleccionRubro(slug: string): (PaginaSeleccionRubro & EntradaIndice) | undefined {
  if (!SELECCION_INDICE.includes(slug)) return undefined;
  const indice = RUBROS_INDICE.find((r) => r.slug === slug);
  const contenido = SELECCION_RUBROS.find((r) => r.slug === slug);
  return indice && contenido ? { ...indice, ...contenido } : undefined;
}

/** Contenido de /publicar-empleo. Cada dato sale del código (ver la cabecera del archivo). */
export const PUBLICAR = {
  title: "Publicar un empleo en Bahía Blanca gratis | BBJobs",
  description:
    "Publicá tus búsquedas en BBJobs, el portal de empleos de Bahía Blanca. Gratis para empresas verificadas por Talency, con las postulaciones en tu panel.",
  h1: "Publicar un empleo en Bahía Blanca",
  bajada: "Publicá gratis y recibí postulaciones ordenadas en tu panel.",
  citable:
    "En BBJobs, el portal de empleos de Bahía Blanca, publicar búsquedas es gratis para las empresas verificadas por Talency. La empresa se registra, Talency verifica sus datos a mano y, una vez aprobada, publica búsquedas sin límite y recibe las postulaciones con el perfil y el CV de cada candidato.",
  dolores: [
    { problema: "Avisos que se pierden en grupos y redes", solucion: "Tu búsqueda en el portal de empleos de Bahía Blanca." },
    { problema: "CV por mail y WhatsApp, todo mezclado", solucion: "Cada postulación en tu panel, con el perfil y el CV del candidato." },
    { problema: "No sabés cómo viene cada candidato", solucion: "Movés cada postulación por etapas, de Nueva a Seleccionado." },
  ] satisfies Par[],
  pasos: [
    { titulo: "Creá tu cuenta", texto: "Con los datos de tu empresa. Es gratis." },
    { titulo: "Verificamos tu empresa", texto: "Talency revisa tus datos a mano: así los candidatos saben que hay una empresa real." },
    { titulo: "Publicá y recibí", texto: "Cargás el puesto, Talency lo revisa y empiezan a llegar las postulaciones." },
  ] satisfies Paso[],
  incluye: [
    "Búsquedas ilimitadas",
    "Postulaciones sin límite",
    "Perfil y CV de cada candidato",
    "Filtros por experiencia, puesto y zona",
    "Estadísticas de tus búsquedas",
  ],
  preguntas: [
    {
      p: "¿Publicar un empleo en BBJobs es gratis?",
      r: "Sí, para empresas verificadas y sin límite de búsquedas ni postulaciones. Sólo pagás si querés destacar un aviso o acceder a la Base de Talento.",
    },
    {
      p: "¿Por qué tengo que esperar la verificación?",
      r: "Porque en BBJobs sólo publican empresas reales. Talency revisa cada cuenta a mano y la verificación es gratis.",
    },
    {
      p: "¿Cuánto dura publicada una búsqueda?",
      r: "Hasta 20 días. Al publicar elegís la duración, y la búsqueda sale del portal cuando se cumple el plazo.",
    },
    {
      p: "¿Tengo que mostrar el sueldo?",
      r: "No. Es opcional: lo cargás si querés que se vea en el aviso.",
    },
  ] satisfies Pregunta[],
};
