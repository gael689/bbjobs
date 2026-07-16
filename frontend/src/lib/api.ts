import axios from 'axios';

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
type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter | null = null;

export const setTokenGetter = (fn: TokenGetter | null) => {
  getToken = fn;
};

api.interceptors.request.use(async (config) => {
  if (getToken) {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
