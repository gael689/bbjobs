from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional
from datetime import datetime
import uuid
from app.models.company import VerificationStatus

class CompanyProfileUpdate(BaseModel):
    legal_name: Optional[str] = None
    industry_id: Optional[uuid.UUID] = None
    province: Optional[str] = None
    city: Optional[str] = None
    employee_count: Optional[str] = None
    responsible_full_name: Optional[str] = None
    responsible_phone: Optional[str] = None
    responsible_position: Optional[str] = None
    website: Optional[HttpUrl] = None
    description: Optional[str] = None

    @field_validator("website", mode="before")
    @classmethod
    def _add_scheme(cls, v):
        # La gente escribe "tuempresa.com.ar" sin protocolo — HttpUrl lo rechaza (422)
        # si no arranca con http(s)://. Se lo agregamos antes de validar.
        if isinstance(v, str) and v and not v.startswith(("http://", "https://")):
            return f"https://{v}"
        return v

class CompanyProfileResponse(BaseModel):
    id: uuid.UUID
    legal_name: str
    cuit: str
    industry_id: uuid.UUID
    province: Optional[str] = None
    city: Optional[str] = None
    employee_count: Optional[str] = None
    responsible_full_name: str
    responsible_phone: str
    responsible_email: str
    responsible_position: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    verification_status: VerificationStatus
    verified_at: Optional[datetime] = None
    is_anonymized: bool

    class Config:
        from_attributes = True

class VerificationRequestModel(BaseModel):
    notes: Optional[str] = None
