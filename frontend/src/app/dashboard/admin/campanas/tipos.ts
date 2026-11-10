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

/**
 * Mail de presentación a empresas (prospección), listo para usar. Texto plano, institucional, sin
 * firma con logo: sale como un mail escrito a mano (igual que la presentación de MBK). Sólo dice lo
 * que BBJobs ya publica de sí mismo (portal de Talency, empresas verificadas a mano, publicar es
 * gratis, cómo es la selección) y nada del negocio del otro: el rubro viene de Google y suele estar
 * mal. El link de baja lo agrega el sistema al pie. Los seguimientos cuentan desde el mail anterior.
 */
export const PLANTILLA_PROSPECCION = {
  nombre: "Presentación de BBJobs y Talency",
  producto: "seleccion_personal",
  asunto: "BBJobs, el portal de empleos de Bahía Blanca",
  cuerpo: `Hola, ¿cómo están?

Les escribimos desde Talency, la consultora de recursos humanos de Bahía Blanca que lleva adelante BBJobs, el portal de empleos de Bahía Blanca y la región.

En BBJobs las empresas publican sus búsquedas gratis y reciben postulaciones de candidatos de la zona. Cada empresa se verifica a mano antes de publicar, así quien se postula sabe que el aviso es real.

Si prefieren delegar la búsqueda, en Talency hacemos la selección completa: definimos el perfil con ustedes, publicamos, filtramos, entrevistamos y les presentamos a los candidatos que mejor encajan.

Pueden conocer el portal acá: https://www.bbjobs.com.ar/publicar-empleo

Cuando necesiten sumar a alguien al equipo, respondan este mail y lo vemos juntos.

Saludos,
Equipo de Talency
BBJobs · www.bbjobs.com.ar`,
  seguimientos: [
    {
      after_days: 7,
      subject: "Re: BBJobs, el portal de empleos de Bahía Blanca",
      body: `Hola, ¿cómo va?

Les escribimos la semana pasada para contarles de BBJobs. Por si les sirve, publicar una búsqueda es gratis: https://www.bbjobs.com.ar/publicar-empleo

Y si prefieren que nos ocupemos de toda la búsqueda, así trabajamos la selección de personal: https://www.bbjobs.com.ar/seleccion-de-personal

Saludos,
Equipo de Talency`,
    },
    {
      after_days: 14,
      subject: "Re: BBJobs, el portal de empleos de Bahía Blanca",
      body: `Hola,

Les escribimos por última vez, no queremos llenarles la casilla. Cuando necesiten sumar a alguien al equipo, nos encuentran respondiendo este mail o en www.bbjobs.com.ar.

¡Éxitos!
Equipo de Talency`,
    },
  ] as Seguimiento[],
};
