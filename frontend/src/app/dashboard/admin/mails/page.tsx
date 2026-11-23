"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";

// ── Tipos (lo que devuelve /admin/mail/*) ─────────────────────────────────────────────────

type Entrega = "pendiente" | "enviado" | "entregado" | "rebotado" | "queja" | "fallido" | "saltado";

interface Enviado {
  id: string; to_email: string; category: string; template_key: string; subject: string;
  delivery: Entrega; touch: number; scheduled_at: string; sent_at: string | null;
  delivered_at: string | null; bounced_at: string | null; last_error: string | null;
}
interface PaginaEnviados { total: number; page: number; per_page: number; items: Enviado[] }

interface Respuesta {
  id: string; from_email: string; to_email: string; subject: string; body: string;
  status: "nueva" | "atendida"; kind: "usuario" | "prospecto" | "desconocido"; who: string | null;
  received_at: string; attended_at: string | null;
}
interface PaginaRespuestas { total: number; new: number; page: number; per_page: number; items: Respuesta[] }

interface Salud {
  mode: string; test_recipients?: string[]; resend_configured: boolean; sent_today: number; daily_cap: number; replies_new: number;
  sent_7d: number; bounce_pct: number; complaint_pct: number; bounce_limit_pct: number;
  complaint_limit_pct: number; min_sample: number; unhealthy: boolean;
  by_category: { category: string; sent: number; delivered: number; opened: number; bounced: number; complained: number }[];
  daily: { day: string; sent: number; bounced: number; complained: number }[];
  domains: { name: string; verified: boolean; status: string }[] | null;
  domains_error: string | null;
}

interface Casilla {
  id: string; address: string; display_name: string; daily_limit: number;
  status: "activa" | "pausada" | "inactiva"; status_reason: string | null;
  sent_today: number; sent_14d: number; bounced_14d: number; complained_14d: number;
}

const CATEGORIAS: Record<string, string> = {
  cuenta: "Cuenta", postulaciones: "Postulaciones", busquedas: "Búsquedas", alertas: "Alertas",
  recordatorios: "Recordatorios", novedades: "Novedades", admin: "Equipo", prospeccion: "Prospección",
};

const ENTREGA: Record<Entrega, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-slate-100 text-slate-700" },
  enviado: { texto: "Enviado", clase: "bg-[#E6F4F7] text-[#187B8E]" },
  entregado: { texto: "Entregado", clase: "bg-emerald-50 text-emerald-800" },
  rebotado: { texto: "Rebotó", clase: "bg-red-50 text-red-800" },
  queja: { texto: "Queja de spam", clase: "bg-red-100 text-red-900" },
  fallido: { texto: "Falló", clase: "bg-red-50 text-red-800" },
  saltado: { texto: "No salió", clase: "bg-yellow-100 text-yellow-900" },
};

function fecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Cargando() {
  return (
    <div className="py-12 flex items-center justify-center" role="status" aria-label="Cargando">
      <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-center text-sm text-[#64748B]">{children}</div>;
}

const SELECT = "rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]";

// ── Respuestas ───────────────────────────────────────────────────────────────────────────

function Respuestas() {
  const [estado, setEstado] = useState<"nueva" | "atendida" | "todas">("nueva");
  const [pagina, setPagina] = useState(1);
  const datos = useModulo<PaginaRespuestas>("/admin/mail/replies", { status: estado, page: pagina });
  const [abierta, setAbierta] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function marcar(r: Respuesta) {
    setError(null);
    try {
      await api.patch(`/admin/mail/replies/${r.id}`, { status: r.status === "nueva" ? "atendida" : "nueva" });
      await datos.recargar();
    } catch (e) {
      setError(detalleError(e));
    }
  }

  if (datos.estado === "cargando") return <Cargando />;
  if (datos.estado === "error") return <div className="p-8 text-center text-red-800">{datos.mensaje}</div>;
  if (datos.estado === "en_desarrollo") return null;
  const d = datos.datos;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-sm text-[#64748B]" htmlFor="filtro-resp">Mostrar</label>
        <select id="filtro-resp" className={SELECT} value={estado}
          onChange={e => { setEstado(e.target.value as typeof estado); setPagina(1); }}>
          <option value="nueva">Sin atender</option>
          <option value="atendida">Atendidas</option>
          <option value="todas">Todas</option>
        </select>
        <span className="text-sm text-[#64748B]">{d.total} {d.total === 1 ? "respuesta" : "respuestas"}</span>
      </div>
      {error && <div className="mb-3 rounded-xl px-4 py-2.5 text-sm font-medium bg-red-50 text-red-800">{error}</div>}

      {d.items.length === 0 ? (
        <Vacio>{estado === "nueva" ? "No hay respuestas sin atender." : "No hay respuestas para mostrar."}</Vacio>
      ) : (
        <ul className="space-y-3">
          {d.items.map(r => {
            const larga = r.body.length > 280;
            const expandida = abierta === r.id;
            return (
              <li key={r.id} className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-[#1C2230] break-all">{r.from_email}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E6F4F7] text-[#187B8E]">
                    {r.kind === "prospecto" ? `Empresa a contactar${r.who ? `: ${r.who}` : ""}`
                      : r.kind === "usuario" ? "Usuario de BBJobs" : "No identificado"}
                  </span>
                  {r.status === "nueva" && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#D4B7A2]/40 text-[#1C2230]">Nueva</span>}
                  <span className="ml-auto text-xs text-[#64748B]">{fecha(r.received_at)}</span>
                </div>
                <p className="text-sm font-medium text-[#1C2230] mb-1">{r.subject || "(sin asunto)"}</p>
                <p className={`text-sm text-[#1C2230] whitespace-pre-wrap break-words ${larga && !expandida ? "line-clamp-4" : ""}`}>
                  {r.body || "(sin texto: Resend no entregó el cuerpo)"}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {larga && (
                    <button type="button" onClick={() => setAbierta(expandida ? null : r.id)}
                      className="text-[#187B8E] font-semibold hover:underline">
                      {expandida ? "Ver menos" : "Ver todo"}
                    </button>
                  )}
                  <button type="button" onClick={() => marcar(r)}
                    className="text-[#187B8E] font-semibold hover:underline">
                    {r.status === "nueva" ? "Marcar como atendida" : "Volver a sin atender"}
                  </button>
                  <a href={`mailto:${r.from_email}?subject=${encodeURIComponent(`Re: ${r.subject}`)}`}
                    className="text-[#187B8E] font-semibold hover:underline">Responder desde mi mail</a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Paginador pagina={d.page} total={d.total} porPagina={d.per_page} cambiar={setPagina} />
    </div>
  );
}

function Paginador({ pagina, total, porPagina, cambiar }: {
  pagina: number; total: number; porPagina: number; cambiar: (n: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm">
      <button type="button" disabled={pagina <= 1} onClick={() => cambiar(pagina - 1)}
        className="px-3 py-1.5 rounded-lg border border-[#DDE3EC] bg-white disabled:opacity-40">Anterior</button>
      <span className="text-[#64748B]">Página {pagina} de {paginas}</span>
      <button type="button" disabled={pagina >= paginas} onClick={() => cambiar(pagina + 1)}
        className="px-3 py-1.5 rounded-lg border border-[#DDE3EC] bg-white disabled:opacity-40">Siguiente</button>
    </div>
  );
}

// ── Enviados ─────────────────────────────────────────────────────────────────────────────

function Enviados() {
  const [categoria, setCategoria] = useState("");
  const [entrega, setEntrega] = useState("");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const params: Record<string, unknown> = { page: pagina };
  if (categoria) params.category = categoria;
  if (entrega) params.delivery = entrega;
  if (busqueda) params.q = busqueda;
  const datos = useModulo<PaginaEnviados>("/admin/mail/sent", params);

  return (
    <div>
      <form className="flex flex-wrap items-end gap-3 mb-4"
        onSubmit={e => { e.preventDefault(); setBusqueda(texto.trim()); setPagina(1); }}>
        <div>
          <label className="block text-xs text-[#64748B] mb-1" htmlFor="f-cat">Tipo</label>
          <select id="f-cat" className={SELECT} value={categoria} onChange={e => { setCategoria(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[#64748B] mb-1" htmlFor="f-ent">Estado</label>
          <select id="f-ent" className={SELECT} value={entrega} onChange={e => { setEntrega(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            {Object.entries(ENTREGA).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-[#64748B] mb-1" htmlFor="f-q">Buscar por mail o asunto</label>
          <input id="f-q" className={`${SELECT} w-full`} value={texto} onChange={e => setTexto(e.target.value)} placeholder="ana@mail.com" />
        </div>
        <button type="submit" className="rounded-lg bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-semibold px-4 py-2">Buscar</button>
      </form>

      {datos.estado === "cargando" ? <Cargando />
        : datos.estado === "error" ? <div className="p-8 text-center text-red-800">{datos.mensaje}</div>
        : datos.estado === "en_desarrollo" ? null
        : datos.datos.items.length === 0 ? <Vacio>No hay mails con esos filtros.</Vacio>
        : (
          <>
            <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-x-auto shadow-sm">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-[#64748B] border-b border-[#DDE3EC]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Para</th>
                    <th className="px-4 py-3 font-semibold">Asunto</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Cuándo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE3EC]/60">
                  {datos.datos.items.map(m => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 break-all">{m.to_email}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={m.subject}>{m.subject}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{CATEGORIAS[m.category] ?? m.category}{m.touch > 1 ? ` · toque ${m.touch}` : ""}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ENTREGA[m.delivery].clase}`}
                          title={m.last_error ?? undefined}>{ENTREGA[m.delivery].texto}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#64748B]">{fecha(m.sent_at ?? m.scheduled_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginador pagina={datos.datos.page} total={datos.datos.total} porPagina={datos.datos.per_page} cambiar={setPagina} />
          </>
        )}
    </div>
  );
}

// ── Salud ────────────────────────────────────────────────────────────────────────────────

function Medidor({ titulo, valor, limite, ayuda }: { titulo: string; valor: number; limite: number; ayuda: string }) {
  const sobre = valor > limite;
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-[#64748B] font-semibold">{titulo}</p>
      <p className={`text-2xl font-display font-bold ${sobre ? "text-red-800" : "text-[#1C2230]"}`}>{valor.toLocaleString("es-AR")} %</p>
      <p className="text-xs text-[#64748B]">Límite de Resend: {limite.toLocaleString("es-AR")} %. {ayuda}</p>
    </div>
  );
}

function SaludMails() {
  const datos = useModulo<Salud>("/admin/mail/health");
  if (datos.estado === "cargando") return <Cargando />;
  if (datos.estado === "error") return <div className="p-8 text-center text-red-800">{datos.mensaje}</div>;
  if (datos.estado === "en_desarrollo") return null;
  const s = datos.datos;
  const maximo = Math.max(1, ...s.daily.map(d => d.sent));
  const simulado = s.mode !== "resend";

  return (
    <div className="space-y-6">
      {s.unhealthy ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          <strong>Envíos frenados.</strong> Los rebotes o las quejas de los últimos 7 días superan el límite de Resend.
          Las novedades, los recordatorios y la prospección esperan; los avisos de cuenta y de postulaciones siguen.
          Se destraba solo cuando los números vuelven a la normalidad.
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Todo en orden.</strong>{" "}
          {s.sent_7d < s.min_sample
            ? `Hasta ${s.min_sample} mails en la semana el freno no se mide (hubo ${s.sent_7d}).`
            : "Los rebotes y las quejas están por debajo del límite."}
        </div>
      )}
      {simulado && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          <strong>Modo {s.mode === "off" ? "apagado" : "simulado"}:</strong> no está saliendo ningún mail real.
          {!s.resend_configured && " Falta cargar la clave de Resend."}
        </div>
      )}
      {!simulado && !!s.test_recipients?.length && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          <strong>Modo prueba:</strong> sólo salen mails a {s.test_recipients.join(", ")}. Al resto no les llega nada
          (quedan como «salteados»). Se apaga vaciando <code>EMAIL_TEST_RECIPIENTS</code> en Railway.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Medidor titulo="Rebotes (7 días)" valor={s.bounce_pct} limite={s.bounce_limit_pct} ayuda="Sólo cuentan los de dirección inexistente." />
        <Medidor titulo="Quejas de spam (7 días)" valor={s.complaint_pct} limite={s.complaint_limit_pct} ayuda="Si se pasa, Resend puede cerrar la cuenta." />
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-[#64748B] font-semibold">Enviados hoy</p>
          <p className="text-2xl font-display font-bold text-[#1C2230]">{s.sent_today}</p>
          <p className="text-xs text-[#64748B]">{s.daily_cap ? `Tope diario de calentamiento: ${s.daily_cap}.` : "Sin tope diario."}</p>
        </div>
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-[#64748B] font-semibold">Respuestas sin atender</p>
          <p className="text-2xl font-display font-bold text-[#1C2230]">{s.replies_new}</p>
          <p className="text-xs text-[#64748B]">Están en la pestaña Respuestas.</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-bold text-[#1C2230] mb-2">Mails por día (últimos 14)</h2>
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm">
          <div className="flex items-end gap-1.5 h-32" role="img"
            aria-label={`Mails enviados por día. Máximo ${maximo} en un día.`}>
            {s.daily.map(d => (
              <div key={d.day} className="flex-1 flex flex-col justify-end h-full"
                title={`${d.day}: ${d.sent} enviados, ${d.bounced} rebotes, ${d.complained} quejas`}>
                <div className="w-full rounded-t bg-[#1E8EA3]" style={{ height: `${(d.sent / maximo) * 100}%`, minHeight: d.sent ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-[#64748B] mt-1">
            <span>{s.daily[0]?.day.slice(5)}</span><span>{s.daily[s.daily.length - 1]?.day.slice(5)}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-[#1C2230] mb-2">Dominios en Resend</h2>
        {s.domains ? (
          <ul className="bg-white border border-[#DDE3EC] rounded-2xl divide-y divide-[#DDE3EC]/60 shadow-sm">
            {s.domains.length === 0 && <li className="px-4 py-3 text-sm text-[#64748B]">La cuenta todavía no tiene dominios.</li>}
            {s.domains.map(d => (
              <li key={d.name} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="font-medium text-[#1C2230]">{d.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.verified ? "bg-emerald-50 text-emerald-800" : "bg-yellow-100 text-yellow-900"}`}>
                  {d.verified ? "Verificado" : `Falta verificar (${d.status})`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio>{s.resend_configured
            ? `No se pudieron leer los dominios${s.domains_error ? `: ${s.domains_error}` : "."} La clave tiene que ser de acceso completo.`
            : "Cuando se cargue la clave de Resend, acá aparecen los dominios y si están verificados."}</Vacio>
        )}
      </section>

      <section>
        <h2 className="text-sm font-bold text-[#1C2230] mb-2">Por tipo de mail (últimos 14 días)</h2>
        {s.by_category.length === 0 ? <Vacio>Todavía no salió ningún mail.</Vacio> : (
          <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-[#64748B] border-b border-[#DDE3EC]">
                <tr>{["Tipo", "Enviados", "Entregados", "Abiertos", "Rebotes", "Quejas"].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]/60">
                {s.by_category.map(c => (
                  <tr key={c.category}>
                    <td className="px-4 py-3 font-medium">{CATEGORIAS[c.category] ?? c.category}</td>
                    <td className="px-4 py-3">{c.sent}</td><td className="px-4 py-3">{c.delivered}</td>
                    <td className="px-4 py-3">{c.opened}</td><td className="px-4 py-3">{c.bounced}</td><td className="px-4 py-3">{c.complained}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Casillas de prospección ──────────────────────────────────────────────────────────────

const ESTADO_CASILLA: Record<Casilla["status"], { texto: string; clase: string }> = {
  activa: { texto: "Activa", clase: "bg-emerald-50 text-emerald-800" },
  pausada: { texto: "Pausada", clase: "bg-yellow-100 text-yellow-900" },
  inactiva: { texto: "Inactiva", clase: "bg-slate-100 text-slate-700" },
};

function Casillas() {
  const datos = useModulo<Casilla[]>("/admin/mail/mailboxes");
  const [nueva, setNueva] = useState({ address: "", display_name: "", daily_limit: 40 });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando("nueva");
    try {
      await api.post("/admin/mail/mailboxes", nueva);
      setNueva({ address: "", display_name: "", daily_limit: 40 });
      await datos.recargar();
    } catch (err) {
      setError(detalleError(err));
    } finally {
      setGuardando(null);
    }
  }

  async function cambiar(c: Casilla, cambios: Partial<Pick<Casilla, "status" | "daily_limit">>) {
    setError(null);
    setGuardando(c.id);
    try {
      await api.patch(`/admin/mail/mailboxes/${c.id}`, cambios);
      await datos.recargar();
    } catch (err) {
      setError(detalleError(err));
    } finally {
      setGuardando(null);
    }
  }

  if (datos.estado === "cargando") return <Cargando />;
  if (datos.estado === "error") return <div className="p-8 text-center text-red-800">{datos.mensaje}</div>;
  if (datos.estado === "en_desarrollo") return null;
  const casillas = datos.datos;
  const cupo = casillas.filter(c => c.status === "activa").reduce((t, c) => t + c.daily_limit, 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#64748B]">
        Desde estas direcciones sale la prospección a empresas. Se turnan para repartir el envío; cada una tiene su
        tope por día y se pausa sola si junta rebotes o una queja de spam. Los avisos a postulantes y empresas no
        usan casillas. {cupo > 0 && <>Cupo de hoy entre todas: <strong>{cupo}</strong> mails.</>}
      </p>
      {error && <div className="rounded-xl px-4 py-2.5 text-sm font-medium bg-red-50 text-red-800">{error}</div>}

      {casillas.length === 0 ? (
        <Vacio>Todavía no hay casillas. Sin casillas, la prospección sale del remitente fijo de la configuración.</Vacio>
      ) : (
        <ul className="space-y-3">
          {casillas.map(c => (
            <li key={c.id} className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#1C2230] break-all">{c.display_name ? `${c.display_name} · ` : ""}{c.address}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ESTADO_CASILLA[c.status].clase}`}>{ESTADO_CASILLA[c.status].texto}</span>
              </div>
              {c.status_reason && <p className="text-xs text-[#64748B] mt-1">{c.status_reason}</p>}
              <p className="text-sm text-[#1C2230] mt-2">
                Hoy {c.sent_today} de {c.daily_limit} · últimos 14 días: {c.sent_14d} enviados, {c.bounced_14d} rebotes, {c.complained_14d} quejas
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {c.status === "activa" ? (
                  <button type="button" disabled={guardando === c.id} onClick={() => cambiar(c, { status: "pausada" })}
                    className="text-[#187B8E] font-semibold hover:underline disabled:opacity-50">Pausar</button>
                ) : (
                  <button type="button" disabled={guardando === c.id} onClick={() => cambiar(c, { status: "activa" })}
                    className="text-[#187B8E] font-semibold hover:underline disabled:opacity-50">Activar</button>
                )}
                <label className="flex items-center gap-2 text-[#64748B]">
                  Tope por día
                  <select className={SELECT} value={c.daily_limit} disabled={guardando === c.id}
                    onChange={e => cambiar(c, { daily_limit: Number(e.target.value) })}>
                    {[10, 20, 40, 60, 80, 100].concat([c.daily_limit]).filter((v, i, a) => a.indexOf(v) === i)
                      .sort((a, b) => a - b).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={crear} className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm grid gap-3 sm:grid-cols-[2fr_1.5fr_auto_auto] sm:items-end">
        <div>
          <label className="block text-xs text-[#64748B] mb-1" htmlFor="c-dir">Dirección</label>
          <input id="c-dir" required className={`${SELECT} w-full`} placeholder="eugenia@contacto.bbjobs.com.ar"
            value={nueva.address} onChange={e => setNueva({ ...nueva, address: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-[#64748B] mb-1" htmlFor="c-nom">Nombre que ve la empresa</label>
          <input id="c-nom" className={`${SELECT} w-full`} placeholder="Eugenia · BBJobs"
            value={nueva.display_name} onChange={e => setNueva({ ...nueva, display_name: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-[#64748B] mb-1" htmlFor="c-tope">Tope por día</label>
          <select id="c-tope" className={SELECT} value={nueva.daily_limit}
            onChange={e => setNueva({ ...nueva, daily_limit: Number(e.target.value) })}>
            {[10, 20, 40, 60].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <button type="submit" disabled={guardando === "nueva"}
          className="rounded-lg bg-[#1E8EA3] hover:bg-[#187B8E] text-white text-sm font-semibold px-4 py-2 disabled:opacity-50">
          Agregar casilla
        </button>
        <p className="sm:col-span-4 text-xs text-[#64748B]">
          Tiene que ser de un subdominio verificado en Resend (nunca de bbjobs.com.ar a secas). Si el dominio todavía no está
          verificado, la casilla queda inactiva hasta que lo esté.
        </p>
      </form>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────────────────

type Pestana = "respuestas" | "enviados" | "casillas" | "salud";

export default function MailsAdminPage() {
  const [pestana, setPestana] = useState<Pestana>("respuestas");
  const aviso = useModulo<Salud>("/admin/mail/health");

  if (aviso.estado === "en_desarrollo") {
    return (
      <EnDesarrollo
        titulo="Mails"
        descripcion="Acá vas a ver los mails que salen de BBJobs, las respuestas de la gente y si la cuenta de envío está sana."
      />
    );
  }
  const nuevas = aviso.estado === "listo" ? aviso.datos.replies_new : 0;
  const pestanas: { clave: Pestana; texto: string }[] = [
    { clave: "respuestas", texto: nuevas ? `Respuestas (${nuevas})` : "Respuestas" },
    { clave: "enviados", texto: "Enviados" },
    { clave: "casillas", texto: "Casillas" },
    { clave: "salud", texto: "Salud de la cuenta" },
  ];

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Mails</h1>
      <p className="text-[#64748B] text-sm mb-6">Qué salió, qué contestó la gente y cómo está la cuenta de envío.</p>

      <div role="tablist" aria-label="Secciones de Mails" className="flex gap-1 border-b border-[#DDE3EC] mb-6 overflow-x-auto">
        {pestanas.map(p => (
          <button key={p.clave} type="button" role="tab" aria-selected={pestana === p.clave}
            onClick={() => setPestana(p.clave)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              pestana === p.clave ? "border-[#1E8EA3] text-[#187B8E]" : "border-transparent text-[#64748B] hover:text-[#1C2230]"}`}>
            {p.texto}
          </button>
        ))}
      </div>

      {pestana === "respuestas" && <Respuestas />}
      {pestana === "enviados" && <Enviados />}
      {pestana === "casillas" && <Casillas />}
      {pestana === "salud" && <SaludMails />}
    </div>
  );
}
