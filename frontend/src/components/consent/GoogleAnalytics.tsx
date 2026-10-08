"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { parseConsent, rawConsentCookie, subscribeConsent } from "@/lib/consent";
import { GA_ID, grantAnalytics, pageView, revokeAnalytics } from "@/lib/analytics";

// Carga gtag.js SÓLO si hay NEXT_PUBLIC_GA_ID y la persona aceptó "Medición". Antes de eso no se
// pide nada a Google. Si después rechaza, se deja de medir en el acto y se borran las cookies _ga*;
// el script ya descargado queda inerte (ga-disable) y en la próxima carga de página ya no se pide.
export default function GoogleAnalytics() {
  const pathname = usePathname();
  // En el servidor (y en la hidratación) no hay cookie que leer: "" = sin elección = no medir.
  const raw = useSyncExternalStore(subscribeConsent, rawConsentCookie, () => "");
  const medicion = parseConsent(raw)?.medicion === true;

  useEffect(() => {
    if (!GA_ID) return;
    if (medicion) grantAnalytics();
    else revokeAnalytics();
  }, [medicion]);

  // Vista de página en cada navegación del App Router (gtag no las ve solo: no hay recarga).
  // Sólo la ruta, sin query: la búsqueda se mide aparte con el evento `search`.
  useEffect(() => {
    if (GA_ID && medicion && pathname) pageView(pathname);
  }, [medicion, pathname]);

  if (!GA_ID || !medicion) return null;
  return (
    <Script
      id="ga4-gtag"
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
      strategy="afterInteractive"
    />
  );
}
