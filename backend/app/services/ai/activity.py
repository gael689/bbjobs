"""Registro de "qué hizo la IA" (Centro de IA de Talency).

Pedido de Gael: **Talency tiene que ver todo** lo que hace la IA. Cada punto que usa Gemini (o que
Talency lanza a mano) deja una fila en `ai_activity_log` con `log_activity(...)`.

Uso (lo llaman el pipeline, las tareas programadas y los endpoints)::

    from app.services.ai.activity import log_activity, KIND_RECOMPUTE
    await log_activity(db, KIND_RECOMPUTE, job_id=job.id, company_id=job.company_id,
                       detail={"motivo": "noche", "candidatos": 42, "reranks": 0}, cost_usd=0.0)

Reglas:
- **No commitea**: la fila entra en la misma transacción que el trabajo que describe (si el
  trabajo se deshace, el registro también).
- **Nunca levanta**: registrar es un extra; un error acá no puede tirar abajo una recomendación.
- **Sólo ids, conteos y montos en `detail`**. Nada de texto del CV, frases de búsqueda, nombres
  ni contactos. `_clean` lo hace cumplir: los textos se cortan a 60 caracteres (sirven para
  claves como `"motivo": "aprobada"`), las listas a 20 elementos y lo anidado se descarta.
- `alert=True` marca algo que Talency debería mirar (p. ej. una lectura de CV en la que quedó
  un dato personal después de anonimizar).

Tipos (`kind`): ver las constantes `KIND_*`. Dos tipos más salen de tablas que ya existían y no
se guardan acá: `busqueda` (agregado diario de `ai_usage_log`, sin las frases) y `aviso_empresa`
(los avisos de "candidatos nuevos que encajan", de `job_recommendations.notified_at`).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import AiActivityLog

logger = structlog.get_logger("app.services.ai.activity")

KIND_CV_READ = "cv_lectura"            # extracción + anonimización de un CV
KIND_RECOMPUTE = "recalculo"           # recomendados de una búsqueda
KIND_SUMMARY = "resumen"               # resumen de 3 líneas de un candidato
KIND_MODERATION = "moderacion"         # duplicados / sector de un aviso
KIND_SKILLS = "habilidades"            # sugerencia de habilidades a un candidato
KIND_JOB_DRAFT = "redaccion"           # borrador de una búsqueda para una empresa
KIND_CAMPAIGN_DRAFT = "campana"        # borrador de campaña (mensual u otro)
KIND_MANUAL = "manual"                 # algo que Talency lanzó desde el Centro de IA
# Derivados (no se guardan en esta tabla):
KIND_SEARCH = "busqueda"
KIND_NEW_FIT = "aviso_empresa"

KINDS = [KIND_CV_READ, KIND_RECOMPUTE, KIND_SUMMARY, KIND_MODERATION, KIND_SKILLS, KIND_JOB_DRAFT,
         KIND_CAMPAIGN_DRAFT, KIND_MANUAL, KIND_SEARCH, KIND_NEW_FIT]

MAX_STR = 60
MAX_LIST = 20
MAX_KEYS = 20


def _scalar(v: Any) -> Any:
    if v is None or isinstance(v, (bool, int)):
        return v
    if isinstance(v, float):
        return round(v, 6)
    if isinstance(v, Decimal):
        return round(float(v), 6)
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, str):
        return v[:MAX_STR]
    return None


def _clean(detail: dict | None) -> dict:
    """Sólo escalares (y listas cortas de escalares). Textos largos y estructuras anidadas no
    entran: es la defensa contra que alguien meta un fragmento de CV acá por error."""
    out: dict = {}
    for k, v in list((detail or {}).items())[:MAX_KEYS]:
        if isinstance(v, (list, tuple, set)):
            items = [_scalar(x) for x in list(v)[:MAX_LIST]]
            out[str(k)[:40]] = [x for x in items if x is not None]
        else:
            val = _scalar(v)
            if val is not None or v is None:
                out[str(k)[:40]] = val
    return out


async def log_activity(
    db: AsyncSession, kind: str, *, job_id: uuid.UUID | None = None, candidate_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None, detail: dict | None = None, cost_usd: float | Decimal = 0.0,
    alert: bool = False,
) -> None:
    """Agrega una fila al registro de actividad de la IA. No commitea y nunca levanta."""
    try:
        db.add(AiActivityLog(
            id=uuid.uuid4(), kind=kind[:40], job_id=job_id, candidate_id=candidate_id, company_id=company_id,
            detail=_clean(detail), cost_usd=Decimal(str(round(float(cost_usd or 0), 6))), alert=bool(alert),
            created_at=datetime.now(timezone.utc),
        ))
    except Exception as exc:  # el registro nunca frena el trabajo
        logger.warning("ai_activity_log_fallo", kind=kind, error=str(exc)[:200])


# ── Gasto de una corrida ────────────────────────────────────────────────────────────────
# `pipeline.log_usage` acumula lo gastado en `db.info["ai_cost_usd"]`; con una marca antes y otra
# después se sabe cuánto costó un recálculo sin volver a consultar `ai_usage_log`.

def cost_mark(db: AsyncSession) -> Decimal:
    try:
        return Decimal(db.info.get("ai_cost_usd", Decimal(0)))
    except Exception:
        return Decimal(0)


def cost_since(db: AsyncSession, mark: Decimal) -> float:
    return float(cost_mark(db) - mark)
