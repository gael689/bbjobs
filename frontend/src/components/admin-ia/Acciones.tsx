"use client";

import { useEffect, useState } from "react";
import {
  ArrowPathIcon, ShieldCheckIcon, DocumentArrowDownIcon, MegaphoneIcon, CheckCircleIcon, XCircleIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { api } from "@/lib/api";
import { detalleError } from "@/hooks/useModulo";
import type { Candidate } from "@/app/dashboard/admin/types";
import { Aviso, Confirmar, Spinner, usd } from "./comun";

interface Estado {
  recs_switch_on: boolean;
  ai_configured: boolean;
  budget_left: boolean;
  today_usd: number;
  daily_budget_usd: number;
  queue: number;
  live_jobs: number;
  pending_moderation: number;
}

type Accion = "todas" | "pendientes" | "cv" | "mensual";

const TEXTOS: Record<Accion, { titulo: string; confirmar: string; boton: string }> = {
  todas: {
    titulo: "¿Recalcular todas las búsquedas activas?",
    confirmar: "Se ponen en la cola y se procesan de a 20 cada 10 minutos. La IA sólo evalúa los perfiles que cambiaron y se frena sola al llegar al tope de gasto del día.",
    boton: "Recalcular todas",
  },
  pendientes: {
    titulo: "¿Revisar las búsquedas pendientes?",
    confirmar: "La IA compara cada búsqueda pendiente con las demás para marcar posibles duplicados y sectores dudosos. No aprueba ni rechaza nada: las marcas aparecen en Búsquedas y en Actividad.",
    boton: "Revisar",
  },
  cv: {
    titulo: "¿Releer este CV?",
    confirmar: "Se vuelve a descargar, leer y anonimizar el CV, y se actualiza lo que lee la IA de ese perfil. El resultado de la anonimización queda en Actividad.",
    boton: "Releer CV",
  },
  mensual: {
    titulo: "¿Armar ahora el borrador de novedades?",
    confirmar: "Se arma el borrador con los datos del mes pasado (una sola llamada a la IA). Queda en Campañas para que lo revises y lo apruebes: no sale solo. Si ya existe el de este mes, no se arma otro.",
    boton: "Armar borrador",
  },
};

function Requisito({ ok, si, no }: { ok: boolean; si: string; no: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#1C2230]">
      {ok ? <CheckCircleIcon className="w-5 h-5 text-green-700 shrink-0" /> : <XCircleIcon className="w-5 h-5 text-red-700 shrink-0" />}
      <span>{ok ? si : no}</span>
    </li>
  );
}

function TarjetaAccion({ icono: Icono, titulo, texto, children }: {
  icono: typeof ArrowPathIcon; titulo: string; texto: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#E6F4F7] text-[#187B8E] flex items-center justify-center shrink-0">
          <Icono className="w-5 h-5" />
        </div>
        <p className="font-display font-bold text-[#1C2230]">{titulo}</p>
      </div>
      <p className="text-sm text-[#1C2230] leading-relaxed mb-4 flex-1">{texto}</p>
      {children}
    </div>
  );
}

const BOTON = "inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-[#1E8EA3] hover:bg-[#187B8E] text-white px-4 py-2.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed";

export default function Acciones() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [intento, setIntento] = useState(0);
  const [confirmar, setConfirmar] = useState<Accion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [q, setQ] = useState("");
  const [candidatos, setCandidatos] = useState<Candidate[]>([]);
  const [elegido, setElegido] = useState<Candidate | null>(null);

  useEffect(() => {
    let vigente = true;
    api.get<Estado>("/admin/ai/actions/status").then(r => { if (vigente) setEstado(r.data); }).catch(() => {});
    return () => { vigente = false; };
  }, [intento]);

  // Buscador de candidatos para "Releer CV": el mismo listado de Candidatos, sólo los que tienen CV.
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) return;
    let vigente = true;
    const t = setTimeout(() => {
      api.get<{ items: Candidate[] }>("/admin/candidates", { params: { q: texto, has_cv: true, page_size: 6 } })
        .then(r => { if (vigente) setCandidatos(r.data.items); })
        .catch(() => { if (vigente) setCandidatos([]); });
    }, 300);
    return () => { vigente = false; clearTimeout(t); };
  }, [q]);

  async function lanzar() {
    if (!confirmar) return;
    setOcupado(true);
    setAviso(null);
    try {
      const url = {
        todas: "/admin/ai/actions/recompute-all",
        pendientes: "/admin/ai/actions/review-pending",
        cv: `/admin/ai/actions/reread-cv/${elegido?.id}`,
        mensual: "/admin/ai/actions/monthly-draft",
      }[confirmar];
      const r = await api.post<{ message: string }>(url);
      setAviso({ tono: "ok", texto: r.data.message });
      if (confirmar === "cv") { setElegido(null); setQ(""); setCandidatos([]); }
      setIntento(i => i + 1);
    } catch (e) {
      setAviso({ tono: "error", texto: detalleError(e) });
    } finally {
      setOcupado(false);
      setConfirmar(null);
    }
  }

  if (!estado) return <div className="py-12 flex justify-center"><Spinner /></div>;
  const lista = estado.recs_switch_on && estado.ai_configured && estado.budget_left;
  const sinIa = !estado.ai_configured || !estado.budget_left;

  return (
    <div>
      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-5 shadow-sm">
        <p className="font-bold text-[#1C2230] mb-3">¿Se puede usar la IA ahora?</p>
        <ul className="space-y-2">
          <Requisito ok={estado.recs_switch_on} si="La IA de recomendados está prendida."
                     no="La IA de recomendados está apagada: se prende en Mails e IA." />
          <Requisito ok={estado.ai_configured} si="La cuenta de Gemini está configurada."
                     no="Todavía no hay cuenta de Gemini configurada: la IA no puede trabajar." />
          <Requisito ok={estado.budget_left}
                     si={`Gasto de hoy: ${usd(estado.today_usd)} de un tope de ${usd(estado.daily_budget_usd)}.`}
                     no={`Hoy ya se llegó al tope de gasto (${usd(estado.daily_budget_usd)}). Vuelve mañana.`} />
        </ul>
        <p className="text-sm text-[#1C2230] mt-3">
          En la cola: <strong>{estado.queue}</strong> · Búsquedas activas: <strong>{estado.live_jobs}</strong> · Pendientes de moderación: <strong>{estado.pending_moderation}</strong>
        </p>
        <p className="text-sm text-[#1C2230] mt-2">
          La IA nunca manda mails ni cambia el estado de nada: ordena, resume y marca cosas para que alguien de Talency decida.
        </p>
      </div>

      {aviso && <div className="mb-4"><Aviso tono={aviso.tono}>{aviso.texto}</Aviso></div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TarjetaAccion icono={ArrowPathIcon} titulo="Recalcular todas las búsquedas activas"
                       texto="Vuelve a ordenar los postulantes y la Base de Talento de cada búsqueda activa. Para recalcular una sola, abrila en Recomendados.">
          <button className={BOTON} disabled={!lista || estado.live_jobs === 0} onClick={() => setConfirmar("todas")}>
            Recalcular {estado.live_jobs} búsquedas
          </button>
        </TarjetaAccion>

        <TarjetaAccion icono={ShieldCheckIcon} titulo="Revisar duplicados y sector de las pendientes"
                       texto="Marca las búsquedas pendientes que parecen repetidas o que quizás eligieron mal el sector. Vos decidís en Búsquedas y postulantes.">
          <button className={BOTON} disabled={!lista || estado.pending_moderation === 0} onClick={() => setConfirmar("pendientes")}>
            Revisar {estado.pending_moderation} pendientes
          </button>
        </TarjetaAccion>

        <TarjetaAccion icono={DocumentArrowDownIcon} titulo="Releer el CV de un candidato"
                       texto="Sirve cuando un candidato cambió el CV y no se refleja, o para comprobar que la anonimización funcionó.">
          <label className="block text-sm font-bold text-[#1C2230] mb-2">Buscá al candidato
            <input value={q} onChange={e => { setQ(e.target.value); setElegido(null); if (e.target.value.trim().length < 2) setCandidatos([]); }}
                   placeholder="Nombre, apellido o mail"
                   className="mt-1 w-full border border-[#DDE3EC] rounded-xl px-3 py-2 text-sm bg-white font-normal" />
          </label>
          {candidatos.length > 0 && !elegido && (
            <ul className="border border-[#DDE3EC] rounded-xl divide-y divide-[#DDE3EC]/60 mb-3 max-h-48 overflow-auto">
              {candidatos.map(c => (
                <li key={c.id}>
                  <button onClick={() => setElegido(c)} className="w-full text-left px-3 py-2 text-sm text-[#1C2230] hover:bg-[#FAFBFD]">
                    {c.first_name} {c.last_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && candidatos.length === 0 && !elegido && (
            <p className="text-sm text-[#1C2230] mb-3">No encontramos candidatos con CV con ese nombre.</p>
          )}
          <button className={BOTON} disabled={!lista || !elegido} onClick={() => setConfirmar("cv")}>
            {elegido ? `Releer el CV de ${elegido.first_name} ${elegido.last_name}` : "Elegí un candidato"}
          </button>
        </TarjetaAccion>

        <TarjetaAccion icono={MegaphoneIcon} titulo="Borrador de novedades del mes"
                       texto="Se arma solo el día 1. Con este botón lo armás ahora con los datos del mes pasado. Queda en borrador hasta que lo apruebes.">
          <div className="flex flex-wrap items-center gap-3">
            <button className={BOTON} disabled={!estado.budget_left} onClick={() => setConfirmar("mensual")}>Armar borrador ahora</button>
            <Link href="/dashboard/admin/campanas" className="text-sm font-bold text-[#187B8E] underline">Ir a Campañas</Link>
          </div>
          {sinIa && estado.budget_left && (
            <p className="text-xs text-[#1C2230] mt-2">Sin cuenta de Gemini, el borrador trae sólo los datos del mes para que lo escribas vos.</p>
          )}
        </TarjetaAccion>
      </div>

      {confirmar && (
        <Confirmar titulo={TEXTOS[confirmar].titulo} texto={TEXTOS[confirmar].confirmar} boton={TEXTOS[confirmar].boton}
                   ocupado={ocupado} onSi={lanzar} onNo={() => setConfirmar(null)} />
      )}
    </div>
  );
}
