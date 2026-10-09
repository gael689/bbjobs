"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowTrendingDownIcon, ArrowTrendingUpIcon, MagnifyingGlassIcon, InformationCircleIcon,
} from "@heroicons/react/24/outline";

// Pantalla "Métricas del sitio" del panel de admin. Sólo presentación: los datos llegan armados
// desde GET /admin/metrics (backend/app/services/site_metrics.py).
// Gráficos en CSS/SVG, una sola tinta (teal de la marca) porque cada gráfico es una sola serie;
// el texto siempre en #1C2230 (contraste pleno), nunca en el color de la barra.

export type Periodo = 7 | 30 | 90;

type Totales = {
  visitas: number; visitantes: number; busquedas: number; avisos_vistos: number;
  postulaciones: number; registros: number; contactos: number; publicaciones: number;
};

export interface MetricasReporte {
  dias: number;
  desde: string;
  hasta: string;
  datos_desde: string | null;
  totales: Totales;
  totales_anteriores: Totales;
  registros_por_tipo: Record<string, number>;
  serie: { fecha: string; visitas: number; visitantes: number }[];
  origenes: { origen: string; visitas: number }[];
  dispositivos: { dispositivo: string; visitas: number }[];
  paginas: { path: string; fichas: boolean; visitas: number }[];
  busquedas: { termino: string; veces: number; resultados_promedio: number | null }[];
  busquedas_sin_resultados: { termino: string; veces: number }[];
  avisos: {
    job_id: string; titulo: string | null; empresa: string | null; estado: string | null;
    vistas: number; postulaciones: number; conversion: number | null;
  }[];
  embudo: { visitantes: number; vieron_aviso: number; se_postularon: number };
}

const TEAL = "#1E8EA3";

const ORIGENES: Record<string, string> = {
  google: "Google",
  bing: "Bing",
  redes: "Redes sociales y WhatsApp",
  ia: "Asistentes de IA (ChatGPT, Gemini…)",
  directo: "Directo (link guardado o escrito)",
  otro: "Otros sitios",
};

const PAGINAS: Record<string, string> = {
  "/": "Inicio",
  "/empleos": "Buscador de empleos",
  "/empresas": "Empresas",
  "/contacto": "Contacto",
  "/nosotros": "Nosotros",
  "/planes": "Planes",
  "/register": "Registro",
  "/login": "Ingresar",
  "/onboarding": "Completar registro",
};

const nf = new Intl.NumberFormat("es-AR");
const n = (v: number) => nf.format(v);
const pct = (v: number) => `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(v * 100)}%`;

function fechaCorta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

