"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, animate, motion } from "framer-motion";

// Pasos del recorrido. Cada uno: texto a la izquierda, demo interactiva a la derecha.
// Fuente de los hechos: INFORME-MAILS-IA-EUGENIA (10/11/2026) y el estado del lanzamiento al
// 11/11/2026. Si cambia algo del lanzamiento, se actualiza en LANZAMIENTO (abajo) y nada más.

export interface PasoProps {
  siguiente: () => void;
  vistaPrevia: string;
}

// ── Estado del lanzamiento ────────────────────────────────────────────────────────────

type EstadoEtapa = "hecho" | "en-curso" | "falta";
const LANZAMIENTO: { titulo: string; detalle: string; estado: EstadoEtapa }[] = [
  {
    titulo: "Todo construido y probado",
    detalle: "Mails, recomendados con IA, campañas y presentación a empresas. Más de 700 pruebas automáticas pasan antes de cada subida.",
    estado: "hecho",
  },
  {
    titulo: "Copia de seguridad de la base",
    detalle: "Antes de tocar nada, el 11/11 se guardó una copia completa de los datos del sitio.",
    estado: "hecho",
  },
  {
    titulo: "Direcciones de mail verificadas",
    detalle: "avisos@ y empleos@ ya están verificadas. contacto@ se suma con el plan pago del servicio de mails.",
    estado: "hecho",
  },
  {
    titulo: "Subido al sitio, apagado",
    detalle: "Está todo adentro de bbjobs.com.ar pero apagado: lo que ve la gente no cambia.",
    estado: "hecho",
  },
  {
    titulo: "Unos días mirando que todo ande",
    detalle: "Antes de prender nada, se controla que el sitio siga funcionando igual que siempre.",
    estado: "en-curso",
  },
  {
    titulo: "Prender la IA y probarla",
    detalle: "Con búsquedas reales: si recomienda bien y si el porqué tiene sentido.",
    estado: "falta",
  },
  {
    titulo: "Prender los mails, de a poco",
    detalle: "Arrancan con pocos por día y suben semana a semana, para que no caigan en spam.",
    estado: "falta",
  },
  {
    titulo: "Presentar BBJobs a las empresas de la zona",
    detalle: "Cuando esté la casilla de Talency para recibir las respuestas.",
    estado: "falta",
  },
];
const PESO: Record<EstadoEtapa, number> = { hecho: 1, "en-curso": 0.5, falta: 0 };
const PORCENTAJE = Math.round(
  (LANZAMIENTO.reduce((s, e) => s + PESO[e.estado], 0) / LANZAMIENTO.length) * 100,
);

// ── Piezas comunes ────────────────────────────────────────────────────────────────────

const SUAVE = [0.22, 1, 0.36, 1] as const;

function Escena({
  capitulo,
  titulo,
  bajada,
  children,
  demo,
}: {
  capitulo: string;
  titulo: ReactNode;
  bajada?: ReactNode;
  children?: ReactNode;
  demo: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:py-14">
      <div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-bold uppercase tracking-[0.16em] text-primary"
        >
          {capitulo}
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-3 font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-text sm:text-4xl"
        >
          {titulo}
        </motion.h2>
        {bajada && (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-base leading-relaxed text-text-muted sm:text-lg"
          >
            {bajada}
          </motion.p>
        )}
        {children && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mt-6"
          >
            {children}
          </motion.div>
        )}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.12, duration: 0.5, ease: SUAVE }}
        className="min-w-0"
      >
        {demo}
      </motion.div>
    </div>
  );
}

function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border border-border bg-white p-5 shadow-[0_20px_60px_-30px_rgba(28,34,48,0.35)] sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function Anillo({
  valor,
  tam = 160,
  grosor = 12,
  color = "#1E8EA3",
  children,
}: {
  valor: number;
  tam?: number;
  grosor?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (tam - grosor) / 2;
  return (
    <div className="relative shrink-0" style={{ width: tam, height: tam }}>
      <svg width={tam} height={tam} className="-rotate-90" aria-hidden>
        <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke="#E6F4F7" strokeWidth={grosor} />
        <motion.circle
          cx={tam / 2}
          cy={tam / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: valor / 100 }}
          transition={{ duration: 1.2, ease: SUAVE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

function Contador({ hasta, duracion = 1.4 }: { hasta: number; duracion?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, hasta, { duration: duracion, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [hasta, duracion]);
  return <span className="tabular-nums">{v.toLocaleString("es-AR")}</span>;
}

function Tilde({ ok = true }: { ok?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-bold ${
        ok ? "bg-primary-light text-primary" : "bg-[#FDECEC] text-[#C2410C]"
      }`}
    >
      {ok ? "✓" : "✕"}
    </span>
  );
}

function ListaTildes({ items, ok = true }: { items: ReactNode[]; ok?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 + i * 0.08 }}
          className="flex gap-3 text-[15px] leading-snug text-text"
        >
          <Tilde ok={ok} />
          <span>{it}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function Chip({ children, tono = "teal" }: { children: ReactNode; tono?: "teal" | "arena" | "gris" | "rojo" }) {
  const t = {
    teal: "bg-primary-light text-primary-hover",
    arena: "bg-secondary-light text-[#8A6A52]",
    gris: "border border-border bg-bg text-text-muted",
    rojo: "bg-[#FDECEC] text-[#B42318]",
  }[tono];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${t}`}>{children}</span>;
}

function NotaEjemplo({ texto = "Ejemplo con personas y empresas inventadas." }: { texto?: string }) {
  return <p className="mt-3 text-center text-[11px] text-text-muted">{texto}</p>;
}

// ── 1. Portada ────────────────────────────────────────────────────────────────────────

function PasoInicio({ siguiente }: PasoProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-14 text-center sm:px-6 sm:py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 140, damping: 16 }}
      >
        <Image src="/logo.png" alt="BBJobs" width={110} height={139} className="h-16 w-auto" priority />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-primary"
      >
        Hola, Eugenia
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-text sm:text-6xl"
      >
        Todo lo nuevo de BBJobs,{" "}
        <span className="bg-gradient-to-r from-primary to-[#3FB3C7] bg-clip-text text-transparent">paso a paso</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-5 max-w-xl text-lg leading-relaxed text-text-muted"
      >
        Qué se construyó, cómo funciona cuando una empresa publica una búsqueda y qué falta para
        prenderlo. Andá a tu ritmo: cada pantalla es una sola idea, y casi todas se pueden tocar.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-10"
      >
        <Anillo valor={PORCENTAJE} tam={176} grosor={14}>
          <div>
            <div className="font-display text-4xl font-extrabold text-text">
              <Contador hasta={PORCENTAJE} duracion={1.2} />%
            </div>
            <div className="text-xs font-semibold text-text-muted">del lanzamiento</div>
          </div>
        </Anillo>
      </motion.div>

      <motion.button
        type="button"
        onClick={siguiente}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
        className="mt-10 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/30 transition-colors hover:bg-primary-hover"
      >
        Empezar el recorrido →
      </motion.button>
      <p className="mt-4 text-sm text-text-muted">12 pasos · unos 5 minutos</p>
    </div>
  );
}

// ── 2. Lo que ya está en el sitio ─────────────────────────────────────────────────────

const RESULTADOS = [
  {
    url: "bbjobs.com.ar",
    titulo: "BBJobs | Empleos y bolsa de trabajo en Bahía Blanca",
    texto: "Búsquedas de empresas verificadas de Bahía Blanca y la zona.",
  },
  {
    url: "bbjobs.com.ar › empleos",
    titulo: "Empleos en Bahía Blanca: ofertas de trabajo activas | BBJobs",
    texto: "Cada búsqueda con su propia página, su empresa y su zona.",
  },
  {
    url: "bbjobs.com.ar › empresas",
    titulo: "Para empresas: encontrá personal en Bahía Blanca | BBJobs",
    texto: "Las empresas que publican, cada una con su ficha.",
  },
];

function DemoGoogle() {
  const frase = "trabajo en bahía blanca";
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => Math.min(v + 1, frase.length)), 65);
    return () => clearInterval(id);
  }, []);
  const listo = n >= frase.length;
  return (
    <Tarjeta>
      <div className="flex items-center gap-3 rounded-full border border-border px-4 py-2.5 shadow-sm">
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="text-[15px] text-text">
          {frase.slice(0, n)}
          {!listo && <span className="cursor-blink text-primary">|</span>}
        </span>
      </div>
      <div className="mt-5 space-y-5">
        {RESULTADOS.map((r, i) => (
          <motion.div
            key={r.titulo}
            initial={{ opacity: 0, y: 10 }}
            animate={listo ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ delay: 0.15 + i * 0.25 }}
          >
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border border-border bg-white">
                <Image src="/logo.png" alt="" width={16} height={20} className="h-3.5 w-auto" />
              </span>
              {r.url}
            </div>
            <div className="mt-1 text-[17px] font-medium leading-snug text-[#1a0dab]">{r.titulo}</div>
            <div className="text-sm text-text-muted">{r.texto}</div>
          </motion.div>
        ))}
      </div>
      <NotaEjemplo texto="Así se presentan las páginas del sitio en Google. En qué lugar aparecen lo decide Google." />
    </Tarjeta>
  );
}

