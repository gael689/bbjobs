// Contenido de las páginas para empresas: /seleccion-de-personal (el servicio de Talency),
// /seleccion-de-personal/<sector> y /publicar-empleo. Ver SEO-EMPRESAS-TALENCY-PLAN.md.
//
// Poco texto y con gancho (reescrito el 10/10/2026): cada página muestra el problema de la empresa
// y cómo se resuelve, no el proceso entero. El detalle largo quedó en `citable` y PASOS_SELECCION,
// que alimentan sólo el JSON-LD y /llms.txt (no se ven en pantalla). Excepción: las páginas de
// sector (09/11/2026) llevan texto largo y propio, porque con poco texto y mitad compartida Google
// las trataba como casi duplicadas.
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

/** Un puesto típico del sector y qué lo hace difícil de cubrir. */
export type Puesto = { nombre: string; texto: string };
/** Un sector vecino al que se enlaza, con el motivo en una línea. */
export type Relacionado = { slug: string; motivo: string };

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
  /** Título de la sección de contexto del sector en la región. */
  contextoTitulo: string;
  /** El sector en Bahía Blanca y la región: qué se busca y por qué cuesta. Hechos generales y
   *  comprobables, sin cifras. */
  contexto: string[];
  /** Tres dolores del sector y cómo se resuelven. */
  dolores: Par[];
  /** Puestos que suelen buscarse en el sector (descripción general, no búsquedas publicadas). */
  perfiles: Puesto[];
  /** Qué se mira en una búsqueda del sector: requisitos, carnets, matrículas, disponibilidad. */
  verifica: string[];
  /** Cómo se adapta el proceso al sector y de qué depende el tiempo (sin plazos prometidos). */
  proceso: string[];
  preguntas: Pregunta[];
  /** Dos sectores vecinos, con el motivo. Tienen que estar en SELECCION_INDICE. */
  relacionados: Relacionado[];
};

