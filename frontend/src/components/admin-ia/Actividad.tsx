"use client";

import { useState } from "react";
import {
  ExclamationTriangleIcon, DocumentTextIcon, ArrowPathIcon, ChatBubbleBottomCenterTextIcon, ShieldCheckIcon,
  TagIcon, PencilSquareIcon, MegaphoneIcon, HandRaisedIcon, MagnifyingGlassIcon, BellAlertIcon, SparklesIcon,
} from "@heroicons/react/24/outline";
import { useListaPaginada } from "@/hooks/useListaPaginada";
import Paginacion from "@/components/ui/Paginacion";
import { MOTIVOS, Spinner, usd, useFichaCandidato, type ItemActividad, type ResumenActividad, type Totales } from "./comun";

const TIPOS: { clave: string; label: string; icono: typeof DocumentTextIcon }[] = [
  { clave: "cv_lectura", label: "Lecturas de CV", icono: DocumentTextIcon },
  { clave: "recalculo", label: "Recálculos de recomendados", icono: ArrowPathIcon },
  { clave: "resumen", label: "Resúmenes de candidatos", icono: ChatBubbleBottomCenterTextIcon },
  { clave: "moderacion", label: "Revisiones de moderación", icono: ShieldCheckIcon },
  { clave: "habilidades", label: "Sugerencias de habilidades", icono: TagIcon },
  { clave: "redaccion", label: "Redacción de búsquedas", icono: PencilSquareIcon },
  { clave: "campana", label: "Borradores de campaña", icono: MegaphoneIcon },
  { clave: "aviso_empresa", label: "Avisos a empresas", icono: BellAlertIcon },
  { clave: "busqueda", label: "Buscador inteligente", icono: MagnifyingGlassIcon },
  { clave: "manual", label: "Lanzado por Talency", icono: HandRaisedIcon },
];

const n = (v: unknown) => (typeof v === "number" ? v : 0);
const plural = (k: number, uno: string, varios: string) => `${k} ${k === 1 ? uno : varios}`;

const ACCIONES: Record<string, string> = {
  recalcular_busqueda: "Talency pidió recalcular esta búsqueda.",
  recalcular_todas: "Talency pidió recalcular todas las búsquedas activas",
  revisar_pendientes: "Talency pidió revisar duplicados y sector de las pendientes",
  releer_cv: "Talency pidió releer el CV de un candidato.",
  borrador_mensual: "Talency pidió el borrador de novedades del mes.",
};

/** Qué hizo la IA, en castellano y sin jerga. Sólo con ids y conteos: el registro no guarda textos. */
function describir(i: ItemActividad): string {
  const d = i.detail;
  switch (i.kind) {
    case "cv_lectura": {
      if (d.estado === "ok") {
        const base = `Leyó y anonimizó un CV (tapó ${plural(n(d.datos_tapados), "dato personal", "datos personales")}).`;
        return n(d.fugas) > 0 ? `${base} Quedaron ${plural(n(d.fugas), "dato", "datos")} de la persona sin tapar: revisá el CV.` : base;
      }
      if (d.estado === "scanned") return "El CV es una imagen escaneada: no se pudo leer el texto.";
      if (d.estado === "failed") return "No pudo leer el CV (no se descargó o tardó demasiado).";
      return `No pudo leer el CV (${String(d.estado ?? "formato no soportado")}).`;
    }
    case "recalculo": {
      const motivo = MOTIVOS[String(d.motivo)] ?? String(d.motivo ?? "");
      let t = `Recalculó los recomendados (${motivo}): ${plural(n(d.candidatos), "candidato", "candidatos")} mirados, ${n(d.reranks)} evaluados con IA`;
      if (n(d.reutilizados)) t += `, ${n(d.reutilizados)} sin cambios`;
      if (n(d.fallidos)) t += `, ${n(d.fallidos)} con error`;
      return t + (n(d.tope) ? ". Llegó al tope de la vuelta: sigue en la próxima." : ".");
    }
    case "resumen": {
      const quien = MOTIVOS[String(d.origen)] ?? String(d.origen ?? "");
      let t = `Armó un resumen de ${plural(n(d.lineas), "línea", "líneas")} (pedido por ${quien === "pedido de la empresa" ? "la empresa" : quien})`;
      if (n(d.descartadas)) t += `; tiró ${plural(n(d.descartadas), "línea", "líneas")} sin cita o con datos protegidos`;
      return t + ".";
    }
    case "moderacion": {
      const partes = [];
      if (n(d.duplicados)) partes.push(plural(n(d.duplicados), "posible duplicado", "posibles duplicados"));
      if (d.sector_dudoso) partes.push("el sector parece otro");
      const cuando = MOTIVOS[String(d.motivo)] ?? String(d.motivo ?? "");
      if (d.disponible === false) return `Revisó el aviso (${cuando}), pero todavía no tenía con qué compararlo.`;
      return `Revisó el aviso (${cuando}): ${partes.length ? partes.join(" y ") : "nada para marcar"}. No aprueba ni rechaza.`;
    }
    case "habilidades": return `Le sugirió ${plural(n(d.sugeridas), "habilidad", "habilidades")} a un candidato a partir de su CV.`;
    case "redaccion": return d.ok ? "Ayudó a una empresa a redactar una búsqueda." : "Intentó ayudar a redactar una búsqueda, pero el borrador no pasó los controles.";
    case "campana": return `Preparó el borrador de novedades ${d.con_ia ? "con texto de la IA" : "sólo con los datos (sin IA)"}. No sale solo: queda en Campañas.`;
    case "aviso_empresa": return `Avisó a la empresa de ${plural(n(d.candidatos), "candidato nuevo que encaja", "candidatos nuevos que encajan")} (aviso dentro del panel, no un mail).`;
    case "busqueda": return `${plural(n(d.consultas), "búsqueda", "búsquedas")} en lenguaje natural en el buscador ese día. Sólo se cuentan: las frases no se guardan.`;
    case "manual": {
      const a = ACCIONES[String(d.accion)] ?? "Talency lanzó una acción.";
      return n(d.busquedas) ? `${a} (${n(d.busquedas)}).` : a;
    }
    default: return i.kind;
  }
}

