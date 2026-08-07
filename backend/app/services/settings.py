"""Lectura y escritura de los interruptores del sitio.

Si la fila no existe todavía vale el default de `SETTING_DEFAULTS` (apagado): así el sistema
arranca con las estadísticas construidas pero sin publicar, y Talency las prende cuando quiere.
"""
from typing import Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.settings import SettingKey, SiteSetting, SETTING_DEFAULTS


async def get_setting(db: AsyncSession, key: SettingKey) -> bool:
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == key))
    row = result.scalar_one_or_none()
    return row.enabled if row else SETTING_DEFAULTS.get(key, False)


async def get_all_settings(db: AsyncSession) -> Dict[str, bool]:
    result = await db.execute(select(SiteSetting))
    guardados = {str(row.key): row.enabled for row in result.scalars().all()}
    return {k.value: guardados.get(k.value, SETTING_DEFAULTS.get(k, False)) for k in SettingKey}


async def set_setting(db: AsyncSession, key: SettingKey, enabled: bool) -> None:
    """Crea la fila si no existía. No commitea — lo hace el endpoint que llama."""
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.enabled = enabled
    else:
        db.add(SiteSetting(key=key, enabled=enabled))
