"use client";

import { openConsentSettings } from "@/lib/consent";

// Reabre el banner de cookies en modo "Configurar" (footer y página /cookies).
export default function ConfigurarCookiesButton({
  className,
  children = "Configurar cookies",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={openConsentSettings} aria-haspopup="dialog" className={className}>
      {children}
    </button>
  );
}