function Tarjeta({ titulo, valor, ayuda, alerta }: { titulo: string; valor: React.ReactNode; ayuda?: string; alerta?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border ${alerta ? "bg-red-50 border-red-200" : "bg-white border-[#DDE3EC]"}`}>
      <p className={`text-2xl font-display font-extrabold ${alerta ? "text-red-900" : "text-[#1C2230]"}`}>{valor}</p>
      <p className={`text-xs font-bold mt-0.5 ${alerta ? "text-red-900" : "text-[#1C2230]"}`}>{titulo}</p>
      {ayuda && <p className="text-xs text-[#1C2230] mt-1">{ayuda}</p>}
    </div>
  );
}

function Tarjetas({ t, tope, dias }: { t: Totales; tope: number; dias: number }) {
  const topePeriodo = tope * dias;
  const pct = topePeriodo ? Math.min(100, (100 * t.spend_usd) / topePeriodo) : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Tarjeta titulo="CVs leídos" valor={t.cv_reads} />
      <Tarjeta titulo="Alertas de anonimización" valor={t.anonymization_alerts} alerta={t.anonymization_alerts > 0}
               ayuda={t.anonymization_alerts > 0 ? "Hay CVs con datos sin tapar." : "Ningún dato personal se escapó."} />
      <Tarjeta titulo="Recálculos" valor={t.recomputes} ayuda={`${t.reranks} evaluaciones con IA`} />
      <Tarjeta titulo="Resúmenes" valor={t.summaries} />
      <Tarjeta titulo="Avisos revisados" valor={t.moderation_reviews} ayuda={`${t.moderation_flags} con algo para mirar`} />
      <div className="rounded-2xl p-4 border bg-white border-[#DDE3EC] col-span-2 md:col-span-1">
        <p className="text-2xl font-display font-extrabold text-[#1C2230]">{usd(t.spend_usd)}</p>
        <p className="text-xs font-bold text-[#1C2230] mt-0.5">Gasto (tope {usd(topePeriodo)})</p>
        <div className="h-2 bg-[#E6F4F7] rounded-full mt-2 overflow-hidden" aria-hidden>
          <div className={`h-full ${pct >= 90 ? "bg-red-600" : "bg-[#1E8EA3]"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ResumenTarjetas({ resumen }: { resumen: ResumenActividad }) {
  const [periodo, setPeriodo] = useState<"hoy" | "semana">("hoy");
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {(["hoy", "semana"] as const).map(p => (
          <button key={p} onClick={() => setPeriodo(p)} aria-pressed={periodo === p}
                  className={`text-sm font-bold px-3 py-1.5 rounded-full border ${periodo === p ? "bg-[#1E8EA3] border-[#1E8EA3] text-white" : "bg-white border-[#DDE3EC] text-[#1C2230]"}`}>
            {p === "hoy" ? "Hoy" : "Últimos 7 días"}
          </button>
        ))}
      </div>
      <Tarjetas t={periodo === "hoy" ? resumen.today : resumen.week} tope={resumen.daily_budget_usd} dias={periodo === "hoy" ? 1 : 7} />
    </section>
  );
}

function dia(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export default function Actividad({ resumen, onVerBusqueda }: { resumen: ResumenActividad; onVerBusqueda: (jobId: string) => void }) {
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(false);
  const ficha = useFichaCandidato();
  const lista = useListaPaginada<ItemActividad>("/admin/ai/activity", {
    tipo: tipo || undefined, desde: desde || undefined, hasta: hasta || undefined, solo_alertas: soloAlertas || undefined,
  }, { pageSize: 30 });

  const icono = (k: string) => TIPOS.find(t => t.clave === k)?.icono ?? SparklesIcon;
  // La cabecera del día va en el primer registro de cada día (la lista viene ordenada).
  const filas = lista.items.map((i, k) => ({ i, d: dia(i.at), cabecera: k === 0 || dia(lista.items[k - 1].at) !== dia(i.at) }));

  return (
    <div>
      <ResumenTarjetas resumen={resumen} />

      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <label className="text-sm font-bold text-[#1C2230]">Qué
          <select value={tipo} onChange={e => setTipo(e.target.value)}
                  className="mt-1 w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm bg-white font-normal">
            <option value="">Todo</option>
            {TIPOS.map(t => <option key={t.clave} value={t.clave}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-[#1C2230]">Desde
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                 className="mt-1 w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm bg-white font-normal" />
        </label>
        <label className="text-sm font-bold text-[#1C2230]">Hasta
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                 className="mt-1 w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm bg-white font-normal" />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-[#1C2230] py-2">
          <input type="checkbox" checked={soloAlertas} onChange={e => setSoloAlertas(e.target.checked)} className="w-4 h-4 accent-[#1E8EA3]" />
          Sólo lo que hay que mirar
        </label>
      </div>

      <div className="bg-white border border-[#DDE3EC] rounded-2xl shadow-sm overflow-hidden">
        {lista.cargando ? (
          <div className="py-12 flex justify-center"><Spinner /></div>
        ) : lista.error ? (
          <p className="p-8 text-center text-red-800">No se pudo cargar la actividad. Probá de nuevo.</p>
        ) : lista.items.length === 0 ? (
          <p className="p-8 text-center text-[#1C2230]">
            {tipo || desde || hasta || soloAlertas ? "No hay actividad con esos filtros." : "La IA todavía no hizo nada. Cuando lea un CV o calcule recomendados, aparece acá."}
          </p>
        ) : (
          <ol>
            {filas.map(({ i, d, cabecera }) => {
              const Icono = icono(i.kind);
              return (
                <li key={i.id}>
                  {cabecera && (
                    <p className="px-4 sm:px-5 py-2 bg-[#FAFBFD] border-y border-[#DDE3EC] text-xs font-extrabold uppercase tracking-wide text-[#1C2230] first:border-t-0">
                      {d}
                    </p>
                  )}
                  <div className={`px-4 sm:px-5 py-3 flex gap-3 ${i.alert ? "bg-red-50/60" : ""}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${i.alert ? "bg-red-100 text-red-900" : "bg-[#E6F4F7] text-[#187B8E]"}`}>
                      {i.alert ? <ExclamationTriangleIcon className="w-5 h-5" /> : <Icono className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[#1C2230]">
                        <span className="font-bold mr-1.5">{new Date(i.at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {describir(i)}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-[#1C2230]">
                        {i.job_id && (
                          <button onClick={() => onVerBusqueda(i.job_id!)} className="font-bold text-[#187B8E] hover:underline text-left">
                            {i.job_title ?? "Ver búsqueda"}{i.company_name ? ` · ${i.company_name}` : ""}
                          </button>
                        )}
                        {!i.job_id && i.company_name && <span className="font-semibold">{i.company_name}</span>}
                        {i.candidate_id && (
                          <button onClick={() => ficha.abrir(i.candidate_id!)} className="font-bold text-[#187B8E] hover:underline">Ver candidato</button>
                        )}
                        {i.cost_usd > 0 && <span className="font-semibold">{usd(i.cost_usd)}</span>}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {lista.items.length > 0 && (
        <div className="mt-4">
          <Paginacion pagina={lista.pagina} totalPaginas={lista.totalPaginas} total={lista.total}
                      pageSize={lista.pageSize} etiqueta="registros" onCambiar={lista.irAPagina} />
        </div>
      )}
      {ficha.modal}
    </div>
  );
}
