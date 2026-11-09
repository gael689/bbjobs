/**
 * Eventos del navegador entre componentes que no se conocen.
 *
 * `EVENTO_RECOMENDADOS_VISTOS`: Recomendados lo dispara cuando la empresa abre una búsqueda (el
 * backend ya los marcó como vistos). El panel vuelve a preguntar en el acto, así el contador
 * "Recomendados (N)" baja sin esperar el minuto.
 */
export const EVENTO_RECOMENDADOS_VISTOS = "bbjobs:recomendados-vistos";