function PasoSitio() {
  return (
    <Escena
      capitulo="Ya está andando"
      titulo="Primero, lo que ya está en el sitio"
      bajada="Antes de los módulos nuevos se trabajó para que Google entienda BBJobs y lo muestre a quien busca trabajo en la zona. Eso ya está publicado."
      demo={<DemoGoogle />}
    >
      <ListaTildes
        items={[
          "Cada búsqueda y cada empresa tiene su propia página, preparada para aparecer en Google.",
          "Los 11 sectores de selección de personal tienen texto propio.",
          "Google entiende que BBJobs es de Talency.",
          "Una búsqueda que aprobás aparece en el sitio enseguida, sin esperar.",
        ]}
      />
    </Escena>
  );
}

// ── 3. La rueda: el viaje de una búsqueda ─────────────────────────────────────────────

type Actor = "Empresa" | "Talency" | "BBJobs" | "Candidato";
const COLOR_ACTOR: Record<Actor, string> = {
  Empresa: "#D4B7A2",
  Talency: "#1C2230",
  BBJobs: "#1E8EA3",
  Candidato: "#3FB3C7",
};
const VIAJE: { actor: Actor; titulo: string; texto: string }[] = [
  { actor: "Empresa", titulo: "Publica una búsqueda", texto: "Carga el puesto, los requisitos y marca cuáles son excluyentes." },
  { actor: "Talency", titulo: "La revisa y la aprueba", texto: "Nada se publica sin que ustedes la miren. Si necesita cambios, a la empresa le llega un mail para corregirla." },
  { actor: "BBJobs", titulo: "Busca quién encaja", texto: "Compara la búsqueda con los perfiles: requisitos, experiencia, estudios, zona y modalidad." },
  { actor: "Candidato", titulo: "Le llega «Salió una búsqueda que encaja con vos»", texto: "Con el porqué: «En tu zona · Presencial, como buscás · Pide Excel». Como mucho un mail por día." },
  { actor: "Candidato", titulo: "Se postula", texto: "Le llega «Postulación confirmada» y la búsqueda queda en su panel." },
  { actor: "Empresa", titulo: "Ve quién encaja mejor", texto: "Los postulantes ordenados con el porqué de cada uno, y un resumen diario en vez de un mail por postulación." },
  { actor: "Candidato", titulo: "Se entera de cada avance", texto: "Cuando la empresa abre su CV o cambia el estado, le llega un mail. Los «No avanza» esperan 24 horas por si fue un error." },
];

