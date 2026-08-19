"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cargarTodasLasPaginas } from "@/hooks/useListaPaginada";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import PanelEstadisticas from "@/components/stats/PanelEstadisticas";
import { type ApplicantStats } from "@/app/dashboard/company/types";

interface JobOpcion {
  id: string;
  title: string;
}

/**
 * Los indicadores de los postulantes, para la administradora.
 *
 * Existían calculados desde el principio y sólo los veían la empresa (los de su
 * propia búsqueda) y el candidato (su comparativa). Quien decide si se publican
 * —el interruptor de acá abajo— no tenía dónde mirarlos, así que aprobaba a
 * ciegas. Por eso este panel vive junto a ese interruptor y no en otra pantalla.
 *
 * Arranca en "todas las búsquedas", que es la lectura del conjunto; el selector
 * permite bajar a una en particular sin cambiar de sección.
 */
export default function PanelIndicadoresAdmin() {
  const [jobs, setJobs] = useState<JobOpcion[]>([]);
  const [jobId, setJobId] = useState("");
  // Un solo estado que recuerda A QUÉ búsqueda corresponde lo que tiene adentro.
  // Así "está cargando" se DERIVA —lo cargado todavía no es lo pedido— en vez de
  // setearse al entrar al efecto, que es un setState síncrono y encadena
  // renders. De paso arregla un parpadeo: al cambiar de filtro ya no se ve el
  // panel viejo por un instante antes del spinner.
  const [resultado, setResultado] = useState<{
    jobId: string;
    stats: ApplicantStats | null;
  } | null>(null);

  const cargando = resultado?.jobId !== jobId;
  const error = !cargando && resultado?.stats === null;

  useEffect(() => {
    // Todas las páginas: /admin/jobs pagina, y esto es un <select>. Si se quedara con la
    // primera página, las búsquedas más nuevas no se podrían elegir para ver sus indicadores.
    cargarTodasLasPaginas<JobOpcion>("/admin/jobs")
      .then(js => setJobs(js.map(j => ({ id: j.id, title: j.title }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let vigente = true;
    api.get("/admin/applications/stats", { params: jobId ? { job_id: jobId } : {} })
      .then(r => { if (vigente) setResultado({ jobId, stats: r.data }); })
      .catch(() => { if (vigente) setResultado({ jobId, stats: null }); });
    // Si cambiás de búsqueda con una respuesta en vuelo, la vieja se descarta:
    // si no, podía pisar a la nueva y mostrar los datos del filtro anterior.
    return () => { vigente = false; };
  }, [jobId]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-[#1E8EA3]" />
          <div>
            <h2 className="font-display font-bold text-[#1C2230]">Indicadores de los postulantes</h2>
            <p className="text-sm text-[#64748B]">
              Lo mismo que verían los candidatos y las empresas si publicás las estadísticas.
            </p>
          </div>
        </div>
        <select
          value={jobId}
          onChange={e => setJobId(e.target.value)}
          className="border border-[#DDE3EC] rounded-lg px-3 py-2 text-sm text-[#1C2230] bg-white focus:outline-none focus:border-[#1E8EA3] sm:max-w-xs"
        >
          <option value="">Todas las búsquedas</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
      </div>

      {cargando ? (
        <div className="py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-[#1E8EA3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 text-center">
          <p className="text-sm text-[#64748B]">No pudimos cargar los indicadores.</p>
        </div>
      ) : resultado?.stats ? (
        <PanelEstadisticas stats={resultado.stats} />
      ) : null}
    </div>
  );
}
