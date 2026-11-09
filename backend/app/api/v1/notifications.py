from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, func
from typing import List
from datetime import datetime, timedelta, timezone
import uuid
from pydantic import BaseModel
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.models.core import User, UserRole
from app.models.alerts import Notification

router = APIRouter()


class NotificationResponse(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str
    link: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/me/notifications", response_model=List[NotificationResponse])
async def list_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    return result.scalars().all()


@router.get("/me/notifications/unread-count")
async def count_unread_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    return {"count": result.scalar() or 0}


# Avisos que el panel muestra además como cartel emergente (Gael, 28/10/2026: "que cuando te
# llegue sea un mensaje saliendo en pantalla"). Sólo los no leídos y recientes: uno viejo ya no
# es noticia. Qué cartel ya se mostró lo recuerda el navegador; leerlo lo saca de acá.
# Los candidatos que encajan con una búsqueda ya no salen de acá: la "bombita" de la empresa
# cuenta lo que tiene sin mirar (`summary`, PLAN-FINAL-IA-Y-MAILS §4).
HIGHLIGHT_TYPES = ("admin_ai_new_fits", "skill_suggestions_ready")
HIGHLIGHT_MAX_AGE = timedelta(days=3)
HIGHLIGHT_LIMIT = 3


@router.get("/me/notifications/highlights", response_model=List[NotificationResponse])
async def list_my_highlights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _highlights(db, current_user)


async def _highlights(db: AsyncSession, current_user: User) -> list:
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.type.in_(HIGHLIGHT_TYPES),
            Notification.created_at >= datetime.now(timezone.utc) - HIGHLIGHT_MAX_AGE,
        )
        .order_by(desc(Notification.created_at))
        .limit(HIGHLIGHT_LIMIT)
    )
    return result.scalars().all()


class PendingJob(BaseModel):
    job_id: uuid.UUID
    title: str
    count: int


class RecommendedPending(BaseModel):
    total: int
    jobs: List[PendingJob]


class NotificationSummary(BaseModel):
    count: int
    highlights: List[NotificationResponse]
    # Sólo empresas verificadas con los módulos nuevos abiertos: recomendados sin mirar.
    recommended: Optional[RecommendedPending] = None


@router.get("/me/notifications/summary", response_model=NotificationSummary)
async def notifications_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Todo lo que el panel pregunta cada minuto, en un solo pedido: el contador de la campanita,
    los carteles emergentes y (empresas) los recomendados sin mirar por búsqueda. Antes eran
    pedidos separados. Sin IA: sólo consultas."""
    from app.core.features import new_modules_enabled

    count = (await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current_user.id, Notification.is_read == False,  # noqa: E712
        )
    )).scalar() or 0
    highlights = await _highlights(db, current_user) if new_modules_enabled() else []
    recommended = None
    if new_modules_enabled() and current_user.role == UserRole.company:
        from app.api.v1.recommendations import pending_for_company
        from app.models.company import CompanyProfile, VerificationStatus
        from app.models.settings import SettingKey
        from app.services.settings import get_setting

        company = (await db.execute(
            select(CompanyProfile).where(CompanyProfile.user_id == current_user.id)
        )).scalar_one_or_none()
        if company is not None and company.verification_status == VerificationStatus.verified                 and await get_setting(db, SettingKey.ia_recomendaciones_activas):
            pending = await pending_for_company(db, company.id)
            recommended = RecommendedPending(total=pending.total,
                                             jobs=[PendingJob(**j.model_dump()) for j in pending.jobs])
    return NotificationSummary(count=count, highlights=highlights, recommended=recommended)


@router.patch("/me/notifications/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(notification)

    return notification


@router.delete("/me/notifications/{notification_id}")
async def delete_notification(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Descartar una notificación de la propia campanita — antes sólo se podía marcar leída,
    nunca sacarla de la lista (ver A3 del plan del 14/08)."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    await db.delete(notification)
    await db.commit()
    return {"status": "ok"}


@router.post("/me/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    now = datetime.now(timezone.utc)
    for notif in result.scalars().all():
        notif.is_read = True
        notif.read_at = now

    await db.commit()
    return {"status": "ok"}
