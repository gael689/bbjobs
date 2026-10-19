import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/sitio";

// Mismas reglas para todos. Los bots de IA (búsqueda y entrenamiento) se nombran explícitamente
// para que quede clara la decisión: queremos que ChatGPT, Claude, Perplexity y Gemini puedan
// leer y citar las búsquedas públicas de BBJobs.
//
// /login, /register y /vista-previa se sumaron el 19/10/2026: son las únicas rutas públicas que se
// renderizan por request (sin caché), y /register?type=... está linkeado en casi todas las páginas
// y en /llms.txt, así que cada bot que seguía esos links gastaba una función de Vercel en un
// formulario de Clerk que no tiene nada para indexar. /vista-previa es privada (404 sin la clave).
const PRIVADO = ["/dashboard", "/onboarding", "/post-login", "/login", "/register", "/vista-previa"];
const BOTS_IA = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVADO },
      ...BOTS_IA.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVADO })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
