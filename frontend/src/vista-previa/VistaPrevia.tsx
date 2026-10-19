"use client";

import { useState } from "react";

// Los datos salen de backend/scripts/generar_vista_previa.py (avisos.json) y de
// generar_muestra_ia.py (ia.json). Esta página es para Eugenia: todo el texto, sin jerga.

export interface Variante {
  clave: string;
  etiqueta: string;
  asunto: string;
  html: string;
  texto: string;
  fuente: string;
}
export interface Aviso {
  tipo: string;
  codigo: string | null;
  nombre: string;
  grupo: string;
  etapa: string;
  orden: number;
  destinatario: string;
  a_quien: string;
  cuando: string;
  frecuencia: string;
  campanita: { titulo: string; cuerpo: string } | null;
  asunto: string;
  html: string;
  texto: string;
  resumen: boolean;
  fuente: string; // "eugenia" | "propuesto" | "sistema"
  confirmar: string[];
  asunto_propuesto: boolean;
  variantes: Variante[];
  categoria: string;
  modo: string;
  demora_horas: number;
  critico: boolean;
  uno_por_dia: boolean;
  con_baja: boolean;
}
export interface SinMail {
  tipo: string;
  destinatario: string;
  grupo?: string;
  cuando: string;
  nota: string;
}
export interface Etapa {
  grupo: string;
  clave: string;
  titulo: string;
}
export interface Pregunta {
  codigo: string;
  tema: string;
  titulo: string;
  texto: string;
  propuesta: string;
  avisos: string[];
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
export interface DatosIA {
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

const GRUPOS: { clave: string; titulo: string; bajada: string }[] = [
  { clave: "candidato", titulo: "Candidatos", bajada: "Lo que le llega a la persona que busca trabajo." },
  { clave: "empresa", titulo: "Empresas", bajada: "Lo que le llega a la empresa que publica búsquedas." },
  { clave: "admin", titulo: "Equipo de Talency", bajada: "Lo que les llega a ustedes, para estar al tanto." },
];
const ink = "text-[#1C2230]";
const muted = "text-[#64748B]";

const idAviso = (a: Aviso) => `aviso-${a.codigo ?? a.tipo}`;
const idEtapa = (clave: string) => `etapa-${clave}`;
const idPregunta = (codigo: string) => `pregunta-${codigo}`;
const deEugenia = (fuente: string) => fuente === "eugenia";

function srcDocDe(html: string) {
  // El logo apunta al dominio del sitio; acá se sirve desde el mismo origen que esta página.
  return html.replace(/https?:\/\/[^"']+\/logo\.png/g, "/logo.png");
}

// ── Etiquetas ─────────────────────────────────────────────────────────────────────────

function EtiquetaFuente({ fuente }: { fuente: string }) {
  return deEugenia(fuente) ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4F7] px-2.5 py-0.5 text-xs font-semibold text-[#187B8E]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#1E8EA3]" aria-hidden />
      Texto de Eugenia
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7EFE9] px-2.5 py-0.5 text-xs font-semibold text-[#7A5238]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#B9825F]" aria-hidden />
      Propuesto por Gael
    </span>
  );
}

function EtiquetaConfirmar({ codigos }: { codigos: string[] }) {
  if (!codigos.length) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
      A confirmar · {codigos.join(", ")}
    </span>
  );
}

function Codigo({ codigo }: { codigo: string | null }) {
  return codigo ? (
    <span className="inline-flex h-8 min-w-11 items-center justify-center rounded-lg bg-[#1C2230] px-2 font-display text-sm font-bold text-white">
      {codigo}
    </span>
  ) : (
    <span
      title="Este aviso no estaba en tu PDF"
      className="inline-flex h-8 items-center justify-center rounded-lg border border-dashed border-[#9ED4DF] px-2 text-xs font-semibold text-[#187B8E]"
    >
      Extra
    </span>
  );
}

function Punto({ a }: { a: Aviso }) {
  const color = a.confirmar.length ? "bg-amber-500" : deEugenia(a.fuente) ? "bg-[#1E8EA3]" : "bg-[#B9825F]";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

// ── Introducción ──────────────────────────────────────────────────────────────────────

function Intro({ avisos, preguntas }: { avisos: Aviso[]; preguntas: Pregunta[] }) {
  const deElla = avisos.filter((a) => deEugenia(a.fuente)).length;
  const aConfirmar = avisos.filter((a) => a.confirmar.length).length;
  const numeros: [number, string][] = [
    [avisos.length, "mails en total"],
    [deElla, "con tu texto"],
    [avisos.length - deElla, "propuestos por Gael"],
    [aConfirmar, "con algo a confirmar"],
  ];
  return (
    <section aria-labelledby="que-es" className="mt-6 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <h2 id="que-es" className={`font-display text-base font-bold ${ink}`}>Qué es esta página</h2>
          <p className={`mt-2 text-sm leading-relaxed ${ink}`}>
            Están todos los mails automáticos de BBJobs, uno por uno, tal como los va a recibir cada persona. Los
            ordenamos como en tu PDF: primero los de candidatos (C1 a C11) y después los de empresas (E1 a E21).
          </p>
        </div>
        <div className="rounded-xl border border-[#9ED4DF] bg-[#E6F4F7] p-5">
          <h2 className={`font-display text-base font-bold ${ink}`}>Todavía no se manda nada</h2>
          <p className={`mt-2 text-sm leading-relaxed ${ink}`}>
            Esto es una muestra. Ningún mail sale hasta que lo revises y decidamos prenderlos. Los nombres, empresas y
            búsquedas de los ejemplos son inventados.
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <h2 className={`font-display text-base font-bold ${ink}`}>Cómo leerla</h2>
          <p className={`mt-2 text-sm leading-relaxed ${ink}`}>
            Cada aviso dice cuándo se manda, a quién le llega y cada cuánto. Al lado está el mail. Al final hay unas
            preguntas para que nos respondas.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-[#DDE3EC] bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className={`text-sm font-semibold ${ink}`}>Qué significa cada etiqueta</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
            <li className="flex items-center gap-2"><EtiquetaFuente fuente="eugenia" /><span className={muted}>lo escribiste vos</span></li>
            <li className="flex items-center gap-2"><EtiquetaFuente fuente="propuesto" /><span className={muted}>no estaba en tu PDF: falta tu visto bueno</span></li>
            <li className="flex items-center gap-2"><EtiquetaConfirmar codigos={["P8"]} /><span className={muted}>hay una pregunta abierta</span></li>
            <li className="flex items-center gap-2"><Codigo codigo={null} /><span className={muted}>aviso que no estaba en tu PDF</span></li>
          </ul>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
          {numeros.map(([n, t]) => (
            <div key={t} className="rounded-lg bg-[#FAFBFD] px-3 py-2 text-center ring-1 ring-[#DDE3EC]">
              <dt className={`text-[11px] leading-tight ${muted}`}>{t}</dt>
              <dd className={`font-display text-xl font-bold ${ink}`}>{n}</dd>
            </div>
          ))}
        </dl>
      </div>
      {preguntas.length > 0 && (
        <a
          href="#preguntas"
          className="flex items-center justify-between gap-3 rounded-xl bg-[#187B8E] px-5 py-4 text-sm font-semibold text-white hover:bg-[#156b7c]"
        >
          <span>Hay {preguntas.length} preguntas para vos al final de la página.</span>
          <span aria-hidden>Ir a las preguntas →</span>
        </a>
      )}
    </section>
  );
}

// ── Índice ────────────────────────────────────────────────────────────────────────────

function Indice({ etapas, avisos }: { etapas: Etapa[]; avisos: Aviso[] }) {
  return (
    <nav aria-label="Índice" className="text-sm">
      {GRUPOS.map((g) => (
        <div key={g.clave} className="mb-4">
          <a href={`#grupo-${g.clave}`} className={`font-display text-sm font-bold ${ink} hover:text-[#187B8E]`}>
            {g.titulo}
          </a>
          {etapas.filter((e) => e.grupo === g.clave).map((e) => (
            <div key={e.clave} className="mt-2">
              <a href={`#${idEtapa(e.clave)}`} className={`text-xs font-semibold uppercase tracking-wide ${muted} hover:text-[#187B8E]`}>
                {e.titulo}
              </a>
              <ul className="mt-1 space-y-0.5">
                {avisos.filter((a) => a.etapa === e.clave).map((a) => (
                  <li key={a.tipo}>
                    <a href={`#${idAviso(a)}`} className={`flex gap-2 rounded px-1 py-0.5 ${ink} hover:bg-[#E6F4F7]`}>
                      <Punto a={a} />
                      <span>
                        {a.codigo && <strong className="mr-1">{a.codigo}</strong>}
                        {a.nombre}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
      <a href="#mas-informacion" className={`block font-display text-sm font-bold ${ink} hover:text-[#187B8E]`}>Más información</a>
      <a href="#preguntas" className="mt-2 block font-display text-sm font-bold text-[#187B8E]">Preguntas para vos</a>
    </nav>
  );
}

// ── Cada aviso ────────────────────────────────────────────────────────────────────────

function Mail({ aviso }: { aviso: Aviso }) {
  const opciones = [
    { clave: "principal", etiqueta: "Texto principal", asunto: aviso.asunto, html: aviso.html, texto: aviso.texto, fuente: aviso.fuente },
    ...aviso.variantes,
  ];
  const [elegida, setElegida] = useState("principal");
  const [comoTexto, setComoTexto] = useState(false);
  const actual = opciones.find((o) => o.clave === elegida) ?? opciones[0];
  return (
    <div className="min-w-0">
      {opciones.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Versiones de este mail">
          {opciones.map((o) => (
            <button
              key={o.clave}
              type="button"
              aria-pressed={o.clave === actual.clave}
              onClick={() => setElegida(o.clave)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${o.clave === actual.clave ? "border-[#187B8E] bg-[#187B8E] text-white" : `border-[#DDE3EC] bg-white ${ink} hover:bg-[#E6F4F7]`}`}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
      )}
      {actual.clave !== "principal" && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <EtiquetaFuente fuente={actual.fuente} />
          <span className={ink}><strong>Asunto:</strong> {actual.asunto}</span>
        </div>
      )}
      {comoTexto ? (
        <pre className={`h-[560px] overflow-auto whitespace-pre-wrap rounded-lg border border-[#DDE3EC] bg-white p-4 font-sans text-sm ${ink}`}>
          {actual.texto}
        </pre>
      ) : (
        <iframe
          title={`Mail: ${actual.asunto}`}
          sandbox=""
          loading="lazy"
          srcDoc={srcDocDe(actual.html)}
          className="h-[560px] w-full rounded-lg border border-[#DDE3EC] bg-[#FAFBFD]"
        />
      )}
      <button
        type="button"
        onClick={() => setComoTexto((v) => !v)}
        className="mt-2 text-xs font-semibold text-[#187B8E] underline underline-offset-2"
      >
        {comoTexto ? "Ver el mail con diseño" : "Ver sólo el texto"}
      </button>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{titulo}</dt>
      <dd className={`mt-0.5 text-sm leading-relaxed ${ink}`}>{children}</dd>
    </div>
  );
}

function TarjetaAviso({ a, preguntas }: { a: Aviso; preguntas: Pregunta[] }) {
  const horario = a.critico
    ? "Sale apenas pasa, a cualquier hora."
    : "Sale entre las 8 y las 21 h; si pasa de noche, espera a la mañana.";
  return (
    <article id={idAviso(a)} className="scroll-mt-28 overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#DDE3EC] px-4 py-3 sm:px-5">
        <Codigo codigo={a.codigo} />
        <h4 className={`font-display text-base font-bold sm:text-lg ${ink}`}>{a.nombre}</h4>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          <EtiquetaFuente fuente={a.fuente} />
          <EtiquetaConfirmar codigos={a.confirmar} />
        </div>
      </header>
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0 space-y-4">
          <dl className="space-y-3">
            <Dato titulo="Cuándo se manda">{a.cuando}</Dato>
            <Dato titulo="A quién le llega">{a.a_quien}</Dato>
            <Dato titulo="Cada cuánto">
              {a.frecuencia} {horario}
            </Dato>
            <Dato titulo="En la campanita de la web">
              {a.campanita ? (
                <>
                  También aparece, con este texto corto: <strong>«{a.campanita.titulo}»</strong>{" "}
                  <span className={muted}>{a.campanita.cuerpo}</span>
                </>
              ) : (
                "No: es un resumen, llega sólo por mail."
              )}
            </Dato>
            <Dato titulo="Asunto del mail">
              <strong>{a.asunto}</strong>
              {a.asunto_propuesto && (
                <span className={`mt-1 block text-xs ${muted}`}>
                  Asunto propuesto: tu texto no tenía asunto y usamos el título que escribiste arriba (P12).
                </span>
              )}
            </Dato>
            <Dato titulo="¿Se puede dar de baja?">
              {a.con_baja
                ? "Sí: el mail trae un link para dejar de recibir este tipo de avisos."
                : "No: es un aviso de la cuenta o de un pago, siempre llega."}
            </Dato>
          </dl>
          {a.confirmar.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">A confirmar</p>
              <ul className="mt-1 space-y-1">
                {a.confirmar.map((c) => {
                  const p = preguntas.find((q) => q.codigo === c);
                  return (
                    <li key={c} className={`text-sm ${ink}`}>
                      <a href={`#${idPregunta(c)}`} className="font-semibold text-amber-900 underline underline-offset-2">
                        {c}
                      </a>{" "}
                      {p?.titulo}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <Mail aviso={a} />
      </div>
    </article>
  );
}

function Grupo({
  grupo, etapas, avisos, sinMail, preguntas,
}: {
  grupo: (typeof GRUPOS)[number]; etapas: Etapa[]; avisos: Aviso[]; sinMail: SinMail[]; preguntas: Pregunta[];
}) {
  const propias = etapas.filter((e) => e.grupo === grupo.clave);
  const aparte = sinMail.filter((s) => (s.grupo ?? s.destinatario) === grupo.clave);
  return (
    <section id={`grupo-${grupo.clave}`} className="scroll-mt-28">
      <div className="border-b-4 border-[#D4B7A2] pb-3">
        <h2 className={`font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${ink}`}>{grupo.titulo}</h2>
        <p className={`mt-1 text-sm ${muted}`}>{grupo.bajada}</p>
      </div>
      {propias.map((e) => {
        const lista = avisos.filter((a) => a.etapa === e.clave);
        if (!lista.length) return null;
        return (
          <div key={e.clave} id={idEtapa(e.clave)} className="mt-8 scroll-mt-28">
            <h3 className={`mb-4 font-display text-lg font-bold ${ink}`}>
              {e.titulo} <span className={`text-sm font-normal ${muted}`}>· {lista.length} {lista.length === 1 ? "mail" : "mails"}</span>
            </h3>
            <div className="space-y-6">
              {lista.map((a) => <TarjetaAviso key={a.tipo} a={a} preguntas={preguntas} />)}
            </div>
          </div>
        );
      })}
      {aparte.length > 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-[#DDE3EC] bg-white p-5">
          <h3 className={`font-display text-base font-bold ${ink}`}>Avisos que no mandan un mail aparte</h3>
          <p className={`mt-1 text-sm ${muted}`}>Aparecen en la campanita de la web, y algunos se juntan en un resumen.</p>
          <ul className={`mt-3 space-y-1.5 text-sm ${ink}`}>
            {aparte.map((s) => (
              <li key={s.tipo} className="flex flex-col sm:flex-row sm:gap-2">
                <span className="font-semibold">{s.cuando}:</span>
                <span className={muted}>{s.nota.charAt(0).toLowerCase() + s.nota.slice(1)}.</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── Preguntas ─────────────────────────────────────────────────────────────────────────

function Preguntas({ preguntas, avisos }: { preguntas: Pregunta[]; avisos: Aviso[] }) {
  const temas = Array.from(new Set(preguntas.map((p) => p.tema)));
  const enlace = (ref: string) => {
    const a = avisos.find((x) => x.codigo === ref || x.nombre === ref);
    return a ? `#${idAviso(a)}` : undefined;
  };
  return (
    <section id="preguntas" className="scroll-mt-28">
      <div className="border-b-4 border-[#1E8EA3] pb-3">
        <h2 className={`font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${ink}`}>Preguntas para vos</h2>
        <p className={`mt-1 max-w-3xl text-sm ${ink}`}>
          Para cada una te contamos qué proponemos. Si estás de acuerdo, alcanza con un «ok». Respondé por WhatsApp o mail
          con el número de la pregunta (por ejemplo: «P8: ok», «P11: prefiero que el mail diga el motivo»).
        </p>
      </div>
      {temas.map((t) => (
        <div key={t} className="mt-6">
          <h3 className={`mb-3 font-display text-lg font-bold ${ink}`}>{t === "Mails" ? "Sobre los mails" : `Sobre las ${t.toLowerCase()} (mejoras.pdf)`}</h3>
          <ol className="space-y-4">
            {preguntas.filter((p) => p.tema === t).map((p) => (
              <li key={p.codigo} id={idPregunta(p.codigo)} className="scroll-mt-28 rounded-xl border border-[#DDE3EC] bg-white p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 min-w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 px-2 font-display text-sm font-bold text-amber-900">
                    {p.codigo}
                  </span>
                  <div className="min-w-0">
                    <h4 className={`font-display text-base font-bold ${ink}`}>{p.titulo}</h4>
                    <p className={`mt-1 text-sm leading-relaxed ${ink}`}>{p.texto}</p>
                    <p className={`mt-2 rounded-lg bg-[#E6F4F7] p-3 text-sm leading-relaxed ${ink}`}>
                      <strong>Lo que proponemos:</strong> {p.propuesta}
                    </p>
                    {p.avisos.length > 0 && (
                      <p className={`mt-2 text-xs ${muted}`}>
                        Afecta a:{" "}
                        {p.avisos.map((ref, i) => {
                          const href = enlace(ref);
                          return (
                            <span key={ref}>
                              {i > 0 && ", "}
                              {href ? <a href={href} className="font-semibold text-[#187B8E] underline underline-offset-2">{ref}</a> : ref}
                            </span>
                          );
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

// ── Más información (estados, reglas e IA) ────────────────────────────────────────────

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
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
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
        <div className={`rounded-lg border border-[#DDE3EC] bg-white p-4 text-sm leading-relaxed ${ink}`}>
          <p>
            Cuando la empresa elige un estado, antes de guardar ve exactamente el mail que le va a llegar al postulante,
            con su nombre y el puesto. Si escribe un mensaje y lo marca como visible, el mensaje va adentro del mail.
          </p>
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-3 rounded-lg border border-[#DDE3EC] bg-white p-4">
          {aviso ? (
            <>
              <p className={`text-xs font-bold uppercase tracking-wide ${ink}`}>Le va a llegar este mail al postulante ({aviso.codigo})</p>
              <p className={`mt-1 text-sm ${ink}`}><strong>Asunto:</strong> {aviso.asunto}</p>
              {aviso.demora_horas > 0 && (
                <p className={`mt-1 text-sm ${ink}`}>Sale {aviso.demora_horas} h después, y sólo si la empresa no cambia el estado antes.</p>
              )}
            </>
          ) : (
            <p className={`text-sm ${ink}`}>Este estado no manda mail: el postulante lo ve en su panel de postulaciones.</p>
          )}
        </div>
        {aviso && (
          <iframe
            title={`Mail: ${aviso.asunto}`}
            sandbox=""
            srcDoc={srcDocDe(aviso.html)}
            className="h-[560px] w-full rounded-lg border border-[#DDE3EC] bg-[#FAFBFD]"
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
    ["Pagos y cuenta", "Salen a cualquier hora, no cuentan para el tope y no se pueden dar de baja."],
    ["«No avanza»", "Los dos (revisión de perfil y después de entrevistas) esperan 24 h y se vuelven a chequear: si la empresa cambió de idea, no salen."],
    ["Confirmación", "Cada postulación tiene su mail de confirmación, con el puesto en el asunto."],
    ["Una semana sin entrar", "«¿Seguís buscando trabajo?» sale como mucho una vez cada 30 días. Si no vuelve después de 3, no se le escribe más."],
    ["Baja", "Todos los mails opcionales traen un link para dejar de recibirlos, por tipo. Los de cuenta y pagos no."],
    ["Resúmenes", "Si no hay nada que contar, no se manda nada."],
    ["WhatsApp", "Los mails de empresas llevan el WhatsApp de Talency (291 508-9353) con un link directo."],
    ["La IA", "Nunca manda mails ni cambia el estado de una postulación. La decisión es siempre de una persona."],
  ];
  return (
    <dl className="divide-y divide-[#DDE3EC] rounded-lg border border-[#DDE3EC] bg-white">
      {filas.map(([k, v]) => (
        <div key={k} className="grid gap-1 p-4 sm:grid-cols-[180px_1fr]">
          <dt className={`font-semibold ${ink}`}>{k}</dt>
          <dd className={`text-sm ${ink}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Chip({ children, tone = "n" }: { children: React.ReactNode; tone?: "n" | "t" | "o" }) {
  const c = tone === "t" ? "bg-[#E6F4F7] text-[#187B8E]" : tone === "o" ? "bg-[#F7EFE9] text-[#1C2230]" : "bg-slate-100 text-[#1C2230]";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

function IA({ ia }: { ia: DatosIA }) {
  if (!ia.disponible) {
    return <p className={`rounded-lg border border-[#DDE3EC] bg-white p-6 ${ink}`}>Esta sección se está preparando.</p>;
  }
  const sacado = ia.cv_ejemplo?.sacado ?? {};
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h4 className={`text-lg font-bold ${ink}`}>Cómo funciona, en cuatro pasos</h4>
        <ol className={`mt-2 list-decimal space-y-1 pl-5 text-sm ${ink}`}>
          <li>Lee el aviso y arma la lista de requisitos. Lo que no se puede pedir (edad, apariencia, género…) se descarta.</li>
          <li>Lee el CV de cada persona <strong>sin sus datos personales</strong>: nombre, DNI, teléfono, mail y fecha de nacimiento se sacan antes.</li>
          <li>Revisa requisito por requisito y, para cada uno que da por cumplido, copia la frase del CV que lo prueba. Si no la encuentra, queda «Sin dato» (que no es lo mismo que «No cumple»).</li>
          <li>El puntaje lo calcula el sistema con reglas fijas, no la IA. La empresa ve la lista ordenada y decide: la IA nunca descarta a nadie, no manda mails ni cambia estados.</li>
        </ol>
      </section>
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h4 className={`text-lg font-bold ${ink}`}>El aviso de ejemplo</h4>
        <p className={`mt-1 font-semibold ${ink}`}>{ia.puesto}</p>
        <p className={`mt-1 text-sm ${ink}`}>{ia.descripcion}</p>
      </section>
      <section className="rounded-lg border border-[#DDE3EC] bg-white p-5">
        <h4 className={`text-lg font-bold ${ink}`}>Paso 1. Qué entendió la IA que pide el aviso</h4>
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
          <h4 className={`text-lg font-bold ${ink}`}>Paso 2. Así le llega un CV a la IA</h4>
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
        <h4 className={`text-lg font-bold ${ink}`}>Pasos 3 y 4. Lo que ve la empresa</h4>
        <p className={`mt-1 text-sm ${ink}`}>A partir de 70 puntos el perfil aparece como «Recomendado». Debajo, el resto sigue visible, ordenado.</p>
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
              {c.alerta && <p className={`mt-2 rounded-md bg-[#F7EFE9] p-2 text-sm ${ink}`}><strong>Atención:</strong> {c.alerta}</p>}
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
                        <td className="whitespace-nowrap py-1.5 pr-3">{r.veredicto}</td>
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

function Desplegable({ titulo, bajada, children }: { titulo: string; bajada: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-[#DDE3EC] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
        <span>
          <span className={`block font-display text-base font-bold ${ink}`}>{titulo}</span>
          <span className={`block text-sm ${muted}`}>{bajada}</span>
        </span>
        <span className="shrink-0 text-[#187B8E] transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="border-t border-[#DDE3EC] bg-[#FAFBFD] p-4 sm:p-5">{children}</div>
    </details>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────────────

export default function VistaPrevia({
  etapas, avisos, sinMail, preguntas, ia,
}: {
  etapas: Etapa[]; avisos: Aviso[]; sinMail: SinMail[]; preguntas: Pregunta[]; ia: DatosIA;
}) {
  const ordenados = [...avisos].sort((a, b) => a.orden - b.orden);
  return (
    <main className="min-h-screen bg-[#FAFBFD] pb-16 pt-28 sm:pt-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h1 className={`font-display text-3xl font-extrabold tracking-tight sm:text-4xl ${ink}`}>
          Vista previa de los mails automáticos
        </h1>
        <p className={`mt-2 max-w-3xl text-base ${ink}`}>
          Para revisar con calma: qué mail recibe cada persona, en qué momento y con qué texto.
        </p>

        <Intro avisos={ordenados} preguntas={preguntas} />

        <details className="mt-6 rounded-xl border border-[#DDE3EC] bg-white lg:hidden">
          <summary className={`cursor-pointer p-4 font-display text-base font-bold ${ink}`}>Índice: ir a un aviso</summary>
          <div className="border-t border-[#DDE3EC] p-4">
            <Indice etapas={etapas} avisos={ordenados} />
          </div>
        </details>

        <div className="mt-8 grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-[#DDE3EC] bg-white p-4">
              <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${muted}`}>Índice</p>
              <Indice etapas={etapas} avisos={ordenados} />
            </div>
          </aside>

          <div className="min-w-0 space-y-14">
            {GRUPOS.map((g) => (
              <Grupo key={g.clave} grupo={g} etapas={etapas} avisos={ordenados} sinMail={sinMail} preguntas={preguntas} />
            ))}

            <section id="mas-informacion" className="scroll-mt-28 space-y-3">
              <div className="border-b-4 border-[#D4B7A2] pb-3">
                <h2 className={`font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${ink}`}>Más información</h2>
                <p className={`mt-1 text-sm ${muted}`}>Para ver cuando quieras. Tocá cada título para abrirlo.</p>
              </div>
              <Desplegable titulo="Qué ve la empresa al cambiar el estado de una postulación" bajada="Elegí un estado y mirá el mail que le llega al postulante.">
                <Estados avisos={ordenados} />
              </Desplegable>
              <Desplegable titulo="Reglas generales de envío" bajada="Horarios, topes por día y cómo darse de baja.">
                <Reglas />
              </Desplegable>
              <Desplegable titulo="Cómo trabaja la IA con los perfiles recomendados" bajada="Una búsqueda de ejemplo, paso a paso.">
                <IA ia={ia} />
              </Desplegable>
            </section>

            <Preguntas preguntas={preguntas} avisos={ordenados} />
          </div>
        </div>
      </div>
    </main>
  );
}
