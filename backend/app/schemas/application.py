from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid
from app.models.job import ApplicationStatus

NOTE_MAX_LENGTH = 1000  # igual que services/application_events.py y el CHECK de la tabla


class ApplicationCreate(BaseModel):
    cover_letter: Optional[str] = None

class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    # Nota opcional junto al cambio (caso típico: "No avanza" + motivo, en un solo paso).
    # Con la compuerta de módulos nuevos cerrada se ignora. Privada salvo que se marque.
    note: Optional[str] = Field(None, max_length=NOTE_MAX_LENGTH)
    note_visible: bool = False


class ApplicationNoteCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=NOTE_MAX_LENGTH)
    visible_to_candidate: bool = False


class ApplicationNoteResponse(BaseModel):
    """Lo que ve la empresa de sus notas. No existe una versión de admin a propósito: Talency
    no lee las notas privadas de las empresas (decisión del 06/10/2026)."""
    id: uuid.UUID
    application_id: uuid.UUID
    body: Optional[str] = None
    visible_to_candidate: bool
    status_at_time: Optional[str] = None
    notified_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ApplicationResponse(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    job_posting_id: uuid.UUID
    cover_letter: Optional[str] = None
    status: ApplicationStatus
    seen_at: Optional[datetime] = None
    status_updated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
