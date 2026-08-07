"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import type { SkillCatalog, SkillCatalogItem, SkillCategory } from "@/app/dashboard/candidate/types";
import { SKILL_CATEGORY_LABEL } from "@/app/dashboard/candidate/types";

interface Props {
  catalog: SkillCatalog;
  selectedIds: string[];
  onToggle: (skill: SkillCatalogItem) => void;
  /** Contenido extra debajo de un grupo — lo usa el perfil del candidato para desplegar los
   *  idiomas y el texto libre de "Otra" justo donde se eligieron. */
  renderAfterGroup?: (category: SkillCategory) => React.ReactNode;
}

/**
 * Selector de habilidades en dos grupos con tope por grupo.
 *
 * Compartido entre el perfil del candidato y el wizard de publicación de la empresa: si cada
 * pantalla arma su propia lista, terminan mostrando catálogos distintos y comparar un aviso
 * con un perfil deja de significar algo.
 *
 * Al llegar al tope las que quedan sin elegir se deshabilitan en vez de desaparecer — así se
 * ve *por qué* no se puede seguir eligiendo, en lugar de que la lista se achique sola.
 */
export default function SkillPicker({ catalog, selectedIds, onToggle, renderAfterGroup }: Props) {
  const grupos: { category: SkillCategory; skills: SkillCatalogItem[] }[] = [
    { category: "soft", skills: catalog.soft },
    { category: "technical", skills: catalog.technical },
  ];

  return (
    <div className="space-y-6">
      {grupos.map(({ category, skills }) => {
        const elegidas = skills.filter(s => selectedIds.includes(s.id)).length;
        const lleno = elegidas >= catalog.max_per_category;

        return (
          <div key={category}>
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <p className="text-sm font-bold text-[#1C2230]">{SKILL_CATEGORY_LABEL[category]}</p>
              <span className={`text-xs font-bold ${lleno ? "text-[#B98F72]" : "text-[#64748B]"}`}>
                {elegidas} de {catalog.max_per_category}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {skills.map(skill => {
                const activa = selectedIds.includes(skill.id);
                const bloqueada = !activa && lleno;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => onToggle(skill)}
                    disabled={bloqueada}
                    aria-pressed={activa}
                    className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full border-2 transition-colors text-left ${
                      activa
                        ? "border-[#1E8EA3] bg-[#E6F4F7] text-[#1C2230]"
                        : bloqueada
                          ? "border-[#DDE3EC] text-[#94A3B8] cursor-not-allowed"
                          : "border-[#DDE3EC] text-[#64748B] hover:border-[#9ED4DF] hover:bg-[#FAFBFD]"
                    }`}
                  >
                    {activa && <CheckIcon className="w-3.5 h-3.5 text-[#1E8EA3] shrink-0" />}
                    {skill.name}
                  </button>
                );
              })}
            </div>

            {lleno && (
              <p className="text-xs text-[#B98F72] mt-2">
                Llegaste al máximo de {catalog.max_per_category}. Destildá una para elegir otra.
              </p>
            )}

            {renderAfterGroup?.(category)}
          </div>
        );
      })}
    </div>
  );
}
