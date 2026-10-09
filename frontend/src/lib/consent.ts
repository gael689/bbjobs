// Consentimiento de cookies (Frente 3 de MAILS-SEO-IA-OCTUBRE-PLAN.md).
//
// La elección se guarda en una cookie propia de primera parte, `bbjobs_consent`, por 180 días.
// Lleva una versión: si cambia lo que medimos (otra herramienta, otra finalidad), se sube
// CONSENT_VERSION y a todos se les vuelve a preguntar. Ley 25.326: el consentimiento es previo
// (nada de medición antes de elegir), informado (/cookies) y revocable (link del footer).

export const CONSENT_COOKIE = "bbjobs_consent";
// v2 (09/10/2026): se sumó la medición propia de BBJobs (lib/medicion.ts, cookie bbjobs_vid) a
// "Medición". Es otra herramienta: quien había aceptado sólo Google Analytics vuelve a elegir.
export const CONSENT_VERSION = 2;
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export interface ConsentChoice {
  v: number;
  /** Cookies de medición (Google Analytics y medición propia). Las necesarias no se preguntan: van siempre. */
  medicion: boolean;
  /** Fecha de la elección, AAAA-MM-DD. */
  fecha: string;
}

/** Evento que se dispara cuando la persona guarda una elección nueva. */
export const CONSENT_CHANGE_EVENT = "bbjobs:consent-change";
/** Evento para reabrir el banner (link "Configurar cookies" del footer y botón de /cookies). */
export const CONSENT_OPEN_EVENT = "bbjobs:consent-open";

/** Valor crudo de la cookie ("" si no hay). Estable entre llamadas: sirve de snapshot para useSyncExternalStore. */
export function rawConsentCookie(): string {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find(c => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1) ?? "";
}

/** Suscripción para useSyncExternalStore: avisa cuando se guarda una elección nueva. */
export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
}

export function parseConsent(raw: string): ConsentChoice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentChoice>;
    if (parsed.v !== CONSENT_VERSION || typeof parsed.medicion !== "boolean") return null;
    return { v: parsed.v, medicion: parsed.medicion, fecha: String(parsed.fecha ?? "") };
  } catch {
    return null;
  }
}

export function readConsent(): ConsentChoice | null {
  return parseConsent(rawConsentCookie());
}

export function hasMeasurementConsent(): boolean {
  return readConsent()?.medicion === true;
}

export function saveConsent(medicion: boolean): ConsentChoice {
  const choice: ConsentChoice = {
    v: CONSENT_VERSION,
    medicion,
    fecha: new Date().toISOString().slice(0, 10),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(choice))}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_CHANGE_EVENT, { detail: choice }));
  return choice;
}

export function openConsentSettings(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
