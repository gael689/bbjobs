"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { CreditCardIcon, CheckCircleIcon, ClockIcon, XCircleIcon } from "@heroicons/react/24/outline";
import {
  FEATURE_STATUS_LABEL, FEATURE_STATUS_CLS,
  type FeatureHistoryItem, type FeatureStatusResponse,
} from "../types";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 10;

function ReturnBanner({ jobId, paymentId }: { jobId: string; paymentId: string }) {
  const [status, setStatus] = useState<FeatureStatusResponse | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => {
      api.get(`/me/company/jobs/${jobId}/feature/status`)
        .then(r => {
          setStatus(r.data);
          const resolved = r.data.is_featured || r.data.payment_status === "rejected" || r.data.payment_status === "cancelled";
          if (resolved || attempts + 1 >= POLL_MAX_ATTEMPTS) setDone(true);
          else setAttempts(a => a + 1);
        })
        .catch(() => setAttempts(a => a + 1));
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [attempts, done, jobId]);

  if (status?.is_featured) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-4 flex items-center gap-3 mb-6">
        <CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0" />
        <p className="text-sm font-medium text-green-800">¡Tu búsqueda ya está destacada!</p>
      </div>
    );
  }
  if (status?.payment_status === "rejected" || status?.payment_status === "cancelled") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 flex items-center gap-3 mb-6">
        <XCircleIcon className="w-5 h-5 text-red-600 shrink-0" />
        <p className="text-sm font-medium text-red-800">El pago fue rechazado o cancelado. Podés volver a intentarlo desde Estadísticas.</p>
      </div>
    );
  }
  if (done) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-center gap-3 mb-6">
        <ClockIcon className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-sm font-medium text-amber-800">
          Tu pago sigue procesándose. Puede demorar unos minutos — este historial se va a actualizar solo.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-2xl px-6 py-4 flex items-center gap-3 mb-6">
      <div className="w-4 h-4 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin shrink-0" />
      <p className="text-sm font-medium text-[#1C2230]">Confirmando tu pago (referencia {paymentId.slice(0, 8)})...</p>
    </div>
  );
}

function CompanyPagosContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id");
  const jobId = searchParams.get("job_id");

  const [history, setHistory] = useState<FeatureHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedAfterReturn = useRef(false);

  useEffect(() => {
    api.get("/me/company/features").then(r => setHistory(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Si volvemos de Mercado Pago, refrescamos el historial una vez más pasado un rato para que
  // la fila recién confirmada por el webhook aparezca sin recargar la página a mano.
  useEffect(() => {
    if (!paymentId || fetchedAfterReturn.current) return;
    fetchedAfterReturn.current = true;
    const timer = setTimeout(() => {
      api.get("/me/company/features").then(r => setHistory(r.data)).catch(() => {});
    }, POLL_INTERVAL_MS * 4);
    return () => clearTimeout(timer);
  }, [paymentId]);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl">
      <h1 className="text-2xl font-display font-bold text-[#1C2230] mb-1">Pagos</h1>
      <p className="text-[#64748B] text-sm mb-6">Historial de búsquedas destacadas.</p>

      {paymentId && jobId && <ReturnBanner jobId={jobId} paymentId={paymentId} />}

      <div className="bg-white border border-[#DDE3EC] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCardIcon className="w-10 h-10 text-[#DDE3EC] mx-auto mb-3" />
            <p className="text-[#64748B] font-medium">Todavía no destacaste ninguna búsqueda.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#DDE3EC]">
            {history.map(item => (
              <div key={item.payment_id} className="px-6 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1C2230] truncate">{item.job_title}</p>
                  <p className="text-xs text-[#64748B]">
                    {new Date(item.purchased_at).toLocaleDateString("es-AR")} · ${item.amount.toLocaleString("es-AR")} {item.currency}
                    {item.ends_at && item.feature_status === "active" && ` · hasta ${new Date(item.ends_at).toLocaleDateString("es-AR")}`}
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

export default function CompanyPagosPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#64748B]">Cargando...</div>}>
      <CompanyPagosContent />
    </Suspense>
  );
}
