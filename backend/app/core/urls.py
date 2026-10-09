"""URLs públicas del sitio, armadas igual que en el frontend.

Espejo de `frontend/src/lib/seo/urls.ts` (slugify + jobUrl) e `indice.ts` (páginas de zona y de
sector). **Si se cambia uno, se cambia el otro**: los dos tienen que dar exactamente la misma URL,
porque es la que se manda a los buscadores (services/indexing.py) y la que va en los mails. Los
casos de `tests/test_public_urls.py` salen de correr el archivo TS con node.

La ficha de un empleo es `/empleos/<slug-del-titulo>-<uuid>`; el uuid sigue siendo la clave y la
forma vieja (sólo uuid) redirige 308 a la canónica, así que un slug desactualizado no rompe nada.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any

# Dominio canónico: el que sirve el sitio (bbjobs.com.ar sin www redirige 308 acá).
SITE_HOST = "www.bbjobs.com.ar"
SITE_URL = f"https://{SITE_HOST}"

_COMBINING = re.compile(r"[̀-ͯ]")
_NO_ALNUM = re.compile(r"[^a-z0-9]+")

# Páginas /trabajo-en/<slug>: slug de la página → slugs del catálogo de zonas que cubre.
# Zona Norte y Zona Sur son barrios de Bahía Blanca: van a la página de Bahía.
_ZONA_PAGINA: dict[str, str] = {
    "bahia-blanca": "bahia-blanca",
    "zona-norte": "bahia-blanca",
    "zona-sur": "bahia-blanca",
    "punta-alta": "punta-alta",
    "monte-hermoso": "monte-hermoso",
    "coronel-suarez": "coronel-suarez",
}
# Páginas /empleos-de/<slug>: los 11 sectores del catálogo, menos "Otro" (mismo slug).
_RUBROS_PAGINA = frozenset({
    "administracion", "comercio", "construccion", "educacion", "gastronomia", "industria",
    "logistica", "marketing", "recursos-humanos", "salud", "tecnologia",
})


def slugify(texto: str) -> str:
    """"Vendedor/a — Bahía Blanca" → "vendedor-a-bahia-blanca". Igual que slugify() en urls.ts."""
    s = unicodedata.normalize("NFD", texto)
    s = _COMBINING.sub("", s)
    s = s.lower().replace("ñ", "n")
    s = _NO_ALNUM.sub("-", s).strip("-")
    return s[:80].rstrip("-")


def job_path(job_id: Any, title: str | None) -> str:
    """Ruta canónica (relativa) de la ficha de un empleo. Igual que jobUrl() en urls.ts."""
    slug = slugify(title) if title else ""
    jid = str(job_id).lower()
    return f"/empleos/{slug}-{jid}" if slug else f"/empleos/{jid}"


def job_public_path(job: Any) -> str:
    """Ruta relativa a partir de un JobPosting (o cualquier cosa con .id y .title)."""
    return job_path(job.id, getattr(job, "title", None))


def job_public_url(job: Any) -> str:
    """URL absoluta canónica de la ficha de un empleo."""
    return SITE_URL + job_public_path(job)


def zone_page_path(zone_catalog_slug: str | None) -> str | None:
    """/trabajo-en/<slug> de la zona del catálogo, o None si esa zona no tiene página."""
    pagina = _ZONA_PAGINA.get(zone_catalog_slug or "")
    return f"/trabajo-en/{pagina}" if pagina else None


def industry_page_path(industry_catalog_slug: str | None) -> str | None:
    """/empleos-de/<slug> del sector del catálogo, o None si no tiene página ("otro")."""
    if industry_catalog_slug in _RUBROS_PAGINA:
        return f"/empleos-de/{industry_catalog_slug}"
    return None
