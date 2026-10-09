"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import MetricasSitio, { type MetricasReporte, type Periodo } from "@/components/dashboard/MetricasSitio";

// Medición propia del sitio público (lib/medicion.ts → POST /metrics/events → site_events).
// El reporte lo arma el backend: GET /admin/metrics?days=7|30|90 (api/v1/metrics.py).
export default function AdminMetricasPage() {
  const [dias, setDias] = useState<Periodo>(30);
  const [data, setData] = useState<MetricasReporte | null>(null);
  // Período del último pedido terminado (bien o mal): si no coincide con `dias`, está cargando.
  const [listoPara, setListoPara] = useState<Periodo | null>(null);
  const [errorPara, setErrorPara] = useState<Periodo | null>(null);

  useEffect(() => {
    let vigente = true;
    api.get<MetricasReporte>("/admin/metrics", { params: { days: dias } })
      .then(r => { if (vigente) { setData(r.data); setErrorPara(null); } })
      .catch(() => { if (vigente) setErrorPara(dias); })
      .finally(() => { if (vigente) setListoPara(dias); });
    return () => { vigente = false; };
  }, [dias]);

  return (
    <MetricasSitio
      data={data}
      dias={dias}
      onDias={setDias}
      cargando={listoPara !== dias}
      error={errorPara === dias}
    />
  );
}
