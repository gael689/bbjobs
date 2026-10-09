"""Aviso a los buscadores cuando una búsqueda aparece o desaparece del portal público.

Dos canales, cada uno inerte sin su variable (no es parte de la compuerta de módulos nuevos:
es SEO y sale normal):

- **IndexNow** (`INDEXNOW_KEY`): Bing, Yandex y lo que lee de Bing (Copilot, ChatGPT search).
  Un POST con la lista de URLs que cambiaron; el buscador verifica la clave en
  https://www.bbjobs.com.ar/indexnow-key.txt (lo sirve el frontend desde la misma variable).
  Además de la ficha se mandan la página de la zona (/trabajo-en/...) y la del sector
  (/empleos-de/...), porque su listado también cambió.
- **Google Indexing API** (`GOOGLE_INDEXING_CREDENTIALS`, el JSON de una cuenta de servicio
  sumada como propietaria en Search Console): la única vía que Google permite para páginas con
  JobPosting. URL_UPDATED cuando la ficha aparece o cambia de título, URL_DELETED cuando deja de
  estar visible (la ficha entonces da 404). Cuota por defecto: 200 publicaciones por día.

Uso desde un endpoint o tarea programada (siempre DESPUÉS del commit; nunca frena ni rompe el
request — corre en segundo plano y cualquier error queda en el log):

    antes = indexing.snapshot(job)
    ... cambios ...
    cambio = indexing.change_for(antes, job)
    await db.commit()
    indexing.notify(cambio)

"Visible" = lo mismo que filtra jobs.py::get_public_job: status active + moderación aprobada +
sin borrar. Si la visibilidad no cambia (y el título tampoco), no se avisa nada.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass
from typing import Any, Iterable

import httpx
import structlog

from app.core.config import settings
from app.core.urls import (
    SITE_HOST, SITE_URL, industry_page_path, job_path, zone_page_path,
)

logger = structlog.get_logger(__name__)

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
INDEXNOW_KEY_LOCATION = f"{SITE_URL}/indexnow-key.txt"
GOOGLE_SCOPE = "https://www.googleapis.com/auth/indexing"
GOOGLE_PUBLISH_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"

UPDATED = "URL_UPDATED"
DELETED = "URL_DELETED"

_TIMEOUT = httpx.Timeout(10.0)
# Los tests lo reemplazan por un httpx.MockTransport.
_TRANSPORT: httpx.AsyncBaseTransport | None = None

# Referencias fuertes a las tareas en vuelo: sin esto el GC puede cortarlas a la mitad.
_tasks: set[asyncio.Task] = set()

# Access token de Google cacheado hasta que venza (con un minuto de margen).
_google_token: tuple[str, float] | None = None
# id de zona/sector → slug del catálogo (los catálogos casi no cambian).
_slug_cache: dict[uuid.UUID, str] = {}


@dataclass(frozen=True)
class JobSnapshot:
    id: uuid.UUID
    title: str | None
    zone_id: uuid.UUID | None
    industry_id: uuid.UUID | None
    visible: bool


@dataclass(frozen=True)
class JobChange:
    kind: str  # UPDATED | DELETED
    job_id: uuid.UUID
    title: str | None
    old_title: str | None = None  # si cambió el título estando visible
    zone_id: uuid.UUID | None = None
    industry_id: uuid.UUID | None = None


# ── Qué cambió ────────────────────────────────────────────────────────────────

def _val(x: Any) -> str:
    return str(getattr(x, "value", x))


def is_public(job: Any) -> bool:
    return (
        _val(job.status) == "active"
        and _val(job.moderation_status) == "approved"
        and getattr(job, "deleted_at", None) is None
    )


def snapshot(job: Any) -> JobSnapshot:
    return JobSnapshot(
        id=job.id, title=job.title, zone_id=getattr(job, "zone_id", None),
        industry_id=getattr(job, "industry_id", None), visible=is_public(job),
    )


def change_for(before: JobSnapshot | None, job: Any) -> JobChange | None:
    """Compara la foto de antes con el estado actual. None si no hay nada que avisar."""
    after = snapshot(job)
    was = bool(before and before.visible)
    if was and not after.visible:
        # Se avisa con la URL que conocía el buscador (la del título de antes).
        return JobChange(DELETED, after.id, before.title, zone_id=before.zone_id,
                         industry_id=before.industry_id)
    if after.visible and not was:
        return JobChange(UPDATED, after.id, after.title, zone_id=after.zone_id,
                         industry_id=after.industry_id)
    if was and after.visible and before.title != after.title:
        return JobChange(UPDATED, after.id, after.title, old_title=before.title,
                         zone_id=after.zone_id, industry_id=after.industry_id)
    return None


# ── Disparo en segundo plano ──────────────────────────────────────────────────

def indexnow_key() -> str | None:
    key = (settings.INDEXNOW_KEY or "").strip()
    return key or None


def google_credentials() -> dict | None:
    raw = (settings.GOOGLE_INDEXING_CREDENTIALS or "").strip()
    if not raw:
        return None
    try:
        info = json.loads(raw)
    except ValueError:
        logger.warning("indexing_google_credentials_invalid_json")
        return None
    if not isinstance(info, dict) or not info.get("client_email") or not info.get("private_key"):
        logger.warning("indexing_google_credentials_incomplete")
        return None
    return info


def enabled() -> bool:
    return bool(indexnow_key() or (settings.GOOGLE_INDEXING_CREDENTIALS or "").strip())


def notify(changes: JobChange | Iterable[JobChange | None] | None) -> None:
    """Agenda el aviso y vuelve enseguida. Llamar después del commit."""
    if changes is None:
        return
    lista = [changes] if isinstance(changes, JobChange) else [c for c in changes if c]
    if not lista or not enabled():
        return
    try:
        task = asyncio.get_running_loop().create_task(process(lista))
    except RuntimeError:  # sin event loop: no hay a quién colgarle la tarea
        logger.warning("indexing_no_event_loop")
        return
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


async def process(changes: list[JobChange]) -> None:
    """Manda los avisos. Nunca levanta excepción."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, transport=_TRANSPORT) as client:
            if indexnow_key():
                await _send_indexnow(client, changes)
            creds = google_credentials()
            if creds:
                await _send_google(client, creds, changes)
    except Exception:  # noqa: BLE001 — un aviso que falla no puede romper nada
        logger.exception("indexing_failed")


