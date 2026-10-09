"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SparklesIcon, ExclamationTriangleIcon, CheckIcon } from "@heroicons/react/24/outline";

/**
 * "¿Te ayudamos a redactarla?" en Publicar búsqueda (módulo nuevo, Frente 6.3).
 *
 * La empresa escribe unas líneas y la IA propone título, aviso, sector y habilidades del
 * catálogo, más avisos si el texto pide algo discriminatorio. Nada se guarda solo: cada campo
 * se usa con un botón y después se edita en el formulario de siempre. Sin el módulo, sin IA
 * (`available: false`) o con la ruta en 404, el bloque no aparece y la pantalla queda como hoy.
 */

export const ASISTENTE_MAX = 1500;
const ACTIVO = process.env.NEXT_PUBLIC_MODULOS_NUEVOS === "true";

interface DraftSkill { id: string; name: string; slug: string; category: string; is_required: boolean }
interface Advertencia { texto: string; motivo: string; alternativa: string }
interface Draft {
  available: boolean;
  reason?: string;
  title?: string;
  description?: string;
  industry?: { id: string; name: string };
  skills: DraftSkill[];
  warnings: Advertencia[];
}

export interface PropuestaAplicada {
  title?: string;
  description?: string;
  industry_id?: string;
  skills?: { skill_id: string; skill_name: string; is_required: boolean }[];
}

type Campo = "title" | "description" | "industry_id" | "skills";

