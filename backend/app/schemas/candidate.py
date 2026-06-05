from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import uuid
from app.models.candidate import EducationLevel, SkillLevel, LanguageLevel

class CandidateProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    location_zone_id: Optional[uuid.UUID] = None
    expected_salary_min: Optional[float] = None
    expected_salary_max: Optional[float] = None
    currency: Optional[str] = None
    summary: Optional[str] = None
    accepts_remote: Optional[bool] = None
    accepts_hybrid: Optional[bool] = None
    accepts_onsite: Optional[bool] = None

class CandidateProfileResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    phone: str
    photo_url: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
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
