import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/sitio";

// Mismas reglas para todos. Los bots de IA (búsqueda y entrenamiento) se nombran explícitamente
// para que quede clara la decisión: queremos que ChatGPT, Claude, Perplexity y Gemini puedan
// leer y citar las búsquedas públicas de BBJobs.
const PRIVADO = ["/dashboard/", "/onboarding", "/post-login"];
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
