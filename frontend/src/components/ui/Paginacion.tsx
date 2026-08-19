"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface Props {
  pagina: number;
  totalPaginas: number;
  total: number;
  pageSize: number;
  /** Cómo se llaman las cosas que se están contando: "candidatos", "empresas", "postulantes". */
  etiqueta: string;
  onCambiar: (pagina: number) => void;
}

/** Los números que se muestran: siempre la primera, la última y las vecinas de la actual.
 *  El 0 es el separador ("…"), y no un número de página que no existe. */
function numerosVisibles(pagina: number, totalPaginas: number): number[] {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const cerca = [pagina - 1, pagina, pagina + 1].filter(n => n > 1 && n < totalPaginas);
  const numeros = [1, ...cerca, totalPaginas];
  const conCortes: number[] = [];
  numeros.forEach((n, i) => {
    if (i > 0 && n - numeros[i - 1] > 1) conCortes.push(0);
    conCortes.push(n);
  });
  return conCortes;
}

/**
 * Paginación numerada para los listados del panel.
 *
 * Numerada y no "ver más": quien administra necesita poder volver a la página 3 donde estaba
 * la empresa que dejó a medio revisar, y con un botón que acumula eso significa scrollear todo
 * de nuevo. El contador va SIEMPRE, aunque haya una sola página — es la única forma de saber
 * si el filtro que acabás de aplicar hizo algo.
 */
export default function Paginacion({ pagina, totalPaginas, total, pageSize, etiqueta, onCambiar }: Props) {
  const desde = total === 0 ? 0 : (pagina - 1) * pageSize + 1;
  const hasta = Math.min(pagina * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 py-3">
      <p className="text-xs text-[#64748B]">
        {total === 0
          ? `Sin ${etiqueta}`
          : totalPaginas === 1
            ? <>
                <span className="font-bold text-[#1C2230]">{total}</span> {etiqueta}
              </>
            : <>
                Mostrando <span className="font-bold text-[#1C2230]">{desde}–{hasta}</span> de{" "}
                <span className="font-bold text-[#1C2230]">{total}</span> {etiqueta}
              </>}
      </p>

      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onCambiar(pagina - 1)}
            disabled={pagina <= 1}
            aria-label="Página anterior"
            className="p-1.5 rounded-lg border border-[#DDE3EC] text-[#64748B] hover:bg-[#FAFBFD] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>

          {numerosVisibles(pagina, totalPaginas).map((n, i) =>
            n === 0 ? (
              <span key={`corte-${i}`} className="px-1 text-xs text-[#64748B]">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onCambiar(n)}
                aria-current={n === pagina ? "page" : undefined}
                className={`min-w-[30px] px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  n === pagina
                    ? "bg-[#1E8EA3] border-[#1E8EA3] text-white"
                    : "border-[#DDE3EC] text-[#64748B] hover:bg-[#FAFBFD]"
                }`}
              >
                {n}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => onCambiar(pagina + 1)}
            disabled={pagina >= totalPaginas}
            aria-label="Página siguiente"
            className="p-1.5 rounded-lg border border-[#DDE3EC] text-[#64748B] hover:bg-[#FAFBFD] disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
