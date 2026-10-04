import uuid
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.alerts import Notification
from app.models.core import User, UserRole

logger = structlog.get_logger("app.services.notifications")


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    link: str | None = None,
    ref_id: uuid.UUID | None = None,
) -> Notification:
    """Adds a Notification to the session without committing — it should
    live in the same transaction as the event that triggers it.

    También encola el mail del aviso según `services/email/catalog.py`. `ref_id` es la entidad
    del aviso (p. ej. la postulación) y permite revalidar al enviar. El mail va dentro de un
    SAVEPOINT: si algo del mail falla, se pierde el mail y nunca la acción que lo originó."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        link=link,
    )
    db.add(notification)

    from app.services.email.catalog import rule_for
    from app.services.email.outbox import emails_enabled, queue_email_for_notification

    # El chequeo va FUERA del try: entrar al SAVEPOINT hace flush de todo lo pendiente, y un
    # error de ese flush es del evento, no del mail — no se lo puede tragar el except. Con el
    # módulo apagado (EMAIL_MODE=off) esto no hace ninguna consulta.
    if rule_for(type).mode == "instant" and await emails_enabled(db):
        try:
            async with db.begin_nested():
                await queue_email_for_notification(
                    db, user_id=user_id, type=type, title=title, body=body, link=link,
                    ref_id=ref_id,
                )
        except Exception as exc:  # el mail nunca rompe el evento
            logger.error("email_encolado_fallo", type=type, error=str(exc)[:300])
    return notification


async def notify_all_admins(
    db: AsyncSession,
    *,
    type: str,
    title: str,
    body: str,
    link: str | None = None,
) -> None:
    """Fan-out: creates one Notification per active admin user."""
    result = await db.execute(
        select(User).where(
            User.role == UserRole.admin,
            User.is_active == True,
            User.deleted_at.is_(None),
        )
    )
    for admin in result.scalars().all():
        await create_notification(
            db, user_id=admin.id, type=type, title=title, body=body, link=link,
        )
