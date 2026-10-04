"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { detalleError } from "@/hooks/useModulo";
import { SparklesIcon, PaperAirplaneIcon, CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { PRODUCTOS, type Audiencia, type Campana, type Destino, type Opcion, type Seguimiento } from "./tipos";

interface Props {
  campana: Campana | null;          // null = nueva
  /** Selección que llega desde "Empresas a contactar" ({ids} o {filter}): se usa tal cual. */
  seleccionProspectos?: Record<string, unknown> | null;
  onCerrar: () => void;
  onGuardada: (c: Campana) => void;
}

interface Borrador {
  subjects: string[];
  preheader: string;
  body: string;
  cta_label: string;
}

const input = "w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]";
const label = "block text-sm font-semibold text-[#1C2230] mb-1";
const btn = "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50";
const btnPrim = `${btn} bg-[#1E8EA3] hover:bg-[#187B8E] text-white`;
const btnSec = `${btn} border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7]`;

export default function EditorCampana({ campana, seleccionProspectos = null, onCerrar, onGuardada }: Props) {
  const editable = !campana || campana.status === "draft";
  const [nombre, setNombre] = useState(campana?.name ?? "");
  const [destino, setDestino] = useState<Destino>(campana?.target ?? (seleccionProspectos ? "prospects" : "users"));
  const [audiencia, setAudiencia] = useState(campana?.audience_key ?? "");
  const [zona, setZona] = useState("");
  const [rubro, setRubro] = useState("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [filtroRubroProspecto, setFiltroRubroProspecto] = useState("");
  const [producto, setProducto] = useState(campana?.product ?? "portal");
  const [asunto, setAsunto] = useState(campana?.subject ?? "");
  const [preheader, setPreheader] = useState(campana?.preheader ?? "");
  const [cuerpo, setCuerpo] = useState(campana?.body ?? "");
  const [ctaLabel, setCtaLabel] = useState(campana?.cta_label ?? "");
  const [ctaUrl, setCtaUrl] = useState(campana?.cta_url ?? "");
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>(campana?.follow_ups ?? []);

  const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
  const [zonas, setZonas] = useState<Opcion[]>([]);
  const [rubros, setRubros] = useState<Opcion[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; mal?: boolean } | null>(null);
  const [id, setId] = useState<string | null>(campana?.id ?? null);

  // IA
  const [brief, setBrief] = useState("");
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [asuntoElegido, setAsuntoElegido] = useState(0);
  const [pidiendoIA, setPidiendoIA] = useState(false);
  const [textoAudiencia, setTextoAudiencia] = useState("");
  const [propuestaAud, setPropuestaAud] = useState<{
    audience_key: string; label: string; zone_id: string | null; industry_id: string | null;
    recipients: number; unresolved: string[];
  } | null>(null);

  // Aprobación
  const [aprobando, setAprobando] = useState<{ n: number } | null>(null);
  const [programada, setProgramada] = useState("");

  useEffect(() => {
    api.get<Opcion[]>("/catalogs/zones").then(r => setZonas(r.data)).catch(() => {});
    api.get<Opcion[]>("/catalogs/industries").then(r => setRubros(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (zona) params.zone_id = zona;
    if (rubro) params.industry_id = rubro;
    api.get<Audiencia[]>("/admin/campaigns/audiences", { params }).then(r => setAudiencias(r.data)).catch(() => {});
  }, [zona, rubro]);

  function payload() {
    const filter: Record<string, string> = {};
    if (filtroEtapa) filter.stage = filtroEtapa;
    if (filtroRubroProspecto) filter.category = filtroRubroProspecto;
    return {
      name: nombre, target: destino,
      audience_key: destino === "users" ? audiencia || null : null,
      zone_id: destino === "users" ? zona || null : null,
      industry_id: destino === "users" ? rubro || null : null,
      prospect_selection: destino === "prospects"
        ? (seleccionProspectos ?? { filter: { ...filter, contactable: true } })
        : null,
      product: producto || null, subject: asunto, preheader: preheader || null, body: cuerpo,
      cta_label: ctaLabel || null, cta_url: ctaUrl || null,
      follow_ups: destino === "prospects" ? seguimientos : [],
    };
  }

  async function guardar(): Promise<Campana | null> {
    if (!nombre.trim()) { setAviso({ texto: "Poné un nombre para la campaña.", mal: true }); return null; }
    setGuardando(true);
    setAviso(null);
    try {
      const r = id
        ? await api.put<Campana>(`/admin/campaigns/${id}`, payload())
        : await api.post<Campana>("/admin/campaigns", payload());
      setId(r.data.id);
      onGuardada(r.data);
      setAviso({ texto: "Guardada como borrador." });
      return r.data;
    } catch (e) {
      setAviso({ texto: detalleError(e), mal: true });
      return null;
    } finally {
      setGuardando(false);
    }
  }

  async function pedirBorrador() {
    setPidiendoIA(true);
    setAviso(null);
    try {
      const r = await api.post<Borrador>("/admin/campaigns/ai/draft", {
        brief, target: destino, audience_key: audiencia || null, product: producto || null,
      });
      setBorrador(r.data);
      setAsuntoElegido(0);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setAviso({ texto: status === 503 ? "La IA no está configurada." : detalleError(e), mal: true });
    } finally {
      setPidiendoIA(false);
    }
  }

  function usarBorrador() {
    if (!borrador) return;
    setAsunto(borrador.subjects[asuntoElegido] ?? borrador.subjects[0] ?? "");
    setPreheader(borrador.preheader);
    setCuerpo(borrador.body);
    setCtaLabel(borrador.cta_label);
    setAviso({ texto: "Copiamos la propuesta al formulario. Revisala antes de guardar." });
  }

  async function interpretarAudiencia() {
    setPidiendoIA(true);
    setAviso(null);
    try {
      const r = await api.post("/admin/campaigns/ai/audience", { text: textoAudiencia });
      setPropuestaAud(r.data);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setAviso({ texto: status === 503 ? "La IA no está configurada." : detalleError(e), mal: true });
    } finally {
      setPidiendoIA(false);
    }
  }

  function aplicarAudiencia() {
    if (!propuestaAud) return;
    setAudiencia(propuestaAud.audience_key);
    setZona(propuestaAud.zone_id ?? "");
    setRubro(propuestaAud.industry_id ?? "");
    setPropuestaAud(null);
  }

  async function enviarPrueba() {
    const c = await guardar();
    if (!c) return;
    try {
      await api.post(`/admin/campaigns/${c.id}/test`);
      setAviso({ texto: "Te mandamos una prueba a tu mail." });
    } catch (e) {
      setAviso({ texto: detalleError(e), mal: true });
    }
  }

  async function abrirAprobacion() {
    const c = await guardar();
    if (!c) return;
    try {
      const r = await api.get<{ recipients: number }>(`/admin/campaigns/${c.id}/recipients`);
      setAprobando({ n: r.data.recipients });
    } catch (e) {
      setAviso({ texto: detalleError(e), mal: true });
    }
  }

  async function confirmarAprobacion() {
    if (!id || !aprobando) return;
    try {
      const r = await api.post<Campana>(`/admin/campaigns/${id}/approve`, {
        expected_recipients: aprobando.n,
        scheduled_at: programada ? new Date(programada).toISOString() : null,
      });
      onGuardada(r.data);
      setAprobando(null);
      onCerrar();
    } catch (e) {
      setAprobando(null);
      setAviso({ texto: detalleError(e), mal: true });
    }
  }

  const audSel = audiencias.find(a => a.key === audiencia);

  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-display font-bold text-[#1C2230]">{campana ? "Editar campaña" : "Nueva campaña"}</h2>
        <button onClick={onCerrar} className="text-[#64748B] hover:text-[#1C2230]" aria-label="Cerrar">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {aviso && (
        <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm font-medium ${aviso.mal ? "bg-red-50 text-red-800" : "bg-[#E6F4F7] text-[#187B8E]"}`}>
          {aviso.texto}
        </div>
      )}

      <fieldset disabled={!editable} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className={label}>Nombre (sólo lo ves vos)</label>
            <input className={input} value={nombre} onChange={e => setNombre(e.target.value)} maxLength={200} />
          </div>

          <div>
            <label className={label}>¿A quién?</label>
            <div className="flex gap-2">
              {(["users", "prospects"] as Destino[]).map(d => (
                <button key={d} type="button" onClick={() => setDestino(d)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${destino === d ? "bg-[#1E8EA3] text-white border-[#1E8EA3]" : "border-[#DDE3EC] text-[#1C2230]"}`}>
                  {d === "users" ? "Usuarios de BBJobs" : "Empresas a contactar"}
                </button>
              ))}
            </div>
          </div>

          {destino === "users" ? (
            <>
              <div>
                <label className={label}>Audiencia</label>
                <select className={input} value={audiencia} onChange={e => setAudiencia(e.target.value)}>
                  <option value="">Elegí una audiencia</option>
                  {audiencias.map(a => (
                    <option key={a.key} value={a.key}>{a.label} ({a.recipients})</option>
                  ))}
                </select>
                {audSel && <p className="text-xs text-[#64748B] mt-1">Hoy la recibirían {audSel.recipients} personas.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Zona (opcional)</label>
                  <select className={input} value={zona} onChange={e => setZona(e.target.value)}>
                    <option value="">Todas</option>
                    {zonas.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>Rubro (opcional)</label>
                  <select className={input} value={rubro} onChange={e => setRubro(e.target.value)}>
                    <option value="">Todos</option>
                    {rubros.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="border border-dashed border-[#9ED4DF] rounded-xl p-3">
                <label className={label}>Audiencia en palabras</label>
                <div className="flex gap-2">
                  <input className={input} placeholder="Ej.: empresas que nunca publicaron"
                    value={textoAudiencia} onChange={e => setTextoAudiencia(e.target.value)} maxLength={500} />
                  <button type="button" className={btnSec} onClick={interpretarAudiencia}
                    disabled={pidiendoIA || textoAudiencia.trim().length < 3}>Interpretar</button>
                </div>
                {propuestaAud && (
                  <div className="mt-2 text-sm text-[#1C2230]">
                    <p><strong>{propuestaAud.label}</strong> · {propuestaAud.recipients} personas</p>
                    {propuestaAud.unresolved.length > 0 && (
                      <p className="text-xs text-red-700">No encontré: {propuestaAud.unresolved.join(", ")}</p>
                    )}
                    <button type="button" className={`${btnSec} mt-2`} onClick={aplicarAudiencia}>Aplicar</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#1C2230] bg-[#E6F4F7] rounded-xl px-3 py-2">
                Sale a las empresas de &quot;Empresas a contactar&quot; que tienen mail, no se dieron de baja y no están registradas.
                Podés acotar por etapa o rubro.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Etapa</label>
                  <select className={input} value={filtroEtapa} onChange={e => setFiltroEtapa(e.target.value)}>
                    <option value="">Todas</option>
                    <option value="nueva">Nuevas</option>
                    <option value="contactada">Contactadas</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Rubro</label>
                  <input className={input} value={filtroRubroProspecto} onChange={e => setFiltroRubroProspecto(e.target.value)}
                    placeholder="Tal como figura en la lista" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className={label}>Qué se ofrece</label>
            <select className={input} value={producto} onChange={e => setProducto(e.target.value)}>
              {Object.entries(PRODUCTOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <p className="text-xs text-[#64748B] mt-1">Se usa para medir cuántos compraron o publicaron en los 14 días siguientes.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className={label}>Asunto</label>
            <input className={input} value={asunto} onChange={e => setAsunto(e.target.value)} maxLength={300} />
          </div>
          <div>
            <label className={label}>Preheader (texto que se ve al lado del asunto)</label>
            <input className={input} value={preheader} onChange={e => setPreheader(e.target.value)} maxLength={300} />
          </div>
          <div>
            <label className={label}>Texto</label>
            <textarea className={`${input} min-h-[180px]`} value={cuerpo} onChange={e => setCuerpo(e.target.value)} maxLength={10000} />
            <p className="text-xs text-[#64748B] mt-1">
              Texto plano. Separá párrafos con una línea en blanco. Podés usar {"{{nombre}}"} (postulantes) o {"{{empresa}}"}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Texto del botón</label>
              <input className={input} value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} maxLength={80} />
            </div>
            <div>
              <label className={label}>Link del botón</label>
              <input className={input} value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="/empleos" maxLength={500} />
            </div>
          </div>

          {destino === "prospects" && (
            <div>
              <label className={label}>Seguimientos (hasta 2; sólo salen si el anterior se entregó y no respondieron)</label>
              {seguimientos.map((s, i) => (
                <div key={i} className="border border-[#DDE3EC] rounded-xl p-3 mb-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[#1C2230]">
                    <span>A los</span>
                    <input type="number" min={3} max={60} className={`${input} w-20`} value={s.after_days}
                      onChange={e => setSeguimientos(seguimientos.map((x, j) => j === i ? { ...x, after_days: Number(e.target.value) } : x))} />
                    <span>días</span>
                    <button type="button" className="ml-auto text-red-700 text-xs font-bold"
                      onClick={() => setSeguimientos(seguimientos.filter((_, j) => j !== i))}>Quitar</button>
                  </div>
                  <input className={input} placeholder="Asunto" value={s.subject}
                    onChange={e => setSeguimientos(seguimientos.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} />
                  <textarea className={`${input} min-h-[90px]`} placeholder="Texto" value={s.body}
                    onChange={e => setSeguimientos(seguimientos.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} />
                </div>
              ))}
              {seguimientos.length < 2 && (
                <button type="button" className={btnSec}
                  onClick={() => setSeguimientos([...seguimientos, { after_days: seguimientos.length ? 21 : 7, subject: "", body: "" }])}>
                  Agregar seguimiento
                </button>
              )}
            </div>
          )}
        </div>
      </fieldset>

      {editable && (
        <div className="mt-6 border border-[#9ED4DF] bg-[#E6F4F7]/40 rounded-2xl p-4">
          <p className="font-bold text-[#1C2230] flex items-center gap-1.5 mb-2">
            <SparklesIcon className="w-5 h-5 text-[#187B8E]" /> Redactar con IA
          </p>
          <p className="text-sm text-[#1C2230] mb-2">Contá la idea y la IA te propone un texto. No se guarda ni se manda nada solo.</p>
          <textarea className={`${input} min-h-[70px] bg-white`} value={brief} onChange={e => setBrief(e.target.value)}
            maxLength={1500} placeholder="Ej.: ofrecer la revisión de CV a quienes ya cargaron el suyo, tono cercano" />
          <button type="button" className={`${btnSec} mt-2 bg-white`} onClick={pedirBorrador}
            disabled={pidiendoIA || brief.trim().length < 10}>
            {pidiendoIA ? "Pensando…" : "Proponer texto"}
          </button>
          {borrador && (
            <div className="mt-3 bg-white rounded-xl border border-[#DDE3EC] p-4 space-y-2 text-sm text-[#1C2230]">
              <p className="font-semibold">Elegí un asunto:</p>
              {borrador.subjects.map((s, i) => (
                <label key={i} className="flex items-center gap-2">
                  <input type="radio" checked={asuntoElegido === i} onChange={() => setAsuntoElegido(i)} />
                  <span>{s}</span>
                </label>
              ))}
              <p><span className="font-semibold">Preheader:</span> {borrador.preheader}</p>
              <p className="whitespace-pre-wrap">{borrador.body}</p>
              <p><span className="font-semibold">Botón:</span> {borrador.cta_label}</p>
              <button type="button" className={btnPrim} onClick={usarBorrador}>Usar este borrador</button>
            </div>
          )}
        </div>
      )}

      {editable && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button className={btnPrim} onClick={guardar} disabled={guardando}>Guardar borrador</button>
          <button className={btnSec} onClick={enviarPrueba} disabled={guardando}>
            <PaperAirplaneIcon className="w-4 h-4" /> Enviarme una prueba
          </button>
          <button className={btnSec} onClick={abrirAprobacion} disabled={guardando}>
            <CheckCircleIcon className="w-4 h-4" /> Aprobar y programar
          </button>
        </div>
      )}

      {aprobando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-display font-bold text-[#1C2230] mb-2">Aprobar campaña</h3>
            <p className="text-[#1C2230] mb-4">
              La van a recibir <strong>{aprobando.n}</strong> {destino === "prospects" ? "empresas" : "personas"}. Una vez aprobada, sale sola.
            </p>
            <label className={label}>Programar (opcional)</label>
            <input type="datetime-local" className={input} value={programada} onChange={e => setProgramada(e.target.value)} />
            <p className="text-xs text-[#64748B] mt-1">Si lo dejás vacío, sale apenas se apruebe.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className={btnSec} onClick={() => setAprobando(null)}>Volver</button>
              <button className={btnPrim} onClick={confirmarAprobacion}>Aprobar para {aprobando.n}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
