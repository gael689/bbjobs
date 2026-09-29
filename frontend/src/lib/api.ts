import axios, { type InternalAxiosRequestConfig } from 'axios';

// Default base URL for local development
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Clerk maneja la sesión y el refresh por su cuenta. `ClerkTokenSync` (montado dentro de
// <ClerkProvider>) registra acá el `getToken()` de Clerk una sola vez; el interceptor lo
// usa antes de cada request, sin necesidad de guardar el token nosotros mismos.
type TokenGetter = (opts?: { skipCache?: boolean }) => Promise<string | null>;
let getToken: TokenGetter | null = null;

// Los pedidos que salen antes de que Clerk termine de cargar (p. ej. los GET que una pantalla
// dispara al montarse) no tienen token todavía: sin esperar, salían sin `Authorization` y el
// backend los rechazaba con 401. Esta promesa se resuelve cuando `ClerkTokenSync` registra el
// getter; el interceptor espera hasta TOKEN_WAIT_MS y sigue sin token si Clerk no llega (por
// ejemplo, visitante sin sesión en una página pública).
const TOKEN_WAIT_MS = 4000;
let resolveReady: (() => void) | null = null;
let ready: Promise<void> = new Promise((res) => { resolveReady = res; });

export const setTokenGetter = (fn: TokenGetter | null) => {
  getToken = fn;
  if (fn) {
    resolveReady?.();
  } else {
    // Al desmontar se vuelve a exigir esperar: el próximo getter es el que vale.
    ready = new Promise((res) => { resolveReady = res; });
  }
};

// ── Sesión vencida ───────────────────────────────────────────────────────────────────────
// El session token de Clerk dura 60 s. Un 401 casi siempre es un token que venció justo antes
// de llegar al servidor (pestaña dormida, subida lenta, formulario abierto un rato): se
// reintenta una vez con un token nuevo. Si igual falla, la sesión de verdad no sirve más y se
// avisa con un banner (SessionExpiredBanner) en vez de un "Error al guardar" que no explica nada.
export const SESSION_EXPIRED_EVENT = 'bbjobs:session-expired';
export const SESSION_RESTORED_EVENT = 'bbjobs:session-restored';

let sessionExpired = false;

export const isSessionExpired = () => sessionExpired;

function setSessionExpired(value: boolean) {
  if (sessionExpired === value) return;
  sessionExpired = value;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(value ? SESSION_EXPIRED_EVENT : SESSION_RESTORED_EVENT));
  }
}

interface AuthConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
  _freshToken?: boolean;
  _hadAuth?: boolean;
}

api.interceptors.request.use(async (config) => {
  const cfg = config as AuthConfig;

  if (!getToken) {
    await Promise.race([ready, new Promise<void>((res) => setTimeout(res, TOKEN_WAIT_MS))]);
  }

  if (getToken) {
    // Las subidas (CV, foto) piden token fresco siempre: pueden tardar y el de 60 s se
    // vence mientras el archivo viaja.
    const fresh = cfg._freshToken || (typeof FormData !== 'undefined' && config.data instanceof FormData);
    try {
      const token = await getToken({ skipCache: fresh });
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        cfg._hadAuth = true;
      }
    } catch {
      // Sin token el pedido sale igual: si el endpoint lo exige, el 401 lo maneja el
      // interceptor de respuesta.
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if ((response.config as AuthConfig)._hadAuth) setSessionExpired(false);
    return response;
  },
  async (error) => {
    const cfg = error?.config as AuthConfig | undefined;
    if (error?.response?.status === 401 && cfg && getToken) {
      if (!cfg._retried) {
        cfg._retried = true;
        cfg._freshToken = true;
        return api.request(cfg);
      }
      setSessionExpired(true);
    }
    return Promise.reject(error);
  },
);
