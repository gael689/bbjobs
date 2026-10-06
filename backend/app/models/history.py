import uuid
from datetime import datetime
from sqlalchemy import Boolean, CheckConstraint, String, DateTime, ForeignKey, Text, false
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin


class ApplicationStatusHistory(UUIDMixin, Base):
    __tablename__ = "application_status_history"

    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_status: Mapped[str] = mapped_column(String(50), nullable=False)
    # Quién generó el cambio — la empresa al mover el estado, o None cuando lo dispara el
    # candidato al postularse (primer registro, from_status=None -> "new").
    changed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # True cuando el cambio lo hizo la plataforma sola: hoy, el paso a "Perfil revisado" al
    # abrir la empresa el perfil o el CV (services/application_events.py::mark_seen).
    automatico: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ApplicationNote(UUIDMixin, Base):
    """Nota de la empresa sobre una postulación. Privada salvo que la empresa la marque.

    No se edita: una privada no puede volverse visible (evita mostrar algo escrito pensando que
    era interno) y una visible ya la pudo leer el postulante. Sólo se borra (lógico).
    Las privadas no salen por ningún endpoint de candidato **ni de admin** (decisión de
    Talency, 06/10/2026): las lee únicamente la empresa que las escribió."""
    __tablename__ = "application_notes"
    __table_args__ = (
        CheckConstraint("body IS NULL OR char_length(body) <= 1000", name="ck_application_notes_body_len"),
    )

    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Redundante con la búsqueda a propósito: el filtro por empresa no depende de un JOIN.
    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("company_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # NULL sólo después del borrado de cuenta del candidato (services/account_deletion.py).
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    visible_to_candidate: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
    # El estado con el que se escribió, si fue junto a un cambio de estado.
    status_at_time: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CandidateActivityLog(UUIDMixin, Base):
    __tablename__ = "candidate_activity_log"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
