from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
import uuid
from app.models.job import ApplicationStatus

NOTE_MAX_LENGTH = 1000  # igual que services/application_events.py y el CHECK de la tabla

# Etiquetas rápidas de las observaciones (Eugenia, 22/10/2026). Lista cerrada: el texto libre va
# en el cuerpo. El front muestra la etiqueta de cada una (`NotasPostulacion.tsx`).
NOTE_TAGS = ("no_se_presento", "ya_entrevistado", "referencias_a_revisar")


def validar_etiquetas(tags: list[str]) -> list[str]:
    """Sólo las de la lista, sin repetir y en el orden en que llegaron."""
    for t in tags:
        if t not in NOTE_TAGS:
            raise ValueError(f"Etiqueta desconocida: {t}")
    return list(dict.fromkeys(tags))


class ApplicationCreate(BaseModel):
    cover_letter: Optional[str] = None

class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    # Observación opcional junto al cambio (caso típico: "No avanza" + motivo, en un solo paso).
    # Siempre privada: no le llega al postulante. Con la compuerta de módulos nuevos cerrada
    # se ignora. Un `note_visible` viejo se descarta (pydantic ignora campos de más).
    note: Optional[str] = Field(None, max_length=NOTE_MAX_LENGTH)
    note_tags: list[str] = Field(default_factory=list, max_length=len(NOTE_TAGS))

    @field_validator("note_tags")
    @classmethod
    def _tags_validas(cls, v: list[str]) -> list[str]:
        return validar_etiquetas(v)


class ApplicationNoteCreate(BaseModel):
    """Observación privada. `application_id` (opcional) dice desde qué postulación se escribió."""
    body: str = Field(..., min_length=1, max_length=NOTE_MAX_LENGTH)
    application_id: Optional[uuid.UUID] = None
    tags: list[str] = Field(default_factory=list, max_length=len(NOTE_TAGS))

    @field_validator("tags")
    @classmethod
    def _tags_validas(cls, v: list[str]) -> list[str]:
        return validar_etiquetas(v)


class ApplicationNoteResponse(BaseModel):
    """Lo que ve la empresa autora de sus observaciones sobre una persona."""
    id: uuid.UUID
    candidate_id: uuid.UUID
    application_id: Optional[uuid.UUID] = None
    # Título de la búsqueda de origen, si la observación salió de una postulación.
    job_title: Optional[str] = None
    body: Optional[str] = None
    tags: list[str] = []
    status_at_time: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminCandidateNoteResponse(ApplicationNoteResponse):
    """Lo que ve Talency (sólo lectura): suma la empresa que la escribió."""
    company_id: uuid.UUID
    company_name: Optional[str] = None


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
