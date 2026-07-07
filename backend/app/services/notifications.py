import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.alerts import Notification
from app.models.core import User, UserRole


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    link: str | None = None,
) -> Notification:
    """Adds a Notification to the session without committing — it should
    live in the same transaction as the event that triggers it."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        link=link,
    )
    db.add(notification)
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
