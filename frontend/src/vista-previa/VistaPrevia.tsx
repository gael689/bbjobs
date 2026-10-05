"use client";

import { useMemo, useState } from "react";

interface Aviso {
  tipo: string;
  destinatario: string;
  cuando: string;
  asunto: string;
  html: string;
  texto: string;
  categoria: string;
  modo: string;
  demora_horas: number;
  critico: boolean;
  uno_por_dia: boolean;
  con_baja: boolean;
  resumen?: boolean;
}
interface SinMail {
  tipo: string;
  destinatario: string;
  cuando: string;
  nota: string;
}
interface Candidato {
  nombre: string;
  puntaje: number;
  cobertura: number;
  motivos: string[];
  evidencia: Record<string, string>;
  estado: string;
}
interface DatosIA {
  disponible: boolean;
  generado?: string;
  modelo?: string;
  gasto_usd?: number;
  puesto?: string;
  descripcion?: string;
  requisitos?: { texto: string; tipo: string }[];
  descartados?: { texto: string; motivo?: string }[];
  candidatos?: Candidato[];
}

const DEST: Record<string, string> = { candidato: "Postulantes", empresa: "Empresas", admin: "Equipo Talency" };
const CATEGORIA: Record<string, string> = {
  cuenta: "Cuenta", admin: "Equipo", postulaciones: "Postulaciones", busquedas: "Búsquedas",
  alertas: "Alertas", recordatorios: "Recordatorios", novedades: "Novedades",
};
const ink = "text-[#1C2230]";

