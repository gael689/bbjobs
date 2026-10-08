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
  fuente?: string;   // "eugenia" | "propuesto" | "sistema"
}
interface SinMail {
  tipo: string;
  destinatario: string;
  cuando: string;
  nota: string;
}
interface EvalRequisito {
  requisito: string;
  tipo: string;
  veredicto: string;
  evidencia: string | null;
}
interface Candidato {
  nombre: string;
  puntaje: number;
  cobertura: number;
  origen: string;
  recomendado: boolean;
  motivos: string[];
  requisitos: EvalRequisito[];
  alerta: string | null;
}
interface DatosIA {
  disponible: boolean;
  generado?: string;
  modelo?: string;
  gasto_usd?: number;
  llamadas?: number;
  puesto?: string;
  descripcion?: string;
  requisitos?: { texto: string; tipo: string }[];
  descartados?: { texto: string; motivo?: string | null }[];
  cv_ejemplo?: { texto: string | null; sacado: Record<string, number> };
  candidatos?: Candidato[];
}

const DEST: Record<string, string> = { candidato: "Postulantes", empresa: "Empresas", admin: "Equipo Talency" };
const CATEGORIA: Record<string, string> = {
  cuenta: "Cuenta", admin: "Equipo", postulaciones: "Postulaciones", busquedas: "Búsquedas",
  alertas: "Alertas", recordatorios: "Recordatorios", novedades: "Novedades",
};
const ink = "text-[#1C2230]";
const FUENTE: Record<string, string> = {
  eugenia: "Texto de Talency",
  propuesto: "Propuesto: falta tu visto bueno",
};
// Los estados que ya no se eligen van al final de la lista.
const esViejo = (a: Aviso) => a.cuando.startsWith("Ya no se elige");

