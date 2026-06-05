from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
from app.models.job import ApplicationStatus

class ApplicationCreate(BaseModel):
    cover_letter: Optional[str] = None

class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus

class ApplicationResponse(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_posting_id: uuid.UUID
    cover_letter: Optional[str] = None
    status: ApplicationStatus
    seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
