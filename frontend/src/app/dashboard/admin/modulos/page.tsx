"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useModulo, detalleError } from "@/hooks/useModulo";
import EnDesarrollo from "@/components/dashboard/EnDesarrollo";
import { CpuChipIcon } from "@heroicons/react/24/outline";

type Ajustes = Record<string, boolean | undefined>;

interface FilaUso {
  key: string | null;
  calls: number;
  cost_usd: number;
}

interface Uso {
  today_usd: number;
  daily_budget_usd: number;
  period_usd: number;
  by_feature: FilaUso[];
  by_company: FilaUso[];
}

const INTERRUPTORES: { clave: string; titulo: string; ayuda: string }[] = [
  { clave: "emails_automaticos_activos", titulo: "Mails automáticos",
    ayuda: "Avisos, resúmenes y campañas por mail. Apagado, no sale ningún mail." },
  { clave: "ia_recomendaciones_activas", titulo: "Candidatos recomendados con IA",
    ayuda: "Ordena postulantes y sugiere perfiles de la Base de Talento. Apagado, las empresas no lo ven." },
  { clave: "revision_cv_activa", titulo: "Venta de revisión de CV",
    ayuda: "Los postulantes pueden pagar la revisión. Apagalo si no das abasto." },
];

const FUNCIONES: Record<string, string> = {
  embeddings: "Indexar perfiles",
  requisitos: "Leer requisitos de los avisos",
  rerank: "Evaluar candidatos",
  campana_borrador: "Redactar campañas",
  campana_audiencia: "Interpretar audiencias",
};

// Una búsqueda cuesta medio centavo: con 2 decimales todo el gasto real se leía "USD 0.00".
const usd = (n: number) => `USD ${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;

function TablaUso({ titulo, filas, etiqueta }: { titulo: string; filas: FilaUso[]; etiqueta: (k: string | null) => string }) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 shadow-sm">
      <p className="font-bold text-[#1C2230] mb-3">{titulo}</p>
      {filas.length === 0 ? (
        <p className="text-sm text-[#1C2230]">Sin consumo en el período.</p>
      ) : (
        <div className="divide-y divide-[#DDE3EC]/60">
          {filas.map(f => (
            <div key={f.key ?? "—"} className="py-2 flex items-center justify-between text-sm text-[#1C2230]">
              <span>{etiqueta(f.key)}</span>
              <span className="font-semibold">{usd(f.cost_usd)} <span className="text-[#64748B] font-normal">· {f.calls} llamadas</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminModulosPage() {
  const ajustes = useModulo<Ajustes>("/admin/settings");
  // Lo que devolvió el último PATCH pisa lo cargado al entrar (sin copiar estado en un efecto).
  const [cambios, setCambios] = useState<Ajustes>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uso, setUso] = useState<Uso | null>(null);
  const [usoEstado, setUsoEstado] = useState<"cargando" | "listo" | "no">("cargando");

  useEffect(() => {
    api.get<Uso>("/admin/ai/usage", { params: { days: 30 } })
      .then(r => { setUso(r.data); setUsoEstado("listo"); })
      .catch(() => setUsoEstado("no"));
  }, []);

  // Con la compuerta cerrada, /admin/settings responde pero sin las claves de los módulos nuevos.
  const valores: Ajustes = { ...(ajustes.estado === "listo" ? ajustes.datos : {}), ...cambios };

  const compuertaCerrada = ajustes.estado === "en_desarrollo"
    || (ajustes.estado === "listo" && INTERRUPTORES.every(i => ajustes.datos[i.clave] === undefined));

  if (compuertaCerrada) {
    return (
      <EnDesarrollo
        titulo="Mails e IA"
        descripcion="Acá vas a poder prender y apagar los mails automáticos, los candidatos recomendados y la venta de revisiones de CV, y ver cuánto se gasta en IA."
      />
    );
  }

  async function cambiar(clave: string, valor: boolean) {
    setGuardando(clave);
    setError(null);
    try {
      const r = await api.patch<Ajustes>("/admin/settings", { [clave]: valor });
      setCambios(r.data);
    } catch (e) {
      setError(detalleError(e));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Mails e IA</h1>
      <p className="text-[#64748B] text-sm mb-6">Interruptores de los módulos nuevos y gasto de IA de los últimos 30 días.</p>

      {error && <div className="mb-4 rounded-xl px-4 py-2.5 text-sm font-medium bg-red-50 text-red-800">{error}</div>}

      {ajustes.estado === "cargando" ? (
        <div className="py-12 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ajustes.estado === "error" ? (
        <div className="p-8 text-center text-red-800">{ajustes.mensaje}</div>
      ) : (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm mb-8 divide-y divide-[#DDE3EC]/60">
          {INTERRUPTORES.map(i => {
            const activo = !!valores[i.clave];
            return (
              <div key={i.clave} className="px-6 py-4 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#1C2230]">{i.titulo}</p>
                  <p className="text-sm text-[#1C2230]">{i.ayuda}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={activo}
                  aria-label={i.titulo}
                  disabled={guardando === i.clave}
                  onClick={() => cambiar(i.clave, !activo)}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${activo ? "bg-[#1E8EA3]" : "bg-[#DDE3EC]"}`}
                >
                  <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? "translate-x-5" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-lg font-display font-bold text-[#1C2230] mb-3 flex items-center gap-2">
        <CpuChipIcon className="w-5 h-5 text-[#187B8E]" /> Gasto de IA
      </h2>
      {usoEstado === "cargando" ? (
        <div className="py-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : usoEstado === "no" || !uso ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-6 text-sm text-[#1C2230]">
          El detalle del gasto todavía no está disponible.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
              <p className="text-2xl font-display font-extrabold text-[#1C2230]">{usd(uso.today_usd)}</p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">Hoy (tope diario {usd(uso.daily_budget_usd)})</p>
              <div className="h-2 bg-[#E6F4F7] rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-[#1E8EA3]"
                  style={{ width: `${Math.min(100, uso.daily_budget_usd ? (100 * uso.today_usd) / uso.daily_budget_usd : 0)}%` }} />
              </div>
            </div>
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
              <p className="text-2xl font-display font-extrabold text-[#1C2230]">{usd(uso.period_usd)}</p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">Últimos 30 días</p>
            </div>
            <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
              <p className="text-2xl font-display font-extrabold text-[#1C2230]">
                {uso.by_feature.reduce((s, f) => s + f.calls, 0)}
              </p>
              <p className="text-xs text-[#64748B] font-medium mt-0.5">Llamadas a la IA en 30 días</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TablaUso titulo="Por función" filas={uso.by_feature} etiqueta={k => FUNCIONES[k ?? ""] ?? k ?? "Otra"} />
            <TablaUso titulo="Por empresa" filas={uso.by_company} etiqueta={k => k ?? "Sin empresa (tareas generales)"} />
          </div>
        </>
      )}
    </div>
  );
}
