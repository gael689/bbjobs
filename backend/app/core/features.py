"""Compuerta de los módulos en desarrollo (mails, IA, Revisión de CV).

Decisión de Gael (04/10/2026): **nadie los ve en producción hasta que se lancen**, ni Eugenia.
Por eso la compuerta es una variable de entorno del deploy (`MODULOS_NUEVOS_ACTIVOS`) y no un
interruptor de `site_settings`, que se maneja desde el panel de admin.

Con la compuerta cerrada:
- las rutas nuevas responden 404, como si no existieran;
- los interruptores nuevos no aparecen en `/admin/settings` ni se pueden cambiar;
- no se encola ningún mail y el scheduler no agrega ninguna tarea nueva.

Los arreglos de bugs no pasan por acá: salen como siempre.
"""
from fastapi import HTTPException

from app.core.config import settings


def new_modules_enabled() -> bool:
    return bool(settings.MODULOS_NUEVOS_ACTIVOS)


async def require_new_modules() -> None:
    """Dependencia de router: 404 si la compuerta está cerrada (no 403: que no se sepa que existe)."""
    if not new_modules_enabled():
        raise HTTPException(status_code=404, detail="Not Found")
