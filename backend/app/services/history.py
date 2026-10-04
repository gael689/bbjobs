import enum
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.history import ApplicationStatusHistory, CandidateActivityLog


def _status_value(status: "str | enum.Enum | None") -> Optional[str]:
    """El valor crudo del estado (`"selected"`), venga como enum o como texto.

    `str()` NO sirve: desde Python 3.11, `str()` de un `(str, Enum)` devuelve
    `"ApplicationStatus.selected"`. Eso se guardó así hasta el 04/10/2026 y el candidato veía
    el texto crudo en su línea de tiempo (migración a7c3e9d2f514 limpia lo viejo)."""
    if status is None:
        return None
    if isinstance(status, enum.Enum):
        return status.value
    return status


async def log_application_status_change(
    db: AsyncSession,
    *,
    application_id: uuid.UUID,
    from_status: "str | enum.Enum | None",
    to_status: "str | enum.Enum",
    changed_by_user_id: Optional[uuid.UUID] = None,
) -> None:
    """Sólo agrega a la sesión — viaja en la misma transacción que el cambio que la origina
    (igual criterio que create_notification en services/notifications.py)."""
    db.add(ApplicationStatusHistory(
        application_id=application_id,
        from_status=_status_value(from_status),
        to_status=_status_value(to_status),
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
