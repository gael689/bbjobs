"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import Paginacion from "@/components/ui/Paginacion";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import { ArrowDownTrayIcon, MegaphoneIcon } from "@heroicons/react/24/outline";
import FichaProspecto from "./FichaProspecto";
import {
  ETAPAS, ETAPA_CLS, ETAPA_LABEL, MOTIVO_LABEL, aCuerpo, aParams, fecha,
  type Facets, type Filtro, type ProspectPage, type SyncRow,
} from "./tipos";

const POR_PAGINA = 50;

/** Qué abarca la selección: ids marcados a mano, o "todas las que cumplen el filtro". */
type Seleccion = { tipo: "ids"; ids: Set<string> } | { tipo: "filtro"; filtro: Filtro; total: number };

function Sincronizaciones() {
  const [filas, setFilas] = useState<SyncRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<SyncRow[]>("/admin/prospect-syncs").then(r => setFilas(r.data)).catch(e => setError(detalleError(e)));
  }, []);

  if (error) return <p className="text-sm text-red-800 font-semibold">{error}</p>;
  if (!filas) return <p className="text-sm text-[#1C2230]">Cargando…</p>;
  if (filas.length === 0) return <p className="text-sm text-[#1C2230]">Todavía no llegó ningún lote desde el centro.</p>;
  return (
    <div className="divide-y divide-[#DDE3EC]/60">
      {filas.map(s => {
        const motivos = Object.entries(s.discarded_reasons)
          .map(([m, n]) => `${n} ${MOTIVO_LABEL[m] ?? m}`).join(", ");
        return (
          <div key={s.sync_id} className="py-3 text-sm text-[#1C2230]">
            <span className="font-semibold">{new Date(s.created_at).toLocaleString("es-AR")}</span>
            {" · "}{s.received} recibidas · {s.created} nuevas · {s.updated} actualizadas · {s.discarded} descartadas
            {motivos && ` (${motivos})`}
            {s.suppressed > 0 && ` · ${s.suppressed} bajas nuevas`}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminEmpresasPotencialesPage() {
  const router = useRouter();
  const facetas = useModulo<Facets>("/admin/prospects/facets");

  const [filtro, setFiltro] = useState<Filtro>({});
  const [borrador, setBorrador] = useState<Filtro>({});
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<ProspectPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>({ tipo: "ids", ids: new Set() });
  const [abierta, setAbierta] = useState<string | null>(null);
  const [vista, setVista] = useState<"empresas" | "sincronizaciones">("empresas");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // La carga va dentro del efecto con setState sólo en callbacks (react-hooks/set-state-in-effect).
  // Para recargar desde un botón se sube `version`. Mientras recarga se ve la página anterior.
  const [version, setVersion] = useState(0);
  const cargar = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (facetas.estado !== "listo") return;
    let vivo = true;
    api.get<ProspectPage>("/admin/prospects", { params: { ...aParams(filtro), page: pagina, size: POR_PAGINA } })
      .then(r => { if (vivo) { setDatos(r.data); setError(null); } })
      .catch(e => { if (vivo) setError(detalleError(e)); });
    return () => { vivo = false; };
  }, [filtro, pagina, version, facetas.estado]);

  if (facetas.estado === "en_desarrollo") {
    return (
      <EnDesarrollo
        titulo="Empresas a contactar"
        descripcion="Acá vas a tener una base de empresas de la zona para ofrecerles la selección de personal y el portal, con su seguimiento."
      />
    );
  }
  if (facetas.estado === "cargando") {
    return (
      <div className="py-24 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (facetas.estado === "error") {
    return <div className="px-6 py-8 text-red-800 font-semibold">{facetas.mensaje}</div>;
  }
  const f = facetas.datos;

  const cantidadSeleccion = seleccion.tipo === "ids" ? seleccion.ids.size : seleccion.total;
  const cuerpoSeleccion = () =>
    seleccion.tipo === "ids" ? { ids: [...seleccion.ids] } : { filter: aCuerpo(seleccion.filtro) };

  function aplicar() {
    setFiltro(borrador);
    setPagina(1);
    setSeleccion({ tipo: "ids", ids: new Set() });
  }

  function alternar(id: string) {
    const ids = new Set(seleccion.tipo === "ids" ? seleccion.ids : []);
    if (ids.has(id)) ids.delete(id); else ids.add(id);
    setSeleccion({ tipo: "ids", ids });
  }

  function elegirPagina(marcar: boolean) {
    const ids = new Set(seleccion.tipo === "ids" ? seleccion.ids : []);
    for (const it of datos?.items ?? []) { if (marcar) ids.add(it.id); else ids.delete(it.id); }
    setSeleccion({ tipo: "ids", ids });
  }

  async function elegirTodas() {
    setError(null);
    try {
      const r = await api.post<{ affected: number }>("/admin/prospects/selection/count", { filter: aCuerpo(filtro) });
      setSeleccion({ tipo: "filtro", filtro, total: r.data.affected });
    } catch (e) {
      setError(detalleError(e));
    }
  }

  async function enMasa(action: "set_stage" | "discard" | "delete", stage?: string) {
    if (!cantidadSeleccion) return;
    const que = action === "delete" ? "BORRAR DEFINITIVAMENTE" : action === "discard" ? "descartar" : `pasar a "${ETAPA_LABEL[stage!]}"`;
    if (!confirm(`¿${que} ${cantidadSeleccion} empresa${cantidadSeleccion === 1 ? "" : "s"}?` +
      (action === "delete" ? "\n\nNo se puede deshacer. Las bajas de sus mails, si las hay, se mantienen." : ""))) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await api.post<{ affected: number }>("/admin/prospects/bulk", { ...cuerpoSeleccion(), action, stage });
      setAviso(`Listo: ${r.data.affected} empresa${r.data.affected === 1 ? "" : "s"}.`);
      setSeleccion({ tipo: "ids", ids: new Set() });
      cargar();
    } catch (e) {
      setError(detalleError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function exportar() {
    setError(null);
    try {
      // Con `api` (lleva el token) y no un link directo: el endpoint pide sesión de admin.
      const r = await api.get("/admin/prospects-export.csv", { params: aParams(filtro), responseType: "blob" });
      const url = URL.createObjectURL(r.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "empresas.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(detalleError(e, "No se pudo exportar."));
    }
  }

  function crearCampana() {
    // La página de campañas puede leer este parámetro para precargar la selección de una
    // campaña a prospectos (por ahora puede ignorarlo).
    const sel = cuerpoSeleccion();
    router.push(`/dashboard/admin/campanas?prospectos=${encodeURIComponent(JSON.stringify(sel))}`);
  }

  const paginaEntera = !!datos?.items.length && seleccion.tipo === "ids" && datos.items.every(it => seleccion.ids.has(it.id));
  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / POR_PAGINA)) : 1;
  const sel = "text-sm border border-[#DDE3EC] rounded-xl px-3 py-2 bg-white text-[#1C2230]";
  const boton = "inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-bold border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7] disabled:opacity-40";

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Empresas a contactar</h1>
      <p className="text-[#1C2230] text-sm mb-6">
        Empresas de la zona que todavía no están en BBJobs, para ofrecerles la selección de personal y el portal.
      </p>

      <div className="flex gap-2 mb-5">
        {(["empresas", "sincronizaciones"] as const).map(v => (
          <button key={v} onClick={() => setVista(v)}
            className={`text-sm px-4 py-2 rounded-xl font-bold ${vista === v ? "bg-[#1E8EA3] text-white" : "border border-[#DDE3EC] text-[#1C2230] hover:bg-[#E6F4F7]"}`}>
            {v === "empresas" ? "Empresas" : "Sincronizaciones"}
          </button>
        ))}
      </div>

      {vista === "sincronizaciones" ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-[#1C2230] mb-3">Cada lote que llegó desde el centro de Gael.</p>
          <Sincronizaciones />
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex flex-wrap gap-2 items-center">
              <input value={borrador.q ?? ""} onChange={e => setBorrador({ ...borrador, q: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") aplicar(); }}
                placeholder="Buscar por nombre" maxLength={100} className={`${sel} min-w-[200px]`} />
              <select value={borrador.category ?? ""} onChange={e => setBorrador({ ...borrador, category: e.target.value })} className={sel}>
                <option value="">Todos los rubros</option>
                {f.categories.map(c => <option key={c.value} value={c.value}>{c.value} ({c.count})</option>)}
              </select>
              <select value={borrador.locality ?? ""} onChange={e => setBorrador({ ...borrador, locality: e.target.value })} className={sel}>
                <option value="">Todas las localidades</option>
                {f.localities.map(c => <option key={c.value} value={c.value}>{c.value} ({c.count})</option>)}
              </select>
              <select value={borrador.stage ?? ""} onChange={e => setBorrador({ ...borrador, stage: e.target.value })} className={sel}>
                <option value="">Todas las etapas</option>
                {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <select value={borrador.has_email ?? ""} onChange={e => setBorrador({ ...borrador, has_email: e.target.value as Filtro["has_email"] })} className={sel}>
                <option value="">Con o sin mail</option>
                <option value="true">Con mail</option>
                <option value="false">Sin mail</option>
              </select>
              <label className="text-sm text-[#1C2230] font-semibold inline-flex items-center gap-1.5">
                <input type="checkbox" checked={!!borrador.has_whatsapp} onChange={e => setBorrador({ ...borrador, has_whatsapp: e.target.checked })} />
                Con WhatsApp
              </label>
              <label className="text-sm text-[#1C2230] font-semibold inline-flex items-center gap-1.5">
                <input type="checkbox" checked={!!borrador.never_contacted} onChange={e => setBorrador({ ...borrador, never_contacted: e.target.checked })} />
                Nunca contactadas
              </label>
              <button onClick={aplicar} className="text-sm px-4 py-2 rounded-xl font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white">
                Filtrar
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[#1C2230] mr-2">
              {seleccion.tipo === "filtro"
                ? `Elegidas: las ${seleccion.total} que cumplen el filtro`
                : `Elegidas: ${seleccion.ids.size}`}
            </span>
            {datos && datos.total > 0 && seleccion.tipo === "ids" && (
              <button onClick={elegirTodas} className={boton}>Elegir las {datos.total} que cumplen el filtro</button>
            )}
            {cantidadSeleccion > 0 && (
              <>
                <select defaultValue="" disabled={ocupado}
                  onChange={e => { const v = e.target.value; e.target.value = ""; if (v) enMasa("set_stage", v); }}
                  className={sel}>
                  <option value="" disabled>Cambiar etapa…</option>
                  {ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
                <button disabled={ocupado} onClick={() => enMasa("discard")} className={boton}>Descartar</button>
                <button disabled={ocupado} onClick={() => enMasa("delete")}
                  className="text-sm px-3 py-2 rounded-xl font-bold border border-red-300 text-red-800 hover:bg-red-50 disabled:opacity-40">
                  Borrar definitivamente
                </button>
                <button onClick={crearCampana} className={`${boton} bg-[#E6F4F7]`}>
                  <MegaphoneIcon className="w-4 h-4" /> Crear campaña con esta selección
                </button>
                <button onClick={() => setSeleccion({ tipo: "ids", ids: new Set() })} className={boton}>Limpiar</button>
              </>
            )}
            <button onClick={exportar} className={`${boton} ml-auto`}>
              <ArrowDownTrayIcon className="w-4 h-4" /> Exportar CSV
            </button>
          </div>

          {aviso && <p className="text-sm text-green-900 font-semibold mb-3">{aviso}</p>}
          {error && <p className="text-sm text-red-800 font-semibold mb-3">{error}</p>}

          <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-x-auto shadow-sm">
            {!datos && !error ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !datos || datos.items.length === 0 ? (
              <div className="p-12 text-center text-[#1C2230]">No hay empresas con estos filtros.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#FAFBFD] text-left text-[#1C2230]">
                  <tr>
                    <th className="px-4 py-3">
                      <input type="checkbox" aria-label="Elegir esta página" checked={paginaEntera}
                        onChange={e => elegirPagina(e.target.checked)} />
                    </th>
                    <th className="px-4 py-3 font-extrabold">Empresa</th>
                    <th className="px-4 py-3 font-extrabold">Rubro</th>
                    <th className="px-4 py-3 font-extrabold">Localidad</th>
                    <th className="px-4 py-3 font-extrabold">Mail</th>
                    <th className="px-4 py-3 font-extrabold">Teléfono</th>
                    <th className="px-4 py-3 font-extrabold">Etapa</th>
                    <th className="px-4 py-3 font-extrabold">Último contacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE3EC]/60">
                  {datos.items.map(it => (
                    <tr key={it.id} className="hover:bg-[#FAFBFD] text-[#1C2230]">
                      <td className="px-4 py-3">
                        <input type="checkbox" aria-label={`Elegir ${it.name}`}
                          checked={seleccion.tipo === "filtro" || seleccion.ids.has(it.id)}
                          disabled={seleccion.tipo === "filtro"}
                          onChange={() => alternar(it.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setAbierta(it.id)} className="font-bold text-left text-[#187B8E] hover:underline">
                          {it.name}
                        </button>
                        {it.do_not_contact && <span className="block text-xs font-semibold text-[#7A5A44]">No contactar por mail</span>}
                      </td>
                      <td className="px-4 py-3">{it.category ?? "—"}</td>
                      <td className="px-4 py-3">{it.locality ?? "—"}</td>
                      <td className="px-4 py-3 break-all">{it.primary_email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{it.phone ?? it.whatsapp ?? "—"}</span>
                          <WhatsAppButton phone={it.whatsapp || it.phone} size="xs" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${ETAPA_CLS[it.stage] ?? ""}`}>
                          {ETAPA_LABEL[it.stage] ?? it.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fecha(it.last_contacted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {datos && (
            <div className="mt-4">
              <Paginacion pagina={pagina} totalPaginas={totalPaginas} total={datos.total} pageSize={POR_PAGINA}
                etiqueta="empresas" onCambiar={setPagina} />
            </div>
          )}
        </>
      )}

      {abierta && <FichaProspecto id={abierta} onCerrar={() => setAbierta(null)} onCambio={cargar} />}
    </div>
  );
}
