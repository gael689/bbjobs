import { MODULOS_NUEVOS_VISIBLES } from "@/lib/modulos";
import TerminosV2 from "@/components/legal/TerminosV2";
import TerminosV3 from "@/components/legal/TerminosV3";

// La 3.0 (módulos nuevos) sólo con la compuerta abierta. La variable se resuelve en el build: el
// texto que no corresponde no llega al HTML.
export default function TerminosPage() {
  return MODULOS_NUEVOS_VISIBLES ? <TerminosV3 /> : <TerminosV2 />;
}
