"use client";

import Link from "next/link";
import {
  ArrowRightIcon, BuildingOffice2Icon, MapPinIcon, SparklesIcon,
} from "@heroicons/react/24/outline";
import { useModulo } from "@/hooks/useModulo";

/** Espejo de RecommendedJobsResponse en backend/app/api/v1/para_vos.py */
interface BusquedaParaVos {
  id: string;
  title: string;
  company_name: string;
  zone_name: string | null;
  modality: string;
  url: string;
  level: "Encaja muy bien" | "Encaja";
  strong: boolean;
  ai_evaluated: boolean;
  reasons: string[];
}

interface Respuesta {
  items: BusquedaParaVos[];
  profile_gaps: string[];
}

const MODALIDAD: Record<string, string> = { presencial: "Presencial", remoto: "Remoto", "híbrido": "Híbrido" };
const MAX_EN_INICIO = 5;

function textoFaltante(gaps: string[]): string {
  if (gaps.includes("zona") && gaps.includes("habilidades")) return "tu zona y tus habilidades";
  return gaps.includes("zona") ? "tu zona" : "tus habilidades";
}

/**
 * "Búsquedas para vos" en el inicio del panel del candidato (módulo nuevo: el que la renderiza
 * ya chequeó `MODULOS_NUEVOS_VISIBLES`). Si el backend tiene la compuerta cerrada (404) no se
 * muestra nada: es un extra del inicio, no una pantalla.
 */
export default function BusquedasParaVos() {
  const estado = useModulo<Respuesta>("/me/candidate/recommended-jobs");
  if (estado.estado === "en_desarrollo" || estado.estado === "error") return null;

  const items = estado.estado === "listo" ? estado.datos.items.slice(0, MAX_EN_INICIO) : [];
  const gaps = estado.estado === "listo" ? estado.datos.profile_gaps : [];

  return (
    <section aria-labelledby="para-vos-titulo" className="bg-white border border-[#DDE3EC] rounded-2xl p-5 mb-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="para-vos-titulo" className="font-display font-bold text-[#1C2230] flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-[#1E8EA3]" aria-hidden="true" />
          Búsquedas para vos
        </h2>
        <Link href="/empleos" className="text-xs font-bold text-[#1E8EA3] hover:text-[#187B8E] shrink-0">
          Ver todas
        </Link>
      </div>

      {estado.estado === "cargando" ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando búsquedas para vos">
          {[0, 1].map(i => <div key={i} className="h-20 rounded-xl bg-[#FAFBFD] border border-[#DDE3EC] animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 px-2">
          {gaps.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-[#1C2230] mb-1">Completá tu perfil para recibir recomendaciones</p>
              <p className="text-xs text-[#64748B] mb-3">
                Cargá {textoFaltante(gaps)} y te mostramos acá las búsquedas que encajan con vos.
              </p>
              <Link href="/dashboard/candidate/perfil" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E]">
                Completar perfil <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#1C2230] mb-1">Todavía no hay búsquedas que encajen con tu perfil</p>
              <p className="text-xs text-[#64748B] mb-3">Cuando se publique una, la vas a ver acá. Mientras, mirá todas las búsquedas activas.</p>
              <Link href="/empleos" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1E8EA3] hover:text-[#187B8E]">
                Ver empleos <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map(job => (
            <li key={job.id} className="border border-[#DDE3EC] rounded-xl p-4 hover:border-[#9ED4DF] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        job.strong
                          ? "bg-[#E6F4F7] text-[#0F5E6C] border border-[#9ED4DF]"
                          : "bg-[#EEF7F9] text-[#145A67] border border-[#DDE3EC]"
                      }`}
                    >
                      {job.level}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-[15.5px] text-[#1C2230] break-words">
                    <Link href={job.url} className="hover:text-[#1E8EA3] transition-colors">{job.title}</Link>
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1 flex items-center flex-wrap gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <BuildingOffice2Icon className="w-3.5 h-3.5" aria-hidden="true" />{job.company_name}
                    </span>
                    {(job.modality === "remoto" || job.zone_name) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPinIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        {job.modality === "remoto" ? MODALIDAD.remoto : job.zone_name}
                      </span>
                    )}
                  </p>
                  {job.reasons.length > 0 && (
                    <p className="text-[12.5px] text-[#1C2230] mt-2">
                      <span className="font-bold">Por qué: </span>
                      <span className="text-[#64748B]">{job.reasons.join(" · ")}</span>
                    </p>
                  )}
                </div>
                <Link
                  href={job.url}
                  aria-label={`Postularme a ${job.title}`}
                  className="self-start sm:self-center inline-flex items-center justify-center gap-1 text-xs font-bold text-white bg-[#1E8EA3] hover:bg-[#187B8E] px-4 py-2 rounded-full transition-colors shrink-0"
                >
                  Postularme <ArrowRightIcon className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