function Rueda() {
  const [activo, setActivo] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setActivo((v) => (v + 1) % VIAJE.length), 3200);
    return () => clearInterval(id);
  }, [auto]);
  const n = VIAJE.length;
  const R = 41; // % del radio, para posicionar los nodos
  const paso = VIAJE[activo];
  return (
    <Tarjeta className="p-4! sm:p-6!">
      <div className="relative mx-auto aspect-square w-full max-w-[420px]">
        {/* aro */}
        <div className="absolute inset-[9%] rounded-full border-2 border-dashed border-primary-mid/70" />
        {/* aguja que gira hasta el paso activo */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: (activo * 360) / n }}
          transition={{ type: "spring", stiffness: 60, damping: 14 }}
        >
          <div className="absolute left-1/2 top-[9%] h-[41%] w-[2px] -translate-x-1/2 bg-gradient-to-b from-primary to-transparent" />
        </motion.div>
        {/* centro */}
        <div className="absolute inset-[27%] grid place-items-center rounded-full bg-gradient-to-br from-primary-light to-white text-center shadow-inner">
          <AnimatePresence mode="wait">
            <motion.div
              key={activo}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="px-3"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: COLOR_ACTOR[paso.actor] === "#D4B7A2" ? "#8A6A52" : COLOR_ACTOR[paso.actor] }}>
                {paso.actor}
              </div>
              <div className="mt-1 font-display text-sm font-bold leading-tight text-text sm:text-base">{paso.titulo}</div>
            </motion.div>
          </AnimatePresence>
        </div>
        {/* nodos */}
        {VIAJE.map((v, i) => {
          const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
          const left = 50 + R * Math.cos(ang);
          const top = 50 + R * Math.sin(ang);
          const on = i === activo;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                setActivo(i);
                setAuto(false);
              }}
              aria-label={`${i + 1}. ${v.actor}: ${v.titulo}`}
              aria-pressed={on}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <motion.span
                animate={{ scale: on ? 1.18 : 1 }}
                className="grid h-11 w-11 place-items-center rounded-full border-2 bg-white font-display text-sm font-extrabold shadow-md sm:h-12 sm:w-12"
                style={{
                  borderColor: COLOR_ACTOR[v.actor],
                  color: on ? "#fff" : "#1C2230",
                  backgroundColor: on ? COLOR_ACTOR[v.actor] : "#fff",
                  boxShadow: on ? `0 0 0 8px ${COLOR_ACTOR[v.actor]}33` : undefined,
                }}
              >
                {i + 1}
              </motion.span>
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={activo}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="mx-auto mt-2 min-h-[3.5rem] max-w-md text-center text-[15px] leading-snug text-text"
        >
          {paso.texto}
        </motion.p>
      </AnimatePresence>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {(Object.keys(COLOR_ACTOR) as Actor[]).map((a) => (
          <span key={a} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_ACTOR[a] }} />
            {a}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setAuto((v) => !v)}
          className="ml-2 rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-muted transition hover:border-primary-mid hover:text-primary"
        >
          {auto ? "❚❚ Pausar" : "▶ Reproducir"}
        </button>
      </div>
    </Tarjeta>
  );
}

function PasoViaje() {
  return (
    <Escena
      capitulo="Cómo funciona"
      titulo="La vida de una búsqueda, de punta a punta"
      bajada="Así se mueve todo cuando una empresa publica. La rueda gira sola; tocá cualquier número para frenarla ahí."
      demo={<Rueda />}
    >
      <div className="rounded-2xl border border-primary-mid/60 bg-primary-light/60 p-4 text-[15px] leading-snug text-text">
        <strong className="font-semibold">La idea de fondo:</strong> el candidato no tiene que configurar
        nada y la empresa no tiene que buscar a nadie. BBJobs los acerca, y en cada paso decide una persona.
      </div>
    </Escena>
  );
}

// ── 4. ¿Quién encaja mejor? (IA) ──────────────────────────────────────────────────────

interface Requisito {
  texto: string;
  excluyente: boolean;
}
const REQUISITOS: Requisito[] = [
  { texto: "Excel avanzado", excluyente: true },
  { texto: "Experiencia en facturación", excluyente: true },
  { texto: "Estudios contables", excluyente: false },
  { texto: "Jornada completa", excluyente: false },
];
const CANDIDATOS: {
  nombre: string;
  zona: string;
  puntaje: number;
  evidencias: (string | null)[];
  porque: string[];
}[] = [
  {
    nombre: "Lucía",
    zona: "Bahía Blanca",
    puntaje: 91,
    evidencias: [
      "«Armado de tablas dinámicas y reportes en Excel para el cierre mensual»",
      "«3 años en facturación y cuentas corrientes en una distribuidora»",
      "«Técnica Superior en Administración Contable»",
      "En su perfil: busca jornada completa",
    ],
    porque: ["En Bahía Blanca, como la búsqueda", "Cumple los 2 excluyentes", "Busca jornada completa"],
  },
  {
    nombre: "Martín",
    zona: "Punta Alta",
    puntaje: 72,
    evidencias: [
      "«Manejo de Excel: fórmulas, tablas dinámicas y gráficos»",
      null,
      "«Estudiante de Contador Público, 3.er año»",
      "En su perfil: busca jornada completa",
    ],
    porque: ["En Punta Alta, cerca", "Cumple 1 de los 2 excluyentes", "Estudia Contador Público"],
  },
  {
    nombre: "Sofía",
    zona: "Lejos de Bahía Blanca",
    puntaje: 44,
    evidencias: ["«Excel avanzado, certificado»", null, null, null],
    porque: ["Vive lejos de la búsqueda", "Cumple 1 de los 2 excluyentes", "No consta experiencia en facturación"],
  },
];
const etiquetaEncaje = (p: number) => (p >= 80 ? "Encaja muy bien" : p >= 60 ? "Encaja bien" : "Encaja poco");
const colorEncaje = (p: number) => (p >= 80 ? "#1E8EA3" : p >= 60 ? "#3FB3C7" : "#D4B7A2");

