"""Retención (v3 M11): a los 90 días se vacía el contenido de los mails de la cola.

Quedan los metadatos (a quién, cuándo, estado, entregado/abierto/rebote) que alimentan las
métricas y la salud de la cuenta; se va el asunto/HTML/texto, que pueden traer datos personales.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email import EmailOutbox

KEEP_CONTENT = timedelta(days=90)


async def purge_old_content(db: AsyncSession, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    result = await db.execute(
        update(EmailOutbox)
        .where(EmailOutbox.created_at < now - KEEP_CONTENT, EmailOutbox.html != "")
        .values(html="", text=None, subject="(contenido vencido)")
    )
    return result.rowcount or 0
