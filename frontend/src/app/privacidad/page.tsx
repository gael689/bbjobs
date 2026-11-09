import type { Metadata } from "next";
import { metaPagina } from "@/lib/seo/meta";
import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";
import PrivacidadV2 from "@/components/legal/PrivacidadV2";
import PrivacidadV3 from "@/components/legal/PrivacidadV3";

export const metadata: Metadata = metaPagina({
  title: "Política de privacidad | BBJobs",
  description:
    "Qué datos guarda BBJobs, para qué los usa, quién puede verlos y cómo ejercer tus derechos sobre tu información personal.",
  path: "/privacidad",
});

// La 3.0 (módulos nuevos) sólo con la compuerta abierta. La variable se resuelve en el build: el
// texto que no corresponde no llega al HTML.
export default function PrivacidadPage() {
  return MODULOS_NUEVOS_VISIBLES ? <PrivacidadV3 /> : <PrivacidadV2 />;
}
