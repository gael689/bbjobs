"""Aviso de "esta persona está en otro proceso" (Eugenia, 22/10/2026, M4).

Cuando una empresa está por avanzar a alguien, se le dice —sin nombrar nada— que esa persona ya
está **En proceso** o **Seleccionada** en una búsqueda de **otra** empresa en los últimos 90 días.
Es sólo informativo: puede contactarla igual.

Qué cuenta y qué no:
- Sólo `in_process` y `selected` (Contactado y Finalista ya no se eligen).
- Sólo postulaciones de **otras** empresas y con movimiento en los últimos 90 días.
- **Nunca** sale el nombre de la empresa, el título de la búsqueda, una fecha ni un id: sólo un
  número. La respuesta completa se revisa en los tests.

Detrás del interruptor `aviso_otros_procesos_activo` (apagado hasta publicar la cláusula en la
política de privacidad y ofrecer la opción de oponerse; decide el abogado). Es un interruptor de
producto, no la compuerta de módulos nuevos.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Application, ApplicationStatus, JobPosting
from app.models.settings import SettingKey
from app.services.settings import get_setting

WINDOW_DAYS = 90
COUNTED_STATUSES = (ApplicationStatus.in_process.value, ApplicationStatus.selected.value)


async def count_other_processes(
    db: AsyncSession, *, company_id: uuid.UUID, candidate_id: uuid.UUID, now: datetime | None = None
) -> int:
    """Cuántas postulaciones de la persona están avanzadas en otras empresas. 0 con el
    interruptor apagado."""
    if not await get_setting(db, SettingKey.aviso_otros_procesos_activo):
        return 0
    now = now or datetime.now(timezone.utc)
    return (await db.execute(
        select(func.count())
        .select_from(Application)
        .join(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(
            Application.candidate_id == candidate_id,
            JobPosting.company_id != company_id,
            Application.status.in_(COUNTED_STATUSES),
            Application.status_updated_at >= now - timedelta(days=WINDOW_DAYS),
            Application.deleted_at.is_(None),
        )
    )).scalar_one()
