// Segmentos con sesión o formularios de Clerk: se renderizan por request (cada uno tiene su
// layout.tsx con `force-dynamic`), pasan por el proxy de Clerk y llevan la CSP estricta con nonce.
// Todo lo demás es contenido público, prerenderizado/ISR, servido por la CDN sin función.
//
// La lista vive acá para que la compartan el proxy (src/proxy.ts), los headers de next.config.ts y
// los links públicos que apuntan a estas rutas. OJO: el `matcher` de src/proxy.ts tiene que ser un
// literal (Next lo analiza en el build y no acepta imports), así que si se agrega un segmento hay
// que sumarlo también ahí a mano.
export const RUTAS_CON_SESION = ["dashboard", "onboarding", "login", "register", "post-login"] as const;

/** true si el href apunta a una ruta con sesión (/login, /register?type=..., /dashboard/...). */
export function esRutaConSesion(href: string): boolean {
  const segmento = href.split(/[/?#]/)[1] ?? "";
  return (RUTAS_CON_SESION as readonly string[]).includes(segmento);
}

// Links públicos a /login y /register (19/10/2026): van con `prefetch={false}`. Son rutas dinámicas,
// así que cada prefetch era un render en el servidor (dos requests por link: el árbol y la página),
// y el Header, el Footer y los CTAs los muestran en todas las páginas públicas: cada visita gastaba
// varias funciones en pantallas que casi nadie abre. Sin prefetch la navegación sigue siendo del
// lado del cliente; sólo se pide el render al hacer click.
export function prefetchDe(href: string): false | undefined {
  return esRutaConSesion(href) ? false : undefined;
}
