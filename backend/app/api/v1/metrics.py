"""Medición propia del sitio público.

- `POST /metrics/events` (público): recibe lotes de eventos del navegador, sólo de quienes
  aceptaron "Medición". Siempre responde 204: lo inválido se descarta en silencio
  (services/site_metrics.py). El frontend lo manda con `navigator.sendBeacon` y cuerpo
  `text/plain` (sin preflight de CORS), por eso el JSON se lee a mano y no con un modelo Pydantic.
- `GET /admin/metrics?days=7|30|90` (admin): el reporte del panel "Métricas del sitio".
"""
import json
from functools import lru_cache
from urllib.parse import urlsplit

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.core.limiter import limiter
from app.models.core import User, UserRole
from app.services import site_metrics

router = APIRouter()
logger = structlog.get_logger("app.metrics")


@lru_cache(maxsize=1)
def _internal_hosts() -> tuple[str, ...]:
    hosts = set(site_metrics.INTERNAL_HOSTS)
    for origin in settings.cors_origins:
        host = urlsplit(origin).hostname
        if host:
            hosts.add(host.lower())
    return tuple(sorted(hosts))


@router.post("/metrics/events", status_code=204)
@limiter.limit("60/minute")
async def collect_events(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    try:
        body = await request.body()
        if not body or len(body) > site_metrics.MAX_BODY_BYTES:
            return Response(status_code=204)
        payload = json.loads(body)
        events = site_metrics.parse_batch(
            payload,
            user_agent=request.headers.get("user-agent"),
            header_referer=request.headers.get("referer"),
            internal_hosts=_internal_hosts(),
        )
        if events:
            db.add_all(events)
            await db.commit()
    except (ValueError, UnicodeDecodeError):
        pass  # JSON roto: se descarta
    except Exception as exc:  # la medición nunca rompe nada: se loguea y se sigue
        logger.warning("metrics_events_failed", error=str(exc))
        await db.rollback()
    return Response(status_code=204)


@router.get("/admin/metrics")
async def admin_metrics(
    days: int = Query(30),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    if days not in (7, 30, 90):
        raise HTTPException(status_code=422, detail="days debe ser 7, 30 o 90")
    return await site_metrics.build_report(db, days)
