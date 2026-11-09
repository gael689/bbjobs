"""Cercanía entre zonas del catálogo: una sola tabla para todo lo que compara zonas.

La usan el puntaje de recomendados (`services/ai/scoring.zone_value`), el resumen "Búsquedas
para vos" (`services/email/digests.score_for_candidate`) y el aviso al candidato de una búsqueda
nueva que encaja con él. Antes cada uno exigía la zona exacta: Bahía Blanca ↔ Zona Norte valía
lo mismo que Bahía Blanca ↔ Coronel Suárez (180 km).

Las claves son los **slugs** del catálogo (`zones.slug`), no los ids: los ids cambian entre
bases, los slugs no. Plan final §2.1.

| Par                                                  | Valor |
|------------------------------------------------------|-------|
| Misma zona                                           | 1     |
| Bahía Blanca, Zona Norte y Zona Sur entre sí         | 1     |
| Punta Alta ↔ Bahía Blanca, Zona Norte o Zona Sur     | 0,8   |
| Monte Hermoso o Coronel Suárez ↔ cualquier otra      | 0,25  |
| Un par que no figura (una localidad nueva)           | 0,5   |
"""
from __future__ import annotations

from typing import Mapping

DESCONOCIDA = 0.5

_BAHIA = ("bahia-blanca", "zona-norte", "zona-sur")
_LEJANAS = ("monte-hermoso", "coronel-suarez")
_CONOCIDAS = (*_BAHIA, "punta-alta", *_LEJANAS)


def _tabla() -> dict[frozenset[str], float]:
    t: dict[frozenset[str], float] = {}
    for a in _BAHIA:
        for b in _BAHIA:
            if a != b:
                t[frozenset((a, b))] = 1.0
        t[frozenset((a, "punta-alta"))] = 0.8
    for lejos in _LEJANAS:
        for otra in _CONOCIDAS:
            if otra != lejos:
                t[frozenset((lejos, otra))] = 0.25
    return t


CERCANIA: dict[frozenset[str], float] = _tabla()


def proximidad(slug_a: str | None, slug_b: str | None) -> float | None:
    """Cercanía 0..1 entre dos zonas por slug. `None` si falta alguna (sin dato: no cuenta).
    Una zona que no está en la tabla vale 0,5, así agregar una localidad no rompe nada."""
    if not slug_a or not slug_b:
        return None
    if slug_a == slug_b:
        return 1.0
    return CERCANIA.get(frozenset((slug_a, slug_b)), DESCONOCIDA)


def proximidad_ids(id_a, id_b, slugs: Mapping) -> float | None:
    """Igual que `proximidad`, con ids de zona y el mapa id → slug ya cargado (una consulta por
    corrida, no una por candidato). Un id fuera del mapa vale como zona desconocida."""
    if not id_a or not id_b:
        return None
    if id_a == id_b:
        return 1.0
    a, b = slugs.get(id_a), slugs.get(id_b)
    if not a or not b:
        return DESCONOCIDA
    return proximidad(a, b)


async def slugs_por_id(db) -> dict:
    """{zone_id: slug} de todo el catálogo (son pocas filas)."""
    from sqlalchemy import select

    from app.models.catalogs import Zone

    return dict((await db.execute(select(Zone.id, Zone.slug))).all())
