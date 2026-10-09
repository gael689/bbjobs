// Contenido de las páginas para empresas: /seleccion-de-personal (el servicio de Talency),
// /seleccion-de-personal/<sector> y /publicar-empleo. Ver SEO-EMPRESAS-TALENCY-PLAN.md.
//
// Regla dura: nada inventado. Los pasos del servicio son los del banner de la home; lo que se
// dice de publicar sale del código (verificación manual, publicar gratis, revisión de cada
// búsqueda, 20 días máximos, etapas de la postulación, destacar pago). Sin años de experiencia,
// cantidad de búsquedas, clientes, plazos ni precios del servicio: esos datos los tiene que dar
// Talency y están anotados como pendientes en el plan, no en la página.

import type { Pregunta } from "./tipos";
import { RUBROS_INDICE, SELECCION_INDICE, type EntradaIndice } from "./indice";

export type Paso = { titulo: string; texto: string };

/** El proceso, en el orden del banner de la home (app/page.tsx, "Selección de personal por Talency"). */
export const PASOS_SELECCION: Paso[] = [
  {
    titulo: "Relevamiento del perfil",
    texto: "Antes de publicar, Talency define con vos qué puesto hay que cubrir, qué tareas tiene y qué requisitos son indispensables.",
  },
  {
    titulo: "Publicación de la búsqueda",
    texto: "Con el perfil claro, Talency redacta el aviso y publica la búsqueda.",
  },
  {
    titulo: "Revisión de postulaciones",
    texto: "Talency lee los CV que llegan y separa a quienes cumplen con lo que pide el puesto. No tenés que revisarlos uno por uno.",
  },
  {
    titulo: "Entrevistas",
    texto: "Talency entrevista a los candidatos que pasaron el primer filtro.",
  },
  {
    titulo: "Evaluaciones psicométricas",
    texto: "Se suman evaluaciones psicométricas para conocer aspectos de cada candidato que no aparecen en un CV.",
  },
  {
    titulo: "Presentación de candidatos",
    texto: "Recibís a los candidatos que mejor se ajustan al perfil y la decisión final es tuya.",
  },
];

export const PARA_QUIEN: string[] = [
  "Empresas que no tienen un área de recursos humanos.",
  "Equipos que no tienen tiempo de leer CV, filtrar y coordinar entrevistas.",
  "Puestos clave o difíciles de cubrir, donde conviene una evaluación más a fondo.",
  "Empresas que quieren sumar evaluaciones psicométricas al proceso.",
];

/** Comparación honesta: publicar por tu cuenta en BBJobs vs. que Talency se encargue. */
export const COMPARACION: { aspecto: string; publicar: string; talency: string }[] = [
  { aspecto: "Costo", publicar: "Gratis para empresas verificadas", talency: "A consultar con Talency" },
  { aspecto: "Definir el perfil", publicar: "Lo definís vos", talency: "Talency lo releva con vos" },
  { aspecto: "Publicar el aviso", publicar: "Lo cargás vos en BBJobs", talency: "Talency lo redacta y lo publica" },
  { aspecto: "Revisar postulaciones", publicar: "Vos, desde tu panel", talency: "Talency" },
  { aspecto: "Entrevistas", publicar: "Las coordinás vos", talency: "Talency" },
  { aspecto: "Evaluaciones psicométricas", publicar: "No incluidas", talency: "Incluidas en el proceso" },
  { aspecto: "Decisión final", publicar: "Vos", talency: "Vos, entre los candidatos presentados" },
];

