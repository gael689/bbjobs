"use client";

import { useState } from "react";
import Link from "next/link";
import { PaperAirplaneIcon, PauseIcon, PlayIcon, RocketLaunchIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import { Aviso, Spinner } from "@/components/admin-ia/comun";

/**
 * Prospección automática (backend: services/email/secuencia.py). Como el centro-nuevo: las
 * empresas nuevas entran solas a una secuencia de 3 mails; acá se ve cómo va, se edita cada
 * mail y se prende o pausa. Pedido de Gael (23/11/2026): "que ella lo pueda MODIFICAR".
 */

interface Paso { n: number; after_days: number; subject: string; body: string }
interface Datos {
  activa: boolean;
  pasos: Paso[];
  variables: Record<string, string>;
  casillas_activas: number;
  stats: {
    en_cola: number; enviados_hoy: number; empresas_contactadas: number; respondieron: number;
    bajas: number; por_entrar: number; tope_diario: number; enviados_por_paso: Record<string, number>;
  };
}

const input = "w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]";

function Numero({ titulo, valor, nota }: { titulo: string; valor: number | string; nota?: string }) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-bold text-[#64748B]">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-[#1C2230]">{valor}</p>
      {nota && <p className="text-[11px] text-[#64748B] mt-0.5">{nota}</p>}
    </div>
  );
}

function diaDe(pasos: Paso[], i: number): number {
  return pasos.slice(1, i + 1).reduce((a, p) => a + (p.after_days || 0), 0);
}

