from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime
import uuid
from app.models.company import VerificationStatus

class CompanyProfileUpdate(BaseModel):
    legal_name: Optional[str] = None
    industry_id: Optional[uuid.UUID] = None
    responsible_full_name: Optional[str] = None
    responsible_phone: Optional[str] = None
    website: Optional[HttpUrl] = None
    description: Optional[str] = None

class CompanyProfileResponse(BaseModel):
    id: uuid.UUID
    legal_name: str
    cuit: str
    industry_id: uuid.UUID
    responsible_full_name: str
    responsible_phone: str
    responsible_email: str
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