export const SELECCION_HUB = {
  title: "Selección de personal en Bahía Blanca | Talency · BBJobs",
  description:
    "Talency, la consultora de recursos humanos detrás de BBJobs, se encarga de búsquedas en Bahía Blanca: perfil, avisos, entrevistas y evaluaciones psicométricas.",
  h1: "Selección de personal en Bahía Blanca",
  bajada: "Talency, la consultora de recursos humanos detrás de BBJobs, se encarga de tu búsqueda de punta a punta.",
  citable:
    "Talency es una consultora de recursos humanos de Bahía Blanca y la organización detrás de BBJobs, el portal de empleos de la ciudad. Su servicio de selección de personal cubre todo el proceso: relevamiento del perfil, publicación de la búsqueda, revisión de postulaciones, entrevistas, evaluaciones psicométricas y presentación de candidatos. Las empresas lo consultan desde el formulario de BBJobs.",
  preguntas: [
    {
      p: "¿Qué incluye el servicio de selección de personal de Talency?",
      r: "Todo el proceso: el relevamiento del perfil con la empresa, la publicación de la búsqueda, la revisión de las postulaciones, las entrevistas, las evaluaciones psicométricas y la presentación de los candidatos. La empresa elige entre los candidatos presentados.",
    },
    {
      p: "¿En qué se diferencia de publicar un aviso en BBJobs?",
      r: "Publicar en BBJobs es gratis para las empresas verificadas, y las postulaciones las gestionás vos desde tu panel. Con el servicio de selección, Talency hace ese trabajo por vos: filtra, entrevista, evalúa y te presenta a los candidatos.",
    },
    {
      p: "¿Cuánto cuesta?",
      r: "El servicio de selección no forma parte de la publicación gratuita de BBJobs. Dejanos la consulta con el puesto que necesitás cubrir y Talency te responde con el costo para tu búsqueda.",
    },
    {
      p: "¿Cómo hago la consulta?",
      r: "Completá el formulario de esta página con tu nombre, un teléfono y lo que necesitás cubrir. Puesto, sector y cantidad de vacantes son opcionales. Talency te responde por WhatsApp o por teléfono.",
    },
    {
      p: "¿Puedo publicar por mi cuenta y pedir ayuda después?",
      r: "Sí. Publicar en BBJobs y consultar por la selección son cosas independientes: podés publicar gratis y, si la búsqueda se complica, escribirle a Talency desde esta página.",
    },
    {
      p: "¿Qué es una evaluación psicométrica?",
      r: "Es una prueba que ayuda a conocer rasgos de personalidad y formas de trabajar de un candidato, cosas que no aparecen en un CV ni siempre surgen en una entrevista. Talency las suma como parte del proceso de selección.",
    },
    {
      p: "¿Trabajan sólo en Bahía Blanca?",
      r: "Talency es de Bahía Blanca y BBJobs cubre la ciudad y la región: Punta Alta, Monte Hermoso y Coronel Suárez. Si tu búsqueda es para otra localidad, contalo en la consulta.",
    },
  ] satisfies Pregunta[],
};

export type PaginaSeleccionRubro = {
  /** Slug del sector: el mismo que /empleos-de/<slug>. Tiene que estar en SELECCION_INDICE. */
  slug: string;
  title: string;
  description: string;
  h1: string;
  bajada: string;
  citable: string;
  /** Perfiles que suelen buscarse en el sector (descripción general, no búsquedas publicadas). */
  perfiles: string[];
  /** Qué conviene evaluar en una búsqueda del sector. */
  evaluar: string[];
  /** Un párrafo propio del sector. */
  contexto: string;
  preguntas: Pregunta[];
};

const PREGUNTA_CONSULTA = (sector: string): Pregunta => ({
  p: `¿Cómo consulto por una búsqueda de ${sector.toLowerCase()}?`,
  r: `Con el formulario de esta página: el sector ${sector} ya viene elegido. Dejá tu teléfono y, si querés, el puesto y la cantidad de vacantes. Talency te responde por WhatsApp o por teléfono.`,
});

const PREGUNTA_PUBLICAR = (sector: string): Pregunta => ({
  p: "¿Y si prefiero publicar la búsqueda por mi cuenta?",
  r: `Registrate como empresa en BBJobs. Talency verifica tus datos y, una vez aprobada, publicás gratis en el sector ${sector} y gestionás las postulaciones desde tu panel.`,
});

