// Segmento con sesión o formularios de Clerk: se renderiza por request para llevar la CSP
// estricta con nonce (ver src/proxy.ts, isStrictCspRoute). Las páginas públicas, en cambio, se
// prerenderizan — el `force-dynamic` global que había en app/layout.tsx se sacó el 23/09/2026
// porque agotaba el CPU del plan de Vercel.
export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
