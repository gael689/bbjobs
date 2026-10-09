"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { parseConsent, rawConsentCookie, subscribeConsent } from "@/lib/consent";
import { isPublicPath, sendOwn } from "@/lib/medicion";

// Vista de página de la medición propia (lib/medicion.ts) en cada cambio de ruta, sólo con
// consentimiento de "Medición" y sólo en el sitio público (ni el panel ni la vista previa). La ruta
// va sin query: la búsqueda se mide aparte con el evento `search`.
export default function MedicionPropia() {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribeConsent, rawConsentCookie, () => "");
  const medicion = parseConsent(raw)?.medicion === true;

  useEffect(() => {
    if (medicion && pathname && isPublicPath(pathname)) sendOwn("page_view", {}, pathname);
  }, [medicion, pathname]);

  return null;
}
