"use client";

/**
 * Piezas visuales de las recomendaciones, compartidas por el panel de la empresa y el Centro de
 * IA de Talency: el anillo de puntaje y la barra de requisitos. La idea (Gael, 28/10/2026): que se
 * entienda de un vistazo, sin leer.
 */

export type Veredicto = "si" | "parcial" | "no" | "sin_datos";

export interface Nivel { label: string; color: string; fondo: string; texto: string }

export function nivel(score: number): Nivel {
  if (score >= 80) return { label: "Encaja muy bien", color: "#1E8EA3", fondo: "#E6F4F7", texto: "#0F5E6C" };
  if (score >= 70) return { label: "Encaja", color: "#5FB4C6", fondo: "#EEF7F9", texto: "#145A67" };
  return { label: "Encaja poco", color: "#D4B7A2", fondo: "#F7EFE9", texto: "#5C3B22" };
}

export function PuntajeAnillo({ score, size = 56 }: { score: number; size?: number }) {
  const n = nivel(score);
  const grosor = size >= 72 ? 7 : 5;
  const r = (size - grosor) / 2;
  const total = 2 * Math.PI * r;
  const lleno = total * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Puntaje ${score} de 100: ${n.label}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F7" strokeWidth={grosor} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={n.color} strokeWidth={grosor} strokeLinecap="round"
                strokeDasharray={total} strokeDashoffset={lleno} className="anillo-llena"
                style={{ ["--anillo-total" as string]: `${total}` }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display font-extrabold text-[#1C2230]"
            style={{ fontSize: size * 0.32 }}>
        {score}
      </span>
    </div>
  );
}

export function NivelChip({ score }: { score: number }) {
  const n = nivel(score);
  return (
    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: n.fondo, color: n.texto }}>
      {n.label}
    </span>
  );
}

const SEGMENTO: Record<Veredicto, { color: string; label: string }> = {
  si: { color: "#1E8EA3", label: "Cumple" },
  parcial: { color: "#D4B7A2", label: "En parte" },
  no: { color: "#E7A5A5", label: "No cumple" },
  sin_datos: { color: "#DDE3EC", label: "Sin datos" },
};

/** Un segmento por requisito, en el orden del aviso; al pasar el mouse dice cuál es. */
export function RequisitosBarra({ evaluaciones, texto }: {
  evaluaciones: { req_id: string; verdict: Veredicto }[];
  texto: (id: string) => string;
}) {
  if (evaluaciones.length === 0) return null;
  const cumple = evaluaciones.filter(e => e.verdict === "si").length;
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex gap-[2px] w-full max-w-[180px]" aria-hidden>
        {evaluaciones.map(e => {
          const s = SEGMENTO[e.verdict] ?? SEGMENTO.sin_datos;
          return <span key={e.req_id} title={`${texto(e.req_id)}: ${s.label}`} className="h-2 flex-1 rounded-full" style={{ background: s.color }} />;
        })}
      </div>
      <span className="text-xs font-bold text-[#1C2230] whitespace-nowrap">
        Cumple {cumple} de {evaluaciones.length}
      </span>
    </div>
  );
}

export const VEREDICTO_DETALLE: Record<Veredicto, { simbolo: string; label: string; color: string }> = {
  si: { simbolo: "✓", label: "Cumple", color: "#0F5E6C" },
  parcial: { simbolo: "~", label: "En parte", color: "#5C3B22" },
  no: { simbolo: "✗", label: "No cumple", color: "#991B1B" },
  sin_datos: { simbolo: "—", label: "Sin datos", color: "#1C2230" },
};
