"""Precios de Gemini: lo que cuesta cada llamada (IA-AGENTES-PLAN.md §7).

Verificados el 15/11/2026 en https://ai.google.dev/gemini-api/docs/pricing (nivel pago,
estándar). Lote y flex cuestan la mitad. Este módulo no importa nada de `services/ai`: lo usan el
pipeline (gasto real) y el registro de agentes (costo estimado por uso).

Un modelo puede cambiar de precio en una fecha conocida: `gemini-3.8-flash` (el Revisor) cuesta
0,75 / 3,75 hasta el 31/12/2026 y 1,50 / 7,50 desde el 1/1/2027. Por eso cada modelo lleva una
lista de tramos `(desde, entrada, salida)`.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

FUENTE = "https://ai.google.dev/gemini-api/docs/pricing (consultada el 15/11/2026)"

# USD por millón de tokens: (vigente desde, entrada, salida). Los tokens de pensamiento se cobran
# como salida. Para embeddings, la salida es 0.
TRAMOS: dict[str, list[tuple[date, float, float]]] = {
    "gemini-3.5-flash-lite": [(date(2026, 1, 1), 0.30, 2.50)],
    "gemini-3.1-flash-lite": [(date(2026, 1, 1), 0.25, 1.50)],     # se da de baja el 7/5/2027
    "gemini-2.5-flash-lite": [(date(2026, 1, 1), 0.10, 0.40)],
    "gemini-3.8-flash": [(date(2026, 1, 1), 0.75, 3.75), (date(2027, 1, 1), 1.50, 7.50)],
    "gemini-3.6-flash": [(date(2026, 1, 1), 0.75, 3.75), (date(2027, 1, 1), 1.50, 7.50)],
    "gemini-embedding-001": [(date(2026, 1, 1), 0.15, 0.0)],
    "gemini-embedding-2": [(date(2026, 1, 1), 0.20, 0.0)],
}
# Un modelo que no está en la tabla se cobra como el más caro que usamos de rutina: mejor
# sobreestimar el gasto (el tope diario corta antes) que subestimarlo.
POR_DEFECTO = (1.50, 7.50)


def precio(model: str, cuando: date | datetime | None = None) -> tuple[float, float]:
    """(entrada, salida) en USD por millón para `model` en la fecha `cuando` (hoy si no se da)."""
    if cuando is None:
        cuando = datetime.now(timezone.utc).date()
    elif isinstance(cuando, datetime):
        cuando = cuando.date()
    tramos = TRAMOS.get(model)
    if not tramos:
        return POR_DEFECTO
    vigente = tramos[0]
    for tramo in tramos:
        if tramo[0] <= cuando:
            vigente = tramo
    return vigente[1], vigente[2]


def costo(model: str, entrada: int, salida: int, *, flex: bool = False,
          cuando: date | datetime | None = None) -> Decimal:
    """Costo en USD de una llamada (`salida` incluye los tokens de pensamiento)."""
    p_in, p_out = precio(model, cuando)
    total = (entrada * p_in + salida * p_out) / 1_000_000
    return Decimal(str(round(total / 2 if flex else total, 6)))
