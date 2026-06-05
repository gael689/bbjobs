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

class JobPosting(UUIDMixin, Base):
    __tablename__ = "job_postings"

    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("company_profiles.id", ondelete="SET NULL"), nullable=True)
    company_legal_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[str] = mapped_column(Text, nullable=False)
    
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
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class JobPostingSkill(Base):
    __tablename__ = "job_posting_skills"

    job_posting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class ApplicationStatus(str, enum.Enum):
    new = "new"
    seen = "seen"
    in_process = "in_process"
    discarded = "discarded"
    contacted = "contacted"

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