export default function AsistenteRedaccion({
  title, zoneId, modality, onApply,
}: {
  title: string;
  zoneId: string;
  modality: string;
  onApply: (p: PropuestaAplicada) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usados, setUsados] = useState<Set<Campo>>(new Set());

  useEffect(() => {
    if (!ACTIVO) return;
    api.get("/me/company/ai/job-draft/status")
      .then(r => setVisible(!!r.data?.available))
      .catch(() => setVisible(false));
  }, []);

  if (!ACTIVO || !visible) return null;

  async function proponer() {
    setCargando(true);
    setAviso(null);
    setDraft(null);
    setUsados(new Set());
    try {
      const r = await api.post<Draft>("/me/company/ai/job-draft", {
        text: texto.trim(),
        title: title.trim() || undefined,
        zone_id: zoneId || undefined,
        modality: modality || undefined,
      });
      if (r.data.available) {
        setDraft(r.data);
      } else if (r.data.reason === "limite_diario") {
        setAviso("Llegaste al máximo de propuestas por hoy. Podés escribir el aviso como siempre.");
      } else {
        setAviso("No pudimos armar una propuesta ahora. Podés escribir el aviso como siempre.");
      }
    } catch {
      setAviso("No pudimos armar una propuesta ahora. Podés escribir el aviso como siempre.");
    } finally {
      setCargando(false);
    }
  }

  function campo(c: Campo): PropuestaAplicada {
    if (!draft) return {};
    switch (c) {
      case "title": return draft.title ? { title: draft.title } : {};
      case "description": return draft.description ? { description: draft.description } : {};
      case "industry_id": return draft.industry ? { industry_id: draft.industry.id } : {};
      case "skills":
        return draft.skills.length
          ? { skills: draft.skills.map(s => ({ skill_id: s.id, skill_name: s.name, is_required: s.is_required })) }
          : {};
    }
  }

  function usar(campos: Campo[]) {
    onApply(Object.assign({}, ...campos.map(campo)));
    setUsados(prev => new Set([...prev, ...campos]));
  }

  const botonUsar = (c: Campo) => (
    <button
      type="button"
      onClick={() => usar([c])}
      className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-[#1E8EA3] hover:underline"
    >
      {usados.has(c) ? <><CheckIcon className="w-3.5 h-3.5" /> Usado</> : "Usar"}
    </button>
  );

  const disponibles: Campo[] = draft
    ? (["title", "description", "industry_id", "skills"] as Campo[]).filter(c => Object.keys(campo(c)).length > 0)
    : [];

  return (
    <div className="bg-white border border-[#9ED4DF] rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <SparklesIcon className="w-5 h-5 text-[#1E8EA3]" />
        <p className="font-display font-bold text-[#1C2230]">¿Te ayudamos a redactarla?</p>
      </div>
      <p className="text-sm text-[#64748B] mb-3">
        Contanos en unas líneas qué necesitás y te proponemos el aviso. Vos decidís qué usar.
      </p>
      <textarea
        rows={3}
        value={texto}
        maxLength={ASISTENTE_MAX}
        onChange={e => setTexto(e.target.value)}
        placeholder="Ej: necesito alguien para el mostrador del local del centro, de lunes a sábado a la mañana, que sepa cobrar con caja."
        className="w-full border border-[#DDE3EC] rounded-xl px-4 py-3 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors leading-relaxed"
      />
      <div className="flex items-center justify-between gap-3 mt-2">
        <span className="text-[11px] text-[#64748B]">{texto.length}/{ASISTENTE_MAX}</span>
        <button
          type="button"
          onClick={proponer}
          disabled={cargando || texto.trim().length < 10}
          className="inline-flex items-center gap-1.5 bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-50 text-white font-bold rounded-xl px-4 py-2 text-sm transition-colors"
        >
          <SparklesIcon className="w-4 h-4" />
          {cargando ? "Armando la propuesta..." : draft ? "Proponer de nuevo" : "Proponer aviso"}
        </button>
      </div>

      {aviso && <p className="text-sm text-[#1C2230] mt-3">{aviso}</p>}

      {draft && (
        <div className="mt-5 space-y-4">
          {draft.warnings.length > 0 && (
            <div className="bg-[#F7EFE9] border border-[#D4B7A2] rounded-xl p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-[#8A6A54] mb-2">
                <ExclamationTriangleIcon className="w-4 h-4" /> Revisá esto antes de publicar
              </p>
              <ul className="space-y-2.5">
                {draft.warnings.map(w => (
                  <li key={w.texto} className="text-sm text-[#1C2230]">
                    <span className="font-semibold">&ldquo;{w.texto}&rdquo;</span> — {w.motivo}
                    <span className="block text-[13px] mt-0.5">
                      <span className="font-semibold text-[#8A6A54]">En su lugar:</span> {w.alternativa}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs font-semibold text-[#8A6A54] bg-[#D4B7A2]/15 border border-[#D4B7A2]/60 rounded-lg px-3 py-2">
            Es una sugerencia: revisala antes de publicar.
          </p>

          {draft.title && (
            <div className="flex items-start justify-between gap-3 border-b border-[#DDE3EC] pb-3">
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Título</p>
                <p className="text-sm font-semibold text-[#1C2230] mt-0.5">{draft.title}</p>
              </div>
              {botonUsar("title")}
            </div>
          )}
          {draft.industry && (
            <div className="flex items-start justify-between gap-3 border-b border-[#DDE3EC] pb-3">
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Sector</p>
                <p className="text-sm text-[#1C2230] mt-0.5">{draft.industry.name}</p>
              </div>
              {botonUsar("industry_id")}
            </div>
          )}
          {draft.description && (
            <div className="border-b border-[#DDE3EC] pb-3">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">El aviso</p>
                {botonUsar("description")}
              </div>
              <div className="text-sm text-[#1C2230] leading-relaxed whitespace-pre-line max-h-72 overflow-y-auto bg-[#FAFBFD] border border-[#DDE3EC] rounded-lg p-3">
                {draft.description}
              </div>
            </div>
          )}
          {draft.skills.length > 0 && (
            <div className="flex items-start justify-between gap-3 border-b border-[#DDE3EC] pb-3">
              <div>
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-1.5">Habilidades</p>
                <div className="flex flex-wrap gap-1.5">
                  {draft.skills.map(s => (
                    <span key={s.id} className="text-xs font-semibold bg-[#E6F4F7] text-[#1C2230] px-2.5 py-1 rounded-full">
                      {s.name} · {s.is_required ? "Requisito" : "Deseable"}
                    </span>
                  ))}
                </div>
              </div>
              {botonUsar("skills")}
            </div>
          )}

          {disponibles.length > 1 && (
            <button
              type="button"
              onClick={() => usar(disponibles)}
              className="inline-flex items-center gap-1.5 border-2 border-[#1E8EA3] text-[#1E8EA3] hover:bg-[#E6F4F7] font-bold rounded-xl px-4 py-2 text-sm transition-colors"
            >
              Usar toda la propuesta
            </button>
          )}
        </div>
      )}
    </div>
  );
}