function fechaLarga(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-AR", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}

function Card({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm min-w-0 ${className}`}>
      <h2 className="font-display font-bold text-[#1C2230] text-base">{title}</h2>
      {subtitle && <p className="text-xs text-[#1C2230] mt-0.5 mb-4 leading-relaxed">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Variacion({ actual, anterior, dias }: { actual: number; anterior: number; dias: number }) {
  if (anterior === 0) {
    return <p className="text-xs text-[#1C2230] mt-2">{actual > 0 ? "Sin datos del período anterior" : "—"}</p>;
  }
  const delta = (actual - anterior) / anterior;
  const igual = Math.abs(delta) < 0.005;
  const sube = delta > 0;
  const Icon = sube ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
  return (
    <p className={`text-xs font-semibold mt-2 flex items-center gap-1 ${igual ? "text-[#1C2230]" : sube ? "text-green-800" : "text-red-800"}`}>
      {!igual && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />}
      <span>
        {igual ? "Igual" : `${sube ? "+" : "−"}${pct(Math.abs(delta))}`}
        <span className="font-normal text-[#1C2230]"> vs. {dias} días anteriores ({n(anterior)})</span>
      </span>
    </p>
  );
}

function Kpi({ label, valor, anterior, dias, detalle }: {
  label: string; valor: number; anterior: number; dias: number; detalle?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm min-w-0">
      <p className="text-sm font-semibold text-[#1C2230]">{label}</p>
      <p className="text-3xl font-display font-extrabold text-[#1C2230] mt-1 tabular-nums">{n(valor)}</p>
      {detalle && <p className="text-xs text-[#1C2230] mt-1">{detalle}</p>}
      <Variacion actual={valor} anterior={anterior} dias={dias} />
    </div>
  );
}

/** Columnas de visitas por día, con tooltip al pasar el mouse (o tocar) y vista de tabla. */
function VisitasPorDia({ serie }: { serie: MetricasReporte["serie"] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map(d => d.visitas));
  const tope = niceMax(max);
  const punto = activo !== null ? serie[activo] : null;
  const medio = Math.floor((serie.length - 1) / 2);

  return (
    <div>
      <div className="relative">
        {/* Grilla: 0, mitad y tope. Recesiva. */}
        <div className="absolute inset-0 bottom-6 flex flex-col justify-between pointer-events-none" aria-hidden>
          {[tope, tope / 2, 0].map(v => (
            <div key={v} className="flex items-center gap-2">
              <span className="w-8 text-right text-[11px] text-[#1C2230] tabular-nums">{n(v)}</span>
              <div className="flex-1 border-t border-[#EEF1F6]" />
            </div>
          ))}
        </div>
        <div
          className="relative ml-10 h-48 flex items-end"
          style={{ gap: serie.length > 45 ? 1 : 2 }}
          onMouseLeave={() => setActivo(null)}
          role="img"
          aria-label={`Visitas por día: ${serie.map(d => `${fechaCorta(d.fecha)} ${d.visitas}`).join(", ")}`}
        >
          {serie.map((d, i) => (
            <button
              type="button"
              key={d.fecha}
              className="flex-1 h-full flex items-end min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8EA3] rounded-sm"
              onMouseEnter={() => setActivo(i)}
              onFocus={() => setActivo(i)}
              onClick={() => setActivo(i)}
              aria-label={`${fechaLarga(d.fecha)}: ${d.visitas} visitas, ${d.visitantes} visitantes`}
            >
              <span
                className="block w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: d.visitas ? `${Math.max(2, (d.visitas / tope) * 100)}%` : 0,
                  background: TEAL,
                  opacity: activo === null || activo === i ? 1 : 0.45,
                }}
              />
            </button>
          ))}
          {punto && activo !== null && (
            <div
              className="absolute -top-2 z-10 pointer-events-none bg-[#1C2230] text-white rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap"
              style={{
                left: `${((activo + 0.5) / serie.length) * 100}%`,
                transform: `translate(${activo < serie.length / 4 ? "-10%" : activo > (serie.length * 3) / 4 ? "-90%" : "-50%"}, -100%)`,
              }}
            >
              <p className="font-bold capitalize">{fechaLarga(punto.fecha)}</p>
              <p className="tabular-nums">{n(punto.visitas)} visitas · {n(punto.visitantes)} visitantes</p>
            </div>
          )}
        </div>
        <div className="ml-10 mt-1 h-5 flex justify-between text-[11px] text-[#1C2230] tabular-nums" aria-hidden>
          <span>{fechaCorta(serie[0].fecha)}</span>
          {serie.length > 2 && <span>{fechaCorta(serie[medio].fecha)}</span>}
          <span>{fechaCorta(serie[serie.length - 1].fecha)}</span>
        </div>
      </div>
      <details className="mt-3 text-sm text-[#1C2230]">
        <summary className="cursor-pointer font-semibold text-[#187B8E] hover:underline">Ver como tabla</summary>
        <div className="max-h-64 overflow-auto mt-2 border border-[#DDE3EC] rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAFBFD] sticky top-0">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-bold">Día</th>
                <th scope="col" className="px-3 py-1.5 font-bold text-right">Visitas</th>
                <th scope="col" className="px-3 py-1.5 font-bold text-right">Visitantes</th>
              </tr>
            </thead>
            <tbody>
              {[...serie].reverse().map(d => (
                <tr key={d.fecha} className="border-t border-[#EEF1F6]">
                  <td className="px-3 py-1 capitalize">{fechaLarga(d.fecha)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(d.visitas)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{n(d.visitantes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Barras horizontales con el valor escrito al lado: identidad por texto, no por color. */
function Barras({ filas, total }: { filas: { label: React.ReactNode; valor: number; key: string }[]; total?: number }) {
  const max = Math.max(1, ...filas.map(f => f.valor));
  const suma = total ?? filas.reduce((s, f) => s + f.valor, 0);
  return (
    <ul className="space-y-3">
      {filas.map(f => (
        <li key={f.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm text-[#1C2230]">
            <span className="min-w-0 truncate">{f.label}</span>
            <span className="shrink-0 tabular-nums font-semibold">
              {n(f.valor)}
              {suma > 0 && <span className="font-normal"> · {pct(f.valor / suma)}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#EEF1F6]">
            <div className="h-2 rounded-full" style={{ width: `${(f.valor / max) * 100}%`, background: TEAL }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="text-sm text-[#1C2230]">{texto}</p>;
}

function Embudo({ e }: { e: MetricasReporte["embudo"] }) {
  const pasos = [
    { label: "Visitaron el sitio", valor: e.visitantes, previo: null as number | null },
    { label: "Abrieron al menos un aviso", valor: e.vieron_aviso, previo: e.visitantes },
    { label: "Se postularon", valor: e.se_postularon, previo: e.vieron_aviso },
  ];
  const max = Math.max(1, e.visitantes);
  return (
    <ol className="space-y-3">
      {pasos.map((p, i) => (
        <li key={p.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm text-[#1C2230]">
            <span><span className="font-bold">{i + 1}.</span> {p.label}</span>
            <span className="tabular-nums font-semibold shrink-0">
              {n(p.valor)}
              {p.previo !== null && p.previo > 0 && <span className="font-normal"> · {pct(p.valor / p.previo)} del paso anterior</span>}
            </span>
          </div>
          <div className="mt-1 h-7 rounded-md bg-[#EEF1F6]">
            <div className="h-7 rounded-md" style={{ width: `${Math.max(p.valor ? 1.5 : 0, (p.valor / max) * 100)}%`, background: TEAL }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function MetricasSitio({ data, dias, onDias, cargando, error }: {
  data: MetricasReporte | null;
  dias: Periodo;
  onDias: (d: Periodo) => void;
  cargando?: boolean;
  error?: boolean;
}) {
  const t = data?.totales;
  const a = data?.totales_anteriores;
  const sinDatos = !!data && !data.datos_desde;

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold text-[#1C2230]">Métricas del sitio</h1>
          <p className="text-sm text-[#1C2230] mt-1 max-w-2xl leading-relaxed">
            Medición propia de BBJobs: visitas, búsquedas y avisos del sitio público. Sólo cuenta a quienes
            aceptaron la medición en el aviso de cookies, y no guarda datos personales.
          </p>
        </div>
        <div role="radiogroup" aria-label="Período" className="inline-flex shrink-0 self-start sm:self-auto rounded-xl border border-[#DDE3EC] bg-white p-1">
          {([7, 30, 90] as Periodo[]).map(d => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dias === d}
              onClick={() => onDias(d)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                dias === d ? "bg-[#1E8EA3] text-white" : "text-[#1C2230] hover:bg-[#E6F4F7]"
              }`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-900 rounded-xl px-4 py-3 text-sm mb-6">
          No se pudieron cargar las métricas. Probá de nuevo en un rato.
        </div>
      )}

      {!data && cargando && <p className="text-sm text-[#1C2230]">Cargando métricas…</p>}

      {sinDatos && (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-center shadow-sm">
          <InformationCircleIcon className="w-8 h-8 mx-auto text-[#1E8EA3]" aria-hidden />
          <p className="mt-3 font-display font-bold text-[#1C2230]">Todavía no hay datos</p>
          <p className="mt-1 text-sm text-[#1C2230] max-w-md mx-auto leading-relaxed">
            Se empiezan a juntar cuando los visitantes aceptan la medición en el aviso de cookies. Volvé a mirar en
            unos días.
          </p>
        </div>
      )}

      {data && t && a && !sinDatos && (
        <div className={`space-y-6 transition-opacity ${cargando ? "opacity-60" : ""}`} aria-busy={cargando}>
          <p className="text-xs text-[#1C2230]">
            Del {fechaLarga(data.desde)} al {fechaLarga(data.hasta)} (hora de Argentina) · datos desde el{" "}
            {fechaLarga(data.datos_desde!)}. Los registros se guardan 13 meses.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Kpi label="Visitas (páginas vistas)" valor={t.visitas} anterior={a.visitas} dias={data.dias} />
            <Kpi label="Visitantes únicos" valor={t.visitantes} anterior={a.visitantes} dias={data.dias}
              detalle="Sólo quienes aceptaron la medición" />
            <Kpi label="Búsquedas" valor={t.busquedas} anterior={a.busquedas} dias={data.dias} />
            <Kpi label="Avisos vistos" valor={t.avisos_vistos} anterior={a.avisos_vistos} dias={data.dias} />
            <Kpi label="Postulaciones" valor={t.postulaciones} anterior={a.postulaciones} dias={data.dias}
              detalle="Desde el sitio, de quienes aceptaron" />
            <Kpi label="Registros" valor={t.registros} anterior={a.registros} dias={data.dias}
              detalle={t.registros ? `${n(data.registros_por_tipo.candidato ?? 0)} candidatos · ${n(data.registros_por_tipo.empresa ?? 0)} empresas` : undefined} />
            <Kpi label="Mensajes de contacto" valor={t.contactos} anterior={a.contactos} dias={data.dias} />
            <Kpi label="Búsquedas publicadas" valor={t.publicaciones} anterior={a.publicaciones} dias={data.dias} />
          </div>

          <Card title="Visitas por día" subtitle="Páginas vistas del sitio público. Pasá el mouse (o tocá) una barra para ver el día.">
            <VisitasPorDia serie={data.serie} />
          </Card>

          {/* Lo más accionable para Talency: qué se busca y no está publicado. */}
          <section className="rounded-2xl border-2 border-[#D4B7A2] bg-[#FBF6F2] p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <MagnifyingGlassIcon className="w-6 h-6 text-[#1C2230] shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="font-display font-bold text-[#1C2230] text-lg">Lo que la gente busca y no encuentra</h2>
                <p className="text-sm text-[#1C2230] mt-0.5 mb-4 leading-relaxed">
                  Búsquedas en /empleos que dieron cero resultados. Es la lista de lo que falta publicar o de
                  palabras que conviene sumar a los avisos.
                </p>
                {data.busquedas_sin_resultados.length === 0 ? (
                  <Vacio texto="En este período todas las búsquedas encontraron al menos un aviso." />
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {data.busquedas_sin_resultados.map(b => (
                      <li key={b.termino} className="inline-flex items-center gap-2 rounded-full bg-white border border-[#D4B7A2] px-3 py-1.5 text-sm text-[#1C2230]">
                        <span className="font-semibold">{b.termino}</span>
                        <span className="tabular-nums text-xs font-bold bg-[#F3E9E1] rounded-full px-2 py-0.5">
                          {n(b.veces)} {b.veces === 1 ? "vez" : "veces"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Cómo llegan" subtitle="Entradas al sitio según de dónde venían. No cuenta las navegaciones dentro de BBJobs.">
              {data.origenes.length === 0 ? <Vacio texto="Sin entradas en este período." /> : (
                <Barras filas={data.origenes.map(o => ({ key: o.origen, label: ORIGENES[o.origen] ?? o.origen, valor: o.visitas }))} />
              )}
            </Card>
            <Card title="Dispositivos" subtitle="Páginas vistas desde celular y desde computadora.">
              {data.dispositivos.length === 0 ? <Vacio texto="Sin visitas en este período." /> : (
                <Barras filas={data.dispositivos.map(d => ({
                  key: d.dispositivo, label: d.dispositivo === "mobile" ? "Celular o tablet" : "Computadora", valor: d.visitas,
                }))} />
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Páginas más vistas" subtitle="Las fichas de cada aviso se suman en una sola fila; el detalle está en “Avisos más vistos”.">
              {data.paginas.length === 0 ? <Vacio texto="Sin visitas en este período." /> : (
                <Barras
                  total={t.visitas}
                  filas={data.paginas.map(p => ({
                    key: p.path,
                    valor: p.visitas,
                    label: p.fichas ? <strong>Fichas de empleo (todas)</strong> : (
                      <span>{PAGINAS[p.path] ?? <span className="font-mono text-xs">{p.path}</span>}
                        {PAGINAS[p.path] && <span className="font-mono text-xs"> {p.path}</span>}</span>
                    ),
                  }))}
                />
              )}
            </Card>
            <Card title="Búsquedas más hechas" subtitle="Lo que más se escribe en el buscador, sin tildes ni mayúsculas.">
              {data.busquedas.length === 0 ? <Vacio texto="Nadie usó el buscador en este período." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-[#1C2230]">
                    <thead>
                      <tr className="border-b border-[#DDE3EC]">
                        <th scope="col" className="py-1.5 pr-3 font-bold">Búsqueda</th>
                        <th scope="col" className="py-1.5 px-3 font-bold text-right">Veces</th>
                        <th scope="col" className="py-1.5 pl-3 font-bold text-right">Resultados (prom.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.busquedas.map(b => (
                        <tr key={b.termino} className="border-b border-[#EEF1F6] last:border-0">
                          <td className="py-1.5 pr-3 font-semibold break-words">{b.termino}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums">{n(b.veces)}</td>
                          <td className={`py-1.5 pl-3 text-right tabular-nums ${b.resultados_promedio === 0 ? "font-bold text-red-800" : ""}`}>
                            {b.resultados_promedio === null ? "—" : b.resultados_promedio === 0 ? "0 (ninguno)" : n(b.resultados_promedio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card
            title="Avisos más vistos"
            subtitle="Vistas medidas en el período y postulaciones reales que recibió cada aviso en esas mismas fechas. Como las postulaciones incluyen a quienes no aceptaron la medición, la conversión puede pasar el 100%."
          >
            {data.avisos.length === 0 ? <Vacio texto="Ningún aviso fue abierto en este período." /> : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[560px] text-sm text-left text-[#1C2230]">
                  <thead>
                    <tr className="border-b border-[#DDE3EC]">
                      <th scope="col" className="py-2 px-1 font-bold">Aviso</th>
                      <th scope="col" className="py-2 px-2 font-bold text-right">Vistas</th>
                      <th scope="col" className="py-2 px-2 font-bold text-right">Postulaciones</th>
                      <th scope="col" className="py-2 px-1 font-bold text-right">Conversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.avisos.map(av => (
                      <tr key={av.job_id} className="border-b border-[#EEF1F6] last:border-0 align-top">
                        <td className="py-2 px-1">
                          {av.titulo ? (
                            <Link href={`/empleos/${av.job_id}`} className="font-semibold text-[#187B8E] hover:underline">{av.titulo}</Link>
                          ) : <span className="font-semibold">Aviso borrado</span>}
                          {av.empresa && <span className="block text-xs">{av.empresa}{av.estado && av.estado !== "active" ? " · ya no está activo" : ""}</span>}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{n(av.vistas)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{n(av.postulaciones)}</td>
                        <td className="py-2 px-1 text-right tabular-nums font-semibold">{av.conversion === null ? "—" : pct(av.conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Embudo" subtitle="Visitantes únicos que llegaron a cada paso en el período (sólo quienes aceptaron la medición).">
            <Embudo e={data.embudo} />
          </Card>
        </div>
      )}
    </div>
  );
}
