from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid


class CandidateOnboarding(BaseModel):
    first_name: str
    last_name: str
    phone: str
    # Casilla de la Base de Talento del registro — desactivada por defecto, igual que en el UI.
    visible_in_talent_pool: bool = False


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