// Textos por sector (reescritos el 09/11/2026: ~280 palabras con la mitad compartida → texto
// propio de cada sector). Sólo hechos generales y comprobables de la región: el polo petroquímico
// y el puerto, las rutas, la temporada en la costa, la LINTI, el carnet de manipulador de
// alimentos, la matrícula, los listados oficiales docentes. Sin cifras, sueldos, clientes ni
// plazos: lo que no se puede comprobar, no va.
export const SELECCION_RUBROS: PaginaSeleccionRubro[] = [
  {
    slug: "industria",
    title: "Selección de personal industrial en Bahía Blanca | Talency",
    description:
      "Operarios, técnicos de mantenimiento, soldadores y supervisores para plantas de Bahía Blanca, Ingeniero White y la zona. Talency define el perfil y entrevista.",
    h1: "Selección de personal para la industria en Bahía Blanca",
    bajada: "Operarios y técnicos que saben hacer el trabajo y cumplen tus turnos.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para empresas industriales de Bahía Blanca y la región: operarios, técnicos de mantenimiento, oficios calificados, supervisores, seguridad e higiene y calidad. Releva el perfil, publica la búsqueda, revisa postulaciones, entrevista, evalúa y presenta a los candidatos.",
    contextoTitulo: "La industria en Bahía Blanca",
    contexto: [
      "Bahía Blanca tiene uno de los polos petroquímicos más importantes del país, en Ingeniero White, pegado al puerto. Alrededor de esas plantas trabaja una red de contratistas de mantenimiento, montaje, metalmecánica y servicios, además de las fábricas del parque industrial y las que procesan la producción agropecuaria de la zona.",
      "Para quien contrata, eso tiene dos caras. En la ciudad hay gente con oficio y escuela técnica, pero las plantas grandes y sus contratistas compiten por los mismos perfiles: soldadores calificados, electricistas, instrumentistas, mecánicos y técnicos con experiencia en planta. Una PyME industrial muchas veces sale a buscar contra empresas que ofrecen turnos y condiciones difíciles de igualar.",
      "Además, el trabajo industrial tiene picos. Las paradas de planta para mantenimiento programado necesitan mucha gente durante unas semanas, y en esos momentos la disponibilidad pesa tanto como la experiencia.",
    ],
    dolores: [
      { problema: "Una mala incorporación se paga en seguridad", solucion: "Definimos con vos los requisitos indispensables antes de buscar." },
      { problema: "Turnos que nadie quiere cubrir", solucion: "Buscamos gente que pueda cumplir tu esquema de turnos." },
      { problema: "El CV no dice cómo trabaja en equipo", solucion: "Las evaluaciones psicométricas muestran lo que el CV no." },
    ],
    perfiles: [
      { nombre: "Operarios de producción", texto: "Gente con escuela técnica o experiencia en planta, que respete los procedimientos. Lo difícil no es encontrar candidatos sino a quienes sostienen el esquema de turnos rotativos en el tiempo." },
      { nombre: "Soldadores, electricistas e instrumentistas", texto: "Son los oficios más disputados. Un soldador vale por las calificaciones que tiene y los procesos que domina, no por los años que dice tener." },
      { nombre: "Técnicos de mantenimiento", texto: "Mecánicos, electromecánicos y técnicos que diagnostican una falla y la resuelven. Muchas veces trabajan con guardias o quedan de llamada." },
      { nombre: "Supervisores y jefes de turno", texto: "Tienen que conocer el proceso y además conducir gente. Es el puesto donde más se nota una mala elección, porque afecta a todo el turno." },
      { nombre: "Seguridad e higiene, laboratorio y calidad", texto: "Técnicos y licenciados en higiene y seguridad, analistas de laboratorio y personal de control de calidad. Piden título específico y, en varios casos, matrícula." },
    ],
    verifica: [
      "El título técnico o el oficio, y las certificaciones que pida el puesto, como la calificación de un soldador. Se marcan como indispensables en el relevamiento y se le piden al candidato.",
      "Los cursos que el trabajo exige cuando corresponden: trabajo en altura, espacios confinados o manejo de equipos de izaje.",
      "Experiencia real en planta: qué máquinas o procesos manejó, en qué esquema de turnos trabajó y por qué dejó cada empleo.",
      "Cómo llega a la planta. No es lo mismo trabajar en el centro que en Ingeniero White o en el parque industrial, sobre todo en el turno noche.",
      "La actitud con las normas de seguridad, que se mira en la entrevista y en las evaluaciones psicométricas. El examen preocupacional y las inducciones de planta siguen a cargo de la empresa.",
    ],
    proceso: [
      "En una búsqueda industrial, el relevamiento es la etapa que más pesa. Ahí se separa lo indispensable (un título, una certificación, un turno) de lo deseable, para no descartar buenos candidatos por requisitos que en la práctica no cambian nada.",
      "Si necesitás varias personas para una parada o un proyecto, conviene avisar con anticipación: la búsqueda se puede armar para todas las vacantes juntas. Un operario de ingreso suele cubrirse antes que un técnico o un oficio calificado; cuanto más específico el perfil, más tiempo lleva encontrarlo.",
    ],
    preguntas: [
      {
        p: "¿Se puede buscar personal para trabajar por turnos?",
        r: "Sí. En el relevamiento se define el esquema de turnos y horarios, y la búsqueda apunta a candidatos que puedan cumplirlo.",
      },
      {
        p: "¿Talency busca personal para paradas de planta o proyectos con fecha de fin?",
        r: "Se puede consultar. Contá cuántas personas necesitás, para qué tareas y en qué fechas. Cuanto antes llegue la consulta, más margen hay para encontrar a la gente con experiencia.",
      },
      {
        p: "¿Cómo se comprueba que un soldador o un electricista tiene el oficio que dice?",
        r: "Las certificaciones y la experiencia se piden y se repasan en la entrevista. La prueba práctica en taller la suele hacer la empresa con su propia gente, con los candidatos que Talency te presenta.",
      },
      {
        p: "¿Quién hace el examen preocupacional?",
        r: "La empresa, como en cualquier contratación: es una obligación del empleador y se hace una vez elegida la persona, antes de que empiece a trabajar.",
      },
      {
        p: "¿Sirve para una PyME industrial sin área de RR.HH.?",
        r: "Sí. Justamente ahí suele faltar tiempo para leer CV y entrevistar. Definís el perfil con Talency y te concentrás en elegir entre los candidatos presentados.",
      },
    ],
    relacionados: [
      { slug: "construccion", motivo: "Montajes, obras en planta y oficios como soldadura y electricidad, que se cruzan con la industria." },
      { slug: "logistica", motivo: "El despacho de la producción por el puerto: choferes, depósito y autoelevadoristas." },
    ],
  },
  {
    slug: "logistica",
    title: "Selección de personal de logística en Bahía Blanca | Talency",
    description:
      "Choferes con licencia profesional, autoelevadoristas y personal de depósito para empresas de Bahía Blanca, el puerto y la región. Selección a cargo de Talency.",
    h1: "Selección de personal para logística en Bahía Blanca",
    bajada: "Choferes y personal de depósito con lo que pide el puesto.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de logística para empresas de Bahía Blanca y la región: choferes de camión y de reparto, autoelevadoristas, personal de depósito y coordinación de tráfico.",
    contextoTitulo: "La logística en Bahía Blanca",
    contexto: [
      "Bahía Blanca es un nudo de transporte: tiene un puerto de aguas profundas, a la ciudad llegan varias rutas nacionales y pasa el tren de carga. Por el puerto sale grano de una región muy amplia y producción del polo petroquímico, y alrededor se mueven transportistas, acopios, depósitos y operadores logísticos.",
      "La demanda de personal no es pareja durante el año. En la cosecha crece el movimiento de camiones hacia las terminales del puerto y los choferes con experiencia escasean. A eso se suma el reparto urbano y la distribución a las localidades de la zona, que piden otro tipo de chofer y otros horarios.",
      "En logística un error se paga caro: una carga mal estibada, un vehículo dañado o un reparto que no llega. Por eso los requisitos formales importan tanto como la actitud.",
    ],
    dolores: [
      { problema: "Licencias y carnets que no están al día", solucion: "Los requisitos del puesto se definen antes de publicar." },
      { problema: "Un reparto frenado por una vacante", solucion: "Filtramos nosotros para que no pierdas tiempo con quienes no cumplen." },
      { problema: "Cuesta saber quién es responsable de verdad", solucion: "Entrevistas y evaluaciones para conocer a cada candidato." },
    ],
    perfiles: [
      { nombre: "Choferes de camión", texto: "Para larga distancia o tráfico al puerto hace falta licencia profesional de la categoría que corresponda y, si el viaje cruza de provincia, la LINTI. Con experiencia en semirremolque o en cargas especiales, son de los perfiles más buscados." },
      { nombre: "Choferes de reparto", texto: "Reparto urbano o a localidades cercanas, con utilitario o camión chico. Además del carnet se busca a alguien que conozca la ciudad, trate bien al cliente y maneje remitos o cobranzas." },
      { nombre: "Autoelevadoristas", texto: "Muchas empresas piden el curso o carnet de autoelevador y experiencia comprobable. Quien lo maneja bien cuida la mercadería y la seguridad del depósito." },
      { nombre: "Personal de depósito", texto: "Recepción, armado de pedidos, control de stock y despacho. Se valoran el orden, la experiencia con sistemas de stock o lectores y la disponibilidad para los picos de trabajo." },
      { nombre: "Coordinación y tráfico", texto: "Quien arma rutas, asigna viajes y sigue cada entrega. Combina manejo de sistemas, conocimiento de la zona y trato con choferes y clientes." },
    ],
    verifica: [
      "La licencia de conducir: categoría y vencimiento y, si el viaje sale de la provincia, la LINTI. Para cargas peligrosas, la habilitación específica.",
      "El curso o carnet de autoelevador, y con qué equipos trabajó: autoelevador, apilador, zorra eléctrica.",
      "Experiencia con el tipo de vehículo y de carga. No es lo mismo un utilitario que un semirremolque, ni carga general que granos o combustible.",
      "Disponibilidad para los horarios del puesto: madrugadas, viajes de varios días o fines de semana en plena cosecha.",
      "Cómo responde ante un imprevisto en la ruta y cómo trata al cliente en la entrega, que se ve en la entrevista y en las evaluaciones.",
    ],
    proceso: [
      "Para un chofer o un autoelevadorista, los requisitos formales se definen al principio y funcionan como primer filtro: quien no tiene la licencia o el curso que el puesto exige no pasa a entrevista.",
      "Si sabés que en la cosecha o a fin de año vas a necesitar más gente, conviene consultar antes del pico. Un repartidor o un operario de depósito suelen encontrarse antes que un chofer de larga distancia con experiencia; cuando el perfil escasea, la búsqueda lleva más tiempo.",
    ],
    preguntas: [
      {
        p: "¿Qué conviene tener claro para pedir un chofer o un operario de depósito?",
        r: "El carnet que hace falta, el vehículo o equipo, la zona de trabajo y los horarios. Con eso el relevamiento es más rápido.",
      },
      {
        p: "¿Qué licencia necesita un chofer de camión para viajar a otras provincias?",
        r: "Además de la licencia profesional de la categoría del vehículo, el transporte de cargas entre jurisdicciones pide la LINTI (Licencia Nacional de Transporte Interjurisdiccional). En el relevamiento se define cuál exige tu puesto y queda como requisito.",
      },
      {
        p: "¿Puedo pedir personal para la temporada de cosecha?",
        r: "Sí. Contá cuántas personas, para qué tareas y desde cuándo. Conviene hacerlo antes de que empiece el movimiento fuerte, cuando todavía hay choferes disponibles.",
      },
      {
        p: "¿El autoelevadorista tiene que tener carnet?",
        r: "Depende de lo que pida tu empresa o tu cliente. Muchas operaciones exigen el curso o carnet de autoelevador; si es tu caso, se pone como requisito y el candidato tiene que mostrarlo.",
      },
      {
        p: "¿Talency hace la prueba de manejo?",
        r: "La prueba con tu vehículo la hace la empresa. Talency llega con candidatos que cumplen los requisitos formales y pasaron la entrevista, así esa prueba se hace con pocos.",
      },
    ],
    relacionados: [
      { slug: "industria", motivo: "Las plantas del polo y del parque industrial, que despachan por el puerto." },
      { slug: "comercio", motivo: "Reposición, depósito de local y reparto para los comercios de la ciudad." },
    ],
  },
  {
    slug: "comercio",
    title: "Selección de vendedores y personal de comercio | Talency",
    description:
      "Vendedores, cajeros, repositores y encargados para comercios de Bahía Blanca y la región, también refuerzos para las fechas fuertes. Talency entrevista por vos.",
    h1: "Selección de personal para comercio en Bahía Blanca",
    bajada: "Gente que atiende bien a tus clientes.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para comercios de Bahía Blanca y la región: vendedores, cajeros, repositores, atención al público y encargados de local, también refuerzos para las fechas de más venta.",
    contextoTitulo: "El comercio en Bahía Blanca",
    contexto: [
      "Bahía Blanca es el centro comercial de una región grande: gente de Punta Alta, Monte Hermoso, Coronel Suárez y muchas localidades del sudoeste bonaerense viene a la ciudad a hacer sus compras. Hay comercio en el microcentro, en los centros comerciales, en los corredores de los barrios y en mayoristas y distribuidoras.",
      "La rotación es alta y la demanda tiene fechas: el Día de la Madre, el Día del Padre, las fiestas de fin de año, la vuelta a clases. Muchas búsquedas son refuerzos que hay que tener listos antes de esas fechas, no cuando ya llegaron.",
      "El desafío no es conseguir CV, que llegan muchos, sino encontrar entre ellos a quien atiende bien, es confiable con la caja y se queda.",
    ],
    dolores: [
      { problema: "Quien atiende es la cara de tu negocio", solucion: "Entrevistamos para ver la actitud, no sólo la experiencia." },
      { problema: "Necesitás varias personas a la vez", solucion: "Un solo relevamiento sirve para cubrir todas las vacantes." },
      { problema: "Los CV de vendedores se parecen todos", solucion: "Las evaluaciones muestran las diferencias." },
    ],
    perfiles: [
      { nombre: "Vendedores", texto: "De salón, de mostrador o de venta técnica (repuestos, materiales, electrodomésticos). Se busca actitud con el cliente y, según el rubro, conocimiento del producto." },
      { nombre: "Cajeros", texto: "Efectivo, posnet, transferencias y cierres de caja. Es un puesto de confianza: pesa la prolijidad tanto como la experiencia." },
      { nombre: "Repositores", texto: "Reposición, control de vencimientos y recepción de mercadería. Suelen trabajar temprano o fuera del horario de atención." },
      { nombre: "Atención al público y posventa", texto: "Cambios, reclamos y pedidos por WhatsApp o redes. Pide paciencia y buena escritura, porque buena parte del trato ya es por mensaje." },
      { nombre: "Encargados de local", texto: "Abren y cierran, arman horarios, controlan caja y stock y conducen al equipo. Es el perfil más difícil: tiene que saber vender y además organizar." },
    ],
    verifica: [
      "Experiencia en atención al público y en tu tipo de comercio: no se vende igual ropa que materiales de construcción.",
      "Manejo de caja y de los medios de pago que usás, y si sabe facturar con el sistema del local.",
      "Disponibilidad horaria real: sábados, horario cortado o corrido y las fechas fuertes del año.",
      "Referencias de empleos anteriores, si el puesto maneja dinero o mercadería y lo pedís en el relevamiento.",
      "Cómo se expresa y cómo resuelve una situación con un cliente difícil, que se mira en la entrevista.",
    ],
    proceso: [
      "En comercio, el relevamiento define sobre todo el perfil de atención: qué tipo de cliente tenés, cuánto conocimiento de producto hace falta y qué horarios hay que cubrir. Con eso se filtra la cantidad de CV que llega a cualquier aviso de vendedor.",
      "Si la búsqueda es para una fecha fuerte, consultá con tiempo. Varias vacantes del mismo puesto se resuelven en una sola búsqueda. Un encargado de local lleva más que un vendedor o un repositor, porque hay menos candidatos que reúnan todo.",
    ],
    preguntas: [
      {
        p: "¿Y si necesito varias personas a la vez?",
        r: "Indicá la cantidad de vacantes en el formulario. El relevamiento sirve para todas y la búsqueda se arma para cubrirlas.",
      },
      {
        p: "¿Con cuánta anticipación conviene buscar refuerzos para fin de año?",
        r: "Cuanto antes, mejor: a medida que se acercan las fiestas, muchos comercios salen a buscar al mismo tiempo. Consultá apenas sepas cuántas personas vas a necesitar y en qué horarios.",
      },
      {
        p: "¿Cómo se elige a alguien de confianza para la caja?",
        r: "Con una entrevista enfocada en su experiencia con dinero, referencias de empleos anteriores si las pedís y evaluaciones psicométricas que muestran lo que un CV no cuenta.",
      },
      {
        p: "¿Sirve para un comercio chico, con uno o dos empleados?",
        r: "Sí. En un comercio chico una mala incorporación pesa más, porque esa persona muchas veces queda sola frente al cliente. Vos seguís atendiendo y elegís entre candidatos ya entrevistados.",
      },
      {
        p: "¿Puedo buscar vendedores para una sucursal en otra localidad?",
        r: "Sí. Indicá dónde queda el local. BBJobs cubre Bahía Blanca, Punta Alta, Monte Hermoso y Coronel Suárez, y la búsqueda apunta a gente que viva cerca.",
      },
    ],
    relacionados: [
      { slug: "gastronomia", motivo: "Salón, caja y atención en bares, cafés y restaurantes, con temporadas parecidas." },
      { slug: "administracion", motivo: "Facturación, cobranzas y control de stock para la trastienda del negocio." },
    ],
  },
  {
    slug: "gastronomia",
    title: "Selección de personal gastronómico en Bahía Blanca | Talency",
    description:
      "Cocineros, ayudantes, mozos y encargados para locales de Bahía Blanca y la temporada en Monte Hermoso y la costa. Talency entrevista y te presenta candidatos.",
    h1: "Selección de personal gastronómico en Bahía Blanca",
    bajada: "Cocina y salón completos antes de abrir.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal gastronómico para Bahía Blanca, Monte Hermoso y la región: cocineros, ayudantes de cocina, mozos, barra y encargados de local, para todo el año o para la temporada de verano.",
    contextoTitulo: "La gastronomía en Bahía Blanca y la costa",
    contexto: [
      "La gastronomía de la región tiene dos ritmos. En Bahía Blanca hay movimiento todo el año: restaurantes, bares, cafés, rotiserías, catering y comedores de empresas. En la costa, con Monte Hermoso a la cabeza y también Pehuen Có, el trabajo se concentra en el verano y la temporada define el año de muchos locales.",
      "Eso hace que todos busquen al mismo tiempo. Cuando se acerca diciembre, los locales de la costa salen a armar equipos completos, muchas veces con gente que tiene que instalarse allá por la temporada, y compiten por los mismos cocineros y mozos con experiencia.",
      "Es un rubro con mucha rotación, horarios nocturnos y fines de semana. Quien sabe y además se queda vale mucho, y por eso la entrevista importa tanto como el CV.",
    ],
    dolores: [
      { problema: "Llega la temporada y el equipo no", solucion: "Empezás con tiempo y entrevistamos sin apuro." },
      { problema: "Turnos de noche, fines de semana y feriados", solucion: "Buscamos gente con la disponibilidad que necesitás." },
      { problema: "En el pico de trabajo se nota quién aguanta", solucion: "Evaluaciones para conocer cómo trabaja cada candidato." },
    ],
    perfiles: [
      { nombre: "Cocineros y jefes de cocina", texto: "Alguien que sostenga la carta en el pico de trabajo y ordene la cocina. Cuenta dónde cocinó, para cuántos cubiertos y con qué tipo de cocina." },
      { nombre: "Ayudantes de cocina y bacheros", texto: "Puestos de ingreso y de mucha rotación. Pesan la disponibilidad, la limpieza y las ganas de aprender." },
      { nombre: "Mozos, mozas y runners", texto: "Atención en salón y terraza, toma de pedidos con comandera o sistema y cobro en la mesa. Para la temporada se buscan con experiencia en salones de mucho movimiento." },
      { nombre: "Barra y cafetería", texto: "Bartenders y baristas. Además de la técnica, el trato con el cliente y la velocidad en hora pico." },
      { nombre: "Encargados de local", texto: "Abren, cierran, controlan caja y mercadería y manejan al equipo. Es el puesto que más le conviene al dueño cubrir bien, porque lo reemplaza cuando no está." },
    ],
    verifica: [
      "El carnet de manipulador de alimentos, que el Código Alimentario Argentino exige a quien trabaja con comida. Si no lo tiene, se pregunta si puede sacarlo antes de empezar.",
      "Experiencia en tu tipo de local: no es lo mismo una parrilla, una cocina de autor, un servicio de catering o una cafetería.",
      "Disponibilidad para noches, fines de semana y feriados y, si el puesto es en la costa, para toda la temporada.",
      "Para trabajar en Monte Hermoso o Pehuen Có, dónde va a vivir y cómo llega. Se habla en la entrevista, no el primer día de trabajo.",
      "Cómo trabaja bajo presión, que se mira en la entrevista y en las evaluaciones: un servicio complicado muestra más que el CV.",
    ],
    proceso: [
      "Para la temporada, lo mejor es arrancar antes de que todos salgan a buscar. Con el perfil definido temprano, Talency entrevista sin apuro y la idea es que el equipo esté armado antes de abrir, no completarlo sobre la marcha.",
      "Para un puesto de todo el año en la ciudad, el foco cambia: se busca a alguien que se quede. Un ayudante o un bachero suelen aparecer rápido; un cocinero con experiencia o un encargado llevan más.",
    ],
    preguntas: [
      {
        p: "¿Conviene empezar la búsqueda antes de la temporada?",
        r: "Sí. Armar el equipo con tiempo deja margen para entrevistar y evaluar con calma, sobre todo en zonas turísticas como Monte Hermoso.",
      },
      {
        p: "¿El personal de cocina necesita carnet de manipulador de alimentos?",
        r: "Sí. El Código Alimentario Argentino pide que quien manipula alimentos esté capacitado y tenga el carnet. En la búsqueda se pregunta si lo tiene vigente o si puede tramitarlo antes de empezar.",
      },
      {
        p: "¿Se puede buscar gente de Bahía Blanca para trabajar en la costa?",
        r: "Sí, pero hay que resolver cómo viaja o dónde se aloja. Contalo en la consulta: si ofrecés alojamiento o traslado, se suman candidatos que de otro modo no podrían ir.",
      },
      {
        p: "¿Sirve para abrir un local nuevo?",
        r: "Sí. Para una apertura se puede pedir el equipo completo, de cocina y de salón, en una sola consulta. Contá la fecha de apertura y cuántas personas necesitás en cada puesto.",
      },
      {
        p: "¿Talency hace la prueba en cocina?",
        r: "La prueba en cocina o en salón la hace el local con su gente. Talency te presenta candidatos ya entrevistados, para que esa prueba sea con quienes de verdad pueden quedar.",
      },
    ],
    relacionados: [
      { slug: "comercio", motivo: "Atención al público y caja en comercios, con fechas fuertes parecidas." },
      { slug: "logistica", motivo: "Reparto y depósito para locales con delivery o servicio de catering." },
    ],
  },
  {
    slug: "construccion",
    title: "Personal para construcción en Bahía Blanca | Talency",
    description:
      "Oficiales, capataces, maestros mayores de obra y técnicos en seguridad para constructoras de Bahía Blanca y la región. Talency arma el perfil y entrevista.",
    h1: "Selección de personal para construcción en Bahía Blanca",
    bajada: "Oficios y conducción de obra, con el perfil claro.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal para empresas constructoras de Bahía Blanca y la región: oficiales, ayudantes, capataces, instaladores matriculados, maestros mayores de obra, técnicos en seguridad e higiene y administrativos de obra.",
    contextoTitulo: "La construcción en Bahía Blanca y la zona",
    contexto: [
      "En Bahía Blanca conviven la obra privada (viviendas, edificios, locales), la obra pública y las obras industriales del polo petroquímico y el puerto, donde se hacen montajes y ampliaciones. Cada una pide gente distinta: no es lo mismo un oficial albañil para una casa que un montador para una planta.",
      "La construcción acompaña a la economía, y cuando se activa todos salen a buscar a la vez a los mismos oficiales con experiencia. Además, muchas obras quedan lejos del centro o en otras localidades, y el traslado define si un buen candidato acepta o no.",
      "En obra, una mala incorporación se nota rápido: atrasa a la cuadrilla, genera trabajo para rehacer o pone en riesgo la seguridad de todos.",
    ],
    dolores: [
      { problema: "Alguien sin el oficio atrasa a toda la obra", solucion: "Definimos las tareas y la etapa de obra antes de buscar." },
      { problema: "Entrevistas que no llevan a nada", solucion: "Filtramos nosotros y te presentamos sólo a quienes encajan." },
      { problema: "La obra queda lejos", solucion: "El traslado se tiene en cuenta desde el perfil." },
    ],
    perfiles: [
      { nombre: "Oficiales y medio oficiales", texto: "Albañiles, armadores, encofradores, pintores, yeseros, colocadores de placas. Se busca oficio comprobable: en qué obras trabajó y qué tareas hacía de verdad." },
      { nombre: "Ayudantes", texto: "El puesto de ingreso, con mucha demanda. Pesan la puntualidad, la disposición y que pueda sostener el trabajo físico." },
      { nombre: "Capataces y encargados de obra", texto: "Organizan la cuadrilla, leen planos y responden ante la dirección de obra. Es el puesto que más cuesta: tiene que saber de obra y conducir gente." },
      { nombre: "Instaladores", texto: "Electricistas, sanitaristas y gasistas. Para gas y para ciertas instalaciones eléctricas, según la tarea, hace falta matrícula habilitante." },
      { nombre: "Técnicos y administración de obra", texto: "Maestros mayores de obra, técnicos en higiene y seguridad, compradores y administrativos que llevan partes diarios, certificados y proveedores." },
    ],
    verifica: [
      "El oficio y la experiencia: qué tareas hizo, en qué tipo de obra y con quién trabajó. En la entrevista se pregunta por obras concretas.",
      "La matrícula cuando la tarea la exige, como la de gasista, y el título en los puestos técnicos.",
      "Los cursos de seguridad que pida la obra, como trabajo en altura, y si ya trabajó en obras industriales, con sus inducciones y permisos de trabajo.",
      "Cómo llega a la obra, si puede trasladarse a otra localidad y si cumple el horario de obra completo.",
      "La actitud con la seguridad: si usa los elementos de protección y respeta las indicaciones de la obra. Se mira en la entrevista y en las evaluaciones.",
    ],
    proceso: [
      "En construcción, el relevamiento parte de la obra: qué etapa es, qué tareas hay que cubrir, dónde queda y por cuánto tiempo. Con eso se arma un perfil realista, que no pida experiencia industrial para una vivienda ni al revés.",
      "Si vas a empezar una obra y necesitás armar cuadrilla, consultá antes de la fecha de inicio. Los ayudantes suelen cubrirse rápido; un capataz o un oficial especializado llevan más, sobre todo cuando hay mucha obra en marcha en la ciudad.",
    ],
    preguntas: [
      {
        p: "¿Se puede buscar personal para una obra fuera de Bahía Blanca?",
        r: "Contá la localidad de la obra en la consulta. BBJobs cubre Bahía Blanca, Punta Alta, Monte Hermoso y Coronel Suárez.",
      },
      {
        p: "¿Se puede buscar personal sólo por la duración de la obra?",
        r: "Se puede consultar. Contá cuánto dura la obra y en qué etapa necesitás a cada persona. La forma de contratación la define tu empresa; Talency se ocupa de encontrar a los candidatos.",
      },
      {
        p: "¿Cómo se comprueba que un oficial sabe el oficio?",
        r: "En la entrevista se pregunta por obras y tareas concretas, y se pueden pedir referencias de capataces o empresas anteriores. La prueba en obra, si la hacés, queda a tu cargo.",
      },
      {
        p: "¿Buscan capataces y maestros mayores de obra?",
        r: "Sí, y son los perfiles que más conviene buscar con tiempo. Contá el tamaño de la obra, cuánta gente va a tener a cargo y con qué documentación técnica trabaja.",
      },
      {
        p: "¿Sirve para obras dentro del polo petroquímico?",
        r: "Sí. En ese caso los requisitos de la planta (cursos, inducciones, experiencia en obras industriales) se marcan como indispensables desde el relevamiento.",
      },
    ],
    relacionados: [
      { slug: "industria", motivo: "Montaje, mantenimiento y oficios en las plantas del polo y del parque industrial." },
      { slug: "administracion", motivo: "Compras, facturación y administración para la oficina de la constructora." },
    ],
  },
  {
    slug: "administracion",
    title: "Selección de administrativos en Bahía Blanca | Talency",
    description:
      "Administrativos, auxiliares contables, facturación, cobranzas y recepción para PyMEs y estudios de Bahía Blanca. Talency filtra los CV, entrevista y evalúa.",
    h1: "Selección de personal administrativo en Bahía Blanca",
    bajada: "Administrativos que manejan las tareas de verdad.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal administrativo para empresas y estudios de Bahía Blanca y la región: administrativos, auxiliares contables, facturación, cobranzas, recepción y asistentes de gerencia.",
    contextoTitulo: "Puestos administrativos en Bahía Blanca",
    contexto: [
      "Casi toda empresa necesita a alguien en administración: PyMEs, comercios, estudios contables, consignatarias y acopios del agro, constructoras, clínicas. Un aviso de administrativo suele recibir muchas postulaciones, y ahí empieza el problema.",
      "La ciudad tiene universidades e institutos con carreras contables y de administración, así que hay estudiantes y graduados. Lo que cuesta no es encontrar postulantes, sino separar a quien sabe hacer las tareas del día a día de quien sólo las nombra en el CV.",
      "Además, el puesto administrativo suele tener acceso a información sensible: cuentas, clientes, proveedores, sueldos. La confianza pesa tanto como la técnica.",
    ],
    dolores: [
      { problema: "Cientos de CV para un solo puesto", solucion: "Los leemos nosotros y separamos a quienes cumplen." },
      { problema: "Cuesta saber quién maneja tu sistema", solucion: "Entrevistamos sobre las tareas y los programas que usás." },
      { problema: "Vas a confiarle información de tu empresa", solucion: "Entrevistas y evaluaciones para conocer a cada persona antes de sumarla." },
    ],
    perfiles: [
      { nombre: "Administrativos generales", texto: "Facturación, pagos, carga de comprobantes, archivo y atención de proveedores. En una PyME suele ser una sola persona que hace un poco de todo." },
      { nombre: "Auxiliares contables", texto: "Estudiantes avanzados o graduados que hacen conciliaciones, registraciones, liquidación de impuestos y papeles de trabajo, en un estudio o en la administración de una empresa." },
      { nombre: "Facturación y cobranzas", texto: "Factura electrónica en ARCA o en el sistema de gestión, seguimiento de cuentas corrientes y llamados de cobranza. Pide orden y firmeza con buen trato." },
      { nombre: "Recepción", texto: "La primera cara de la empresa, en persona y por teléfono: agenda, mails y mensajes. Se busca buena expresión oral y escrita." },
      { nombre: "Asistentes de gerencia", texto: "Organizan la agenda, preparan informes y coordinan entre áreas. Necesitan criterio y reserva." },
    ],
    verifica: [
      "Las tareas que hizo de verdad: se pregunta paso a paso cómo factura, cómo concilia o cómo arma un pago, no sólo si conoce el tema.",
      "Los programas: el sistema de gestión que uses, planillas de cálculo al nivel que pide el puesto y los servicios de ARCA del día a día.",
      "Los estudios, si el puesto pide ser estudiante o graduado de una carrera contable o administrativa.",
      "Orden, prolijidad y reserva, que se miran en la entrevista y en las evaluaciones psicométricas.",
      "Horario y modalidad: jornada completa o media, presencial o con algunos días remotos.",
    ],
    proceso: [
      "En una búsqueda administrativa, el filtro de CV es la parte más pesada y la que más tiempo te ahorra delegar. Con las tareas y los programas definidos en el relevamiento, Talency deja sólo a quienes cumplen y los entrevista sobre el trabajo concreto.",
      "Un puesto administrativo general suele resolverse antes que uno con responsabilidad contable o de mucha confianza. Si es un reemplazo por licencia o renuncia, avisá la fecha en que necesitás a la persona, así la búsqueda se organiza en función de eso.",
    ],
    preguntas: [
      {
        p: "¿Qué conviene contar en la consulta para un puesto administrativo?",
        r: "Las tareas, los programas que se usan, el horario y si es un reemplazo o un puesto nuevo.",
      },
      {
        p: "¿Cómo saben si maneja el sistema que usamos?",
        r: "En la entrevista se pregunta por el sistema y por tareas concretas. Si querés una prueba práctica con tu programa, conviene hacerla vos en la etapa final, con los candidatos presentados.",
      },
      {
        p: "¿Sirve para buscar un auxiliar para un estudio contable?",
        r: "Sí. Contá qué hace el estudio (sueldos, impuestos, sociedades) y si buscás estudiante o graduado. Con eso se filtra mejor una búsqueda que suele recibir muchas postulaciones.",
      },
      {
        p: "¿Conviene pedir media jornada o jornada completa?",
        r: "Depende de la carga real de trabajo. En el relevamiento se repasan tareas y horarios; si el puesto se puede cubrir en media jornada, se suman candidatos, por ejemplo estudiantes.",
      },
      {
        p: "¿Es mejor alguien con experiencia o un perfil junior para formar?",
        r: "Depende de quién lo va a formar. Si no hay nadie en la empresa que pueda enseñarle, conviene alguien que ya hizo las mismas tareas. Si hay quien lo acompañe, un perfil con menos experiencia y buena actitud puede funcionar bien.",
      },
    ],
    relacionados: [
      { slug: "recursos-humanos", motivo: "Liquidación de sueldos y administración de personal, un paso más allá de lo administrativo." },
      { slug: "comercio", motivo: "Caja, facturación en mostrador y atención en comercios." },
    ],
  },
  {
    slug: "tecnologia",
    title: "Selección de personal IT en Bahía Blanca | Talency",
    description:
      "Soporte técnico, administradores de sistemas y desarrolladores para empresas de Bahía Blanca, presencial, remoto o híbrido. Talency define el perfil y entrevista.",
    h1: "Selección de personal de tecnología en Bahía Blanca",
    bajada: "Perfiles técnicos que saben lo que dicen saber y encajan con tu equipo.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de tecnología para empresas de Bahía Blanca y la región: soporte técnico, administradores de sistemas y redes, desarrolladores, testers y analistas de datos.",
    contextoTitulo: "Perfiles de tecnología en Bahía Blanca",
    contexto: [
      "Bahía Blanca forma gente de sistemas: la Universidad Nacional del Sur y la UTN tienen carreras de computación y de ingeniería en sistemas, y hay institutos con tecnicaturas. El problema para una empresa local es retenerla: muchos programadores trabajan en forma remota para empresas de otras ciudades o del exterior.",
      "Al mismo tiempo, muchas empresas de la región no buscan un desarrollador sino alguien que sostenga lo que ya tienen: soporte a usuarios, redes, servidores, el sistema de gestión, la página web. Son perfiles distintos y conviene no mezclarlos en un mismo aviso.",
      "Y para quien no es del área, un CV técnico es difícil de leer: está lleno de siglas y herramientas, y cuesta saber cuánto de eso es experiencia real.",
    ],
    dolores: [
      { problema: "Un CV lleno de siglas", solucion: "Definimos con vos qué necesitás de verdad antes de buscar." },
      { problema: "Cuesta saber si alguien sabe lo que dice saber", solucion: "Entrevistamos sobre las tecnologías que realmente usás." },
      { problema: "Un buen técnico que no encaja en el equipo", solucion: "Las evaluaciones psicométricas muestran cómo trabaja cada persona." },
    ],
    perfiles: [
      { nombre: "Soporte técnico y mesa de ayuda", texto: "Atiende a usuarios, configura equipos, impresoras y cuentas, y resuelve los problemas del día a día. Pesa tanto el trato como el conocimiento." },
      { nombre: "Administradores de sistemas y redes", texto: "Servidores, redes, copias de seguridad y proveedores de internet. Es el puesto que sostiene todo y el que más se nota cuando falta." },
      { nombre: "Desarrolladores", texto: "Web, aplicaciones o integraciones con el sistema de gestión. Hay que definir con qué tecnologías trabaja la empresa y qué nivel de experiencia hace falta." },
      { nombre: "Testers y QA", texto: "Prueban los sistemas antes de que lleguen al usuario. Se busca método, prolijidad y capacidad de explicar un problema por escrito." },
      { nombre: "Datos e informes", texto: "Arman reportes y tableros con los datos de la empresa. Combinan planillas, bases de datos y entendimiento del negocio." },
    ],
    verifica: [
      "Qué hizo en proyectos concretos, con qué herramientas y con qué responsabilidad, más allá de la lista del CV.",
      "La modalidad: presencial, remoto o híbrido, y si vive en Bahía Blanca o puede venir cuando hace falta.",
      "Qué condiciones espera, para no llegar a la última etapa con alguien que busca algo muy distinto de lo que ofrecés.",
      "Cómo trabaja en equipo, cómo le explica un problema técnico a alguien que no es del área y cómo se organiza si trabaja remoto. Eso se ve en la entrevista y en las evaluaciones.",
      "La evaluación técnica de fondo conviene que la haga alguien de tu equipo o de tu confianza, con los candidatos que Talency te presenta.",
    ],
    proceso: [
      "En tecnología, el relevamiento ayuda a separar lo que realmente necesitás de lo que se pide por costumbre. A veces la empresa pide un desarrollador cuando lo que le falta es soporte, o pide diez herramientas cuando usa tres.",
      "Un perfil de soporte suele encontrarse antes que un desarrollador o un administrador de sistemas con experiencia, que son más escasos y suelen tener varias ofertas a la vez. Si el puesto puede ser híbrido o remoto, hay más candidatos.",
    ],
    preguntas: [
      {
        p: "¿Se puede buscar personal remoto o híbrido?",
        r: "Sí. Indicá la modalidad (presencial, remoto o híbrido) en la consulta y se define en el relevamiento del perfil.",
      },
      {
        p: "¿Cómo saben si un programador sabe lo que dice, si Talency no es del área?",
        r: "Talency entrevista sobre proyectos concretos y filtra por experiencia, modalidad y forma de trabajo. La prueba técnica de fondo conviene que la haga alguien de tu equipo con los candidatos presentados: cada uno hace la parte que mejor conoce.",
      },
      {
        p: "No sé si necesito un desarrollador o alguien de soporte. ¿Me ayudan a definirlo?",
        r: "Para eso sirve el relevamiento. Contá qué problema querés resolver (un sistema que se cae, una web que hay que mantener, usuarios que piden ayuda) y el perfil se define a partir de eso.",
      },
      {
        p: "¿Sirve para una empresa que no es de tecnología?",
        r: "Sí, y es donde más ayuda: una empresa que busca a su primera persona de sistemas no suele tener a nadie que pueda leer esos CV.",
      },
      {
        p: "¿Conviene buscar a alguien junior para formar?",
        r: "Si tenés a alguien que lo acompañe, puede andar bien, y en la ciudad hay estudiantes avanzados. Si va a quedar solo a cargo de los sistemas, conviene un perfil con experiencia.",
      },
    ],
    relacionados: [
      { slug: "marketing", motivo: "Diseño, redes y marketing digital, que trabajan pegados a la web y los datos." },
      { slug: "administracion", motivo: "Administrativos y analistas que viven dentro del sistema de gestión." },
    ],
  },
  {
    slug: "salud",
    title: "Selección de personal de salud en Bahía Blanca | Talency",
    description:
      "Enfermería, técnicos, administrativos de salud y recepción para clínicas, consultorios y geriátricos de Bahía Blanca. Talency define requisitos y entrevista.",
    h1: "Selección de personal de salud en Bahía Blanca",
    bajada: "Personal con la formación que pide el puesto y buen trato con las personas.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de salud para clínicas, consultorios, geriátricos y prestadores de Bahía Blanca y la región: enfermería, técnicos, administrativos de salud, recepción y cuidadores.",
    contextoTitulo: "Trabajar en salud en Bahía Blanca",
    contexto: [
      "Bahía Blanca es el centro de salud de una región amplia: además de los hospitales públicos hay clínicas y sanatorios privados, centros de diagnóstico, consultorios, laboratorios, geriátricos y servicios de internación domiciliaria. Mucha gente de las localidades vecinas viene a la ciudad a atenderse.",
      "Enfermería es, en todo el país, uno de los perfiles más difíciles de cubrir, y la región no es la excepción. Las guardias, los turnos rotativos, los fines de semana y feriados hacen que muchas personas trabajen en más de un lugar, y eso complica la disponibilidad.",
      "En salud hay requisitos que no se negocian: título, matrícula habilitante y, según el puesto, cursos y vacunas al día. Y el trato con pacientes y familias pesa tanto como la formación.",
    ],
    dolores: [
      { problema: "Títulos y matrículas que hay que tener claros", solucion: "Definimos los requisitos del puesto antes de publicar." },
      { problema: "Turnos rotativos y guardias", solucion: "Buscamos gente con la disponibilidad que pide el puesto." },
      { problema: "El trato con pacientes pesa más que el CV", solucion: "Entrevistas y evaluaciones para conocer cómo trata a las personas." },
    ],
    perfiles: [
      { nombre: "Enfermería", texto: "Enfermeros y licenciados para internación, guardia, consultorio o domicilio. Se define el servicio, el esquema de turnos y si hace falta experiencia en un área como terapia intensiva o pediatría." },
      { nombre: "Técnicos", texto: "Radiología, laboratorio, instrumentación quirúrgica, hemoterapia y otras tecnicaturas, cada una con su título y su matrícula." },
      { nombre: "Administrativos de salud", texto: "Admisión de pacientes, autorizaciones y facturación a obras sociales y prepagas. Es un trabajo administrativo con reglas propias: quien ya lo hizo rinde desde el primer día." },
      { nombre: "Recepción de consultorios", texto: "Turnos, atención telefónica y en persona, cobro de consultas. Se busca paciencia y orden con la agenda." },
      { nombre: "Cuidadores y auxiliares", texto: "Para geriátricos, internación domiciliaria o acompañamiento. Pesan la formación en cuidados, la responsabilidad y el trato humano." },
    ],
    verifica: [
      "Título y matrícula habilitante vigente para ejercer en la provincia de Buenos Aires, en todos los puestos que la exigen.",
      "Experiencia en el servicio o la especialidad del puesto, y en qué esquema de turnos trabajó.",
      "Disponibilidad real para guardias, turnos rotativos, francos y feriados, y si tiene otro empleo que se superponga.",
      "Para los puestos administrativos, experiencia con obras sociales, prepagas, autorizaciones y sistemas de turnos o de facturación.",
      "Cómo trata a pacientes y familias y cómo maneja una situación tensa, que se mira en la entrevista y en las evaluaciones psicométricas.",
    ],
    proceso: [
      "En salud, el relevamiento separa con claridad los requisitos legales (título, matrícula) de los deseables. Quien no los cumple no pasa a entrevista, y vos sólo ves candidatos que pueden ejercer el puesto.",
      "Enfermería y algunas tecnicaturas llevan más tiempo de búsqueda que los puestos administrativos o de recepción, porque hay menos personas disponibles. Si vas a abrir un servicio o sumar turnos, conviene consultar con anticipación.",
    ],
    preguntas: [
      {
        p: "¿Y si el puesto exige matrícula?",
        r: "Contalo en la consulta: queda entre los requisitos indispensables del perfil.",
      },
      {
        p: "¿Pueden buscar enfermería para guardias o turnos rotativos?",
        r: "Sí. En el relevamiento se define el esquema (horas de guardia, rotación, francos) y la búsqueda apunta a quienes pueden cumplirlo sin superponerse con otro trabajo.",
      },
      {
        p: "¿Sirve para un consultorio chico que necesita una recepcionista?",
        r: "Sí. En un consultorio, la recepción es la primera impresión del paciente. Contá el horario, el sistema de turnos que usás y si la persona también va a cobrar o facturar.",
      },
      {
        p: "¿Buscan personal para facturación a obras sociales?",
        r: "Sí. Es un puesto con reglas propias: contá con qué obras sociales y prepagas trabajás, y la experiencia en ese tipo de facturación queda como requisito.",
      },
      {
        p: "¿Y para geriátricos o internación domiciliaria?",
        r: "También. Contá el horario, si es con cama adentro o por turnos y qué cuidados necesitan las personas a atender, porque eso define el perfil.",
      },
    ],
    relacionados: [
      { slug: "administracion", motivo: "Facturación, cobranzas y administración general fuera del ámbito de la salud." },
      { slug: "educacion", motivo: "Otro sector donde el trato diario con personas pesa tanto como el título." },
    ],
  },
  {
    slug: "educacion",
    title: "Selección de personal de educación en Bahía Blanca | Talency",
    description:
      "Docentes, preceptores, coordinadores y capacitadores para colegios privados, institutos y empresas de Bahía Blanca. Talency entrevista y te presenta candidatos.",
    h1: "Selección de personal de educación en Bahía Blanca",
    bajada: "Docentes y equipos de instituciones, elegidos por cómo trabajan.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de educación para colegios privados, institutos, academias y empresas que capacitan en Bahía Blanca y la región: docentes, preceptores, coordinadores, capacitadores y administrativos. Los cargos de escuelas públicas se cubren por los listados oficiales.",
    contextoTitulo: "La educación en Bahía Blanca",
    contexto: [
      "Bahía Blanca es una ciudad universitaria con una oferta educativa grande: colegios privados, jardines, institutos de idiomas, academias, centros de formación profesional y empresas que capacitan a su gente. Cada uno busca perfiles distintos, del docente de nivel inicial al capacitador técnico.",
      "Los cargos en las escuelas públicas de la provincia se cubren por los listados y actos públicos oficiales, no por una consultora. La selección de Talency apunta a las instituciones privadas, los institutos y las empresas, que eligen a su personal por su cuenta.",
      "El calendario manda: la mayoría de las incorporaciones se definen antes del inicio de clases o de un curso, y una vacante a mitad de año hay que cubrirla rápido para no dejar un grupo sin docente.",
    ],
    dolores: [
      { problema: "Un docente se elige por cómo enseña, no sólo por el título", solucion: "Entrevistamos para conocer su forma de trabajar." },
      { problema: "Cargos que hay que cubrir ya", solucion: "Con el perfil definido, la búsqueda no arranca de cero." },
      { problema: "Trato diario con chicos y familias", solucion: "Evaluaciones para conocer a la persona más allá del CV." },
    ],
    perfiles: [
      { nombre: "Docentes", texto: "De nivel inicial, primario o secundario, o de materias específicas como inglés o informática. Además del título, se busca a alguien que encaje con el proyecto de la institución." },
      { nombre: "Preceptores y auxiliares", texto: "Acompañan a los alumnos en el día a día, llevan la asistencia y son el nexo con las familias. Pesan el criterio y la presencia." },
      { nombre: "Coordinadores", texto: "Coordinan un nivel, un área o un equipo docente. Es el puesto donde más cuentan la experiencia en gestión y el trato con docentes y familias." },
      { nombre: "Capacitadores", texto: "Para centros de formación o empresas que capacitan a su gente: oficios, seguridad, atención al cliente, herramientas digitales. Tienen que saber el tema y saber enseñarlo." },
      { nombre: "Administrativos de instituciones", texto: "Secretaría, inscripciones, cobro de cuotas y atención a familias. Es trabajo administrativo con un calendario propio." },
    ],
    verifica: [
      "El título habilitante para el nivel y la materia, cuando el puesto lo pide.",
      "El certificado de antecedentes penales, que muchas instituciones exigen a quien trabaja con chicos.",
      "Experiencia frente a grupos de la edad que corresponde: no se trabaja igual en un jardín que con adultos en un curso.",
      "Disponibilidad para los días y horarios de cursada, y si tiene horas en otras instituciones.",
      "Cómo se comunica con alumnos y familias, que se ve en la entrevista y en las evaluaciones. Si querés una clase de prueba, la organiza la institución.",
    ],
    proceso: [
      "Para una institución, el relevamiento define el puesto y también el estilo: qué proyecto educativo tiene, cómo es el grupo y qué se espera de la persona más allá del título.",
      "Para los cargos del ciclo siguiente, lo ideal es consultar hacia fin de año o al principio del verano. Una vacante a mitad de año, por licencia o renuncia, también se busca: contá desde cuándo necesitás a la persona. Un preceptor o un administrativo suelen aparecer antes que el docente de una materia con pocos títulos en la ciudad.",
    ],
    preguntas: [
      {
        p: "¿Sirve para instituciones y centros de capacitación?",
        r: "Sí. Contá qué tipo de institución sos y qué puesto necesitás en la consulta.",
      },
      {
        p: "¿Talency cubre cargos en escuelas públicas?",
        r: "No. En las escuelas públicas de la provincia los cargos se cubren por los listados oficiales. La selección de Talency es para colegios privados, institutos, academias y empresas que eligen a su personal.",
      },
      {
        p: "¿Cuándo conviene buscar docentes para el próximo ciclo lectivo?",
        r: "Con tiempo antes del inicio de clases. Muchas instituciones definen sus cargos hacia fin de año, y a esa altura varios buenos docentes ya tienen sus horas tomadas.",
      },
      {
        p: "¿Se pide certificado de antecedentes penales?",
        r: "Si tu institución lo exige, queda como requisito del perfil. Es habitual en puestos que trabajan con chicos y se tramita ante el Registro Nacional de Reincidencia.",
      },
      {
        p: "¿Pueden buscar un capacitador para mi empresa?",
        r: "Sí. Contá el tema, a cuántas personas hay que capacitar, si es presencial o virtual y si es un curso puntual o un puesto fijo.",
      },
    ],
    relacionados: [
      { slug: "salud", motivo: "Otro sector de trato diario con personas, turnos y títulos habilitantes." },
      { slug: "recursos-humanos", motivo: "Capacitación y desarrollo del personal dentro de las empresas." },
    ],
  },
  {
    slug: "marketing",
    title: "Selección de personal de marketing en Bahía Blanca | Talency",
    description:
      "Community managers, diseñadores, redactores y especialistas en publicidad digital para PyMEs y agencias de Bahía Blanca. Talency define el perfil y entrevista.",
    h1: "Selección de personal de marketing en Bahía Blanca",
    bajada: "Gente creativa que además cumple y encaja en tu equipo.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de marketing para PyMEs, comercios y agencias de Bahía Blanca y la región: community managers, diseñadores gráficos, redactores, publicidad digital y producción audiovisual.",
    contextoTitulo: "Marketing en empresas de Bahía Blanca",
    contexto: [
      "Muchas búsquedas de marketing en la ciudad no son para grandes departamentos sino para PyMEs, comercios y agencias chicas. A menudo la empresa busca a su primera persona de marketing y espera que maneje redes, diseño, publicidad y algo de ventas al mismo tiempo.",
      "Ahí aparece el problema: el perfil que hace todo casi no existe, y quien sabe mucho de una cosa suele trabajar como freelance para varios clientes. Definir qué parte del marketing es la importante para tu negocio cambia toda la búsqueda.",
      "Además, un portfolio prolijo no cuenta todo. Interesa saber qué hizo la persona, qué resultados midió y cómo trabaja con plazos y con el resto del equipo.",
    ],
    dolores: [
      { problema: "Portfolios lindos que no dicen cómo trabaja", solucion: "Entrevistamos sobre casos y trabajos concretos." },
      { problema: "No tenés claro qué perfil necesitás", solucion: "El relevamiento define el puesto antes de publicar." },
      { problema: "En un equipo chico cada persona cuenta", solucion: "Evaluaciones para ver cómo encaja con los demás." },
    ],
    perfiles: [
      { nombre: "Community managers", texto: "Manejan redes, contenido y mensajes de clientes. Se busca buena escritura, criterio para la marca y constancia, más que seguidores propios." },
      { nombre: "Diseñadores gráficos", texto: "Piezas para redes, cartelería, packaging o web. El portfolio muestra el estilo; la entrevista, cómo recibe correcciones y cumple plazos." },
      { nombre: "Redactores y contenido", texto: "Textos para web, redes, mails o prensa. Lo que más dice es una muestra de escritura o una prueba corta sobre tu negocio." },
      { nombre: "Publicidad digital", texto: "Campañas pagas en redes y buscadores, presupuesto y medición. Tiene que poder explicar qué hizo con la inversión y qué volvió." },
      { nombre: "Fotografía y video", texto: "Producción de contenido audiovisual para redes o para la marca. Se miran el material, el equipo propio y la disponibilidad." },
    ],
    verifica: [
      "El portfolio y, en la entrevista, qué parte de cada trabajo hizo la persona y qué parte hizo el resto del equipo.",
      "Resultados que pueda explicar: qué midió, qué cambió y qué aprendió de una campaña que no funcionó.",
      "Las herramientas que vas a necesitar, de diseño, de publicidad, de edición o de gestión de redes, al nivel que pide el puesto.",
      "Si busca relación de dependencia o trabaja con otros clientes, para acordar desde el principio la dedicación.",
      "Cómo trabaja con plazos, correcciones y otras áreas como ventas, que se ve en la entrevista y en las evaluaciones psicométricas.",
    ],
    proceso: [
      "En marketing, el relevamiento es donde más se gana: se define qué necesita tu negocio (más ventas por redes, una marca más ordenada, campañas que se puedan medir) y a partir de eso qué perfil buscar, en vez de pedir una lista de todo.",
      "Los perfiles generalistas para redes aparecen rápido; un especialista en publicidad digital o un diseñador con mucha experiencia llevan más. Si el puesto acepta trabajo remoto o media jornada, se amplía la cantidad de candidatos.",
    ],
    preguntas: [
      {
        p: "¿Qué datos ayudan a definir un puesto de marketing?",
        r: "El puesto, las herramientas que se usan, si es presencial o remoto y qué conviene que muestre el candidato: portfolio, campañas o textos.",
      },
      {
        p: "¿Me conviene sumar a alguien al equipo o seguir con una agencia?",
        r: "Depende del volumen de trabajo y de cuánto querés controlar el día a día. Si la marca necesita a alguien todos los días, una persona en el equipo suele rendir; para campañas puntuales, una agencia o un freelance pueden alcanzar.",
      },
      {
        p: "¿Cómo se evalúa a un community manager?",
        r: "Con su trabajo en cuentas reales, la forma en que escribe y cómo le responde a un cliente enojado. En la etapa final podés pedirle una propuesta corta para tu marca.",
      },
      {
        p: "¿Se puede buscar a alguien que haga diseño y redes a la vez?",
        r: "Se puede, y es común en PyMEs. Conviene definir cuál de las dos tareas pesa más, porque es raro encontrar a alguien igual de fuerte en ambas.",
      },
      {
        p: "¿Y si no sé qué perfil necesito?",
        r: "Es lo más común. Contá qué querés lograr y en el relevamiento se define el puesto: a veces es un community manager, a veces un diseñador y a veces alguien de ventas.",
      },
    ],
    relacionados: [
      { slug: "tecnologia", motivo: "Desarrollo web, datos y soporte, que trabajan pegados al marketing digital." },
      { slug: "comercio", motivo: "Vendedores y atención al público: la otra mitad de vender más." },
    ],
  },
  {
    slug: "recursos-humanos",
    title: "Selección de personal de RR.HH. en Bahía Blanca | Talency",
    description:
      "Liquidadores de sueldos, analistas de RR.HH., reclutadores y capacitadores para empresas de Bahía Blanca, elegidos por una consultora de recursos humanos.",
    h1: "Selección de personal de recursos humanos en Bahía Blanca",
    bajada: "Quien busca a las personas de tu empresa tiene que ser la persona indicada.",
    citable:
      "Talency, la consultora de recursos humanos detrás de BBJobs, hace selección de personal de recursos humanos para empresas de Bahía Blanca y la región: liquidación de sueldos, analistas generalistas, reclutadores, administrativos de personal y capacitación.",
    contextoTitulo: "Recursos humanos en empresas de Bahía Blanca",
    contexto: [
      "Muchas empresas arman su área de personal sobre la marcha: primero alguien de administración liquida los sueldos, después hace falta quien busque gente, ordene legajos o lleve la relación con el gremio. Cuando llega el momento de contratar a alguien para eso, cuesta saber qué perfil pedir.",
      "La liquidación de sueldos es el puesto más técnico y uno de los más difíciles de cubrir: cada convenio colectivo (comercio, construcción, metalúrgicos, camioneros, gastronómicos) tiene sus escalas, adicionales y particularidades, y un error termina en reclamos.",
      "Además, quien trabaja en RR.HH. maneja sueldos, legajos y conflictos de toda la empresa. La reserva y el criterio pesan tanto como el conocimiento.",
    ],
    dolores: [
      { problema: "Va a manejar información sensible de tu gente", solucion: "Entrevistas y evaluaciones para conocer a la persona antes de sumarla." },
      { problema: "Puestos que mezclan administración y trato con personas", solucion: "Definimos qué parte pesa más en tu puesto." },
      { problema: "Buscar a quien va a buscar a otros", solucion: "Talency es una consultora de RR.HH.: conoce el oficio." },
    ],
    perfiles: [
      { nombre: "Liquidación de sueldos", texto: "Liquida haberes y cargas sociales y hace las presentaciones ante ARCA, con el convenio y el sistema de la empresa. Se busca experiencia en los mismos convenios que aplicás." },
      { nombre: "Analistas de RR.HH.", texto: "Generalistas que llevan legajos, ausentismo, licencias, búsquedas y la relación diaria con el personal. Es el perfil típico de la primera persona del área." },
      { nombre: "Reclutadores", texto: "Para empresas con muchas búsquedas o mucha rotación. Pesan la organización y el criterio para entrevistar." },
      { nombre: "Administrativos de personal", texto: "Altas y bajas, control de asistencia, ART, vacaciones y documentación. Trabajo prolijo y confidencial." },
      { nombre: "Capacitación y desarrollo", texto: "Detectan necesidades, organizan cursos y acompañan la incorporación de gente nueva. Aparecen cuando la empresa ya tiene un área formada." },
    ],
    verifica: [
      "Los convenios colectivos con los que liquidó y el sistema de sueldos que manejó, frente a los de tu empresa.",
      "Conocimiento de la legislación laboral al nivel que pide el puesto: licencias, indemnizaciones, ART, presentaciones mensuales.",
      "Estudios en recursos humanos, relaciones del trabajo o ciencias económicas, cuando el puesto los requiere.",
      "Experiencia real en reclutamiento: qué perfiles buscó, cuántas búsquedas llevó a la vez y cómo las cerró.",
      "Reserva, criterio y manejo de conflictos, que se miran en la entrevista y en las evaluaciones psicométricas.",
    ],
    proceso: [
      "Talency es una consultora de recursos humanos, así que en estas búsquedas conoce el puesto desde adentro: sabe qué preguntarle a un liquidador sobre un convenio o a un reclutador sobre cómo cerró una búsqueda difícil.",
      "Un administrativo de personal se encuentra antes que un liquidador con experiencia en un convenio específico, que es un perfil escaso. Si el puesto es nuevo en tu empresa, el relevamiento sirve también para definir hasta dónde llega.",
    ],
    preguntas: [
      {
        p: "¿Qué datos hacen falta para pedir un perfil de RR.HH.?",
        r: "Si el puesto es de liquidación, de reclutamiento o mixto, qué convenios aplica tu empresa y qué sistema de sueldos usás.",
      },
      {
        p: "Si tercerizo la selección, ¿igual necesito a alguien de RR.HH.?",
        r: "Depende del tamaño de tu empresa. La selección es una parte del trabajo del área: liquidar sueldos, llevar legajos y acompañar al personal sigue haciendo falta. Muchas PyMEs tercerizan las búsquedas y tienen a una persona para el resto.",
      },
      {
        p: "¿Pueden buscar un liquidador de sueldos para un convenio específico?",
        r: "Sí. Indicá el convenio (o los convenios) y cuántos empleados se liquidan; la experiencia en ese convenio queda como requisito.",
      },
      {
        p: "¿Talency puede buscar a la persona que después haga las búsquedas de mi empresa?",
        r: "Sí. Es una búsqueda como cualquier otra, y una consultora de RR.HH. tiene claro qué mirar en alguien que va a reclutar. Después decidís si seguís tercerizando o no.",
      },
      {
        p: "¿Tiene que conocer el sistema de sueldos que uso?",
        r: "Ayuda, pero no siempre es indispensable: quien domina un sistema suele aprender otro. Lo que no se aprende rápido es el convenio, así que eso se prioriza.",
      },
    ],
    relacionados: [
      { slug: "administracion", motivo: "Administrativos, auxiliares contables y facturación, que muchas veces comparten oficina con personal." },
      { slug: "educacion", motivo: "Capacitadores y perfiles de formación, para cuando el área crece." },
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
