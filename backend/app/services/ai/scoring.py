"""Puntaje de recomendados: todo en código, reproducible y auditable (auditoría R6, R7, R8, R15).

La IA nunca pone un número: evalúa requisito por requisito con evidencia (rerank.py) y el
puntaje sale de acá. Cambiar los pesos recalcula sin volver a llamar a la IA.

- **Encaje vs. cobertura (R6):** cada criterio da un valor en [0,1] o `None` (sin dato). El
  encaje se calcula sólo sobre los criterios con dato; la cobertura dice cuánto se sabe. Así un
  perfil incompleto no queda abajo por incompleto sino por lo que sí se sabe de él.
- **Habilidades blandas: peso 0.** La medición del 04/10 mostró que el 47 % marca las 12
  posibles y las más elegidas son genéricas ("Responsabilidad y compromiso").
- **Semántica en percentil (R8):** el coseno crudo de CVs de una misma zona varía poco.
- **Nunca** entran edad, género, foto, nombre ni estado civil.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Iterable

WEIGHTS_VERSION = "2026-10-04"

# Pesos del puntaje híbrido. Son el punto de partida y se calibran con el etiquetado de Eugenia
# (auditoría R13). Sólo cuentan los criterios que la búsqueda declara y de los que hay dato.
DEFAULT_WEIGHTS: dict[str, float] = {
    "skills_required": 35,
    "skills_optional": 10,
    "experience": 15,
    "education": 10,
    "zone": 20,
    "modality": 10,
}

EDUCATION_ORDER = {"secundario": 1, "terciario": 2, "universitario": 3, "posgrado": 4}

RECOMMENDED_THRESHOLD = 70
NEW_FIT_THRESHOLD = 80
NEW_FIT_MIN_COVERAGE = 0.5
EXCLUDING_FAIL_CAP = 49


def experience_months(intervals: Iterable[tuple[date | None, date | None]], today: date | None = None) -> int | None:
    """Meses trabajados como **unión** de intervalos (dos trabajos en paralelo no cuentan doble;
    el trabajo actual va hasta hoy). `None` si no hay ninguna experiencia con fecha (R15)."""
    today = today or date.today()
    spans = sorted(
        ((s, e or today) for s, e in intervals if s is not None and (e or today) >= s),
        key=lambda x: x[0],
    )
    if not spans:
        return None
    total, cur_s, cur_e = 0, spans[0][0], spans[0][1]
    for s, e in spans[1:]:
        if s <= cur_e:
            cur_e = max(cur_e, e)
        else:
            total += (cur_e.year - cur_s.year) * 12 + cur_e.month - cur_s.month
            cur_s, cur_e = s, e
    total += (cur_e.year - cur_s.year) * 12 + cur_e.month - cur_s.month
    return max(0, total)


def education_value(educations: list[tuple[str, str | None]], min_level: str | None) -> float | None:
    """1 si cumple el nivel, 0,5 si lo está cursando (o lo dejó en el nivel), 0 si no. `None` si
    la búsqueda no pide nivel o el candidato no cargó formación."""
    if not min_level or min_level not in EDUCATION_ORDER:
        return None
    if not educations:
        return None
    need = EDUCATION_ORDER[min_level]
    best = 0.0
    for level, status in educations:
        rank = EDUCATION_ORDER.get(level, 0)
        if status == "abandonado":
            rank -= 1
        if rank > need or (rank == need and status in (None, "graduado")):
            best = max(best, 1.0)
        elif rank == need:
            best = max(best, 0.5)
    return best


def experience_value(months: int | None, min_years: int | None) -> float | None:
    if not min_years:
        return None
    if months is None:
        return None
    return min(1.0, months / (min_years * 12))


def skills_value(candidate_skill_ids: set, job_skill_ids: set) -> float | None:
    """Fracción de las habilidades **técnicas** pedidas que el candidato tiene. `None` si la
    búsqueda no pide ninguna o el candidato no cargó ninguna (sin dato, no "no")."""
    if not job_skill_ids:
        return None
    if not candidate_skill_ids:
        return None
    return len(candidate_skill_ids & job_skill_ids) / len(job_skill_ids)


def zone_value(candidate_zone, job_zone, job_modality: str | None) -> float | None:
    """Factor, no filtro (decisión P6): misma zona 1, otra zona 0,5. No aplica si es remoto."""
    if job_modality == "remoto":
        return None
    if not candidate_zone or not job_zone:
        return None
    return 1.0 if candidate_zone == job_zone else 0.5


def modality_value(candidate_modalities: set[str], job_modality: str | None) -> float | None:
    """Sin ninguna modalidad marcada es `None`, no "no" (auditoría R4: 235 candidatos)."""
    if not job_modality or not candidate_modalities:
        return None
    needed = {"presencial": "onsite", "remoto": "remote", "híbrido": "hybrid", "hibrido": "hybrid"}.get(job_modality)
    if needed is None:
        return None
    return 1.0 if needed in candidate_modalities else 0.0


@dataclass
class Hybrid:
    fit: float                # encaje 0..1 sobre lo que se sabe
    coverage: float           # 0..1: cuánto del peso tenía dato
    criteria: dict[str, float | None] = field(default_factory=dict)


def hybrid_score(criteria: dict[str, float | None], weights: dict[str, float] | None = None) -> Hybrid:
    weights = weights or DEFAULT_WEIGHTS
    applicable = {k: w for k, w in weights.items() if k in criteria}
    known = {k: w for k, w in applicable.items() if criteria.get(k) is not None}
    total_w = sum(applicable.values())
    known_w = sum(known.values())
    fit = sum(criteria[k] * w for k, w in known.items()) / known_w if known_w else 0.0
    return Hybrid(fit=fit, coverage=known_w / total_w if total_w else 0.0, criteria=criteria)


def percentiles(values: dict) -> dict:
    """Percentil (0..1) de cada valor dentro del universo de la búsqueda. Empates: el promedio."""
    if not values:
        return {}
    ordered = sorted(values.values())
    n = len(ordered)
    out = {}
    for key, v in values.items():
        below = sum(1 for x in ordered if x < v)
        equal = sum(1 for x in ordered if x == v)
        out[key] = (below + (equal - 1) / 2) / (n - 1) if n > 1 else 1.0
    return out


@dataclass
class RequirementEval:
    req_id: str
    kind: str          # excluyente | deseable
    verdict: str       # si | parcial | no | sin_datos


_VERDICT = {"si": 1.0, "parcial": 0.5, "no": 0.0}


def requirements_score(evals: list[RequirementEval]) -> tuple[float | None, bool]:
    """(puntaje 0..1 sobre los requisitos con dato, ¿algún excluyente da "no"?)"""
    known = [(e, 2.0 if e.kind == "excluyente" else 1.0) for e in evals if e.verdict in _VERDICT]
    failed_excluding = any(e.kind == "excluyente" and e.verdict == "no" for e in evals)
    if not known:
        return None, failed_excluding
    total = sum(w for _, w in known)
    return sum(_VERDICT[e.verdict] * w for e, w in known) / total, failed_excluding


def final_score(hybrid: Hybrid, semantic_pct: float | None, req_score: float | None, failed_excluding: bool) -> int:
    """R7. Con evaluación por requisito: 0,55·req + 0,30·híbrido + 0,15·semántica. Sin ella
    (rerank apagado o fallido): 0,75·híbrido + 0,25·semántica. Un excluyente con "no" y
    evidencia tapa el puntaje en 49: puede aparecer, nunca como "recomendado"."""
    sem = semantic_pct if semantic_pct is not None else 0.5
    if req_score is None:
        score = 0.75 * hybrid.fit + 0.25 * sem
    else:
        score = 0.55 * req_score + 0.30 * hybrid.fit + 0.15 * sem
    value = round(100 * score)
    if failed_excluding:
        value = min(value, EXCLUDING_FAIL_CAP)
    return max(0, min(100, value))
