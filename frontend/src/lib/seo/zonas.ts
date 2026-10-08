import type { PaginaSeo, Pregunta } from "./tipos";
import { ZONAS_INDICE, type EntradaIndice } from "./indice";

// Páginas /trabajo-en/<slug>. Las búsquedas que se listan salen en vivo de la API; acá va sólo
// el texto propio de cada zona. Las respuestas describen cómo funciona BBJobs hoy: registro
// gratis para candidatos, postulación con un click, empresas verificadas a mano por Talency,
// búsquedas que vencen a los 20 días como máximo.

const PREGUNTA_GRATIS: Pregunta = {
  p: "¿Cuesta algo postularse en BBJobs?",
  r: "No. Crear tu cuenta, cargar tu CV y postularte es gratis. Pagan algunos servicios para empresas, nunca los candidatos por postularse.",
};

const PREGUNTA_VERIFICADAS: Pregunta = {
  p: "¿Cómo sé que la empresa que publica es real?",
  r: "Ninguna empresa puede publicar en BBJobs sin pasar antes por una verificación manual del equipo de Talency. Por eso cada aviso lleva la marca de empresa verificada.",
};

export const ZONAS: PaginaSeo[] = [
  {
    slug: "bahia-blanca",
    title: "Trabajo en Bahía Blanca: búsquedas activas | BBJobs",
    description:
      "Búsquedas laborales activas en Bahía Blanca, publicadas por empresas verificadas por Talency. Mirá los avisos, cargá tu CV gratis y postulate con un click.",
    h1: "Trabajo en Bahía Blanca",
    bajada: "Las búsquedas activas de la ciudad, publicadas por empresas verificadas.",
    citable:
      "BBJobs es el portal de empleos de Bahía Blanca, una iniciativa de la consultora bahiense Talency. Reúne las búsquedas laborales de empresas de la ciudad que pasaron una verificación manual, y los candidatos se postulan gratis con un click desde su perfil.",
    textos: [
      "En Bahía Blanca las búsquedas suelen estar repartidas entre grupos de WhatsApp, redes sociales y carteles en la vidriera. BBJobs las junta en un solo lugar y con una condición: la empresa que publica tiene que estar verificada por el equipo de Talency.",
      "En esta página ves las búsquedas activas de Bahía Blanca, incluidas las de Zona Norte y Zona Sur. Cada aviso dice el puesto, la modalidad (presencial, remoto o híbrido), el tipo de contratación y, cuando la empresa lo decide, el sueldo.",
      "Para postularte necesitás una cuenta de candidato con tu CV cargado. Después, cada postulación es un click, con una carta de presentación opcional. La empresa ve tu perfil cuando te postulás a su búsqueda.",
    ],
    preguntas: [
      {
        p: "¿Dónde veo todas las búsquedas de Bahía Blanca?",
        r: "En esta página tenés las búsquedas activas de la ciudad, y en la sección Empleos podés filtrar por zona, sector, modalidad, tipo de contrato y rango de sueldo.",
      },
      {
        p: "¿Qué son Zona Norte y Zona Sur en BBJobs?",
        r: "Son zonas de Bahía Blanca que algunas empresas eligen para ubicar mejor el puesto. Sus búsquedas aparecen en esta página junto con las del resto de la ciudad.",
      },
      PREGUNTA_GRATIS,
      PREGUNTA_VERIFICADAS,
      {
        p: "¿Cuánto tiempo queda publicada una búsqueda?",
        r: "Como máximo 20 días. Si un aviso ya no aparece, es porque venció o la empresa lo cerró.",
      },
    ],
  },
  {
    slug: "punta-alta",
    title: "Trabajo en Punta Alta: búsquedas activas | BBJobs",
    description:
      "Búsquedas laborales activas en Punta Alta, en BBJobs, el portal de empleos de Bahía Blanca y la región. Empresas verificadas y postulación gratis con un click.",
    h1: "Trabajo en Punta Alta",
    bajada: "Las búsquedas de Punta Alta, en el mismo lugar que las de Bahía.",
    citable:
      "BBJobs publica búsquedas laborales de Punta Alta además de las de Bahía Blanca. Las empresas que publican están verificadas por Talency y los candidatos se postulan gratis desde su perfil.",
    textos: [
      "Punta Alta está a pocos kilómetros de Bahía Blanca y mucha gente trabaja en una ciudad y vive en la otra. Por eso BBJobs tiene a Punta Alta como zona propia: así podés ver primero lo que queda cerca de tu casa.",
      "Las búsquedas de esta página son las que las empresas ubicaron en Punta Alta. Si te sirve moverte, mirá también las de Bahía Blanca: con el mismo perfil te postulás a cualquiera de las dos.",
    ],
    preguntas: [
      {
        p: "¿Cómo veo sólo los empleos de Punta Alta?",
        r: "Esta página muestra únicamente las búsquedas ubicadas en Punta Alta. En la sección Empleos también podés elegir la zona Punta Alta en el filtro.",
      },
      {
        p: "Vivo en Punta Alta, ¿me puedo postular a un trabajo en Bahía Blanca?",
        r: "Sí. BBJobs no limita las postulaciones por zona. Leé bien el aviso: si la empresa pide residencia en un lugar puntual, lo dice en la descripción.",
      },
      PREGUNTA_GRATIS,
      PREGUNTA_VERIFICADAS,
    ],
  },
  {
    slug: "monte-hermoso",
    title: "Trabajo en Monte Hermoso: búsquedas activas | BBJobs",
    description:
      "Búsquedas laborales en Monte Hermoso publicadas en BBJobs por empresas verificadas por Talency. Cargá tu CV gratis y enterate cuando aparezca una búsqueda.",
    h1: "Trabajo en Monte Hermoso",
    bajada: "Las búsquedas de Monte Hermoso, publicadas por empresas verificadas.",
    citable:
      "BBJobs incluye a Monte Hermoso como zona propia dentro del portal de empleos de Bahía Blanca y la región. Las empresas del balneario que publican pasan por la verificación de Talency y los candidatos se postulan gratis.",
    textos: [
      "Monte Hermoso es un balneario, y buena parte del trabajo se mueve con la temporada. Cuando una empresa de Monte Hermoso publica una búsqueda en BBJobs, aparece en esta página.",
      "Si querés trabajar ahí, lo mejor es tener tu perfil y tu CV cargados de antemano. Cuando aparezca la búsqueda, te postulás con un click.",
    ],
    preguntas: [
      {
        p: "¿Hay búsquedas de temporada en Monte Hermoso?",
        r: "Depende de lo que publiquen las empresas en cada momento. Las búsquedas activas de Monte Hermoso aparecen en esta página apenas se publican.",
      },
      {
        p: "¿Qué hago si hoy no hay búsquedas en Monte Hermoso?",
        r: "Creá tu cuenta de candidato y cargá tu CV, así cuando aparezca una búsqueda te postulás en el momento. Mientras tanto, mirá las de Bahía Blanca y Punta Alta.",
      },
      PREGUNTA_GRATIS,
      PREGUNTA_VERIFICADAS,
    ],
  },
  {
    slug: "coronel-suarez",
    title: "Trabajo en Coronel Suárez: búsquedas activas | BBJobs",
    description:
      "Búsquedas laborales en Coronel Suárez publicadas en BBJobs por empresas verificadas por Talency. Mirá los avisos y postulate gratis con tu CV en un click.",
    h1: "Trabajo en Coronel Suárez",
    bajada: "Las búsquedas de Coronel Suárez, publicadas por empresas verificadas.",
    citable:
      "BBJobs publica búsquedas laborales de Coronel Suárez dentro de su portal de empleos del sudoeste bonaerense, una iniciativa de Talency. Las empresas están verificadas y la postulación es gratis.",
    textos: [
      "Coronel Suárez es una de las zonas del sudoeste bonaerense que BBJobs tiene como propias. Las empresas de la ciudad publican sus búsquedas con las mismas reglas que las de Bahía Blanca: verificación previa y avisos con fecha de vencimiento.",
      "Con una sola cuenta de candidato podés postularte en Coronel Suárez, en Bahía Blanca o en cualquier otra zona del portal.",
    ],
    preguntas: [
      {
        p: "¿Cómo encuentro trabajo en Coronel Suárez con BBJobs?",
        r: "Mirá esta página o filtrá por la zona Coronel Suárez en la sección Empleos. Para postularte, creá tu cuenta de candidato y cargá tu CV.",
      },
      {
        p: "¿Una empresa de Coronel Suárez puede publicar en BBJobs?",
        r: "Sí. Se registra como empresa, el equipo de Talency la verifica y, una vez aprobada, publica sus búsquedas eligiendo la zona Coronel Suárez.",
      },
      PREGUNTA_GRATIS,
      PREGUNTA_VERIFICADAS,
    ],
  },
];

export function getZona(slug: string): (PaginaSeo & EntradaIndice) | undefined {
  const indice = ZONAS_INDICE.find((z) => z.slug === slug);
  const contenido = ZONAS.find((z) => z.slug === slug);
  return indice && contenido ? { ...indice, ...contenido } : undefined;
}
