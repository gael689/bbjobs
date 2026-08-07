from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List
from datetime import date, datetime
import uuid
from app.models.candidate import (
    EducationLevel, EducationStatus, LanguageLevel, Gender, Availability, OTHER_SKILL_MAX_LENGTH,
    MIN_CANDIDATE_AGE_YEARS,
)
from app.models.catalogs import SkillCategory


def calculate_age(birth_date: Optional[date]) -> Optional[int]:
    """Edad al día de hoy — se deriva de birth_date, nunca se persiste (se desactualizaría)."""
    if birth_date is None:
        return None
    today = date.today()
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


class ProfileMissingItem(BaseModel):
    key: str
    label: str
    link: str


class CandidateProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    has_own_transport: Optional[bool] = None
    availability: Optional[Availability] = None
    immediate_availability: Optional[bool] = None
    location_zone_id: Optional[uuid.UUID] = None
    expected_salary_min: Optional[float] = None
    expected_salary_max: Optional[float] = None
    currency: Optional[str] = None
    summary: Optional[str] = Field(default=None, max_length=300)
    accepts_remote: Optional[bool] = None
    accepts_hybrid: Optional[bool] = None
    accepts_onsite: Optional[bool] = None
    visible_in_talent_pool: Optional[bool] = None

    @field_validator("birth_date")
    @classmethod
    def _validar_fecha_de_nacimiento(cls, v: Optional[date]) -> Optional[date]:
        """Antes no se validaba nada y se podía declarar haber nacido en 2027.
        El tope del formulario no alcanza: se puede mandar el PATCH sin pasar por la UI."""
        if v is None:
            return v
        if v > date.today():
            raise ValueError("La fecha de nacimiento no puede ser futura.")
        if calculate_age(v) < MIN_CANDIDATE_AGE_YEARS:
            raise ValueError(f"Tenés que ser mayor de {MIN_CANDIDATE_AGE_YEARS} años para registrarte.")
        return v


class CandidateProfileResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    phone: str
    photo_url: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    has_own_transport: Optional[bool] = None
    availability: Optional[Availability] = None
    immediate_availability: Optional[bool] = None
    location_zone_id: Optional[uuid.UUID] = None
    expected_salary_min: Optional[float] = None
    expected_salary_max: Optional[float] = None
    currency: Optional[str] = None
    summary: Optional[str] = None
    cv_file_url: Optional[str] = None
    cv_uploaded_at: Optional[datetime] = None
    accepts_remote: bool
    accepts_hybrid: bool
    accepts_onsite: bool
    visible_in_talent_pool: bool = False
    talent_pool_asked_at: Optional[datetime] = None
    talent_pool_decided_at: Optional[datetime] = None
    completion_percent: int = 0
    missing_fields: List[ProfileMissingItem] = []

    class Config:
        from_attributes = True

class ExperienceBase(BaseModel):
    """Los campos, sin reglas.

    La respuesta hereda de acá y **no** de `ExperienceCreate` a propósito: las validaciones de
    fecha se agregaron en agosto/2026, y en la base ya había registros cargados antes con
    fechas futuras. Si el schema de salida las heredara, esos perfiles reventarían con un 500
    al abrirlos — se validan los datos que entran, no los que ya están guardados."""
    company_name: str
    role_title: str
    start_date: date
    # None = "trabajo actualmente acá". Es el único significado que tiene un fin vacío.
    end_date: Optional[date] = None
    description: Optional[str] = None


class ExperienceCreate(ExperienceBase):
    @field_validator("start_date", "end_date")
    @classmethod
    def _sin_futuro(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError("No se puede cargar una fecha futura.")
        return v

    @model_validator(mode="after")
    def _fin_despues_del_inicio(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio.")
        return self


class ExperienceResponse(ExperienceBase):
    id: uuid.UUID
    candidate_id: uuid.UUID

    class Config:
        from_attributes = True

class EducationBase(BaseModel):
    """Campos sin reglas — mismo motivo que `ExperienceBase`."""
    institution: str
    degree: str
    level: EducationLevel
    start_date: date
    end_date: Optional[date] = None
    status: EducationStatus = EducationStatus.graduado


class EducationCreate(EducationBase):
    @field_validator("start_date", "end_date")
    @classmethod
    def _sin_futuro(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError("No se puede cargar una fecha futura.")
        return v

    @model_validator(mode="after")
    def _coherencia_de_fechas(self):
        # "En curso" no lleva fecha de egreso: nada de fecha estimada a futuro (decisión de
        # Talency, 06/08/2026) — es un dato que nadie vuelve a actualizar cuando se recibe.
        if self.status == EducationStatus.en_curso and self.end_date:
            raise ValueError("Si está en curso, no corresponde cargar fecha de fin.")
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("La fecha de fin no puede ser anterior a la de inicio.")
        return self

class EducationResponse(EducationBase):
    id: uuid.UUID
    candidate_id: uuid.UUID

    class Config:
        from_attributes = True

class CandidateSkillItem(BaseModel):
    skill_id: uuid.UUID
    skill_name: str
    slug: str
    category: SkillCategory


class CandidateSkillsUpdate(BaseModel):
    """La selección completa, no un alta suelta — el tope de 6 por grupo sólo se puede validar
    mirando el conjunto entero (ver PUT /me/candidate/skills)."""
    skill_ids: List[uuid.UUID] = []
    other_skill: Optional[str] = Field(default=None, max_length=OTHER_SKILL_MAX_LENGTH)


class CandidateSkillsResponse(BaseModel):
    soft: List[CandidateSkillItem] = []
    technical: List[CandidateSkillItem] = []
    other_skill: Optional[str] = None

class LanguageCreate(BaseModel):
    language_name: str
    level: LanguageLevel

class LanguageResponse(LanguageCreate):
    id: uuid.UUID
    candidate_id: uuid.UUID

    class Config:
        from_attributes = True

# ── Vista completa para empresas (solo candidatos que se postularon) ──────────

class ExperienceForCompany(BaseModel):
    company_name: str
    role_title: str
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True

class EducationForCompany(BaseModel):
    institution: str
    degree: str
    level: str
    start_date: date
    end_date: Optional[date] = None
    status: str

    class Config:
        from_attributes = True

class SkillForCompany(BaseModel):
    skill_name: str
    category: SkillCategory

class LanguageForCompany(BaseModel):
    language_name: str
    level: str

    class Config:
        from_attributes = True

class CandidateFullProfile(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    phone: str
    summary: Optional[str] = None
    cv_file_url: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    has_own_transport: Optional[bool] = None
    availability: Optional[Availability] = None
    immediate_availability: Optional[bool] = None
    completion_percent: int = 0
    accepts_remote: bool
    accepts_hybrid: bool
    accepts_onsite: bool
    experience: List[ExperienceForCompany]
    education: List[EducationForCompany]
    skills: List[SkillForCompany]
    other_skill: Optional[str] = None
    languages: List[LanguageForCompany]
