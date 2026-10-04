// Espejo de los modelos de backend/app/api/v1/prospects.py.

export interface ProspectRow {
  id: string;
  name: string;
  category: string | null;
  locality: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  stage: string;
  primary_email: string | null;
  do_not_contact: boolean;
  last_contacted_at: string | null;
  created_at: string;
}

export interface ProspectPage {
  total: number;
  page: number;
  size: number;
  items: ProspectRow[];
}

export interface FacetValue { value: string; count: number }
export interface Facets { categories: FacetValue[]; localities: FacetValue[]; stages: FacetValue[] }

export interface ProspectEvent { kind: string; detail: string | null; created_at: string }

export interface ProspectDetail extends ProspectRow {
  address: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  rating: number | null;
  notes: string | null;
  emails: string[];
  suppressed_emails: string[];
  company_profile_id: string | null;
  events: ProspectEvent[];
}

export interface SyncRow {
  sync_id: string;
  received: number;
  created: number;
  updated: number;
  discarded: number;
  suppressed: number;
  discarded_reasons: Record<string, number>;
  created_at: string;
}

/** Filtros del listado: los mismos sirven para "todas las que cumplen" y para el CSV. */
export interface Filtro {
  q?: string;
  category?: string;
  locality?: string;
  stage?: string;
  /** "true" = con mail, "false" = sin mail, vacío = cualquiera. */
  has_email?: "" | "true" | "false";
  has_whatsapp?: boolean;
  never_contacted?: boolean;
}

export const ETAPAS: { value: string; label: string }[] = [
  { value: "nueva", label: "Nueva" },
  { value: "contactada", label: "Contactada" },
  { value: "respondio", label: "Respondió" },
  { value: "reunion", label: "Reunión" },
  { value: "cliente", label: "Cliente" },
  { value: "registrada", label: "Registrada en BBJobs" },
  { value: "descartada", label: "Descartada" },
];

export const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map(e => [e.value, e.label]));

export const ETAPA_CLS: Record<string, string> = {
  nueva: "bg-[#E6F4F7] text-[#187B8E]",
  contactada: "bg-yellow-100 text-yellow-900",
  respondio: "bg-[#1E8EA3] text-white",
  reunion: "bg-[#1E8EA3] text-white",
  cliente: "bg-green-100 text-green-900",
  registrada: "bg-green-100 text-green-900",
  descartada: "bg-gray-100 text-[#1C2230]",
};

export const EVENTO_LABEL: Record<string, string> = {
  sincronizada: "Llegó desde el centro",
  etapa: "Cambio de etapa",
  nota: "Nota",
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  mail_enviado: "Mail enviado",
  respuesta: "Respondió",
  registrada: "Se registró en BBJobs",
  baja: "Pidió no recibir más mails",
};

export const MOTIVO_LABEL: Record<string, string> = {
  competencia: "consultoras de RRHH",
  duplicada: "duplicadas",
  sin_identificador: "sin datos mínimos",
};

/** Parámetros de query sin los vacíos (axios mandaría "undefined"). */
export function aParams(f: Filtro): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === "" || v === false) continue;
    out[k] = String(v);
  }
  return out;
}

/** El mismo filtro como cuerpo JSON (selección "todas las que cumplen" en POST). */
export function aCuerpo(f: Filtro): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  if (f.q) out.q = f.q;
  if (f.category) out.category = f.category;
  if (f.locality) out.locality = f.locality;
  if (f.stage) out.stage = f.stage;
  if (f.has_email) out.has_email = f.has_email === "true";
  if (f.has_whatsapp) out.has_whatsapp = true;
  if (f.never_contacted) out.never_contacted = true;
  return out;
}

export function fecha(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("es-AR") : "—";
}
