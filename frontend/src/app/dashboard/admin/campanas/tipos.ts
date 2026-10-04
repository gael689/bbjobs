export type Destino = "users" | "prospects";

export interface Seguimiento {
  after_days: number;
  subject: string;
  body: string;
}

export interface Campana {
  id: string;
  name: string;
  target: Destino;
  audience_key: string | null;
  product: string | null;
  subject: string;
  preheader: string | null;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  follow_ups: Seguimiento[];
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipients_total: number;
  generated_by_ai: boolean;
  stats?: Record<string, number> | null;
}

export interface Audiencia {
  key: string;
  label: string;
  role: string;
  product: string;
  recipients: number;
}

export interface Opcion {
  id: string;
  name: string;
}

export const PRODUCTOS: Record<string, string> = {
  portal: "Conocer el portal",
  cv_review: "Revisión de CV",
  destacar: "Destacar una búsqueda",
  pack_talento: "Pack de la Base de Talento",
  seleccion_personal: "Selección de personal",
  publicar: "Publicar una búsqueda",
};

export const ESTADOS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-[#F1F5F9] text-[#1C2230]" },
  scheduled: { label: "Programada", cls: "bg-[#E6F4F7] text-[#187B8E]" },
  sending: { label: "Enviándose", cls: "bg-yellow-100 text-yellow-900" },
  sent: { label: "Enviada", cls: "bg-green-100 text-green-800" },
  canceled: { label: "Cancelada", cls: "bg-red-50 text-red-700" },
};

export const ETIQUETAS_STATS: Record<string, string> = {
  encolados: "En cola",
  enviados: "Enviados",
  entregados: "Entregados",
  abiertos: "Abiertos",
  clics: "Clics",
  rebotes: "Rebotes",
  quejas: "Quejas",
  conversiones: "Conversiones (14 días)",
};

export const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—";
