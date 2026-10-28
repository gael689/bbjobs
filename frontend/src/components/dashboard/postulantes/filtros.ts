import type { ValorFiltro } from "@/hooks/useListaPaginada";

/**
 * Los filtros de la lista de postulantes de una búsqueda, compartidos por el panel de la
 * empresa y el de Talency (BUSCADOR-Y-SEGUIMIENTO-POSTULANTES-PLAN.md).
 *
 * Todo es string porque sale de inputs y de la URL; `aParametros` lo traduce a lo que espera el
 * backend (`services/applicant_search.py::filtros_postulantes`). Las claves son las mismas que
 * los parámetros de la API, así la URL de la pantalla y el pedido se leen igual.
 */
export interface FiltrosPostulantes {
  q: string;
  status: string;
  starred: "" | "true";
  seen: "" | "false";
  orden: "" | "estrella";
  age_min: string;
  age_max: string;
  experience_min: string;
  experience_max: string;
  zone_id: string;
  gender: string;
  has_own_transport: "" | "true" | "false";
  availability: string;
  immediate_availability: "" | "true";
}

export const FILTROS_VACIOS: FiltrosPostulantes = {
  q: "", status: "", starred: "", seen: "", orden: "",
  age_min: "", age_max: "", experience_min: "", experience_max: "",
  zone_id: "", gender: "", has_own_transport: "", availability: "", immediate_availability: "",
};

const CLAVES = Object.keys(FILTROS_VACIOS) as (keyof FiltrosPostulantes)[];

/** Los de "Más filtros": si alguno está puesto, el panel arranca abierto. */
export const CLAVES_AVANZADAS: (keyof FiltrosPostulantes)[] = [
  "age_min", "age_max", "experience_min", "experience_max", "zone_id", "gender",
  "has_own_transport", "availability", "immediate_availability",
];

export function aParametros(f: FiltrosPostulantes): Record<string, ValorFiltro> {
  const out: Record<string, ValorFiltro> = {};
  for (const clave of CLAVES) {
    const valor = clave === "q" ? f.q.trim() : f[clave];
    if (valor) out[clave] = valor;
  }
  return out;
}

/** Lee los filtros de la URL (lo que no es un filtro, como `busqueda` o `page`, se ignora). */
export function desdeUrl(params: URLSearchParams): FiltrosPostulantes {
  const f = { ...FILTROS_VACIOS };
  for (const clave of CLAVES) {
    const valor = params.get(clave);
    if (valor !== null) (f as Record<string, string>)[clave] = valor;
  }
  return f;
}

export function hayFiltros(f: FiltrosPostulantes): boolean {
  return CLAVES.some(clave => clave !== "orden" && !!(clave === "q" ? f.q.trim() : f[clave]));
}

export interface ConteosPostulantes {
  total: number;
  by_status: Record<string, number>;
  starred: number;
  unseen: number;
}