# ── IndexNow ──────────────────────────────────────────────────────────────────

async def _resolve_slugs(ids: set[uuid.UUID]) -> dict[uuid.UUID, str]:
    """Slugs de catálogo (zonas y sectores) por id, con su propia sesión: el request ya cerró."""
    faltan = {i for i in ids if i and i not in _slug_cache}
    if faltan:
        from sqlalchemy import select, union_all
        from app.db.session import AsyncSessionLocal
        from app.models.catalogs import Industry, Zone

        q = union_all(
            select(Zone.id, Zone.slug).where(Zone.id.in_(faltan)),
            select(Industry.id, Industry.slug).where(Industry.id.in_(faltan)),
        )
        async with AsyncSessionLocal() as db:
            for rid, slug in (await db.execute(q)).all():
                _slug_cache[rid] = slug
    return {i: _slug_cache[i] for i in ids if i in _slug_cache}


async def _indexnow_urls(changes: list[JobChange]) -> list[str]:
    ids = {c.zone_id for c in changes if c.zone_id} | {c.industry_id for c in changes if c.industry_id}
    try:
        slugs = await _resolve_slugs(ids) if ids else {}
    except Exception:  # noqa: BLE001 — sin catálogo se avisa igual la ficha
        logger.exception("indexing_slug_lookup_failed")
        slugs = {}
    urls: list[str] = []
    for c in changes:
        paths = [job_path(c.job_id, c.title)]
        if c.old_title is not None:
            paths.append(job_path(c.job_id, c.old_title))
        paths.append(zone_page_path(slugs.get(c.zone_id)))
        paths.append(industry_page_path(slugs.get(c.industry_id)))
        for p in paths:
            if p and SITE_URL + p not in urls:
                urls.append(SITE_URL + p)
    return urls


async def _send_indexnow(client: httpx.AsyncClient, changes: list[JobChange]) -> None:
    urls = await _indexnow_urls(changes)
    if not urls:
        return
    payload = {
        "host": SITE_HOST,
        "key": indexnow_key(),
        "keyLocation": INDEXNOW_KEY_LOCATION,
        "urlList": urls[:10000],
    }
    try:
        r = await client.post(INDEXNOW_ENDPOINT, json=payload,
                              headers={"Content-Type": "application/json; charset=utf-8"})
        if r.status_code in (200, 202):
            logger.info("indexnow_sent", urls=len(urls), status=r.status_code)
        else:
            logger.warning("indexnow_rejected", status=r.status_code, body=r.text[:300])
    except httpx.HTTPError as e:
        logger.warning("indexnow_error", error=str(e))


# ── Google Indexing API ───────────────────────────────────────────────────────

def _signed_assertion(info: dict, now: int) -> str:
    """JWT firmado con la clave de la cuenta de servicio (RS256), con google-auth."""
    from google.auth import crypt, jwt as gjwt

    signer = crypt.RSASigner.from_service_account_info(info)
    payload = {
        "iss": info["client_email"],
        "scope": GOOGLE_SCOPE,
        "aud": info.get("token_uri") or GOOGLE_TOKEN_URI,
        "iat": now,
        "exp": now + 3600,
    }
    token = gjwt.encode(signer, payload)
    return token.decode() if isinstance(token, bytes) else token


async def _google_access_token(client: httpx.AsyncClient, info: dict) -> str | None:
    global _google_token
    now = time.time()
    if _google_token and _google_token[1] - 60 > now:
        return _google_token[0]
    try:
        assertion = _signed_assertion(info, int(now))
    except Exception:  # noqa: BLE001 — clave mal pegada en la variable
        logger.exception("indexing_google_sign_failed")
        return None
    try:
        r = await client.post(info.get("token_uri") or GOOGLE_TOKEN_URI, data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        })
    except httpx.HTTPError as e:
        logger.warning("indexing_google_token_error", error=str(e))
        return None
    if r.status_code != 200:
        logger.warning("indexing_google_token_rejected", status=r.status_code, body=r.text[:300])
        return None
    data = r.json()
    token = data.get("access_token")
    if not token:
        return None
    _google_token = (token, now + float(data.get("expires_in", 3600)))
    return token


async def _send_google(client: httpx.AsyncClient, info: dict, changes: list[JobChange]) -> None:
    token = await _google_access_token(client, info)
    if not token:
        return
    for c in changes:
        url = SITE_URL + job_path(c.job_id, c.title)
        try:
            r = await client.post(
                GOOGLE_PUBLISH_ENDPOINT,
                json={"url": url, "type": c.kind},
                headers={"Authorization": f"Bearer {token}"},
            )
            if r.status_code == 200:
                logger.info("indexing_google_sent", type=c.kind, url=url)
            else:
                logger.warning("indexing_google_rejected", status=r.status_code, url=url,
                               body=r.text[:300])
        except httpx.HTTPError as e:
            logger.warning("indexing_google_error", error=str(e), url=url)
