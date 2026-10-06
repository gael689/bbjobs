import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Literal, Optional
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

    @field_validator("topic")
    @classmethod
    def no_arrepentimiento(cls, v: ContactTopic) -> ContactTopic:
        # Ese tema sólo entra por /contact/arrepentimiento, que es el que da el código de trámite.
        if v == ContactTopic.arrepentimiento:
            raise ValueError("Para arrepentirte de una compra usá el botón de arrepentimiento")
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


class ArrepentimientoCreate(BaseModel):
    """Botón de arrepentimiento (Ley 24.240 art. 34, Disposición 954/2025): sin login, con lo
    mínimo para encontrar la compra. El mail es obligatorio: es por donde se le confirma."""
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=50)
    compra: Literal["destacado", "pack", "otro"]
    detalle: str = Field(min_length=3, max_length=500)
    comentario: Optional[str] = Field(default=None, max_length=1000)


class ArrepentimientoResponse(BaseModel):
    codigo: str
    recibido: datetime


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
    tracking_code: Optional[str] = None
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True