function srcDocDe(html: string) {
  // El logo apunta al dominio del sitio; acá se sirve desde el mismo origen que esta página.
  return html.replace(/https?:\/\/[^"']+\/logo\.png/g, "/logo.png");
}

function Chip({ children, tone = "n" }: { children: React.ReactNode; tone?: "n" | "t" | "o" }) {
  const c = tone === "t" ? "bg-[#E6F4F7] text-[#187B8E]" : tone === "o" ? "bg-[#F7EFE9] text-[#1C2230]" : "bg-slate-100 text-[#1C2230]";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

function Mails({ avisos, sinMail }: { avisos: Aviso[]; sinMail: SinMail[] }) {
  const [dest, setDest] = useState("candidato");
  const lista = useMemo(
    () => avisos.filter((a) => a.destinatario === dest).sort((a, b) => Number(esViejo(a)) - Number(esViejo(b))),
    [avisos, dest],
  );
  const [tipo, setTipo] = useState<string>(() => avisos.find((a) => a.destinatario === "candidato")!.tipo);
  const actual = avisos.find((a) => a.tipo === tipo && a.destinatario === dest) ?? lista[0];
  const aparte = sinMail.filter((s) => s.destinatario === dest);
  const srcDoc = srcDocDe(actual.html);

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
              {a.fuente && FUENTE[a.fuente] && (
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.fuente === "eugenia" ? "bg-[#E6F4F7] text-[#187B8E]" : "bg-[#F7EFE9] text-[#1C2230]"}`}>
                  {FUENTE[a.fuente]}
                </span>
              )}
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
              {actual.fuente && FUENTE[actual.fuente] && <Chip tone={actual.fuente === "eugenia" ? "t" : "o"}>{FUENTE[actual.fuente]}</Chip>}
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
  const sacado = ia.cv_ejemplo?.sacado ?? {};
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h3 className={`text-lg font-bold ${ink}`}>Cómo funciona, en cuatro pasos</h3>
        <ol className={`mt-2 list-decimal space-y-1 pl-5 text-sm ${ink}`}>
          <li>Lee el aviso y arma la lista de requisitos. Lo que no se puede pedir (edad, apariencia, género…) se descarta.</li>
          <li>Lee el CV de cada persona <strong>sin sus datos personales</strong>: nombre, DNI, teléfono, mail y fecha de nacimiento se sacan antes.</li>
          <li>Revisa requisito por requisito y, para cada uno que da por cumplido, copia la frase del CV que lo prueba. Si no la encuentra, queda «Sin dato» (que no es lo mismo que «No cumple»).</li>
          <li>El puntaje lo calcula el sistema con reglas fijas, no la IA. La empresa ve la lista ordenada y decide: la IA nunca descarta a nadie, no manda mails ni cambia estados.</li>
        </ol>
      </section>
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h3 className={`text-lg font-bold ${ink}`}>El aviso de ejemplo</h3>
        <p className={`mt-1 font-semibold ${ink}`}>{ia.puesto}</p>
        <p className={`mt-1 text-sm ${ink}`}>{ia.descripcion}</p>
      </section>
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h3 className={`text-lg font-bold ${ink}`}>Paso 1. Qué entendió la IA que pide el aviso</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {ia.requisitos?.map((r) => (
            <li key={r.texto} className={ink}>
              <Chip tone={r.tipo === "excluyente" ? "o" : "n"}>{r.tipo}</Chip> {r.texto}
            </li>
          ))}
        </ul>
        {!!ia.descartados?.length && (
          <div className="mt-3 rounded-md bg-[#F7EFE9] p-3 text-sm">
            <p className={`font-semibold ${ink}`}>Lo que el aviso pide pero no se usa, a propósito</p>
            <ul className={`mt-1 ${ink}`}>{ia.descartados.map((d) => <li key={d.texto}>· «{d.texto}»</li>)}</ul>
            <p className={`mt-1 text-xs ${ink}`}>Son datos protegidos por la ley antidiscriminación (Ley 23.592): no entran en el orden.</p>
          </div>
        )}
      </section>
      {ia.cv_ejemplo?.texto && (
        <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
          <h3 className={`text-lg font-bold ${ink}`}>Paso 2. Así le llega un CV a la IA</h3>
          <pre className={`mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 font-sans text-sm ${ink}`}>{ia.cv_ejemplo.texto}</pre>
          <p className={`mt-2 text-xs ${ink}`}>
            «[DATO]» es el nombre, que se reemplaza. La línea con DNI, teléfono y fecha de nacimiento se sacó entera
            {sacado.nombre_propio || sacado.lineas_personales
              ? ` (en este CV: ${sacado.nombre_propio ?? 0} menciones del nombre y ${sacado.lineas_personales ?? 0} línea de datos personales)`
              : ""}.
          </p>
        </section>
      )}
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h3 className={`text-lg font-bold ${ink}`}>Pasos 3 y 4. Lo que ve la empresa</h3>
        <p className={`mt-1 text-sm ${ink}`}>
          A partir de 70 puntos el perfil aparece como «Recomendado». Debajo, el resto sigue visible, ordenado.
        </p>
        <div className="mt-3 space-y-3">
          {ia.candidatos?.map((c) => (
            <div key={c.nombre} className="rounded-lg border border-[#DDE3EC] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className={`font-semibold ${ink}`}>{c.nombre}</p>
                  <p className="text-xs text-[#475569]">{c.origen}</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.recomendado && <Chip tone="t">Recomendado</Chip>}
                  <span className="rounded-full bg-[#187B8E] px-3 py-1 text-sm font-bold text-white">{c.puntaje}</span>
                </div>
              </div>
              {c.alerta && (
                <p className={`mt-2 rounded-md bg-[#F7EFE9] p-2 text-sm ${ink}`}><strong>Atención:</strong> {c.alerta}</p>
              )}
              <ul className={`mt-2 list-disc pl-5 text-sm ${ink}`}>{c.motivos.map((m) => <li key={m}>{m}</li>)}</ul>
              <div className="mt-3 overflow-x-auto">
                <table className={`w-full text-left text-sm ${ink}`}>
                  <thead>
                    <tr className="border-b border-[#DDE3EC] text-xs text-[#475569]">
                      <th className="py-1 pr-3 font-medium">Requisito</th>
                      <th className="py-1 pr-3 font-medium">Resultado</th>
                      <th className="py-1 font-medium">Dónde lo dice el CV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.requisitos.map((r) => (
                      <tr key={r.requisito} className="border-b border-slate-100 align-top">
                        <td className="py-1.5 pr-3">{r.requisito}{r.tipo === "excluyente" ? " *" : ""}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{r.veredicto}</td>
                        <td className="py-1.5">{r.evidencia ? <em>«{r.evidencia}»</em> : <span className="text-[#475569]">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[#475569]">* excluyente</p>
      </section>
      <p className="text-xs text-[#475569]">
        Corrida real con {ia.modelo} el {ia.generado}: {ia.llamadas} consultas, costo total de la búsqueda USD{" "}
        {ia.gasto_usd?.toFixed(4)}. Las personas y la empresa son inventadas.
      </p>
    </div>
  );
}

// El desplegable que ve la empresa (Eugenia, 08/10/2026: sin «Contactado» ni «Finalista») y el
// aviso que dispara cada opción. Es el mismo que le muestra el cuadro «Cambiar estado».
const ESTADOS: [string, string, string | null][] = [
  ["new", "Nueva", null],
  ["seen", "Perfil revisado", "application_seen"],
  ["in_process", "En proceso", "application_in_process"],
  ["selected", "Seleccionado", "application_selected"],
  ["discarded", "No avanza – revisión de perfil", "application_discarded"],
  ["discarded_interview", "No avanza – después de entrevistas", "application_discarded_interview"],
];

function Estados({ avisos }: { avisos: Aviso[] }) {
  const [estado, setEstado] = useState("in_process");
  const [, , tipo] = ESTADOS.find(([k]) => k === estado)!;
  const aviso = tipo ? avisos.find((a) => a.tipo === tipo) : undefined;
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="rounded-lg border border-[#DDE3EC] bg-white p-4">
          <label htmlFor="estado-demo" className={`text-sm font-semibold ${ink}`}>Estado de la postulación</label>
          <select
            id="estado-demo"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className={`mt-2 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm ${ink}`}
          >
            {ESTADOS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className={`rounded-lg border border-[#DDE3EC] bg-white p-4 text-sm ${ink}`}>
          <p>
            Cuando la empresa elige un estado, antes de guardar ve exactamente el mail que le va a llegar al postulante,
            con su nombre y el puesto. Si escribe un mensaje y lo marca como visible, el mensaje va adentro del mail.
          </p>
          <p className="mt-2">
            «Contactado» y «Finalista» ya no aparecen. Las postulaciones que ya estaban en esos estados los conservan.
          </p>
        </div>
      </div>
      <div>
        <div className="mb-3 rounded-lg border border-[#DDE3EC] bg-white p-4">
          {aviso ? (
            <>
              <p className={`text-xs font-bold uppercase tracking-wide ${ink}`}>Le va a llegar este mail al postulante</p>
              <p className={`mt-1 text-sm ${ink}`}><strong>Asunto:</strong> {aviso.asunto}</p>
              {aviso.demora_horas > 0 && (
                <p className={`mt-1 text-sm ${ink}`}>
                  Sale {aviso.demora_horas} h después, y sólo si la empresa no cambia el estado antes.
                </p>
              )}
            </>
          ) : (
            <p className={`text-sm ${ink}`}>Este estado no manda mail: el postulante lo ve en su panel de postulaciones.</p>
          )}
        </div>
        {aviso && (
          <iframe
            title={aviso.asunto}
            sandbox=""
            srcDoc={srcDocDe(aviso.html)}
            className="h-[640px] w-full rounded-lg border border-[#DDE3EC] bg-white"
          />
        )}
      </div>
    </div>
  );
}

function Reglas() {
  const filas: [string, string][] = [
    ["Horario", "Los avisos comunes salen de 8 a 21 h. Fuera de ese horario esperan a la mañana."],
    ["Tope", "Como mucho 2 mails por día por persona. Los resúmenes ya agrupan varios avisos y no cuentan."],
    ["Críticos", "Pagos y estado de la cuenta salen a cualquier hora y no cuentan para el tope."],
    ["«No avanza»", "Los dos (revisión de perfil y después de entrevistas) se demoran 24 h y se vuelven a chequear: si la empresa cambió de idea, no salen."],
    ["Confirmación", "Cada postulación tiene su mail de confirmación, con el puesto en el asunto."],
    ["Una semana sin entrar", "«¿Seguís buscando trabajo?» sale como mucho una vez cada 30 días. Si no vuelve después de 3, no se le escribe más."],
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
  const [tab, setTab] = useState<"mails" | "estados" | "ia" | "reglas">("mails");
  const tabs = [
    ["mails", "Los mails"], ["estados", "Estados de la postulación"], ["ia", "Cómo trabaja la IA"], ["reglas", "Reglas de envío"],
  ] as const;
  return (
    <main className="min-h-screen bg-[#FAFBFD] px-4 pb-12 pt-32">
      <div className="mx-auto max-w-6xl">
        <p className="text-2xl font-extrabold italic tracking-tight text-[#1C2230]"><span className="text-[#1E8EA3]">BB</span>JOBS</p>
        <h1 className={`mt-2 text-2xl font-bold ${ink}`}>Vista previa de mails e IA</h1>
        <p className={`mt-1 max-w-3xl text-sm ${ink}`}>
          Esto todavía no está activo en el sitio. Acá ves los mails tal como los recibiría cada persona y cómo trabaja la
          IA con una búsqueda de ejemplo. Los nombres y los datos son inventados.
        </p>
        <div className="mt-6 flex gap-2 overflow-x-auto border-b border-[#DDE3EC]" role="tablist">
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
          {tab === "estados" && <Estados avisos={avisos} />}
          {tab === "ia" && <IA ia={ia} />}
          {tab === "reglas" && <Reglas />}
        </div>
      </div>
    </main>
  );
}
