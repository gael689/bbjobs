// Medición propia de BBJobs: los eventos van a nuestro backend (POST /metrics/events) y se ven en
// el panel de admin, "Métricas del sitio". Mismas reglas que Google Analytics:
// - Sólo con consentimiento de "Medición" (cookie bbjobs_consent). Sin eso no sale nada y no se
//   crea ninguna cookie.
// - Nada personal: ni nombre, ni mail, ni ids de usuario. El visitante es un id aleatorio en la
//   cookie de primera parte `bbjobs_vid` (13 meses), que se borra al retirar el consentimiento.
//   La sesión es otro id aleatorio en sessionStorage (muere al cerrar la pestaña).
// - El backend no guarda IP ni user agent: de ahí saca sólo si es celular o compu, y si es un bot.
//
// Envío: lotes chicos con navigator.sendBeacon y cuerpo text/plain (sin preflight de CORS y
// sobrevive al cierre de la página). Si no hay sendBeacon, fetch con keepalive.

import { hasMeasurementConsent } from "@/lib/consent";

const ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/metrics/events`;
export const VISITOR_COOKIE = "bbjobs_vid";
const VISITOR_MAX_AGE = 395 * 24 * 60 * 60; // 13 meses
const SESSION_KEY = "bbjobs_sid";
const MAX_BATCH = 20;
const FLUSH_MS = 1500;

// Lo único que se manda además del evento y la ruta. Todo lo demás se descarta acá mismo.
const ALLOWED_PARAMS = new Set(["job_id", "search_term", "results", "method", "topic"]);

export type OwnParam = string | number | boolean;

interface OwnEvent {
  event: string;
  path: string;
  referrer?: string;
  visitor_id?: string;
  session_id?: string;
  [key: string]: OwnParam | undefined;
}

let queue: OwnEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
let memorySession: string | null = null;
let firstPageView = true;

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function readCookie(name: string): string {
  return document.cookie.split("; ").find(c => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

/** Id anónimo del visitante. Se crea recién acá, o sea, sólo después de aceptar medición. */
function visitorId(): string {
  const actual = readCookie(VISITOR_COOKIE);
  if (/^[0-9a-f-]{36}$/i.test(actual)) return actual;
  const nuevo = randomId();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${VISITOR_COOKIE}=${nuevo}; Max-Age=${VISITOR_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  return nuevo;
}

function sessionId(): string {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    memorySession = memorySession || randomId();
    return memorySession;
  }
}

/** Al retirar el consentimiento: se borra el id del visitante y lo que quedaba sin mandar. */
export function forgetVisitor(): void {
  if (typeof document === "undefined") return;
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
  document.cookie = `${VISITOR_COOKIE}=; Max-Age=0; Path=/`;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* sin sessionStorage no hay nada que borrar */
  }
  memorySession = null;
}

function flush(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const lote = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  // Si la persona retiró el consentimiento entre el evento y el envío, no sale nada.
  if (!hasMeasurementConsent()) {
    queue = [];
    return;
  }
  const body = JSON.stringify(lote);
  let sent = false;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain;charset=UTF-8" }));
    }
  } catch {
    sent = false;
  }
  if (!sent) {
    fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      mode: "no-cors",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    }).catch(() => {});
  }
  if (queue.length) flush();
}

function listen(): void {
  if (listening) return;
  listening = true;
  // Al irse de la página (o pasar a otra pestaña) se manda lo pendiente.
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/** Encola un evento propio. No hace nada sin consentimiento de "Medición". */
export function sendOwn(evento: string, params: Record<string, OwnParam> = {}, path?: string): void {
  if (typeof window === "undefined" || !hasMeasurementConsent()) return;
  const ev: OwnEvent = {
    event: evento,
    path: (path ?? window.location.pathname).slice(0, 300),
    visitor_id: visitorId(),
    session_id: sessionId(),
  };
  // De dónde llegó la persona: sólo en la primera vista de cada carga de página (document.referrer).
  // El resto son navegaciones dentro del sitio. El backend clasifica (Google, redes, IA...) y tira la URL.
  if (evento === "page_view" && firstPageView) {
    firstPageView = false;
    ev.referrer = document.referrer || "";
  } else {
    ev.referrer = window.location.origin + "/";
  }
  for (const [key, value] of Object.entries(params)) {
    if (ALLOWED_PARAMS.has(key)) ev[key] = typeof value === "string" ? value.slice(0, 100) : value;
  }
  queue.push(ev);
  listen();
  if (queue.length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

/** Rutas que no son del sitio público: ahí no se cuentan vistas. */
export function isPublicPath(path: string): boolean {
  return !(path.startsWith("/dashboard") || path.startsWith("/vista-previa"));
}
