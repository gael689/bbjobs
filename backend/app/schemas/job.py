from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime
import uuid
from app.models.job import JobPostingModality, JobPostingStatus, JobModerationStatus
from app.models.candidate import EducationLevel

# Límite de producto: toda búsqueda vence a los 20 días como máximo (se puede reducir, no ampliar).
MAX_JOB_DURATION_DAYS = 20

class JobPostingSkillCreate(BaseModel):
    skill_id: uuid.UUID
    is_required: bool = True

class JobPostingSkillResponse(JobPostingSkillCreate):
    class Config:
        from_attributes = True

class JobPostingCreate(BaseModel):
    title: str
    description: str
    requirements: str
    industry_id: uuid.UUID
    zone_id: uuid.UUID
    contract_type_id: uuid.UUID
    modality: JobPostingModality
    min_experience_years: Optional[int] = None
    min_education_level: Optional[EducationLevel] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: Optional[str] = None
    salary_visible: bool = False
    benefits: Optional[str] = None
    duration_days: int = Field(default=MAX_JOB_DURATION_DAYS, ge=1, le=MAX_JOB_DURATION_DAYS)
    skills: List[JobPostingSkillCreate] = []

class JobPostingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None
    modality: Optional[JobPostingModality] = None
    status: Optional[JobPostingStatus] = None
    duration_days: Optional[int] = Field(default=None, ge=1, le=MAX_JOB_DURATION_DAYS)

class JobPostingResponse(BaseModel):
    id: uuid.UUID
    company_id: Optional[uuid.UUID] = None
    company_legal_name_snapshot: str
    logo_url: Optional[str] = None
    title: str
    description: str
    requirements: str
    industry_id: uuid.UUID
    zone_id: uuid.UUID
    contract_type_id: uuid.UUID
    modality: JobPostingModality
    min_experience_years: Optional[int] = None
    min_education_level: Optional[EducationLevel] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: Optional[str] = None
    salary_visible: bool
    benefits: Optional[str] = None
    status: JobPostingStatus
    is_featured: bool
    published_at: Optional[datetime] = None
    duration_days: int
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class JobPostingCompanyResponse(JobPostingResponse):
    """Igual a JobPostingResponse + estado de moderación — sólo para los endpoints
    /me/company/jobs (la empresa necesita ver si está pendiente/rechazada). No se usa en el
    listado público: moderation_notes puede contener el motivo de un rechazo, información
    interna que no corresponde exponer fuera de la empresa dueña de la búsqueda."""
    moderation_status: JobModerationStatus
    moderation_notes: Optional[str] = None

class JobPostingPublicResponse(JobPostingResponse):
    @model_validator(mode="after")
    def _mask_hidden_salary(self):
        # Filtrar por rango de salario no es lo mismo que mostrarlo — se puede buscar
        # por rango aunque la empresa haya elegido no mostrar el número (salary_visible=False).
        if not self.salary_visible:
            self.salary_min = None
            self.salary_max = None
            self.salary_currency = None
        return self


class PaginatedJobsResponse(BaseModel):
    items: List[JobPostingPublicResponse]
    total: int
    page: int
    page_size: int


class JobSuggestion(BaseModel):
    label: str
    type: str  # "title" | "company"
