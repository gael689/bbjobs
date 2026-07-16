import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.history import ApplicationStatusHistory, CandidateActivityLog


async def log_application_status_change(
    db: AsyncSession,
    *,
    application_id: uuid.UUID,
    from_status: Optional[str],
    to_status: str,
    changed_by_user_id: Optional[uuid.UUID] = None,
) -> None:
    """Sólo agrega a la sesión — viaja en la misma transacción que el cambio que la origina
    (igual criterio que create_notification en services/notifications.py)."""
    db.add(ApplicationStatusHistory(
        application_id=application_id,
        from_status=from_status,
        to_status=to_status,
        changed_by_user_id=changed_by_user_id,
    ))


async def log_candidate_activity(
    db: AsyncSession,
    *,
    candidate_id: uuid.UUID,
    event_type: str,
    summary: str,
) -> None:
    db.add(CandidateActivityLog(candidate_id=candidate_id, event_type=event_type, summary=summary))
