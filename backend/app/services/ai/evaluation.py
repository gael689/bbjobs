"""Evaluación del RAG con el etiquetado de Eugenia (auditoría R13, rehecha con la medición real).

Con sólo 2 búsquedas con seleccionado no se puede medir nada estadísticamente. Se reemplaza por
**etiquetado experto**: Eugenia califica de 0 a 3, sin ver el puntaje, 40 candidatos por
búsqueda en 3 búsquedas. Los 40 se eligen **estratificados** (arriba, medio y abajo del
híbrido) para que la muestra no favorezca a ningún método.

**Regla de decisión (fija, antes de mirar los números):** el rerank con IA se prende si mejora
NDCG@10 sobre el híbrido solo en al menos 0,05 en 2 de las 3 búsquedas. Si no, queda el híbrido
y la IA sólo redacta motivos.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass

MIN_GAIN = 0.05
K = 10


def dcg(gains: list[float], k: int = K) -> float:
    return sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(gains[:k]))


def ndcg(order: list[str], labels: dict[str, float], k: int = K) -> float:
    """NDCG@k del orden dado, contra las etiquetas (sólo cuenta lo etiquetado)."""
    ranked = [labels[c] for c in order if c in labels]
    ideal = sorted(labels.values(), reverse=True)
    best = dcg(ideal, k)
    return dcg(ranked, k) / best if best > 0 else 0.0


def stratified_sample(ranked: list[str], n: int = 40, seed: int = 7) -> list[str]:
    """Un tercio de arriba, un tercio del medio y un tercio de abajo del orden híbrido,
    mezclados (Eugenia no tiene que poder adivinar el orden)."""
    if len(ranked) <= n:
        sample = list(ranked)
    else:
        third = len(ranked) // 3
        rng = random.Random(seed)
        per = n // 3
        sample = (rng.sample(ranked[:third], per) + rng.sample(ranked[third:2 * third], per)
                  + rng.sample(ranked[2 * third:], n - 2 * per))
    rng = random.Random(seed + 1)
    rng.shuffle(sample)
    return sample


@dataclass
class JobResult:
    job: str
    arrival: float
    hybrid: float
    rerank: float | None

    @property
    def rerank_wins(self) -> bool:
        return self.rerank is not None and self.rerank - self.hybrid >= MIN_GAIN


def decide(results: list[JobResult]) -> tuple[bool, str]:
    wins = sum(1 for r in results if r.rerank_wins)
    need = 2 if len(results) >= 3 else len(results)
    on = wins >= need and need > 0
    return on, (f"El rerank mejora ≥ {MIN_GAIN} en {wins} de {len(results)} búsquedas: "
                + ("se prende." if on else "queda sólo el híbrido (la IA redacta motivos)."))
