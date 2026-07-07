from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid


class CandidateOnboarding(BaseModel):
    first_name: str
    last_name: str
    phone: str


class CompanyOnboarding(BaseModel):
    legal_name: str
    cuit: str
    industry_id: uuid.UUID
    province: Optional[str] = None
    city: Optional[str] = None
    employee_count: Optional[str] = None
    responsible_full_name: str
    responsible_phone: str
    responsible_email: EmailStr
    responsible_position: Optional[str] = None
    description: Optional[str] = None


class OnboardingResponse(BaseModel):
    role: str
