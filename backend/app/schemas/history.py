from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class ApplicationStatusHistoryResponse(BaseModel):
    id: uuid.UUID
    from_status: Optional[str] = None
    to_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateApplicationHistoryItem(BaseModel):
    """Línea de tiempo del postulante: cambios de estado y, con la compuerta de módulos nuevos
    abierta, las notas **visibles** de la empresa (`kind="note"`, el texto en `note`). Las notas
    privadas nunca llegan acá."""
    id: uuid.UUID
    kind: str = "status"
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime


class CandidateActivityLogResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    summary: str
    created_at: datetime

    class Config:
        from_attributes = True
