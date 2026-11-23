"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import { Aviso, Spinner } from "@/components/admin-ia/comun";

/**
 * Mails automáticos (backend: api/v1/admin_textos.py y /admin/mail/overview). Todos los mails que
 * BBJobs manda solo: Eugenia ve cuántos salieron, los últimos envíos, la cuota y el costo del mes,
 * y prende o apaga cada uno. Los que tienen texto propio se editan; "Volver al original" deshace.
 * Los resúmenes y avisos al equipo los arma el sistema: se ven y se apagan, el texto no se edita.
 */

interface Texto {
  key: string; nombre: string; grupo: string; categoria: string; activo: boolean;
  asunto: string; texto: string; asunto_original: string; texto_original: string;
  editado: boolean; variables: Record<string, string>; editable: boolean;
  enviados_30d: number; ultimo_envio: string | null;
}

interface Overview {
  mode: string; test_recipients: string[]; tope_diario: number; enviados_hoy: number;
  cuota: { fuente: "resend" | "bbjobs"; mes_usados: number; mes_limite: number | null; mes_reinicia: string | null; hoy_usados: number; error?: string | null };
  costo: { plan: string; plan_usd: number; mails_mes: number; costo_por_mail_usd: number | null; ia_mes_usd: number; total_mes_usd: number };
}

interface Enviado { id: string; to_email: string; subject: string; delivery: string; sent_at: string | null; scheduled_at: string }

const ESTADO: Record<string, string> = {
  pendiente: "En cola", enviado: "Enviado", entregado: "Entregado", rebotado: "Rebotó", queja: "Marcado como spam",
  fallido: "Falló", saltado: "No salió",
};

const fecha = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const num = (n: number) => n.toLocaleString("es-AR");
const usd = (n: number) => `USD ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: n > 0 && n < 0.01 ? 4 : 2 })}`;

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl shadow-sm p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#64748B] mb-2">{titulo}</p>
      {children}
    </div>
  );
}

