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


class CandidateActivityLogResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    summary: str
    created_at: datetime

    class Config:
        from_attributes = True
