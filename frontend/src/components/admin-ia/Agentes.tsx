"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, CodeBracketIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { detalleError } from "@/hooks/useModulo";
import { Aviso, Spinner, fecha, usd } from "./comun";

/**
 * Agentes del Centro de IA (IA-AGENTES-PLAN.md §5): quién es cada agente, qué hace, qué nunca hace,
 * con qué instrucciones trabaja y cuánto trabajó. Sólo lectura: no llama a Gemini ni cambia nada.
 */

type Estado = "andando" | "apagado" | "sin_cuenta" | "tope";
type Equipo = "recomendaciones" | "asistentes" | "talency";

interface Agente {
  key: string; name: string; team: Equipo; kind: "ia" | "vectores"; model: string;
  what: string; receives: string; returns: string; never: string; code: string; est_cost_usd: number;
  state: Estado; switch?: string | null; version?: string | null; instructions?: string | null;
  stats: {
    calls_today: number; spend_today_usd: number; calls: number; spend_usd: number;
    avg_cost_usd?: number | null; last_used_at?: string | null;
  };
  reviews?: number | null; degraded?: number | null;
}
interface Paso { kind: "agente" | "codigo"; value: string }
interface Control {
  key: string; title: string; state: "ok" | "alerta" | "sin_datos"; value?: number | null;
  threshold: number; unit: "%" | "usd" | "veces"; detail: string;
}
interface Respuesta {
  checks: Control[];
  agents: Agente[]; flow: Paso[]; days: number; daily_budget_usd: number; today_usd: number;
  review_band: [number, number];
  per_search_usd: number; per_search_2027_usd: number; searches_per_month: number; prices_source: string;
}

const EQUIPOS: { clave: Equipo; titulo: string; texto: string }[] = [
  { clave: "recomendaciones", titulo: "Recomendaciones", texto: "Encuentran a los candidatos que encajan con cada búsqueda." },
  { clave: "asistentes", titulo: "Asistentes", texto: "Ayudan a empresas y candidatos dentro del portal." },
  { clave: "talency", titulo: "Para Talency", texto: "Ayudan al equipo de Talency a moderar y armar campañas." },
];

const ESTADOS: Record<Estado, { texto: string; cls: string }> = {
  andando: { texto: "Andando", cls: "bg-[#E6F4F7] text-[#187B8E]" },
  apagado: { texto: "Apagado", cls: "bg-slate-100 text-[#1C2230]" },
  sin_cuenta: { texto: "Sin cuenta de Gemini", cls: "bg-yellow-100 text-yellow-900" },
  tope: { texto: "Pausado por el tope del día", cls: "bg-[#D4B7A2] text-[#241C15]" },
};

const INTERRUPTORES: Record<string, string> = {
  ia_recomendaciones_activas: "IA de recomendados",
  asistente_ia_activo: "Asistentes con IA",
  busqueda_ia_activa: "Buscador inteligente",
};

const CONTROL: Record<Control["state"], { texto: string; cls: string }> = {
  ok: { texto: "Bien", cls: "bg-emerald-50 text-emerald-800" },
  alerta: { texto: "Mirar", cls: "bg-red-50 text-red-800" },
  sin_datos: { texto: "Poca muestra", cls: "bg-slate-100 text-[#1C2230]" },
};

