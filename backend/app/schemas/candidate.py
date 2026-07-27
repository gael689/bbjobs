from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
import uuid
from app.models.candidate import EducationLevel, SkillLevel, LanguageLevel, Gender, Availability


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
    completion_percent: int = 0
    missing_fields: List[ProfileMissingItem] = []

    class Config:
        from_attributes = True

class ExperienceCreate(BaseModel):
    company_name: str
    role_title: str
    start_date: date
    end_date: Optional[date] = None
    description: Optional[str] = None

class ExperienceResponse(ExperienceCreate):
    id: uuid.UUID
    candidate_id: uuid.UUID

    class Config:
        from_attributes = True

class EducationCreate(BaseModel):
    institution: str
    degree: str
    level: EducationLevel
    start_date: date
    end_date: Optional[date] = None
    in_progress: bool = False

class EducationResponse(EducationCreate):
    id: uuid.UUID
    candidate_id: uuid.UUID

    class Config:
        from_attributes = True

class CandidateSkillCreate(BaseModel):
    skill_id: uuid.UUID
    level: SkillLevel

class CandidateSkillResponse(BaseModel):
    skill_id: uuid.UUID
    level: SkillLevel

    class Config:
        from_attributes = True

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
    in_progress: bool

    class Config:
        from_attributes = True

class SkillForCompany(BaseModel):
    skill_name: str
    level: str

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
    languages: List[LanguageForCompany]
