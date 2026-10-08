// Medición con Google Analytics 4 (Frente 3 de MAILS-SEO-IA-OCTUBRE-PLAN.md).
//
// Reglas:
// - Sin NEXT_PUBLIC_GA_ID no se carga nada y `track` no hace nada.
// - Sin consentimiento de "Medición" (cookie bbjobs_consent) tampoco: GA ni siquiera se descarga.
// - Consent Mode v2 arranca todo en "denied"; con el sí, sólo analytics_storage pasa a "granted".
//   Lo publicitario (ad_storage, ad_user_data, ad_personalization) queda denegado siempre: BBJobs
//   no hace publicidad.
// - Nunca se mandan datos personales: ni nombre, ni mail, ni teléfono, ni ids de usuario. Los ids
//   de búsquedas (job_id) sí, porque son públicos.
//
// No hay <script> inline: el stub de gtag se arma desde este módulo, así la CSP con nonce del
// panel no necesita excepciones (sólo el dominio de googletagmanager.com, ver src/proxy.ts).

import { hasMeasurementConsent } from "@/lib/consent";

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() || "";

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

let initialized = false;
let granted = false;

/** Arma window.gtag y fija el default de Consent Mode (todo denegado). Idempotente. */
function ensureGtag(): GtagFn {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js espera el objeto `arguments` tal cual, no un array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  if (!initialized) {
    initialized = true;
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }
  return window.gtag;
}

function disableFlag(disabled: boolean) {
  // Interruptor oficial de gtag: con esto en true no sale ningún hit, ni siquiera sin cookies.
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = disabled;
}

/** Se llama al aceptar "Medición": habilita y configura GA4 (antes de que cargue gtag.js). */
export function grantAnalytics(): void {
  if (!GA_ID || granted) return;
  granted = true;
  const gtag = ensureGtag();
  disableFlag(false);
  gtag("consent", "update", { analytics_storage: "granted" });
  gtag("js", new Date());
  gtag("config", GA_ID, {
    send_page_view: false, // las vistas las manda GoogleAnalytics.tsx en cada cambio de ruta
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

/** Se llama al rechazar después de haber aceptado: corta el envío y borra las cookies _ga*. */
export function revokeAnalytics(): void {
  if (!GA_ID) return;
  granted = false;
  if (window.gtag) window.gtag("consent", "update", { analytics_storage: "denied" });
  disableFlag(true);
  deleteGaCookies();
}

function deleteGaCookies() {
  const names = document.cookie
    .split("; ")
    .map(c => c.split("=")[0])
    .filter(n => n === "_ga" || n.startsWith("_ga_") || n === "_gid" || n === "_gat");
  // GA4 escribe la cookie en el dominio "más alto" posible (ej. .bbjobs.com.ar): hay que borrarla
  // probando el host y cada dominio padre.
  const parts = window.location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; Domain=.${parts.slice(i).join(".")}`);
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain}`;
    }
  }
}

export function pageView(path: string): void {
  if (!GA_ID || !hasMeasurementConsent()) return;
  grantAnalytics();
  ensureGtag()("event", "page_view", {
    page_location: window.location.origin + path,
    page_title: document.title,
  });
}

// Claves que nunca se mandan aunque alguien las pase por error.
const PERSONAL_KEY = /(name|nombre|mail|phone|telefono|tel[eé]fono|cuit|dni|user|usuario|candidate|candidato|address|direcci)/i;

type Param = string | number | boolean;

/**
 * Evento de GA4. No hace nada sin NEXT_PUBLIC_GA_ID o sin consentimiento de "Medición".
 * Uso: track("search", { search_term: "chofer" }), track("apply", { job_id }).
 */
export function track(evento: string, params: Record<string, Param | null | undefined> = {}): void {
  if (typeof window === "undefined" || !GA_ID || !hasMeasurementConsent()) return;
  const clean: Record<string, Param> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || PERSONAL_KEY.test(key)) continue;
    clean[key] = typeof value === "string" ? value.slice(0, 100) : value;
  }
  // Si un componente dispara el evento antes de que GoogleAnalytics.tsx monte, la config tiene que
  // quedar antes en la cola: gtag.js descarta los eventos que llegan sin un "config" previo.
  grantAnalytics();
  ensureGtag()("event", evento, clean);
}