function DemoIA() {
  const [sel, setSel] = useState(0);
  const c = CANDIDATOS[sel];
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Búsqueda</div>
          <div className="font-display text-lg font-bold text-text">Administrativo/a contable · Bahía Blanca</div>
        </div>
        <Chip tono="arena">¿Quién encaja mejor?</Chip>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Candidatos">
        {CANDIDATOS.map((k, i) => (
          <button
            key={k.nombre}
            type="button"
            role="tab"
            aria-selected={i === sel}
            onClick={() => setSel(i)}
            className={`relative rounded-2xl border px-2 py-2.5 text-left transition ${
              i === sel ? "border-primary bg-primary-light" : "border-border bg-white hover:border-primary-mid"
            }`}
          >
            <div className="text-[11px] font-bold text-text-muted">#{i + 1}</div>
            <div className="font-semibold text-text">{k.nombre}</div>
            <div className="text-xs font-semibold" style={{ color: colorEncaje(k.puntaje) === "#D4B7A2" ? "#8A6A52" : colorEncaje(k.puntaje) }}>
              {k.puntaje} · {etiquetaEncaje(k.puntaje)}
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={sel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start"
        >
          <div className="mx-auto">
            <Anillo valor={c.puntaje} tam={128} grosor={11} color={colorEncaje(c.puntaje)}>
              <div>
                <div className="font-display text-3xl font-extrabold text-text">
                  <Contador hasta={c.puntaje} duracion={1} />
                </div>
                <div className="text-[11px] font-semibold text-text-muted">{c.zona}</div>
              </div>
            </Anillo>
          </div>
          <ul className="space-y-2.5">
            {REQUISITOS.map((r, i) => {
              const ev = c.evidencias[i];
              return (
                <motion.li
                  key={r.texto}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.12 }}
                  className="flex gap-2.5"
                >
                  <Tilde ok={ev !== null} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-text">
                      {r.texto}
                      {r.excluyente && <Chip tono="arena">Excluyente · pesa doble</Chip>}
                    </div>
                    <div className="text-[13px] leading-snug text-text-muted">{ev ?? "No aparece en el CV."}</div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </motion.div>
      </AnimatePresence>
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
        <span className="mr-1 text-xs font-semibold text-text-muted">Por qué:</span>
        {c.porque.map((p) => (
          <Chip key={p} tono="gris">
            {p}
          </Chip>
        ))}
      </div>
      <NotaEjemplo texto="Ejemplo con personas inventadas. Tocá cada candidato." />
    </Tarjeta>
  );
}

function PasoIA() {
  return (
    <Escena
      capitulo="Candidatos recomendados con IA"
      titulo="Para cada búsqueda, quién encaja mejor y por qué"
      bajada="La IA lee el CV y, requisito por requisito, dice si lo cumple copiando la frase que lo prueba. Así nadie tiene que creerle a ciegas."
      demo={<DemoIA />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Los requisitos", "uno por uno"],
            ["El perfil", "experiencia, estudios, modalidad"],
            ["La zona", "por cercanía real"],
            ["El parecido", "entre el CV y el aviso"],
          ].map(([a, b]) => (
            <div key={a} className="rounded-xl border border-border bg-white px-3 py-2">
              <div className="font-semibold text-text">{a}</div>
              <div className="text-xs text-text-muted">{b}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl bg-text p-4 text-white">
          <div className="text-xs font-bold uppercase tracking-wider text-primary-mid">Lo que la IA nunca hace</div>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-snug">
            <li>· No usa edad ni género.</li>
            <li>· No manda mails ni cambia el estado de una postulación: sólo sugiere, decide la empresa.</li>
            <li>· El CV sale de BBJobs sin nombre ni datos de contacto.</li>
          </ul>
        </div>
      </div>
    </Escena>
  );
}

// ── 5. Mails al candidato (teléfono) ──────────────────────────────────────────────────

interface MailDemo {
  asunto: string;
  cuando: string;
  nuevo?: boolean;
  detalle?: ReactNode;
}
const MAILS_CANDIDATO: MailDemo[] = [
  { asunto: "Bienvenido/a a BBJobs", cuando: "Apenas se registra." },
  {
    asunto: "Salió una búsqueda que encaja con vos",
    cuando: "Cuando aprobás una búsqueda, a quienes encajan bien con ella.",
    nuevo: true,
    detalle: (
      <div className="rounded-xl border border-border bg-bg p-3">
        <div className="text-[11px] font-semibold text-text-muted">Distribuidora del Sur · Bahía Blanca</div>
        <div className="font-semibold text-text">Administrativo/a contable</div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Chip>En tu zona</Chip>
          <Chip>Presencial, como buscás</Chip>
          <Chip>Pide Excel</Chip>
        </div>
        <div className="mt-3 rounded-lg bg-primary py-1.5 text-center text-xs font-semibold text-white">Postularme</div>
      </div>
    ),
  },
  { asunto: "Postulación confirmada", cuando: "Cada vez que se postula." },
  { asunto: "Tu perfil fue revisado", cuando: "Cuando la empresa abre su CV por primera vez." },
  { asunto: "Tu postulación avanzó", cuando: "Cuando la empresa cambia el estado." },
  { asunto: "Una empresa vio tu perfil", cuando: "Cuando una empresa lo abre en la Base de Talento." },
  { asunto: "Búsquedas para vos", cuando: "Los lunes, con las búsquedas que encajan con su perfil.", nuevo: true },
  { asunto: "Completá tu perfil", cuando: "Recordatorio, con tope para no molestar." },
];

function Telefono({ mails, remitente }: { mails: MailDemo[]; remitente: string }) {
  const [visibles, setVisibles] = useState(0);
  const [abierto, setAbierto] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setVisibles((v) => (v < mails.length ? v + 1 : v)), 450);
    return () => clearInterval(id);
  }, [mails.length]);
  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="rounded-[2.6rem] border-[10px] border-text bg-text shadow-2xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-white">
          <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[11px] font-semibold text-text">
            <span>9:41</span>
            <span className="h-4 w-16 rounded-full bg-text" />
            <span>●●●</span>
          </div>
          <div className="border-b border-border px-4 pb-2.5 pt-1">
            <div className="font-display text-lg font-bold text-text">Recibidos</div>
          </div>
          <div className="h-[430px] overflow-y-auto">
            {mails.slice(0, visibles).map((m, i) => {
              const on = abierto === i;
              return (
                <motion.div
                  key={m.asunto}
                  initial={{ opacity: 0, y: -14, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  transition={{ duration: 0.35, ease: SUAVE }}
                  className="border-b border-border/70"
                >
                  <button
                    type="button"
                    onClick={() => setAbierto(on ? null : i)}
                    aria-expanded={on}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition ${on ? "bg-primary-light/60" : "hover:bg-bg"}`}
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">BB</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-[12px] text-text-muted">
                        <span className="truncate font-semibold text-text">{remitente}</span>
                        {m.nuevo && <span className="shrink-0 rounded-full bg-secondary px-1.5 py-px text-[10px] font-bold text-white">Nuevo</span>}
                      </span>
                      <span className="block truncate text-[13.5px] font-semibold text-text">{m.asunto}</span>
                      <span className="block truncate text-[12px] text-text-muted">{m.cuando}</span>
                    </span>
                  </button>
                  <AnimatePresence>
                    {on && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden px-4"
                      >
                        <div className="pb-3 text-[13px] leading-snug text-text">
                          <p className="mb-2">
                            <strong>Cuándo sale:</strong> {m.cuando}
                          </p>
                          {m.detalle}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
      <NotaEjemplo texto="Tocá cualquier mail para ver cuándo sale." />
    </div>
  );
}

function PasoMailsCandidato() {
  return (
    <Escena
      capitulo="Mails al candidato"
      titulo="Al candidato le llega lo justo, en el momento justo"
      bajada="Salen solos, con tus textos, tu firma y un link para elegir qué mails recibe. Los dos nuevos lo traen de vuelta al sitio cuando aparece algo para él."
      demo={<Telefono mails={MAILS_CANDIDATO} remitente="BBJobs" />}
    >
      <div className="rounded-2xl border border-border bg-white p-4">
        <div className="font-semibold text-text">«Salió una búsqueda que encaja con vos»</div>
        <ul className="mt-2 space-y-1.5 text-[14px] leading-snug text-text-muted">
          <li>· BBJobs decide qué mandarle según su perfil, como hace LinkedIn: no tiene que armar alertas.</li>
          <li>· Como mucho uno por día; si salen varias búsquedas, van juntas.</li>
          <li>· Nunca repite una búsqueda ni le manda una a la que ya se postuló.</li>
          <li>· Sólo a quien entró a BBJobs en los últimos 30 días.</li>
        </ul>
      </div>
    </Escena>
  );
}

// ── 6. Mails a la empresa ─────────────────────────────────────────────────────────────

const GRUPOS_EMPRESA: { titulo: string; icono: string; mails: string[] }[] = [
  { titulo: "Su cuenta", icono: "◆", mails: ["Registro recibido", "Ya podés publicar", "Verificación rechazada, con el motivo"] },
  {
    titulo: "Sus búsquedas",
    icono: "▲",
    mails: ["Búsqueda publicada", "Necesita cambios", "Dada de baja · Reactivada", "Por vencer · Vencida"],
  },
  { titulo: "Un empujón", icono: "●", mails: ["Una semana sin postulaciones, con consejos", "Publicá tu primera búsqueda"] },
  {
    titulo: "Sus candidatos",
    icono: "★",
    mails: ["Resumen diario de postulaciones", "Candidatos recomendados: uno por noche, sólo con los que encajan muy bien"],
  },
];

function DemoEmpresa() {
  const [abierto, setAbierto] = useState(3);
  return (
    <div className="space-y-4">
      <Tarjeta className="p-0! overflow-hidden">
        {GRUPOS_EMPRESA.map((g, i) => {
          const on = abierto === i;
          return (
            <div key={g.titulo} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => setAbierto(on ? -1 : i)}
                aria-expanded={on}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-bg"
              >
                <span className={`grid h-9 w-9 place-items-center rounded-xl text-sm ${on ? "bg-primary text-white" : "bg-primary-light text-primary"}`}>
                  {g.icono}
                </span>
                <span className="flex-1 font-semibold text-text">{g.titulo}</span>
                <span className="text-xs text-text-muted">{g.mails.length} mails</span>
                <motion.span animate={{ rotate: on ? 180 : 0 }} className="text-text-muted">
                  ▾
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden px-5"
                  >
                    {g.mails.map((m) => (
                      <li key={m} className="flex items-center gap-2 border-t border-dashed border-border py-2.5 text-[14px] text-text">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {m}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </Tarjeta>
      <Tarjeta>
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Así llega el resumen</div>
        <div className="mt-1 font-display text-lg font-bold text-text">
          Hoy recibiste <span className="text-primary">7 postulaciones</span> en 2 búsquedas
        </div>
        <div className="mt-3 space-y-2">
          {[
            ["Operario/a de depósito", 5, "2 encajan muy bien"],
            ["Administrativo/a contable", 2, "1 encaja muy bien"],
          ].map(([t, n, r], i) => (
            <motion.div
              key={t as string}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15 }}
              className="flex items-center justify-between rounded-xl bg-bg px-3 py-2 text-sm"
            >
              <span className="font-semibold text-text">{t}</span>
              <span className="text-text-muted">
                {n} nuevas · <span className="font-semibold text-primary">{r}</span>
              </span>
            </motion.div>
          ))}
        </div>
        <NotaEjemplo />
      </Tarjeta>
    </div>
  );
}

function PasoMailsEmpresa() {
  return (
    <Escena
      capitulo="Mails a la empresa"
      titulo="La empresa siempre sabe en qué está, sin que la llenemos de mails"
      bajada="Avisos de su cuenta y de sus búsquedas, un empujón cuando algo no arranca, y lo más importante: sus candidatos, agrupados en un resumen."
      demo={<DemoEmpresa />}
    >
      <ListaTildes
        items={[
          "Un resumen por día con las postulaciones, no un mail por cada una.",
          "Un resumen sin novedades no sale.",
          "En el panel, un aviso: «5 candidatos que encajan con Operario/a» y un contador en el menú.",
          "Puede marcar cada recomendación como buena o mala.",
        ]}
      />
    </Escena>
  );
}

// ── 7. Reglas para no molestar (reloj) ────────────────────────────────────────────────

function Reloj() {
  const [hora, setHora] = useState(23);
  const enHorario = hora >= 8 && hora < 21;
  const size = 260;
  const c = size / 2;
  const rArco = 104;
  // arco del horario permitido, de 8 a 21 (reloj de 24 h, 0 arriba)
  const angulo = (h: number) => (h / 24) * 2 * Math.PI - Math.PI / 2;
  const punto = (h: number, r: number) => [c + r * Math.cos(angulo(h)), c + r * Math.sin(angulo(h))];
  const [x1, y1] = punto(8, rArco);
  const [x2, y2] = punto(21, rArco);
  const arco = `M ${x1} ${y1} A ${rArco} ${rArco} 0 1 1 ${x2} ${y2}`;
  return (
    <Tarjeta>
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <div className="relative mx-auto" style={{ width: size, height: size }}>
          <svg width={size} height={size} aria-hidden>
            <circle cx={c} cy={c} r={rArco} fill="none" stroke="#EEF1F6" strokeWidth={18} />
            <motion.path
              d={arco}
              fill="none"
              stroke="#1E8EA3"
              strokeWidth={18}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: SUAVE }}
            />
            {Array.from({ length: 24 }, (_, h) => {
              const [a, b] = punto(h, 126);
              return (
                <text key={h} x={a} y={b} textAnchor="middle" dominantBaseline="central" fontSize={h % 3 === 0 ? 11 : 0} fill="#64748B" fontWeight={600}>
                  {h}
                </text>
              );
            })}
          </svg>
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: (hora / 24) * 360 }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
          >
            <div className="absolute left-1/2 top-[22px] h-[108px] w-1 -translate-x-1/2 rounded-full bg-text" />
          </motion.div>
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center shadow-md">
              <div>
                <div className="font-display text-2xl font-extrabold tabular-nums text-text">{String(hora).padStart(2, "0")}:00</div>
                <div className={`text-[10px] font-bold ${enHorario ? "text-primary" : "text-[#8A6A52]"}`}>{enHorario ? "en horario" : "de noche"}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-text-muted">Mové la hora</span>
            <input
              type="range"
              min={0}
              max={23}
              value={hora}
              onChange={(e) => setHora(Number(e.target.value))}
              className="mt-1 w-full accent-[#1E8EA3]"
            />
          </label>
          <div className="rounded-xl border border-border p-3">
            <div className="text-[13px] font-semibold text-text">«Ya podés publicar»</div>
            <div className="text-xs text-text-muted">Es de su cuenta: la empresa lo está esperando.</div>
            <div className="mt-1.5"><Chip>Sale en el momento</Chip></div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-[13px] font-semibold text-text">«Postulación confirmada» o «Salió una búsqueda que encaja con vos»</div>
            <div className="text-xs text-text-muted">No son urgentes.</div>
            <div className="mt-1.5">
              <AnimatePresence mode="wait">
                <motion.span key={String(enHorario)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="inline-block">
                  {enHorario ? <Chip>Sale ahora</Chip> : <Chip tono="arena">Espera hasta las 8:00</Chip>}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </Tarjeta>
  );
}

function PasoReglas() {
  return (
    <Escena
      capitulo="Las reglas para no molestar"
      titulo="Lo que no es urgente, nunca de noche"
      bajada="Lo que no es urgente sale entre las 8 y las 21. Sólo los avisos de la cuenta salen a cualquier hora. Mové la aguja del reloj y fijate qué pasa con cada mail."
      demo={<Reloj />}
    >
      <ListaTildes
        items={[
          "Nadie recibe más de 2 mails por día de los que no son urgentes.",
          "Si un mail rebota o lo marcan como spam, esa persona no recibe nada más.",
          "Todo aviso queda también en la campanita del panel, aunque el mail no salga.",
          "Cada persona elige qué mails recibe, con un link en el mismo mail.",
        ]}
      />
    </Escena>
  );
}

// ── 8. Tu panel de control (interruptores) ────────────────────────────────────────────

const MODULOS: { nombre: string; que: string }[] = [
  { nombre: "Mails a candidatos", que: "Bienvenida, postulaciones, avances y búsquedas que encajan." },
  { nombre: "Mails a empresas", que: "Su cuenta, sus búsquedas y el resumen diario." },
  { nombre: "Candidatos recomendados con IA", que: "«¿Quién encaja mejor?» en cada búsqueda." },
  { nombre: "Buscador inteligente", que: "Entiende «algo de administración part time en Punta Alta»." },
  { nombre: "Asistentes", que: "Ayudan a redactar la búsqueda y avisan si pide algo discriminatorio." },
  { nombre: "Campañas por mail", que: "A grupos que vos elegís, con tu aprobación." },
];

function Interruptor({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-[#CBD3DF]"}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${on ? "right-1" : "left-1"}`}
      />
    </button>
  );
}

function Panel() {
  const [prendidos, setPrendidos] = useState<boolean[]>(() => MODULOS.map(() => false));
  const cuantos = prendidos.filter(Boolean).length;
  return (
    <Tarjeta className="p-0! overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-bg px-5 py-3.5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Panel de Talency</div>
          <div className="font-display font-bold text-text">Mails e IA</div>
        </div>
        <motion.div key={cuantos} initial={{ scale: 0.85 }} animate={{ scale: 1 }}>
          <Chip tono={cuantos ? "teal" : "gris"}>
            {cuantos} de {MODULOS.length} prendidos
          </Chip>
        </motion.div>
      </div>
      <ul>
        {MODULOS.map((m, i) => (
          <li key={m.nombre} className="flex items-center gap-4 border-b border-border px-5 py-3.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-text">{m.nombre}</div>
              <div className="text-[13px] leading-snug text-text-muted">{m.que}</div>
            </div>
            <Interruptor
              on={prendidos[i]}
              label={m.nombre}
              onClick={() => setPrendidos((p) => p.map((v, j) => (j === i ? !v : v)))}
            />
          </li>
        ))}
      </ul>
      <p className="border-t border-border bg-bg px-5 py-2.5 text-center text-[11px] text-text-muted">
        Es una maqueta: probá prender y apagar. Lo que toques acá no cambia nada del sitio.
      </p>
    </Tarjeta>
  );
}

function PasoPanel() {
  return (
    <Escena
      capitulo="Vos tenés el control"
      titulo="Todo arranca apagado, y lo prendemos por partes"
      bajada="Cada módulo tiene su interruptor en Panel de Talency → Mails e IA. Si algo no te convence, lo apagás en el momento y no pasa nada."
      demo={<Panel />}
    >
      <div className="space-y-3 text-[15px] leading-snug text-text">
        <p>
          En <strong>Centro de IA</strong> vas a ver un panorama, los recomendados de cada búsqueda y lo que
          hizo la IA cada día, con botones para recalcular una búsqueda o volver a leer un CV.
        </p>
        <p>
          En <strong>Mails e IA</strong> ves cuánto se gasta en IA, con un tope por día para que nunca haya sorpresas.
        </p>
      </div>
    </Escena>
  );
}

// ── 9. Empresas a contactar ───────────────────────────────────────────────────────────

const TOQUES = [
  {
    dia: 0,
    titulo: "Presentación",
    texto:
      "«Les escribimos desde Talency, la consultora de recursos humanos de Bahía Blanca que lleva adelante BBJobs…» Cuenta que publicar es gratis, que cada empresa se verifica a mano y que Talency puede hacer la selección completa.",
  },
  {
    dia: 7,
    titulo: "Recordatorio",
    texto: "«Les escribimos la semana pasada para contarles de BBJobs. Por si les sirve, publicar una búsqueda es gratis…»",
  },
  {
    dia: 21,
    titulo: "Cierre",
    texto: "«Les escribimos por última vez, no queremos llenarles la casilla…»",
  },
];

function DemoContactar() {
  const [toque, setToque] = useState(0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Tarjeta className="p-4! text-center">
          <div className="font-display text-3xl font-extrabold text-text">
            <Contador hasta={6800} />
          </div>
          <div className="text-xs text-text-muted">empresas de la zona, aprox.</div>
        </Tarjeta>
        <Tarjeta className="p-4! text-center">
          <div className="font-display text-3xl font-extrabold text-primary">
            <Contador hasta={1000} duracion={1.8} />
          </div>
          <div className="text-xs text-text-muted">tienen mail</div>
        </Tarjeta>
      </div>
      <Tarjeta>
        <div className="relative flex items-center justify-between">
          <div className="absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-border" />
          <motion.div
            className="absolute left-6 top-1/2 h-0.5 -translate-y-1/2 bg-primary"
            animate={{ width: `calc((100% - 48px) * ${toque / 2})` }}
          />
          {TOQUES.map((t, i) => (
            <button
              key={t.dia}
              type="button"
              onClick={() => setToque(i)}
              aria-pressed={toque === i}
              className="relative z-10 flex flex-col items-center gap-1"
            >
              <span
                className={`grid h-12 w-12 place-items-center rounded-full border-2 font-display text-sm font-extrabold transition ${
                  i <= toque ? "border-primary bg-primary text-white" : "border-border bg-white text-text-muted"
                }`}
              >
                {t.dia === 0 ? "Día 0" : `Día ${t.dia}`}
              </span>
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={toque} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Mail {toque + 1} de 3 · {TOQUES[toque].titulo}
            </div>
            <div className="mt-2 rounded-xl border border-border bg-bg p-4 font-mono text-[13px] leading-relaxed text-text">
              <div className="mb-2 text-text-muted">
                De: Equipo de Talency
                <br />
                Asunto: {toque === 0 ? "" : "Re: "}BBJobs, el portal de empleos de Bahía Blanca
              </div>
              {TOQUES[toque].texto}
            </div>
          </motion.div>
        </AnimatePresence>
        <NotaEjemplo texto="Tocá cada día. Los textos completos se pueden editar antes de mandar." />
      </Tarjeta>
    </div>
  );
}

function PasoContactar() {
  return (
    <Escena
      capitulo="Empresas a contactar"
      titulo="Presentar BBJobs y Talency a las empresas de la zona"
      bajada="Bahía Blanca, Punta Alta, Ingeniero White, General Daniel Cerri, Monte Hermoso y Coronel Suárez. Tres mails en texto, como escritos por una persona, firmados por «Equipo de Talency»."
      demo={<DemoContactar />}
    >
      <ListaTildes
        items={[
          "Pocos por día y en horario de oficina.",
          "Cada mail trae su link para darse de baja.",
          "Si alguien rebota o se queja, no se le escribe más.",
          "Las respuestas llegan a una casilla de Talency: sin esa casilla, no sale ninguno.",
        ]}
      />
    </Escena>
  );
}

// ── 10. Tres direcciones, tres carriles ───────────────────────────────────────────────

const CARRILES = [
  { de: "avisos@avisos.bbjobs.com.ar", para: "Cuenta, postulaciones y búsquedas", estado: "Verificada" },
  { de: "empleos@novedades.bbjobs.com.ar", para: "Búsquedas que encajan y novedades", estado: "Verificada" },
  { de: "contacto@contacto.bbjobs.com.ar", para: "Presentación a empresas", estado: "Con el plan pago" },
];

function Carriles() {
  const [problema, setProblema] = useState(false);
  return (
    <Tarjeta>
      <div className="space-y-3">
        {CARRILES.map((c, i) => {
          const roto = problema && i === 1;
          const listo = c.estado === "Verificada";
          return (
            <div key={c.de} className={`rounded-2xl border p-3 transition-colors ${roto ? "border-[#F5B7B1] bg-[#FFF5F4]" : "border-border bg-bg"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12.5px] font-semibold text-text">{c.de}</div>
                  <div className="text-xs text-text-muted">{c.para}</div>
                </div>
                {roto ? <Chip tono="rojo">Con problemas</Chip> : listo ? <Chip>✓ {c.estado}</Chip> : <Chip tono="arena">{c.estado}</Chip>}
              </div>
              <div className="relative mt-2.5 h-7 overflow-hidden rounded-full bg-white">
                {listo &&
                  [0, 1, 2].map((k) => (
                    <motion.span
                      key={`${k}-${roto}`}
                      className="absolute top-1/2 -translate-y-1/2"
                      initial={{ left: "-8%" }}
                      animate={roto ? { left: ["-8%", "45%"], opacity: [1, 0] } : { left: ["-8%", "104%"] }}
                      transition={{ duration: roto ? 1.6 : 3, repeat: Infinity, delay: k * 1, ease: "linear" }}
                    >
                      <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
                        <rect x="0.75" y="0.75" width="18.5" height="12.5" rx="2" fill={roto ? "#FDECEC" : "#E6F4F7"} stroke={roto ? "#B42318" : "#1E8EA3"} strokeWidth="1.5" />
                        <path d="M1.5 1.5 10 8l8.5-6.5" stroke={roto ? "#B42318" : "#1E8EA3"} strokeWidth="1.5" strokeLinejoin="round" />
                      </svg>
                    </motion.span>
                  ))}
                {!listo && <div className="grid h-full place-items-center text-[11px] text-text-muted">se habilita con el plan pago de mails</div>}
                {roto && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#B42318]">spam</div>}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setProblema((v) => !v)}
        className="mt-4 w-full rounded-full border border-border bg-white py-2.5 text-sm font-semibold text-text transition hover:border-primary-mid hover:text-primary"
      >
        {problema ? "Volver a la normalidad" : "¿Y si una dirección tiene un problema?"}
      </button>
      <AnimatePresence>
        {problema && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-center text-[13px] text-text">
            Los otros carriles siguen andando: los avisos de cuenta y de postulaciones llegan igual.
          </motion.p>
        )}
      </AnimatePresence>
    </Tarjeta>
  );
}

function PasoRemitentes() {
  return (
    <Escena
      capitulo="Para que los mails lleguen"
      titulo="Tres direcciones, tres carriles separados"
      bajada="Cada tipo de mail sale de una dirección distinta. Si una cae en spam, no arrastra a las otras, y bbjobs.com.ar queda limpio para el sitio y para sus casillas."
      demo={<Carriles />}
    >
      <ListaTildes
        items={[
          "avisos@ y empleos@ ya están verificadas y listas.",
          "contacto@ se suma cuando se active el plan pago del servicio de mails.",
          "Los mails arrancan de a poco y suben por semana: así los proveedores aprenden a confiar.",
        ]}
      />
    </Escena>
  );
}

// ── 11. El lanzamiento ────────────────────────────────────────────────────────────────

function PasoLanzamiento() {
  const hechos = LANZAMIENTO.filter((e) => e.estado === "hecho").length;
  return (
    <Escena
      capitulo="El lanzamiento"
      titulo="Dónde estamos, de 0 a 100"
      bajada={`Ya están ${hechos} de ${LANZAMIENTO.length} pasos. Lo que sigue se hace con cuidado y por partes: nada se prende de golpe.`}
      demo={
        <Tarjeta>
          <ol className="relative space-y-1">
            <div className="absolute bottom-4 left-[15px] top-4 w-0.5 bg-border" aria-hidden />
            {LANZAMIENTO.map((e, i) => (
              <motion.li
                key={e.titulo}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.09 }}
                className="relative flex gap-3 rounded-xl px-1 py-2"
              >
                <span
                  className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    e.estado === "hecho"
                      ? "bg-primary text-white"
                      : e.estado === "en-curso"
                        ? "border-2 border-primary bg-white text-primary"
                        : "border-2 border-border bg-white text-text-muted"
                  }`}
                >
                  {e.estado === "hecho" ? "✓" : i + 1}
                  {e.estado === "en-curso" && <span className="ai-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />}
                </span>
                <div className="min-w-0 pt-0.5">
                  <div className={`font-semibold ${e.estado === "falta" ? "text-text-muted" : "text-text"}`}>
                    {e.titulo}
                    {e.estado === "en-curso" && <span className="ml-2 align-middle"><Chip>Ahora</Chip></span>}
                  </div>
                  <div className="text-[13px] leading-snug text-text-muted">{e.detalle}</div>
                </div>
              </motion.li>
            ))}
          </ol>
        </Tarjeta>
      }
    >
      <div className="flex items-center gap-5">
        <Anillo valor={PORCENTAJE} tam={150} grosor={13}>
          <div>
            <div className="font-display text-4xl font-extrabold text-text">
              <Contador hasta={PORCENTAJE} />%
            </div>
            <div className="text-[11px] font-semibold text-text-muted">listo</div>
          </div>
        </Anillo>
        <p className="text-[15px] leading-snug text-text">
          Desde que se prenden los módulos, cada usuario acepta una vez los términos nuevos al entrar.
          No hay que pedirle nada a nadie por mail.
        </p>
      </div>
    </Escena>
  );
}

// ── 12. Lo que necesito de vos ────────────────────────────────────────────────────────

const PEDIDOS = [
  { titulo: "Una casilla de Talency", texto: "Para recibir las respuestas de las empresas. Sin eso no sale ningún mail de presentación." },
  { titulo: "Aprobar los textos", texto: "El del aviso al candidato y los 3 mails a empresas." },
  { titulo: "Charlar «Está en otro proceso»", texto: "Queda apagado hasta que lo decidamos juntos." },
  { titulo: "Marcar 3 búsquedas reales", texto: "Decime en cada una quién te parecía mejor: con eso ajusto el orden de los recomendados." },
];

function PasoVos({ vistaPrevia }: PasoProps) {
  const [tildados, setTildados] = useState<boolean[]>(() => PEDIDOS.map(() => false));
  const listos = tildados.filter(Boolean).length;
  return (
    <Escena
      capitulo="Lo que sigue"
      titulo="Lo que necesito de vos"
      bajada="Con estas cuatro cosas cerramos el lanzamiento. Podés ir tildándolas para llevar la cuenta."
      demo={
        <div className="space-y-4">
          <Tarjeta className="p-3!">
            {PEDIDOS.map((p, i) => (
              <button
                key={p.titulo}
                type="button"
                role="checkbox"
                aria-checked={tildados[i]}
                onClick={() => setTildados((t) => t.map((v, j) => (j === i ? !v : v)))}
                className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${tildados[i] ? "bg-primary-light/70" : "hover:bg-bg"}`}
              >
                <motion.span
                  animate={{ scale: tildados[i] ? [1, 1.25, 1] : 1 }}
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 text-sm font-bold ${
                    tildados[i] ? "border-primary bg-primary text-white" : "border-border bg-white text-transparent"
                  }`}
                >
                  ✓
                </motion.span>
                <span>
                  <span className={`block font-semibold ${tildados[i] ? "text-primary-hover line-through decoration-2" : "text-text"}`}>{p.titulo}</span>
                  <span className="block text-[13px] leading-snug text-text-muted">{p.texto}</span>
                </span>
              </button>
            ))}
            <div className="px-3 pb-1 pt-2 text-center text-xs font-semibold text-text-muted">
              {listos === PEDIDOS.length ? "¡Todo listo! 🎉" : `${listos} de ${PEDIDOS.length}`}
            </div>
          </Tarjeta>
          <Link
            href={vistaPrevia}
            className="group flex items-center justify-between rounded-3xl bg-text px-6 py-5 text-white transition hover:bg-[#2a3346]"
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-wider text-primary-mid">Para leer con calma</span>
              <span className="block font-display text-lg font-bold">Todos los mails, con sus textos completos</span>
            </span>
            <span className="text-2xl transition group-hover:translate-x-1">→</span>
          </Link>
        </div>
      }
    >
      <div className="rounded-2xl border border-border bg-white p-4">
        <div className="font-semibold text-text">Para probarlo vos, cuando lo prendamos</div>
        <p className="mt-1 text-[14px] leading-snug text-text-muted">
          Publicá y aprobá una búsqueda de prueba. Fijate qué candidatos te recomienda, si el porqué tiene
          sentido y qué mail le llega al candidato.
        </p>
      </div>
      <p className="mt-6 text-sm text-text-muted">
        La revisión de CV paga queda como la manejás vos, por fuera.
        <br />
        <span className="mt-3 inline-block font-semibold text-text">Gael González · BBJobs para Talency</span>
      </p>
    </Escena>
  );
}

// ── Orden ─────────────────────────────────────────────────────────────────────────────

export const PASOS: { id: string; capitulo: string; corto: string; Componente: ComponentType<PasoProps> }[] = [
  { id: "inicio", capitulo: "Bienvenida", corto: "Empezar", Componente: PasoInicio },
  { id: "sitio", capitulo: "Ya está andando", corto: "Lo que ya está en el sitio", Componente: PasoSitio },
  { id: "viaje", capitulo: "Cómo funciona", corto: "La vida de una búsqueda", Componente: PasoViaje },
  { id: "ia", capitulo: "Recomendados con IA", corto: "¿Quién encaja mejor?", Componente: PasoIA },
  { id: "mails-candidato", capitulo: "Mails al candidato", corto: "Lo que le llega al candidato", Componente: PasoMailsCandidato },
  { id: "mails-empresa", capitulo: "Mails a la empresa", corto: "Lo que le llega a la empresa", Componente: PasoMailsEmpresa },
  { id: "reglas", capitulo: "Reglas", corto: "Para no molestar", Componente: PasoReglas },
  { id: "panel", capitulo: "Vos tenés el control", corto: "Interruptores", Componente: PasoPanel },
  { id: "contactar", capitulo: "Empresas a contactar", corto: "Presentar BBJobs y Talency", Componente: PasoContactar },
  { id: "remitentes", capitulo: "Para que los mails lleguen", corto: "Tres direcciones", Componente: PasoRemitentes },
  { id: "lanzamiento", capitulo: "El lanzamiento", corto: "De 0 a 100", Componente: PasoLanzamiento },
  { id: "vos", capitulo: "Lo que sigue", corto: "Lo que necesito de vos", Componente: PasoVos },
];