function Panel() {
  const o = useModulo<Overview>("/admin/mail/overview");
  if (o.estado !== "listo") return null;
  const d = o.datos;
  const lim = d.cuota.mes_limite;
  const pct = lim ? Math.min(100, (d.cuota.mes_usados / lim) * 100) : 0;
  return (
    <div className="mb-8 space-y-3">
      {d.test_recipients.length > 0 && (
        <Aviso tono="info">Modo prueba: sólo salen mails a {d.test_recipients.join(", ")}. Al resto no les llega nada.</Aviso>
      )}
      {d.mode !== "resend" && d.test_recipients.length === 0 && (
        <Aviso tono="error">Los mails no están saliendo (modo «{d.mode}»). Avisale a Solven.</Aviso>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta titulo="Cuota del mes">
          <p className="font-display text-2xl font-bold text-[#1C2230]">
            {num(d.cuota.mes_usados)}{lim ? <span className="text-base text-[#64748B]"> de {num(lim)}</span> : null}
          </p>
          {lim ? (
            <div className="mt-2 h-2 rounded-full bg-[#E6F4F7]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-2 rounded-full ${pct > 80 ? "bg-amber-500" : "bg-[#1E8EA3]"}`} style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
          ) : null}
          <p className="text-xs text-[#64748B] mt-2">
            {d.cuota.mes_reinicia ? `Se renueva el ${new Date(d.cuota.mes_reinicia).toLocaleDateString("es-AR")}.` : "Contados por BBJobs este mes."}
          </p>
        </Tarjeta>
        <Tarjeta titulo="Hoy">
          <p className="font-display text-2xl font-bold text-[#1C2230]">
            {num(d.enviados_hoy)}{d.tope_diario > 0 && <span className="text-base text-[#64748B]"> de {num(d.tope_diario)}</span>}
          </p>
          <p className="text-xs text-[#64748B] mt-2">
            {d.tope_diario > 0 ? "Tope por día para cuidar la reputación del dominio. Los pagos y la verificación de cuenta salen igual."
              : "Sin tope diario: salen todos (máximo 2 avisos por persona por día)."}
          </p>
        </Tarjeta>
        <Tarjeta titulo="Costo del mes">
          <p className="font-display text-2xl font-bold text-[#1C2230]">{usd(d.costo.total_mes_usd)}</p>
          <p className="text-xs text-[#64748B] mt-2">
            Mails: plan {d.costo.plan} de Resend, {usd(d.costo.plan_usd)} fijo por mes
            {d.costo.costo_por_mail_usd != null && ` (${usd(d.costo.costo_por_mail_usd)} por mail este mes)`}.
            {" "}IA: {usd(d.costo.ia_mes_usd)}.
          </p>
        </Tarjeta>
      </div>
    </div>
  );
}

function UltimosEnvios({ clave }: { clave: string }) {
  const [items, setItems] = useState<Enviado[] | null>(null);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let vigente = true;
    api.get("/admin/mail/sent", { params: { template_key: clave, per_page: 8 } })
      .then(r => { if (vigente) { setItems(r.data.items); setTotal(r.data.total); } })
      .catch(() => { if (vigente) setItems([]); });
    return () => { vigente = false; };
  }, [clave]);
  if (items === null) return <p className="text-xs text-[#64748B]">Cargando los últimos envíos…</p>;
  if (items.length === 0) return <p className="text-xs text-[#64748B]">Todavía no salió ninguno.</p>;
  return (
    <div>
      <p className="text-xs font-bold text-[#1C2230] mb-1">Últimos envíos <span className="font-normal text-[#64748B]">({num(total)} en total)</span></p>
      <ul className="divide-y divide-[#DDE3EC] text-xs">
        {items.map(m => (
          <li key={m.id} className="py-1.5 flex flex-wrap gap-x-3">
            <span className="text-[#64748B] w-24 shrink-0">{fecha(m.sent_at ?? m.scheduled_at)}</span>
            <span className="text-[#1C2230] truncate max-w-[16rem]">{m.to_email}</span>
            <span className="text-[#64748B] truncate flex-1 min-w-0">{m.subject}</span>
            <span className="font-bold text-[#187B8E]">{ESTADO[m.delivery] ?? m.delivery}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const input = "w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]";

function Fila({ t, onCambio }: { t: Texto; onCambio: (t: Texto) => void }) {
  const [abierta, setAbierta] = useState(false);
  const [asunto, setAsunto] = useState(t.asunto);
  const [texto, setTexto] = useState(t.texto);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const cambiado = asunto !== t.asunto || texto !== t.texto;

  async function llamar(fn: () => Promise<{ data: Texto }>, ok: string) {
    setOcupado(true); setMsg(null);
    try {
      const r = await fn();
      onCambio({ ...r.data, enviados_30d: t.enviados_30d, ultimo_envio: t.ultimo_envio });
      setAsunto(r.data.asunto); setTexto(r.data.texto);
      setMsg({ tono: "ok", texto: ok });
    } catch (e) {
      setMsg({ tono: "error", texto: detalleError(e) });
    } finally { setOcupado(false); }
  }

  return (
    <li className="bg-white border border-[#DDE3EC] rounded-2xl shadow-sm">
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta}
        className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-[#1C2230] truncate">{t.nombre}</span>
          <span className="block text-xs text-[#64748B] truncate">
            {t.enviados_30d > 0 ? `${num(t.enviados_30d)} en los últimos 30 días · último ${fecha(t.ultimo_envio)}` : "Sin envíos en los últimos 30 días"}
          </span>
        </span>
        {t.editado && <span className="shrink-0 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-[#E6F4F7] text-[#187B8E]">Editado</span>}
        {!t.activo && <span className="shrink-0 text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-[#1C2230]">Apagado</span>}
        <ChevronDownIcon className={`w-4 h-4 text-[#64748B] transition-transform ${abierta ? "rotate-180" : ""}`} />
      </button>
      {abierta && (
        <div className="border-t border-[#DDE3EC] p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold text-[#1C2230]">
            <input type="checkbox" checked={t.activo} disabled={ocupado}
              onChange={e => llamar(() => api.put(`/admin/mail/templates/${t.key}`, { activo: e.target.checked }),
                e.target.checked ? "Prendido: este mail vuelve a salir." : "Apagado: este mail no sale más hasta que lo prendas.")} />
            Este mail sale
          </label>
          {!t.editable && (
            <p className="text-xs text-[#64748B]">El contenido de este mail lo arma el sistema con los datos de cada día: se puede prender o apagar, pero el texto no se edita.</p>
          )}
          {t.editable && (<>
          <div>
            <label className="block text-xs font-bold text-[#1C2230] mb-1">Asunto</label>
            <input className={input} value={asunto} maxLength={500} onChange={e => setAsunto(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#1C2230] mb-1">
              Texto <span className="font-normal text-[#64748B]">(párrafos separados por una línea en blanco; **así** queda en negrita)</span>
            </label>
            <textarea className={`${input} min-h-[160px] leading-relaxed`} value={texto} maxLength={8000} onChange={e => setTexto(e.target.value)} />
          </div>
          <p className="text-xs text-[#64748B]">
            Variables: {Object.entries(t.variables).map(([k, v]) => (
              <span key={k} className="mr-2"><code className="rounded bg-[#E6F4F7] px-1.5 py-0.5 text-[#187B8E]">{`{{${k}}}`}</code> {v}</span>
            ))}
            · El saludo, el botón y el pie los agrega el sistema.
          </p>
          {msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
          <div className="flex flex-wrap gap-2 justify-end">
            {t.editado && (
              <button type="button" disabled={ocupado}
                onClick={() => llamar(() => api.delete(`/admin/mail/templates/${t.key}`), "Volvió al texto original.")}
                className="rounded-xl border border-[#DDE3EC] px-4 py-2 text-sm font-bold text-[#64748B] hover:bg-[#FAFBFD]">
                Volver al original
              </button>
            )}
            <button type="button" disabled={!cambiado || ocupado}
              onClick={() => llamar(() => api.put(`/admin/mail/templates/${t.key}`, { asunto, texto }), "Guardado. Los próximos mails salen con este texto.")}
              className="rounded-xl bg-[#1E8EA3] px-4 py-2 text-sm font-bold text-white hover:bg-[#187B8E] disabled:opacity-50">
              Guardar
            </button>
          </div>
          </>)}
          {!t.editable && msg && <Aviso tono={msg.tono}>{msg.texto}</Aviso>}
          <div className="border-t border-[#DDE3EC] pt-3"><UltimosEnvios clave={t.key} /></div>
        </div>
      )}
    </li>
  );
}

export default function TextosMailsPage() {
  const estado = useModulo<Texto[]>("/admin/mail/templates");
  const [cambios, setCambios] = useState<Record<string, Texto>>({});
  const [q, setQ] = useState("");

  if (estado.estado === "en_desarrollo") return <EnDesarrollo titulo="Mails automáticos" descripcion="Todos los mails que BBJobs manda solo." />;
  if (estado.estado === "cargando") return <div className="py-16 flex justify-center"><Spinner /></div>;
  if (estado.estado === "error") return <div className="p-8"><Aviso tono="error">{estado.mensaje}</Aviso></div>;

  const lista = estado.datos.map(t => cambios[t.key] ?? t)
    .filter(t => !q.trim() || `${t.nombre} ${t.asunto}`.toLowerCase().includes(q.trim().toLowerCase()));
  const ORDEN = ["A postulantes", "A empresas", "Al equipo de Talency", "Otros"];
  const grupos = Array.from(new Set(lista.map(t => t.grupo))).sort((a, b) => ORDEN.indexOf(a) - ORDEN.indexOf(b));

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1 flex items-center gap-2">
        <EnvelopeIcon className="w-6 h-6 text-[#187B8E]" /> Mails automáticos
      </h1>
      <p className="text-[#64748B] text-sm mb-5">
        Todos los mails que BBJobs manda solo. Tocá uno para ver los últimos envíos, apagarlo o cambiarle el texto. Lo que
        guardes vale para los próximos mails. La prospección a empresas tiene su propia pantalla.
      </p>
      <Panel />
      <input className={`${input} mb-6`} placeholder="Buscar un mail (ej.: seleccionado, verificada, búsqueda)…"
        value={q} onChange={e => setQ(e.target.value)} />
      {grupos.map(g => (
        <section key={g} className="mb-8">
          <h2 className="font-display font-bold text-lg text-[#1C2230] mb-3">{g}</h2>
          <ul className="space-y-2">
            {lista.filter(t => t.grupo === g).map(t => (
              <Fila key={t.key} t={t} onCambio={n => setCambios(c => ({ ...c, [n.key]: n }))} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
