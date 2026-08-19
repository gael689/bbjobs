"""La forma común de todo listado paginado.

El contrato no se inventó acá: es el que `GET /jobs` ya venía devolviendo y el que el
frontend ya sabe consumir (ver `frontend/src/app/empleos/page.tsx`). Sacarlo a un genérico
es lo que evita que cada listado que se pagina invente su propio `{results, count}` y que
después el frontend tenga una forma distinta por pantalla.
"""
from typing import Generic, List, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

T = TypeVar("T")

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# Se declaran una sola vez para que los cinco listados acepten exactamente los mismos límites:
# si el tope viviera copiado en cada router, alcanzaría con que uno quede en 500 para que ese
# endpoint sea la puerta por la que se baja la base entera de una.
PageQuery = Query(1, ge=1, description="Número de página, arranca en 1")
PageSizeQuery = Query(
    DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Cuántos elementos por página"
)


class Paginated(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int


async def contar(db: AsyncSession, query) -> int:
    """El total de una consulta sin traer sus filas.

    Va sobre `query.subquery()` y no reconstruye el `where`: cualquier filtro que se agregue
    después al listado queda contado solo. Con `len(rows)` habría que traer las N filas nada
    más que para saber cuántas son, que es justo lo que la paginación viene a evitar."""
    return (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0


def recortar(filas: Sequence, page: int, page_size: int) -> list:
    """El corte de página en memoria, para los listados que filtran por un valor derivado.

    Sólo se usa cuando el filtro no se puede expresar en SQL (los años de experiencia, que
    salen de fusionar tramos superpuestos; el título alcanzado, que es el máximo de las
    educaciones cargadas). En esos casos el `total` tiene que contar lo que quedó después de
    filtrar, no lo que la consulta trajo — si no, la última página aparece vacía."""
    desde = (page - 1) * page_size
    return list(filas[desde:desde + page_size])
