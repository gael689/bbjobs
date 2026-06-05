from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
import uuid
from app.models.core import UserRole

class UserBase(BaseModel):
    email: EmailStr

class CandidateRegister(UserBase):
    password: str = Field(..., min_length=8)
    first_name: str
    last_name: str
    phone: str

class CompanyRegister(UserBase):
    password: str = Field(..., min_length=8)
    legal_name: str
    cuit: str
    industry_id: uuid.UUID
    responsible_full_name: str
    responsible_phone: str
    responsible_email: EmailStr

class UserLogin(UserBase):
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(UserBase):
    id: uuid.UUID
    role: UserRole
    is_active: bool
    email_verified_at: Optional[datetime]

    class Config:
        from_attributes = True

class RefreshTokenRequest(BaseModel):
    # Depending on implementation, token might come from cookie, but we define a schema just in case
    pass
