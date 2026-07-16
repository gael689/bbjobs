"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import { FEATURE_STATUS_LABEL, FEATURE_STATUS_CLS, type FeatureHistoryItem } from "../types";

export default function AdminPagosPage() {
  const [history, setHistory] = useState<FeatureHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/features").then(r => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalRevenue = history
    .filter(item => item.payment_status === "approved")
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Pagos</h1>
      <p className="text-[#64748B] text-sm mb-6">Historial de búsquedas destacadas de todas las empresas.</p>

      {history.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-2xl p-5">
            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center mb-3">
              <CreditCardIcon className="w-5 h-5 text-green-700" />
            </div>
            <p className="text-2xl font-display font-extrabold text-[#1C2230]">${totalRevenue.toLocaleString("es-AR")}</p>
            <p className="text-xs text-[#64748B] font-medium mt-0.5">Ingresos totales por destacados (ARS)</p>
          </div>
          <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
            <p className="text-2xl font-display font-extrabold text-[#1C2230]">
              {history.filter(h => h.feature_status === "active").length}
            </p>
            <p className="text-xs text-[#64748B] font-medium mt-0.5">Destacados activos ahora</p>
          </div>
          <div className="bg-white border border-[#DDE3EC] rounded-2xl p-5">
            <p className="text-2xl font-display font-extrabold text-[#1C2230]">{history.length}</p>
            <p className="text-xs text-[#64748B] font-medium mt-0.5">Compras totales</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">Todavía no se pagó ningún destacado en la plataforma.</div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]/60">
            {history.map(item => (
              <div key={item.payment_id} className="px-6 py-4 flex items-center gap-4 hover:bg-[#FAFBFD] transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#F7EFE9] text-[#B98F72] flex items-center justify-center shrink-0">
                  <CreditCardIcon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#1C2230] truncate">{item.job_title}</p>
                  <p className="text-xs text-[#64748B]">
                    {item.company_name} · {new Date(item.purchased_at).toLocaleDateString("es-AR")} · ${item.amount.toLocaleString("es-AR")} {item.currency}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${FEATURE_STATUS_CLS[item.feature_status]}`}>
                  {FEATURE_STATUS_LABEL[item.feature_status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
