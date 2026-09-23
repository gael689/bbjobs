import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin


class ContactTopic(str, enum.Enum):
    general = "general"
    empresa = "empresa"


class ContactMessage(UUIDMixin, Base):
    __tablename__ = "contact_messages"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # phone sigue nullable en la base a propósito: los mensajes anteriores al 23/09/2026 no lo
    # tienen. La obligación vive en el schema de la API, que es la única entrada a esta tabla.
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    topic: Mapped[ContactTopic] = mapped_column(String(20), nullable=False, default=ContactTopic.general)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
