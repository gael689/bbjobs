import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";
import PrivacidadV2 from "@/components/legal/PrivacidadV2";
import PrivacidadV3 from "@/components/legal/PrivacidadV3";

// La 3.0 (módulos nuevos) sólo con la compuerta abierta. La variable se resuelve en el build: el
// texto que no corresponde no llega al HTML.
export default function PrivacidadPage() {
  return MODULOS_NUEVOS_VISIBLES ? <PrivacidadV3 /> : <PrivacidadV2 />;
}
