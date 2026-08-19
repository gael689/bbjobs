"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cargarTodasLasPaginas } from "@/hooks/useListaPaginada";
import { GiftIcon, LockOpenIcon, UserGroupIcon } from "@heroicons/react/24/outline";

type PackRow = {
  id: string;
  company_id: string;
  company_name: string;
  credits_total: number;
  credits_used: number;
  status: "pending_payment" | "active" | "exhausted" | "canceled";
  purchased_at: string;
  activated_at: string | null;
  was_granted: boolean;
};

type UnlockRow = {
  id: string;
  company_name: string;
  candidate_name: string;
  candidate_id: string;
  unlocked_at: string;
};

type CompanyLite = { id: string; legal_name: string };

const STATUS_LABEL: Record<PackRow["status"], { label: string; cls: string }> = {
  pending_payment: { label: "Esperando pago", cls: "bg-yellow-100 text-yellow-900" },
  active: { label: "Activo", cls: "bg-[#E6F4F7] text-[#1E8EA3]" },
  exhausted: { label: "Agotado", cls: "bg-[#F1F5F9] text-[#64748B]" },
  canceled: { label: "Cancelado", cls: "bg-red-50 text-red-700" },
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function AdminTalentoPage() {
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [unlocks, setUnlocks] = useState<UnlockRow[]>([]);
  const [empresas, setEmpresas] = useState<CompanyLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [regalando, setRegalando] = useState(false);
  const [form, setForm] = useState({ company_id: "", credits: "15", notes: "" });
  const [toast, setToast] = useState<string | null>(null);

  function avisar(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    Promise.all([
      api.get("/admin/talent/packs").then(r => r.data as PackRow[]).catch(() => []),
      api.get("/admin/talent/unlocks").then(r => r.data as UnlockRow[]).catch(() => []),
      // Todas, no la primera página: /admin/companies pagina de a 20 desde que el panel de
      // Empresas lo necesitó, y acá alimenta un <select>. Con una sola página, la empresa
      // número 21 no se podría elegir nunca para asignarle desbloqueos.
      cargarTodasLasPaginas<CompanyLite>("/admin/companies", { status: "verified" })
        .catch(() => [] as CompanyLite[]),
    ]).then(([p, u, e]) => {
      setPacks(p);
      setUnlocks(u);
      setEmpresas(e);
      setLoading(false);
    });
  }, []);

  async function regalarPack(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.company_id) return;
    setRegalando(true);
    try {
      const r = await api.post("/admin/talent/packs", {
        company_id: form.company_id,
        credits: Number(form.credits) || 15,
        notes: form.notes || null,
      });
      setPacks(ps => [r.data, ...ps]);
      setForm({ company_id: "", credits: "15", notes: "" });
      avisar(`Le asignaste ${r.data.credits_total} desbloqueos a ${r.data.company_name}.`);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      avisar(detail || "No pudimos asignar el pack.");
    } finally {
      setRegalando(false);
    }
  }

  const activos = packs.filter(p => p.status === "active");
  const creditosVendidos = packs
    .filter(p => !p.was_granted && p.status !== "pending_payment" && p.status !== "canceled")
    .reduce((a, p) => a + p.credits_total, 0);

  if (loading) {
    return <div className="px-4 sm:px-6 py-8 text-[#64748B] text-sm">Cargando…</div>;
  }

  return (
    // Igual que el resto del panel: el <main> del shell no trae padding propio.
    <div className="px-4 sm:px-6 py-8 max-w-7xl">
      <h1 className="font-display font-extrabold text-2xl text-[#1C2230] mb-1">Base de Talento</h1>
      <p className="text-[#64748B] text-sm mb-6">
        Quién compró desbloqueos y a quién accedió.
      </p>

      {/* ── Indicadores ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Indicador label="Packs activos" valor={activos.length} icono={UserGroupIcon} />
        <Indicador label="Desbloqueos vendidos" valor={creditosVendidos} icono={GiftIcon} />
        <Indicador label="Desbloqueos usados" valor={unlocks.length} icono={LockOpenIcon} />
        <Indicador
          label="Empresas con acceso"
          valor={new Set(activos.map(p => p.company_id)).size}
          icono={UserGroupIcon}
        />
      </div>

      {/* ── Regalar un pack ── */}
      <form onSubmit={regalarPack} className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-6">
        <p className="text-sm font-bold text-[#1C2230] mb-1">Asignar desbloqueos sin cobrar</p>
        <p className="text-xs text-[#64748B] mb-4">
          Para un canje, una prueba o compensar algo. Queda registrado con tu usuario.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={form.company_id}
            onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
            required
            className="sm:col-span-2 border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3]"
          >
            <option value="">Elegí una empresa verificada</option>
            {empresas.map(e => (
              <option key={e.id} value={e.id}>{e.legal_name}</option>
            ))}
          </select>
          <input
            type="number" min={1} placeholder="Desbloqueos"
            value={form.credits}
            onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
            className="border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
          />
          <button
            type="submit" disabled={regalando || !form.company_id}
            className="text-sm font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
          >
            {regalando ? "Asignando…" : "Asignar"}
          </button>
        </div>
        <input
          type="text" placeholder="Motivo (opcional) — ej: canje por convenio"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full mt-3 border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3]"
        />
      </form>

      {/* ── Packs ── */}
      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-bold text-[#1C2230] mb-4">Packs ({packs.length})</h2>
        {packs.length === 0 ? (
          <p className="text-sm text-[#64748B]">Todavía no compró nadie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-[#64748B] uppercase tracking-wide border-b border-[#DDE3EC]">
                  <th className="pb-2 pr-4">Empresa</th>
                  <th className="pb-2 pr-4">Uso</th>
                  <th className="pb-2 pr-4">Estado</th>
                  <th className="pb-2 pr-4">Origen</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {packs.map(p => (
                  <tr key={p.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="py-2.5 pr-4 text-[#1C2230] font-medium">{p.company_name}</td>
                    <td className="py-2.5 pr-4 text-[#64748B]">
                      {p.credits_used} / {p.credits_total}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_LABEL[p.status].cls}`}>
                        {STATUS_LABEL[p.status].label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-[#64748B]">
                      {p.was_granted ? "Asignado por Talency" : "Comprado"}
                    </td>
                    <td className="py-2.5 text-xs text-[#64748B]">{fecha(p.purchased_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Desbloqueos ──
          Es el registro que permite responderle a un candidato que pregunte qué empresa
          accedió a sus datos. Esa pregunta va a llegar. */}
      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-[#1C2230] mb-1">Desbloqueos ({unlocks.length})</h2>
        <p className="text-xs text-[#64748B] mb-4">
          Qué empresa accedió al contacto de qué candidato. Si un candidato pregunta, la respuesta
          está acá.
        </p>
        {unlocks.length === 0 ? (
          <p className="text-sm text-[#64748B]">Todavía nadie desbloqueó ningún perfil.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold text-[#64748B] uppercase tracking-wide border-b border-[#DDE3EC]">
                  <th className="pb-2 pr-4">Empresa</th>
                  <th className="pb-2 pr-4">Candidato</th>
                  <th className="pb-2">Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {unlocks.map(u => (
                  <tr key={u.id} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="py-2.5 pr-4 text-[#1C2230] font-medium">{u.company_name}</td>
                    <td className="py-2.5 pr-4 text-[#1C2230]">{u.candidate_name}</td>
                    <td className="py-2.5 text-xs text-[#64748B]">{fecha(u.unlocked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-[#1C2230] text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function Indicador({
  label, valor, icono: Icono,
}: { label: string; valor: number; icono: React.ElementType }) {
  return (
    <div className="bg-white border border-[#DDE3EC] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icono className="w-4 h-4 text-[#1E8EA3]" />
        <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{label}</p>
      </div>
      <p className="font-display font-extrabold text-2xl text-[#1C2230]">{valor}</p>
    </div>
  );
}
