"use client";

import { BarrasHorizontales, Dona, AnillosDePorcentaje, TarjetaDato } from "./Graficos";
import type { ApplicantStats } from "@/app/dashboard/company/types";

interface Props {
  stats: ApplicantStats;
  /** Datos del candidato para resaltar su franja. Sólo se pasan en la vista del candidato. */
  mio?: {
    franjaEdad?: string | null;
    franjaExperiencia?: string | null;
    educacion?: string | null;
    habilidades?: string[];
  };
}

function formatoPesos(n: number) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

const NIVEL_LABEL: Record<string, string> = {
  secundario: "Secundario",
  terciario: "Terciario",
  universitario: "Universitario",
  posgrado: "Posgrado",
};

/**
 * El panel de estadísticas de una búsqueda.
 *
 * Es el mismo componente para la empresa y para el candidato — cambia sólo que al candidato se
 * le pasa `mio` y sus franjas quedan resaltadas. Un solo componente evita que las dos vistas
 * terminen mostrando números distintos del mismo dato.
 */
export default function PanelEstadisticas({ stats, mio }: Props) {
  if (stats.total === 0) {
    return (
      <div className="bg-white border border-[#DDE3EC] rounded-2xl p-10 text-center">
        <p className="text-sm text-[#64748B]">
          Todavía no hay postulaciones para calcular estadísticas.
        </p>
      </div>
    );
  }

  const salario =
    stats.expected_salary_min_avg != null || stats.expected_salary_max_avg != null
      ? [stats.expected_salary_min_avg, stats.expected_salary_max_avg]
          .filter((v): v is number => v != null)
          .map(formatoPesos)
          .join(" – ")
      : "Sin datos";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TarjetaDato
          valor={String(stats.total)}
          etiqueta={stats.total === 1 ? "Postulación" : "Postulaciones"}
        />
        <TarjetaDato
          valor={salario}
          etiqueta="Salario pretendido promedio"
          detalle={
            stats.expected_salary_reported > 0
              ? `Sobre ${stats.expected_salary_reported} de ${stats.total} que lo declararon`
              : "Ningún postulante lo declaró"
          }
        />
        <TarjetaDato
          valor={
            stats.top_education_level
              ? NIVEL_LABEL[stats.top_education_level] || stats.top_education_level
              : "—"
          }
          etiqueta="Nivel educativo más frecuente"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarrasHorizontales
          titulo="Años de experiencia"
          buckets={stats.experience_buckets}
          destacado={mio?.franjaExperiencia}
        />
        <Dona titulo="Edad" buckets={stats.age_buckets} destacado={mio?.franjaEdad} />
      </div>

      <BarrasHorizontales
        titulo="Nivel educativo"
        buckets={stats.education_buckets}
        destacado={mio?.educacion}
        nota="Se toma el nivel más alto que declaró cada postulante."
      />

      <AnillosDePorcentaje
        titulo="Habilidades más declaradas entre los postulados"
        buckets={stats.top_skills}
        propias={mio?.habilidades}
      />
    </div>
  );
}