export default function ProspeccionPage() {
  const estado = useModulo<Datos>("/admin/prospecting/sequence");
  const [pasos, setPasos] = useState<Paso[] | null>(null);
  const [guardados, setGuardados] = useState<Paso[] | null>(null);
  const [activa, setActiva] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (estado.estado === "en_desarrollo") {
    return <EnDesarrollo titulo="Prospección automática" descripcion="Mails automáticos a empresas que todavía no están en BBJobs." />;
  }
  if (estado.estado === "cargando") return <div className="py-16 flex justify-center"><Spinner /></div>;
  if (estado.estado === "error") return <div className="p-8"><Aviso tono="error">{estado.mensaje}</Aviso></div>;

  const d = estado.datos;
  const lista = pasos ?? d.pasos;
  const prendida = activa ?? d.activa;
  const cambiado = pasos !== null && JSON.stringify(pasos) !== JSON.stringify(guardados ?? d.pasos);

  function editar(i: number, campo: keyof Paso, valor: string | number) {
    setPasos(lista.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  }

  async function guardar() {
    setOcupado(true); setMsg(null);
    try {
      const r = await api.put<Datos>("/admin/prospecting/sequence", { pasos: lista });
      setPasos(r.data.pasos);
      setGuardados(r.data.pasos);
      setMsg({ tono: "ok", texto: "Guardado. Los mails que todavía no salieron ya usan el texto nuevo." });
    } catch (e) {
      setMsg({ tono: "error", texto: detalleError(e) });
    } finally { setOcupado(false); }
  }

  async function alternar() {
    setOcupado(true); setMsg(null);
    try {
      const r = await api.put<Datos>("/admin/prospecting/sequence/active", { activa: !prendida });
      setActiva(r.data.activa);
    } catch (e) {
      setMsg({ tono: "error", texto: detalleError(e) });
    } finally { setOcupado(false); }
  }

  async function prueba(n: number) {
    setMsg(null);
    try {
      await api.post("/admin/prospecting/sequence/test", { n });
      setMsg({ tono: "ok", texto: `Te mandamos el mail ${n} a tu casilla, armado para una empresa de ejemplo.` });
    } catch (e) {
      setMsg({ tono: "error", texto: detalleError(e) });
    }
  }

  const s = d.stats;
  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1 flex items-center gap-2">
            <RocketLaunchIcon className="w-6 h-6 text-[#187B8E]" /> Prospección automática
          </h1>
          <p className="text-[#64748B] text-sm max-w-2xl">
            Las empresas nuevas que llegan a «Empresas a contactar» reciben solas estos 3 mails. Salen en días hábiles
            de 9 a 12, respetando el cupo de cada casilla. Si la empresa responde, se da de baja o el mail rebota, no
            le llega ninguno más.
          </p>
        </div>
        <button type="button" onClick={alternar} disabled={ocupado}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60 ${
            prendida ? "bg-amber-600 hover:bg-amber-700" : "bg-[#1E8EA3] hover:bg-[#187B8E]"}`}>
          {prendida ? <><PauseIcon className="w-5 h-5" /> Pausar</> : <><PlayIcon className="w-5 h-5" /> Prender</>}
        </button>
      </div>

      <div className={`rounded-2xl border p-4 mb-6 text-sm ${prendida ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <strong>{prendida ? "Prendida." : "Pausada."}</strong>{" "}
        {prendida
          ? `Hasta ${s.tope_diario} empresas nuevas por día. Hay ${s.por_entrar} esperando su turno.`
          : "No entra ninguna empresa nueva y no sale ningún mail de la secuencia hasta que la prendas."}
        {d.casillas_activas === 0 && (
          <> {" "}Todavía no hay casillas de envío activas: <Link href="/dashboard/admin/mails/casillas" className="font-bold underline">cargá al menos una</Link>.</>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Numero titulo="Enviados hoy" valor={s.enviados_hoy} nota={`Tope: ${s.tope_diario} por día`} />
        <Numero titulo="Empresas contactadas" valor={s.empresas_contactadas} />
        <Numero titulo="Respondieron" valor={s.respondieron} nota="Avanzaron a «respondió» o más" />
        <Numero titulo="En cola" valor={s.en_cola} nota={`Se dieron de baja: ${s.bajas}`} />
      </div>

      {msg && <div className="mb-4"><Aviso tono={msg.tono}>{msg.texto}</Aviso></div>}

      <div className="space-y-5">
        {lista.map((p, i) => (
          <section key={p.n} className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display font-bold text-lg text-[#1C2230]">
                  {i === 0 ? "Mail 1 · primer contacto" : `Mail ${p.n} · seguimiento`}
                </h2>
                <p className="text-xs text-[#64748B]">
                  {i === 0 ? "Sale apenas la empresa entra a la secuencia." :
                    `Día ${diaDe(lista, i)}: sale si el anterior se entregó y la empresa no respondió.`}
                  {d.stats.enviados_por_paso[String(p.n)] ? ` · Enviados: ${d.stats.enviados_por_paso[String(p.n)]}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => prueba(p.n)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDE3EC] px-3 py-2 text-xs font-bold text-[#187B8E] hover:bg-[#E6F4F7]">
                <PaperAirplaneIcon className="w-4 h-4" /> Mandarme una prueba
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <div>
                <label className="block text-xs font-bold text-[#1C2230] mb-1">
                  Asunto{i > 0 && <span className="font-normal text-[#64748B]"> (vacío = «Re:» del primero, en la misma conversación)</span>}
                </label>
                <input className={input} value={p.subject} maxLength={300} onChange={e => editar(i, "subject", e.target.value)} />
              </div>
              {i > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#1C2230] mb-1">Días después del anterior</label>
                  <input type="number" min={1} max={30} className={input} value={p.after_days}
                    onChange={e => editar(i, "after_days", Number(e.target.value))} />
                </div>
              )}
            </div>
            <label className="block text-xs font-bold text-[#1C2230] mt-3 mb-1">
              Texto{i > 0 && <span className="font-normal text-[#64748B]"> (vacío = este mail no sale)</span>}
            </label>
            <textarea className={`${input} min-h-[170px] font-mono text-[13px] leading-relaxed`} value={p.body} maxLength={6000}
              onChange={e => editar(i, "body", e.target.value)} />
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DDE3EC] bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="text-xs text-[#64748B]">
          Variables: {Object.entries(d.variables).map(([k, v]) => (
            <span key={k} className="mr-2"><code className="rounded bg-[#E6F4F7] px-1.5 py-0.5 text-[#187B8E]">{`{{${k}}}`}</code> {v}</span>
          ))}
          · El pie con el link de baja lo agrega el sistema.
        </p>
        <button type="button" onClick={guardar} disabled={!cambiado || ocupado}
          className="rounded-xl bg-[#1E8EA3] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#187B8E] disabled:opacity-50">
          {ocupado ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
