import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin


class LegalAcceptance(UUIDMixin, Base):
    """Qué versión de los términos y de la privacidad aceptó cada usuario, y cuándo.

    Una fila por documento y versión. Al borrar la cuenta en lápida se conserva la fila (prueba de
    qué se aceptó) pero sin IP ni navegador; en el borrado completo cae por CASCADE."""
    __tablename__ = "legal_acceptances"
    __table_args__ = (UniqueConstraint("user_id", "document", "version", name="uq_legal_acceptances_user_doc_version"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document: Mapped[str] = mapped_column(String(20), nullable=False)
    version: Mapped[str] = mapped_column(String(10), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
