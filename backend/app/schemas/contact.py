from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import uuid
from app.models.contact import ContactTopic


class ContactMessageCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    company_name: Optional[str] = None
    topic: ContactTopic = ContactTopic.general
    message: str


class ContactMessageResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    topic: ContactTopic
    message: str
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True
