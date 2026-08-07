"use client";

/**
 * Gráficos de las estadísticas de postulantes.
 *
 * En SVG y CSS a mano, sin librería: son barras y donas simples y una dependencia de charts
 * pesa más que todo esto junto.
 *
 * `destacado` es la razón de ser del componente en la vista del candidato: pinta con otro
 * color la franja donde está esa persona, para que se lea "acá estoy yo, ahí están los demás"
 * — que fue exactamente lo que pidió Eugenia.
 */

export interface Bucket {
  label: string;
  count: number;
  percent: number;
}

const TEAL = "#1E8EA3";
const TEAL_CLARO = "#9ED4DF";
const DESTACADO = "#D4B7A2";
const BORDE = "#EEF2F7";

interface BarrasProps {
  titulo: string;
  buckets: Bucket[];
  /** Etiqueta de la franja propia del candidato. Si viene, esa barra va en otro color. */
  destacado?: string | null;
  nota?: string;
}

export function BarrasHorizontales({ titulo, buckets, destacado, nota }: BarrasProps) {
  const maximo = Math.max(...buckets.map(b => b.count), 1);
  const hayDatos = buckets.some(b => b.count > 0);

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#1C2230] mb-4">{titulo}</h3>
      {!hayDatos ? (
        <p className="text-xs text-[#64748B]">Todavía no hay datos suficientes.</p>
      ) : (
        <div className="space-y-2.5">
          {buckets.map(b => {
            const esMio = !!destacado && b.label === destacado;
            return (
              <div key={b.label} className="flex items-center gap-3">
                <span className={`text-xs w-32 shrink-0 ${esMio ? "font-bold text-[#8A6A54]" : "text-[#64748B]"}`}>
                  {b.label}
                </span>
                <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: BORDE }}>
                  <div
                    className="h-full rounded-md transition-[width] duration-500"
                    style={{
                      width: `${(b.count / maximo) * 100}%`,
                      background: esMio ? DESTACADO : TEAL,
                      minWidth: b.count > 0 ? "0.5rem" : 0,
                    }}
                  />
                </div>
                <span className={`text-xs w-14 text-right shrink-0 ${esMio ? "font-bold text-[#8A6A54]" : "text-[#1C2230]"}`}>
                  {b.count} · {b.percent}%
                </span>
              </div>
            );
          })}
        </div>
      )}
      {destacado && hayDatos && (
        <p className="text-[11px] text-[#8A6A54] mt-3 flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: DESTACADO }} />
          Acá estás vos
        </p>
      )}
      {nota && <p className="text-[11px] text-[#64748B] mt-3">{nota}</p>}
    </div>
  );
}

interface DonaProps {
  titulo: string;
  buckets: Bucket[];
  destacado?: string | null;
  nota?: string;
}

/** Paleta para las porciones, del más oscuro al más claro. */
const PALETA = ["#1E8EA3", "#3EA3B6", "#6BBBCA", "#9ED4DF", "#C6E6EC", "#E6F4F7"];