function formatear(c: Control, n: number | null | undefined): string {
  if (n == null) return "—";
  if (c.unit === "usd") return `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  if (c.unit === "%") return `${n.toLocaleString("es-AR")} %`;
  return String(n);
}

/** Cómo está respondiendo la IA, con el límite a partir del cual hay que mirar (etapa de observación). */
function Controles({ controles, dias }: { controles: Control[]; dias: number }) {
  const mirar = controles.filter(c => c.state === "alerta").length;
  return (
    <section className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
      <h3 className="font-display font-bold text-[#1C2230]">Cómo está respondiendo la IA</h3>
      <p className="text-sm text-[#64748B] mt-1 mb-4">
        Últimos {dias} días. {mirar ? <strong className="text-red-800">Hay {mirar} para mirar.</strong> : "Nada para mirar por ahora."}{" "}
        Con poca muestra no se enciende ninguna alerta.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {controles.map(c => (
          <li key={c.key} className="rounded-xl border border-[#DDE3EC] p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-[#1C2230]">{c.title}</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${CONTROL[c.state].cls}`}>{CONTROL[c.state].texto}</span>
            </div>
            <p className="text-xl font-display font-bold text-[#1C2230] mt-1">{formatear(c, c.value)}</p>
            <p className="text-xs text-[#64748B]">
              {c.state === "sin_datos" ? "" : `Se mira a partir de ${formatear(c, c.threshold)}. `}{c.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Recorrido({ pasos, nombres }: { pasos: Paso[]; nombres: Record<string, string> }) {
  return (
    <ol className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-stretch">
      {pasos.map((p, i) => (
        <li key={i} className="flex sm:items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold leading-snug ${
            p.kind === "agente" ? "bg-[#1E8EA3] text-white" : "bg-white border border-dashed border-[#9ED4DF] text-[#1C2230] font-medium sm:max-w-56"
          }`}>
            {p.kind === "agente" ? <SparklesIcon className="w-4 h-4 shrink-0" /> : <CodeBracketIcon className="w-4 h-4 shrink-0 text-[#187B8E]" />}
            {p.kind === "agente" ? nombres[p.value] ?? p.value : p.value}
          </span>
          {i < pasos.length - 1 && <span aria-hidden className="hidden sm:inline text-[#64748B]">→</span>}
        </li>
      ))}
    </ol>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{titulo}</dt>
      <dd className="text-sm text-[#1C2230] mt-0.5">{children}</dd>
    </div>
  );
}

function Tarjeta({ a, dias, franja }: { a: Agente; dias: number; franja: [number, number] }) {
  const [abierto, setAbierto] = useState(false);
  const estado = ESTADOS[a.state];
  return (
    <article className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-display font-bold text-lg text-[#1C2230] flex items-center gap-2">
            {a.kind === "ia" ? <SparklesIcon className="w-5 h-5 text-[#187B8E]" /> : <CodeBracketIcon className="w-5 h-5 text-[#187B8E]" />}
            {a.name}
          </h4>
          <p className="text-xs text-[#64748B] mt-0.5">
            {a.kind === "ia" ? "Lee y responde con IA" : "Compara textos, no escribe"} · <span className="font-mono">{a.model}</span>
          </p>
        </div>
        <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${estado.cls}`}>{estado.texto}</span>
      </header>

      <p className="text-sm text-[#1C2230]">{a.what}</p>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Dato titulo="Recibe">{a.receives}</Dato>
        <Dato titulo="Devuelve">{a.returns}</Dato>
        <div className="sm:col-span-2">
          <Dato titulo="Nunca">{a.never}</Dato>
        </div>
      </dl>

      <div className="rounded-xl border border-dashed border-[#9ED4DF] p-3">
        <Dato titulo="Lo que hace el sistema, sin IA">{a.code}</Dato>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-[#FAFBFD] border border-[#DDE3EC] p-3">
        <Dato titulo="Hoy">{a.stats.calls_today} usos · {usd(a.stats.spend_today_usd)}</Dato>
        <Dato titulo={`${dias} días`}>{a.stats.calls} usos · {usd(a.stats.spend_usd)}</Dato>
        <Dato titulo="Por uso">
          {a.stats.avg_cost_usd != null ? usd(a.stats.avg_cost_usd) : <>~{usd(a.est_cost_usd)} <span className="text-[#64748B]">(estimado)</span></>}
        </Dato>
        <Dato titulo="Último uso">{fecha(a.stats.last_used_at)}</Dato>
      </div>

      {a.key === "revisor" && (
        <p className="text-xs text-[#1C2230]">
          Revisa solo a quienes quedaron con puntaje entre {franja[0]} y {franja[1]}: el corte de 70 decide si se le avisa al candidato.
          {a.reviews != null && <> En {dias} días revisó <strong>{a.reviews}</strong>.</>}
        </p>
      )}
      {a.key === "evaluador" && a.degraded != null && (
        <p className="text-xs text-[#1C2230]">
          En {dias} días el sistema descartó <strong>{a.degraded}</strong> respuestas sin una frase del CV que las respalde
          (quedaron como «no dice nada»).
        </p>
      )}
      {a.switch && (
        <p className="text-xs text-[#64748B]">Se prende y apaga con «{INTERRUPTORES[a.switch] ?? a.switch}» en Configuración.</p>
      )}

      {a.instructions && (
        <div>
          <button type="button" onClick={() => setAbierto(v => !v)} aria-expanded={abierto}
                  className="flex items-center gap-1 text-sm font-bold text-[#187B8E] hover:text-[#1E8EA3]">
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${abierto ? "rotate-180" : ""}`} />
            {abierto ? "Ocultar instrucciones" : "Ver sus instrucciones"}
          </button>
          {abierto && (
            <div className="mt-2">
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#1C2230] bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-3 max-h-96 overflow-auto font-sans">
                {a.instructions}
              </pre>
              <p className="text-[11px] text-[#64748B] mt-1">
                Versión <span className="font-mono">{a.version}</span>. Si las instrucciones cambian, lo que este agente ya hizo se vuelve a calcular.
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// Filtros que usa el menú por área (lib/adminMenu.ts). Prospección = los dos agentes de campañas;
// el Moderador, aunque es "para Talency", no tiene que ver con prospectar.
const GRUPOS: Record<"recomendaciones" | "prospeccion" | "asistentes", { titulo: string; incluye: (a: Agente) => boolean }> = {
  recomendaciones: { titulo: "Agentes de recomendación", incluye: a => a.team === "recomendaciones" },
  prospeccion: { titulo: "Agentes de prospección y campañas", incluye: a => a.key === "redactor_campanas" || a.key === "audiencias" },
  asistentes: { titulo: "Asistentes", incluye: a => a.team === "asistentes" },
};

export default function Agentes({ grupo = null, onVerTodos }: {
  grupo?: keyof typeof GRUPOS | null; onVerTodos?: () => void;
} = {}) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Respuesta>("/admin/ai/agents").then(r => setDatos(r.data)).catch(e => setError(detalleError(e)));
  }, []);

  if (error) return <Aviso tono="error">{error}</Aviso>;
  if (!datos) return <div className="py-12 flex justify-center"><Spinner /></div>;

  const nombres = Object.fromEntries(datos.agents.map(a => [a.key, a.name]));
  const filtro = grupo ? GRUPOS[grupo] : null;
  // El recorrido y los controles son de las recomendaciones: no se muestran con otro filtro.
  const conRecorrido = !grupo || grupo === "recomendaciones";
  return (
    <div className="flex flex-col gap-8">
      {filtro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#9ED4DF] bg-[#E6F4F7] px-4 py-3">
          <p className="text-sm font-bold text-[#187B8E]">Mostrando: {filtro.titulo}</p>
          {onVerTodos && (
            <button type="button" onClick={onVerTodos} className="text-sm font-bold text-[#187B8E] underline">
              Ver todos los agentes
            </button>
          )}
        </div>
      )}
      {conRecorrido && datos.checks?.length > 0 && <Controles controles={datos.checks} dias={datos.days} />}
      {conRecorrido && <section className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
        <h3 className="font-display font-bold text-[#1C2230]">Cómo se arma una recomendación</h3>
        <p className="text-sm text-[#1C2230] mt-1 mb-4">
          Cada agente hace una sola cosa y le pasa el resultado al siguiente. Entre uno y otro, el sistema controla lo que
          devolvió la IA. Los pasos con borde punteado no usan IA y no cuestan nada.
        </p>
        <Recorrido pasos={datos.flow} nombres={nombres} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3 rounded-xl bg-[#FAFBFD] border border-[#DDE3EC] p-3">
          <Dato titulo="Una búsqueda (estimado)">~{usd(datos.per_search_usd)}</Dato>
          <Dato titulo={`Por mes (~${datos.searches_per_month} búsquedas)`}>~{usd(datos.per_search_usd * datos.searches_per_month)}</Dato>
          <Dato titulo="Desde enero 2027">
            ~{usd(datos.per_search_2027_usd)} por búsqueda: sube el modelo del Revisor
          </Dato>
        </div>
        <p className="text-xs text-[#64748B] mt-4">
          Gasto de hoy: <strong>{usd(datos.today_usd)}</strong> de un tope de {usd(datos.daily_budget_usd)}. Al llegar al tope, la IA
          se pausa sola hasta mañana y las recomendaciones siguen con el puntaje sin IA.
        </p>
      </section>}

      {EQUIPOS.map(eq => {
        const lista = datos.agents.filter(a => a.team === eq.clave && (!filtro || filtro.incluye(a)));
        if (!lista.length) return null;
        return (
          <section key={eq.clave}>
            <h3 className="font-display font-bold text-lg text-[#1C2230]">{eq.titulo}</h3>
            <p className="text-sm text-[#1C2230] mb-3">{eq.texto}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {lista.map(a => <Tarjeta key={a.key} a={a} dias={datos.days} franja={datos.review_band} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