export const SELECCION_RUBROS: PaginaSeleccionRubro[] = [
  {
    slug: "industria",
    title: "Selección de personal industrial en Bahía Blanca | Talency",
    description:
      "Talency busca operarios, técnicos y supervisores para empresas industriales de Bahía Blanca y la región: perfil, entrevistas y evaluaciones psicométricas.",
    h1: "Selección de personal para la industria en Bahía Blanca",
    bajada: "Operarios, técnicos y supervisión, con el proceso completo a cargo de Talency.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para empresas industriales de Bahía Blanca y la región. Releva el perfil, publica la búsqueda, revisa postulaciones, entrevista, evalúa y presenta a los candidatos.",
    perfiles: [
      "Operarios de producción",
      "Técnicos de mantenimiento mecánico y eléctrico",
      "Supervisores y jefes de turno",
      "Técnicos en seguridad e higiene",
      "Personal de laboratorio y control de calidad",
    ],
    evaluar: [
      "La formación técnica y las certificaciones que exige el puesto.",
      "La experiencia trabajando con normas y procedimientos de seguridad.",
      "La disponibilidad real para el esquema de turnos.",
      "El trabajo en equipo, que en planta pesa tanto como lo técnico.",
    ],
    contexto:
      "Bahía Blanca tiene puerto y polo petroquímico, y alrededor de ellos trabajan empresas industriales y de servicios. En estos puestos, una mala incorporación se nota en la seguridad y en la continuidad de la operación: por eso conviene que el perfil quede bien definido antes de publicar.",
    preguntas: [
      PREGUNTA_CONSULTA("Industria"),
      {
        p: "¿Se puede buscar personal para trabajar por turnos?",
        r: "Sí. En el relevamiento del perfil se define el esquema de trabajo (turnos, horarios y lugar) y la búsqueda apunta a candidatos que puedan cumplirlo.",
      },
      {
        p: "¿Las evaluaciones psicométricas sirven para puestos operativos?",
        r: "Sí. Son parte del servicio de selección de Talency y se usan en puestos operativos, técnicos o de supervisión para conocer cómo trabaja cada candidato más allá del CV.",
      },
      PREGUNTA_PUBLICAR("Industria"),
    ],
  },
  {
    slug: "logistica",
    title: "Selección de personal de logística en Bahía Blanca | Talency",
    description:
      "Talency busca choferes, personal de depósito y coordinadores de distribución para empresas de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal para logística en Bahía Blanca",
    bajada: "Choferes, depósito y distribución, con el proceso completo a cargo de Talency.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de logística para empresas de Bahía Blanca y la región: choferes, operarios de depósito, autoelevadoristas y coordinación de distribución.",
    perfiles: [
      "Choferes con licencia profesional",
      "Repartidores",
      "Autoelevadoristas",
      "Operarios y encargados de depósito",
      "Administrativos de despacho y coordinadores de distribución",
    ],
    evaluar: [
      "Que las licencias o carnets que pide el puesto estén vigentes.",
      "La experiencia con el vehículo, el equipo o el sistema de depósito que se usa.",
      "El conocimiento de la zona de reparto.",
      "La responsabilidad y la puntualidad, que en logística se notan el primer día.",
    ],
    contexto:
      "Con el puerto y las rutas que la cruzan, Bahía Blanca es un nodo de transporte para todo el sudoeste bonaerense. Las búsquedas de logística suelen tener requisitos concretos (licencias, carnets, horarios) que conviene dejar claros desde el principio.",
    preguntas: [
      PREGUNTA_CONSULTA("Logística"),
      {
        p: "¿Qué conviene tener claro para pedir un chofer o un operario de depósito?",
        r: "El tipo de licencia o carnet que hace falta, el vehículo o equipo que va a manejar, la zona de trabajo y los horarios. Con eso el relevamiento del perfil es más rápido.",
      },
      PREGUNTA_PUBLICAR("Logística"),
    ],
  },
  {
    slug: "comercio",
    title: "Selección de vendedores y personal de comercio | Talency",
    description:
      "Talency busca vendedores, cajeros, repositores y encargados de local para comercios de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal para comercio en Bahía Blanca",
    bajada: "Ventas, atención al público y encargados, con el proceso a cargo de Talency.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para comercios de Bahía Blanca y la región: vendedores, cajeros, repositores, atención al público y encargados de local.",
    perfiles: [
      "Vendedores de salón y vendedores externos",
      "Atención al público",
      "Cajeros",
      "Repositores",
      "Encargados de local",
    ],
    evaluar: [
      "La forma de atender y de comunicarse con un cliente.",
      "La disponibilidad horaria: fines de semana, feriados y temporadas altas.",
      "El manejo de caja, si el puesto lo incluye.",
      "En encargados, la experiencia coordinando a otras personas.",
    ],
    contexto:
      "En un comercio, quien atiende es la cara del negocio. Por eso en estas búsquedas pesa tanto la actitud como la experiencia, y las entrevistas sirven para ver lo que un CV no muestra.",
    preguntas: [
      PREGUNTA_CONSULTA("Comercio"),
      {
        p: "¿Y si necesito varias personas a la vez?",
        r: "Indicá la cantidad de vacantes en el formulario. El relevamiento del perfil sirve para todas y la búsqueda se arma para cubrirlas.",
      },
      PREGUNTA_PUBLICAR("Comercio"),
    ],
  },
  {
    slug: "gastronomia",
    title: "Selección de personal gastronómico en Bahía Blanca | Talency",
    description:
      "Talency busca cocineros, ayudantes, mozos y encargados para locales gastronómicos de Bahía Blanca y la región. Perfil, entrevistas y presentación de candidatos.",
    h1: "Selección de personal gastronómico en Bahía Blanca",
    bajada: "Cocina, salón y encargados, con el proceso completo a cargo de Talency.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal gastronómico para Bahía Blanca y la región: cocineros, ayudantes de cocina, mozos, barra y encargados de local.",
    perfiles: [
      "Cocineros y ayudantes de cocina",
      "Mozos y mozas",
      "Bacheros",
      "Barra y cafetería",
      "Cajeros y encargados de local",
    ],
    evaluar: [
      "La experiencia en puestos parecidos y en locales de un volumen similar.",
      "La disponibilidad para turnos de noche, fines de semana y feriados.",
      "El trabajo bajo presión en los momentos de más demanda.",
      "El carnet de manipulador de alimentos, en los puestos que lo requieren.",
    ],
    contexto:
      "En gastronomía muchas búsquedas siguen la temporada, sobre todo en zonas turísticas como Monte Hermoso. Empezar con tiempo da margen para entrevistar y evaluar sin el apuro de tener que abrir con el equipo incompleto.",
    preguntas: [
      PREGUNTA_CONSULTA("Gastronomía"),
      {
        p: "¿Conviene empezar la búsqueda antes de la temporada?",
        r: "Sí. Armar el equipo con tiempo deja margen para entrevistar y evaluar con calma. Si tu local está en una zona turística, consultá antes de que empiece la temporada.",
      },
      PREGUNTA_PUBLICAR("Gastronomía"),
    ],
  },
  {
    slug: "construccion",
    title: "Personal para construcción en Bahía Blanca | Talency",
    description:
      "Talency busca oficiales, capataces, técnicos y personal de obra para empresas constructoras de Bahía Blanca y la región, con entrevistas y evaluaciones.",
    h1: "Selección de personal para construcción en Bahía Blanca",
    bajada: "Oficios, conducción de obra y técnicos, con el proceso a cargo de Talency.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para empresas constructoras de Bahía Blanca y la región: oficiales, ayudantes, capataces, maestros mayores de obra, técnicos y administrativos de obra.",
    perfiles: [
      "Oficiales, medio oficiales y ayudantes",
      "Capataces y encargados de obra",
      "Maestros mayores de obra y técnicos",
      "Técnicos en seguridad e higiene",
      "Administrativos de obra",
    ],
    evaluar: [
      "El oficio y la experiencia en obras parecidas.",
      "El manejo de las herramientas y los equipos que se usan.",
      "El conocimiento de las normas de seguridad en obra.",
      "La disponibilidad para trasladarse hasta la obra.",
    ],
    contexto:
      "En construcción los tiempos los marca la obra, y sumar a alguien que no tiene el oficio que se necesita retrasa a todo el equipo. Un buen relevamiento del perfil, con la etapa de la obra y las tareas concretas, ahorra entrevistas que no conducen a nada.",
    preguntas: [
      PREGUNTA_CONSULTA("Construcción"),
      {
        p: "¿Se puede buscar personal para una obra fuera de Bahía Blanca?",
        r: "Contá la localidad de la obra en la consulta. BBJobs cubre Bahía Blanca y la región (Punta Alta, Monte Hermoso y Coronel Suárez), y el traslado se tiene en cuenta en el perfil.",
      },
      PREGUNTA_PUBLICAR("Construcción"),
    ],
  },
  {
    slug: "administracion",
    title: "Selección de administrativos en Bahía Blanca | Talency",
    description:
      "Talency busca administrativos, auxiliares contables, recepcionistas y asistentes para empresas de Bahía Blanca y la región. Perfil, entrevistas y evaluaciones.",
    h1: "Selección de personal administrativo en Bahía Blanca",
    bajada: "Administración, contabilidad y recepción, con el proceso a cargo de Talency.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal administrativo para empresas de Bahía Blanca y la región: administrativos, auxiliares contables, facturación, cobranzas, recepción y asistentes.",
    perfiles: [
      "Administrativos generales",
      "Auxiliares contables",
      "Facturación y cobranzas",
      "Recepcionistas",
      "Asistentes de gerencia",
    ],
    evaluar: [
      "El manejo de los programas que usa la empresa.",
      "La prolijidad y la organización con documentos y plazos.",
      "La confidencialidad con la información de la empresa.",
      "La comunicación con clientes y proveedores.",
    ],
    contexto:
      "Un puesto administrativo suele recibir muchas postulaciones, y separar a quienes de verdad manejan las tareas lleva tiempo. Ahí es donde más se nota que alguien lea los CV, entreviste y evalúe por vos.",
    preguntas: [
      PREGUNTA_CONSULTA("Administración"),
      {
        p: "¿Qué conviene contar en la consulta para un puesto administrativo?",
        r: "Las tareas principales, los programas que se usan, el horario y si es un reemplazo o un puesto nuevo. Con eso el relevamiento arranca más rápido.",
      },
      PREGUNTA_PUBLICAR("Administración"),
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
  bajada: "Gratis para empresas verificadas. Publicás vos y gestionás las postulaciones desde tu panel.",
  citable:
    "En BBJobs, el portal de empleos de Bahía Blanca, publicar búsquedas es gratis para las empresas verificadas por Talency. La empresa se registra, Talency verifica sus datos a mano y, una vez aprobada, publica búsquedas sin límite y recibe las postulaciones con el perfil y el CV de cada candidato.",
  pasos: [
    {
      titulo: "Creá tu cuenta de empresa",
      texto: "Registrate con los datos de tu empresa. Es gratis.",
    },
    {
      titulo: "Talency verifica tu empresa",
      texto: "El equipo de Talency revisa tus datos a mano antes de habilitarte a publicar. Así los candidatos saben que detrás de cada aviso hay una empresa real.",
    },
    {
      titulo: "Publicá la búsqueda",
      texto: "Cargás el puesto, el sector, la zona, la modalidad y el tipo de contrato; el sueldo, si querés mostrarlo. Talency revisa cada búsqueda antes de que salga publicada, y cada una dura hasta 20 días.",
    },
    {
      titulo: "Gestioná las postulaciones",
      texto: "Recibís cada postulación en tu panel, con el perfil y el CV del candidato, y la movés por etapas: Nueva, Perfil revisado, Contactado, En proceso, Finalista, Seleccionado o No avanza.",
    },
  ] satisfies Paso[],
  incluye: [
    "Búsquedas ilimitadas",
    "Postulaciones sin límite",
    "Acceso al perfil y CV de quienes se postulan",
    "Filtros por experiencia, puesto y zona",
    "Estadísticas de tus búsquedas",
  ],
  preguntas: [
    {
      p: "¿Publicar un empleo en BBJobs es gratis?",
      r: "Sí. Publicar búsquedas es gratis para las empresas verificadas, sin límite de búsquedas ni de postulaciones. Sólo pagás si querés destacar un aviso o acceder a la Base de Talento.",
    },
    {
      p: "¿Por qué tengo que esperar la verificación?",
      r: "Porque en BBJobs sólo publican empresas reales. El equipo de Talency revisa cada cuenta a mano antes de habilitarla, y la verificación es gratis.",
    },
    {
      p: "¿Cuánto dura publicada una búsqueda?",
      r: "Hasta 20 días. Al publicar elegís la duración, y la búsqueda sale del portal cuando se cumple el plazo.",
    },
    {
      p: "¿Tengo que mostrar el sueldo?",
      r: "No. El sueldo es opcional: lo cargás si querés que se vea en el aviso.",
    },
    {
      p: "¿Qué es destacar una búsqueda?",
      r: "Es una opción paga para búsquedas urgentes o difíciles de cubrir: el aviso aparece primero en los resultados mientras siga activo. Es un pago único por búsqueda; el precio está en la página de planes.",
    },
    {
      p: "¿Y si no tengo tiempo de revisar las postulaciones?",
      r: "Talency, la consultora detrás de BBJobs, puede encargarse de la búsqueda completa: relevamiento del perfil, publicación, revisión de postulaciones, entrevistas, evaluaciones psicométricas y presentación de candidatos.",
    },
  ] satisfies Pregunta[],
};