export function Dona({ titulo, buckets, destacado, nota }: DonaProps) {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const conDatos = buckets.filter(b => b.count > 0);

  // Circunferencia de un radio 60 — la dona se dibuja con stroke-dasharray sobre un solo
  // círculo, girando el offset por cada porción. Evita tener que calcular paths de arcos.
  const RADIO = 60;
  const CIRC = 2 * Math.PI * RADIO;

  // Los tramos se calculan antes del render, no mutando un acumulador dentro del .map():
  // el compilador de React rechaza esa reasignación, y con razón — si el componente se
  // re-renderiza a mitad de camino, el offset queda corrido.
  const tramos = conDatos.reduce<{ b: Bucket; porcion: number; offset: number }[]>((acc, b) => {
    const porcion = (b.count / total) * CIRC;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].porcion : 0;
    acc.push({ b, porcion, offset });
    return acc;
  }, []);

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#1C2230] mb-4">{titulo}</h3>
      {total === 0 ? (
        <p className="text-xs text-[#64748B]">Todavía no hay datos suficientes.</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0 -rotate-90">
            <circle cx="80" cy="80" r={RADIO} fill="none" stroke={BORDE} strokeWidth="22" />
            {tramos.map(({ b, porcion, offset }, i) => {
              const esMio = !!destacado && b.label === destacado;
              return (
                <circle
                  key={b.label}
                  cx="80" cy="80" r={RADIO}
                  fill="none"
                  stroke={esMio ? DESTACADO : PALETA[i % PALETA.length]}
                  strokeWidth="22"
                  strokeDasharray={`${porcion} ${CIRC - porcion}`}
                  strokeDashoffset={-offset}
                />
              );
            })}
          </svg>

          <ul className="flex-1 space-y-1.5 w-full">
            {conDatos.map((b, i) => {
              const esMio = !!destacado && b.label === destacado;
              return (
                <li key={b.label} className="flex items-center gap-2 text-xs">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: esMio ? DESTACADO : PALETA[i % PALETA.length] }}
                  />
                  <span className={`flex-1 truncate ${esMio ? "font-bold text-[#8A6A54]" : "text-[#64748B]"}`}>
                    {b.label}{esMio && " — vos"}
                  </span>
                  <span className="text-[#1C2230] font-medium shrink-0">{b.percent}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {nota && <p className="text-[11px] text-[#64748B] mt-3">{nota}</p>}
    </div>
  );
}

interface AnillosProps {
  titulo: string;
  buckets: Bucket[];
  /** Habilidades del candidato — las suyas se marcan distinto. */
  propias?: string[];
  nota?: string;
}

/** Los anillos de porcentaje que usa Bumeran para "conocimientos y habilidades destacados". */
export function AnillosDePorcentaje({ titulo, buckets, propias = [], nota }: AnillosProps) {
  const RADIO = 26;
  const CIRC = 2 * Math.PI * RADIO;

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#1C2230] mb-4">{titulo}</h3>
      {buckets.length === 0 ? (
        <p className="text-xs text-[#64748B]">Ningún postulante cargó habilidades todavía.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {buckets.map(b => {
            const esMia = propias.includes(b.label);
            const color = esMia ? DESTACADO : TEAL;
            return (
              <div key={b.label} className="flex flex-col items-center text-center">
                <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                  <circle cx="32" cy="32" r={RADIO} fill="none" stroke={BORDE} strokeWidth="8" />
                  <circle
                    cx="32" cy="32" r={RADIO}
                    fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(b.percent / 100) * CIRC} ${CIRC}`}
                  />
                  <text
                    x="32" y="32" textAnchor="middle" dominantBaseline="central"
                    className="rotate-90 origin-center"
                    style={{ fontSize: 15, fontWeight: 700, fill: "#1C2230" }}
                  >
                    {Math.round(b.percent)}%
                  </text>
                </svg>
                <span className={`text-[11px] mt-1.5 leading-tight ${esMia ? "font-bold text-[#8A6A54]" : "text-[#64748B]"}`}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {propias.length > 0 && buckets.length > 0 && (
        <p className="text-[11px] text-[#8A6A54] mt-4 flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: DESTACADO }} />
          Las que vos declaraste
        </p>
      )}
      {nota && <p className="text-[11px] text-[#64748B] mt-3">{nota}</p>}
    </div>
  );
}

interface TarjetaProps {
  valor: string;
  etiqueta: string;
  detalle?: string;
}

export function TarjetaDato({ valor, etiqueta, detalle }: TarjetaProps) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl px-5 py-4">
      <p className="text-2xl font-display font-extrabold" style={{ color: TEAL }}>{valor}</p>
      <p className="text-xs font-bold text-[#1C2230] mt-0.5">{etiqueta}</p>
      {detalle && <p className="text-[11px] text-[#64748B] mt-0.5">{detalle}</p>}
    </div>
  );
}

export const COLORES_GRAFICO = { TEAL, TEAL_CLARO, DESTACADO };