function Chip({ children, tone = "n" }: { children: React.ReactNode; tone?: "n" | "t" | "o" }) {
  const c = tone === "t" ? "bg-[#E6F4F7] text-[#187B8E]" : tone === "o" ? "bg-[#F7EFE9] text-[#1C2230]" : "bg-slate-100 text-[#1C2230]";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

function Mails({ avisos, sinMail }: { avisos: Aviso[]; sinMail: SinMail[] }) {
  const [dest, setDest] = useState("candidato");
  const lista = useMemo(() => avisos.filter((a) => a.destinatario === dest), [avisos, dest]);
  const [tipo, setTipo] = useState<string>(() => avisos.find((a) => a.destinatario === "candidato")!.tipo);
  const actual = avisos.find((a) => a.tipo === tipo && a.destinatario === dest) ?? lista[0];
  const aparte = sinMail.filter((s) => s.destinatario === dest);
  // El logo apunta al dominio del sitio; acá se sirve desde el mismo origen que esta página.
  const srcDoc = actual.html.replace(/https?:\/\/[^"']+\/logo\.png/g, "/logo.png");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(DEST).map(([k, v]) => (
          <button
            key={k}
            onClick={() => { setDest(k); setTipo(avisos.find((a) => a.destinatario === k)!.tipo); }}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold ${dest === k ? "border-[#187B8E] bg-[#187B8E] text-white" : `border-[#DDE3EC] bg-white ${ink}`}`}
          >
            {v} <span className="opacity-70">({avisos.filter((a) => a.destinatario === k).length})</span>
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-1">
          {lista.map((a) => (
            <button
              key={a.tipo}
              onClick={() => setTipo(a.tipo)}
              className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${a.tipo === actual.tipo ? "border-[#187B8E] bg-[#E6F4F7]" : "border-[#DDE3EC] bg-white hover:bg-slate-50"} ${ink}`}
            >
              <span className="font-semibold">{a.resumen ? "Resumen · " : ""}{a.asunto}</span>
              <span className="mt-0.5 block text-xs text-[#475569]">{a.cuando}</span>
            </button>
          ))}
          {aparte.length > 0 && (
            <div className="mt-4 rounded-lg border border-dashed border-[#DDE3EC] bg-white p-3 text-xs text-[#475569]">
              <p className={`mb-1 font-semibold ${ink}`}>Avisos que no mandan mail suelto</p>
              <ul className="space-y-1">
                {aparte.map((s) => (
                  <li key={s.tipo}>· {s.cuando}: <em>{s.nota.toLowerCase()}</em></li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <div className="mb-3 rounded-lg border border-[#DDE3EC] bg-white p-4">
            <p className={`text-sm ${ink}`}><strong>Asunto:</strong> {actual.asunto}</p>
            <p className={`mt-1 text-sm ${ink}`}><strong>Cuándo sale:</strong> {actual.cuando}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip tone="t">{CATEGORIA[actual.categoria] ?? actual.categoria}</Chip>
              {actual.critico && <Chip tone="o">Crítico: sale a cualquier hora</Chip>}
              {actual.demora_horas > 0 && <Chip>Espera {actual.demora_horas} h y se revalida</Chip>}
              {actual.uno_por_dia && <Chip>Como mucho 1 por día</Chip>}
              <Chip>{actual.con_baja ? "Se puede dar de baja" : "No se puede dar de baja"}</Chip>
            </div>
          </div>
          <iframe
            title={actual.asunto}
            sandbox=""
            srcDoc={srcDoc}
            className="h-[640px] w-full rounded-lg border border-[#DDE3EC] bg-white"
          />
          <p className="mt-2 text-xs text-[#475569]">
            Así se ve el mail real. Los nombres y datos de los ejemplos son inventados.
          </p>
        </div>
      </div>
    </div>
  );
}

function IA({ ia }: { ia: DatosIA }) {
  if (!ia.disponible) {
    return <p className={`rounded-lg border border-[#DDE3EC] bg-white p-6 ${ink}`}>Esta sección se está preparando.</p>;
  }
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h3 className={`text-lg font-bold ${ink}`}>La búsqueda</h3>
        <p className={`mt-1 font-semibold ${ink}`}>{ia.puesto}</p>
        <p className={`mt-1 text-sm ${ink}`}>{ia.descripcion}</p>
      </section>
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h3 className={`text-lg font-bold ${ink}`}>1. Qué entendió la IA que pide la búsqueda</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {ia.requisitos?.map((r) => (
            <li key={r.texto} className={ink}>
              <Chip tone={r.tipo === "excluyente" ? "o" : "n"}>{r.tipo}</Chip> {r.texto}
            </li>
          ))}
        </ul>
        {!!ia.descartados?.length && (
          <div className="mt-3 rounded-md bg-[#F7EFE9] p-3 text-sm">
            <p className={`font-semibold ${ink}`}>Lo que la IA no usa, a propósito (datos protegidos)</p>
            <ul className={`mt-1 ${ink}`}>{ia.descartados.map((d) => <li key={d.texto}>· {d.texto}</li>)}</ul>
          </div>
        )}
      </section>
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h3 className={`text-lg font-bold ${ink}`}>2. Candidatos recomendados</h3>
        <div className="mt-3 space-y-3">
          {ia.candidatos?.map((c) => (
            <div key={c.nombre} className="rounded-lg border border-[#DDE3EC] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className={`font-semibold ${ink}`}>{c.nombre}</p>
                <span className="rounded-full bg-[#187B8E] px-3 py-1 text-sm font-bold text-white">{c.puntaje}</span>
              </div>
              <p className={`mt-1 text-xs ${ink}`}>Cumple {Math.round(c.cobertura * 100)}% de lo pedido · {c.estado}</p>
              <ul className={`mt-2 list-disc pl-5 text-sm ${ink}`}>{c.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
              {Object.keys(c.evidencia).length > 0 && (
                <div className="mt-2 text-sm">
                  <p className={`font-semibold ${ink}`}>Dónde lo vio en el CV</p>
                  {Object.entries(c.evidencia).map(([k, v]) => (
                    <p key={k} className={ink}>{k}: <em>«{v}»</em></p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      <p className="text-xs text-[#475569]">
        Corrida con {ia.modelo} · costo de la búsqueda: USD {ia.gasto_usd?.toFixed(4)} · {ia.generado}. La IA sólo ordena y
        muestra evidencia: nunca envía mails ni cambia el estado de una postulación.
      </p>
    </div>
  );
}

function Reglas() {
  const filas: [string, string][] = [
    ["Horario", "Los avisos comunes salen de 8 a 21 h. Fuera de ese horario esperan a la mañana."],
    ["Tope", "Como mucho 2 mails por día por persona. Los resúmenes ya agrupan varios avisos y no cuentan."],
    ["Críticos", "Pagos y estado de la cuenta salen a cualquier hora y no cuentan para el tope."],
    ["«No avanzó»", "Se demora 24 h y se vuelve a chequear: si la empresa cambió de idea, no sale."],
    ["Baja", "Todos los mails opcionales traen un link para dejar de recibirlos, por categoría. Los de cuenta y pagos no."],
    ["Resúmenes", "Si no hay nada que contar, no se manda nada."],
    ["La IA", "Nunca manda mails ni cambia el estado de una postulación. La decisión es siempre de una persona."],
  ];
  return (
    <dl className="divide-y divide-[#DDE3EC] rounded-lg border border-[#DDE3EC] bg-white">
      {filas.map(([k, v]) => (
        <div key={k} className="grid gap-1 p-4 sm:grid-cols-[160px_1fr]">
          <dt className={`font-semibold ${ink}`}>{k}</dt>
          <dd className={`text-sm ${ink}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function VistaPrevia({ avisos, sinMail, ia }: { avisos: Aviso[]; sinMail: SinMail[]; ia: DatosIA }) {
  const [tab, setTab] = useState<"mails" | "ia" | "reglas">("mails");
  const tabs = [["mails", "Los mails"], ["ia", "Cómo trabaja la IA"], ["reglas", "Reglas de envío"]] as const;
  return (
    <main className="min-h-screen bg-[#FAFBFD] px-4 pb-12 pt-32">
      <div className="mx-auto max-w-6xl">
        <p className="text-2xl font-extrabold italic tracking-tight text-[#1C2230]"><span className="text-[#1E8EA3]">BB</span>JOBS</p>
        <h1 className={`mt-2 text-2xl font-bold ${ink}`}>Vista previa de mails e IA</h1>
        <p className={`mt-1 max-w-3xl text-sm ${ink}`}>
          Esto todavía no está activo en el sitio. Acá ves los mails tal como los recibiría cada persona y cómo trabaja la
          IA con una búsqueda de ejemplo. Los nombres y los datos son inventados.
        </p>
        <div className="mt-6 flex gap-2 border-b border-[#DDE3EC]" role="tablist">
          {tabs.map(([k, v]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? "border-[#187B8E] text-[#187B8E]" : `border-transparent ${ink}`}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "mails" && <Mails avisos={avisos} sinMail={sinMail} />}
          {tab === "ia" && <IA ia={ia} />}
          {tab === "reglas" && <Reglas />}
        </div>
      </div>
    </main>
  );
}
