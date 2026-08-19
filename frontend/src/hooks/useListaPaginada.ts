"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** La forma que devuelven todos los listados paginados del backend (app/schemas/common.py). */
export interface RespuestaPaginada<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type ValorFiltro = string | number | boolean | undefined | null;

export const PAGE_SIZE_POR_DEFECTO = 20;
/** El tope que acepta el backend (MAX_PAGE_SIZE en app/schemas/common.py). */
export const PAGE_SIZE_MAXIMO = 100;

/** Las claves van ordenadas y los vacíos se descartan para que el mismo conjunto de filtros
 *  dé siempre exactamente el mismo string: de ahí sale tanto el querystring como la detección
 *  de "cambió un filtro". `false` NO es vacío — "sin movilidad" es un filtro, no la ausencia
 *  de uno; el que no quiere filtrar manda `undefined`. */
function serializar(filtros: Record<string, ValorFiltro>): string {
  const params = new URLSearchParams();
  for (const clave of Object.keys(filtros).sort()) {
    const valor = filtros[clave];
    if (valor === undefined || valor === null || valor === "") continue;
    params.set(clave, String(valor));
  }
  return params.toString();
}

interface Opciones {
  pageSize?: number;
  /** Espera antes de disparar el pedido, para los filtros que se tipean. */
  debounceMs?: number;
}

/**
 * Un listado paginado del backend, con la vuelta a la página 1 incluida.
 *
 * Se extrae del armado de parámetros y el paginado que ya tenía /empleos, que era el único
 * lugar que sabía consumir `{items, total, page, page_size}`. Tenerlo una sola vez es lo que
 * evita que cada pantalla reimplemente el detalle que siempre se olvida: **al cambiar un
 * filtro hay que volver a la página 1**. Si no, filtrás parado en la página 4, el resultado
 * tiene una sola página y la pantalla queda vacía sin ninguna explicación.
 *
 * Acá eso no se sincroniza con un efecto (un `setPagina(1)` en un `useEffect` alcanza a
 * disparar antes un pedido de la página vieja que después hay que descartar): el pedido
 * guarda contra qué filtros se pidió esa página, y si la clave dejó de coincidir la página
 * vuelve a 1 **derivada**, en el mismo render.
 *
 * `url === null` deja el hook quieto — sirve para las pantallas maestro-detalle, donde
 * todavía no hay nada seleccionado y no hay a qué endpoint pedirle.
 */
export function useListaPaginada<T>(
  url: string | null,
  filtros: Record<string, ValorFiltro> = {},
  opciones: Opciones = {},
) {
  const { pageSize = PAGE_SIZE_POR_DEFECTO, debounceMs = 0 } = opciones;

  const claveFiltros = serializar(filtros);
  // La url entra en la clave: en un maestro-detalle, cambiar de búsqueda seleccionada también
  // tiene que arrancar de la página 1.
  const clave = `${url ?? ""}?${claveFiltros}`;

  const [pedido, setPedido] = useState({ clave, pagina: 1, intento: 0 });
  const pagina = pedido.clave === clave ? pedido.pagina : 1;
  const intento = pedido.clave === clave ? pedido.intento : 0;

  // Mismo criterio que el resto del panel: "está cargando" se DERIVA de que lo resuelto
  // todavía no es lo pedido, en vez de prender un flag adentro del efecto (que es un setState
  // síncrono, encadena renders y hace parpadear el resultado viejo antes del spinner).
  const token = `${clave}|${pagina}|${pageSize}|${intento}`;
  const [resuelto, setResuelto] = useState<{
    token: string;
    items: T[];
    total: number;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    if (url === null) return;
    // `vigente` descarta la respuesta de un filtro anterior si llega después de la actual:
    // pasa tecleando rápido en un buscador, y sin esto pisa los resultados buenos.
    let vigente = true;
    const params = new URLSearchParams(claveFiltros);
    params.set("page", String(pagina));
    params.set("page_size", String(pageSize));

    const timeout = setTimeout(() => {
      api.get<RespuestaPaginada<T>>(`${url}?${params.toString()}`)
        .then(r => {
          if (vigente) setResuelto({ token, items: r.data.items, total: r.data.total, error: false });
        })
        .catch(() => {
          if (vigente) setResuelto({ token, items: [], total: 0, error: true });
        });
    }, debounceMs);

    return () => { vigente = false; clearTimeout(timeout); };
  }, [url, claveFiltros, pagina, pageSize, token, debounceMs]);

  const datos = resuelto !== null && resuelto.token === token ? resuelto : null;
  const items = datos?.items ?? [];
  const total = datos?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    pagina,
    pageSize,
    totalPaginas,
    cargando: url !== null && datos === null,
    error: datos?.error ?? false,
    irAPagina: (n: number) => setPedido({ clave, pagina: Math.max(1, n), intento }),
    /** Vuelve a pedir la página actual — para después de aprobar, rechazar o borrar algo. */
    recargar: () => setPedido({ clave, pagina, intento: intento + 1 }),
    /** Retoca lo que ya está en pantalla sin volver a pedirlo (ej. cambiar el estado de una
     *  postulación desde su propia fila). */
    actualizarItems: (fn: (previos: T[]) => T[]) =>
      setResuelto(r => (r ? { ...r, items: fn(r.items) } : r)),
  };
}

/**
 * Todas las páginas de un listado, juntas.
 *
 * Es para los `<select>`: un selector que se queda con las primeras 20 empresas no tiene cómo
 * elegir la 21. Recorre hasta juntar `total` en vez de pedir un `page_size` grande y rezar,
 * así el tope de 100 del backend sigue valiendo para todos los consumidores y no hace falta
 * abrir un endpoint sin techo al costado.
 */
export async function cargarTodasLasPaginas<T>(
  url: string,
  filtros: Record<string, ValorFiltro> = {},
): Promise<T[]> {
  const acumulado: T[] = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams(serializar(filtros));
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE_MAXIMO));
    const r = await api.get<RespuestaPaginada<T>>(`${url}?${params.toString()}`);
    acumulado.push(...r.data.items);
    if (r.data.items.length === 0 || acumulado.length >= r.data.total) return acumulado;
  }
}
