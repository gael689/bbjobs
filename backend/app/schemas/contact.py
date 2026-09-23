import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
import uuid
from app.models.contact import ContactTopic

# Un teléfono argentino con característica tiene 10 dígitos; con menos de 8 no hay forma de
# devolver el llamado. Se cuentan sólo los dígitos: espacios, guiones y "+" se toleran.
MIN_PHONE_DIGITS = 8


class ContactMessageCreate(BaseModel):
    """Teléfono obligatorio y mail opcional desde el 23/09/2026: Eugenia responde por WhatsApp,
    y pedir el mail era un campo más que frenaba a quien sólo quería que lo llamen."""
    name: str
    phone: str
    email: Optional[EmailStr] = None
    company_name: Optional[str] = None
    topic: ContactTopic = ContactTopic.general
    message: str

    @field_validator("email", mode="before")
    @classmethod
    def empty_email_is_none(cls, v):
        # Un input vacío llega como "" y EmailStr lo rechazaría.
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 50:
            raise ValueError("El teléfono es demasiado largo")
        if len(re.sub(r"\D", "", v)) < MIN_PHONE_DIGITS:
            raise ValueError("Ingresá un teléfono válido, con característica")
        return v


class ContactMessageResponse(BaseModel):
    id: uuid.UUID
    name: str
    # Los dos opcionales en la respuesta: los mensajes nuevos pueden no tener mail y los
    # anteriores al 23/09/2026 pueden no tener teléfono.
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    topic: ContactTopic
    message: str
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True
