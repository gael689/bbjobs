import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin
import uuid
from app.models.candidate import EducationLevel

class JobPostingModality(str, enum.Enum):
    presencial = "presencial"
    remoto = "remoto"
    hibrido = "híbrido"

class JobPostingStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    paused = "paused"
    closed = "closed"
    expired = "expired"

class JobModerationStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved = "approved"
    rejected = "rejected"

class JobPosting(UUIDMixin, Base):
    __tablename__ = "job_postings"

    # CASCADE (no SET NULL): si se borra la empresa, sus búsquedas se borran con ella —
    # decisión de producto explícita, no dejar avisos huérfanos dando vueltas.
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("company_profiles.id", ondelete="CASCADE"), nullable=True)
    company_legal_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # El aviso completo en un solo campo. `requirements` se fusionó acá en agosto/2026
    # (migración c3e7b1d5a92f): la empresa escribe un texto y el portal lo muestra entero.
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    industry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("industries.id", ondelete="RESTRICT"), nullable=False)
    zone_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("zones.id", ondelete="RESTRICT"), nullable=False)
    contract_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contract_types.id", ondelete="RESTRICT"), nullable=False)
    
    modality: Mapped[JobPostingModality] = mapped_column(String(50), nullable=False)
    
    min_experience_years: Mapped[int | None] = mapped_column(nullable=True)
    min_education_level: Mapped[EducationLevel | None] = mapped_column(String(50), nullable=True)
    
    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    salary_currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    salary_visible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    benefits: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    status: Mapped[JobPostingStatus] = mapped_column(String(50), default=JobPostingStatus.draft, nullable=False)
    
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    featured_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Vencimiento — 20 días por defecto desde que se publica, la empresa puede reducirlo
    # (nunca ampliarlo más allá del máximo de producto). Se recalcula a partir de published_at
    # cada vez que se cambia duration_days (ver JobPostingUpdate).
    duration_days: Mapped[int] = mapped_column(default=20, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Throttle del aviso "vence en 3 días" — evita mandarlo de nuevo en cada corrida horaria del
    # scheduler una vez que ya se avisó (ver core/scheduler.py::notify_expiring_soon).
    expiring_soon_notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Moderación de Talency — ortogonal a `status` (ciclo de vida propio de la empresa).
    # Una búsqueda sólo es visible en el portal público si moderation_status == approved,
    # sin importar que status == active (barrera dura, ver jobs.py list_public_jobs).
    moderation_status: Mapped[JobModerationStatus] = mapped_column(
        String(50), default=JobModerationStatus.pending_review, nullable=False
    )
    moderation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    moderated_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class JobPostingSkill(Base):
    __tablename__ = "job_posting_skills"

    job_posting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class ApplicationStatus(str, enum.Enum):
    """El embudo de selección, en el orden que definió Talency.

    La columna es String(50) y no un ENUM de Postgres, así que sumar valores no necesita
    migración de tipo. `finalist` y `selected` se agregaron en agosto/2026; el resto sólo
    cambió de etiqueta en la UI (`seen` pasó a mostrarse como "Perfil revisado" y `discarded`
    como "No avanza"), sin tocar los datos ya guardados."""
    new = "new"                  # Nueva
    seen = "seen"                # Perfil revisado
    contacted = "contacted"      # Contactado
    in_process = "in_process"    # En proceso
    finalist = "finalist"        # Finalista
    selected = "selected"        # Seleccionado
    discarded = "discarded"      # No avanza

class Application(UUIDMixin, Base):
    __tablename__ = "applications"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)
    job_posting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ApplicationStatus] = mapped_column(String(50), default=ApplicationStatus.new, nullable=False)
    
    seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("candidate_id", "job_posting_id", name="uq_candidate_job_posting"),
    )
