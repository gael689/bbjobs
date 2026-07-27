import enum
from datetime import date, datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin
import uuid

class Gender(str, enum.Enum):
    masculino = "masculino"
    femenino = "femenino"
    otro = "otro"
    no_declara = "no_declara"

class Availability(str, enum.Enum):
    full_time = "full_time"
    part_time = "part_time"
    ambos = "ambos"

class CandidateProfile(UUIDMixin, Base):
    __tablename__ = "candidate_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped["Gender | None"] = mapped_column(String(50), nullable=True)
    has_own_transport: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    availability: Mapped["Availability | None"] = mapped_column(String(50), nullable=True)
    immediate_availability: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    location_zone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("zones.id", ondelete="SET NULL"), nullable=True)
    
    expected_salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    expected_salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    cv_file_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    cv_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    accepts_remote: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    accepts_hybrid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    accepts_onsite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    visible_in_talent_pool: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Throttle del recordatorio "completá tu perfil" — evita mandar la notificación de nuevo
    # antes de que pase el intervalo mínimo (ver services/profile_completion.py).
    last_completion_reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Experience(UUIDMixin, Base):
    __tablename__ = "experiences"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role_title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

class EducationLevel(str, enum.Enum):
    secundario = "secundario"
    terciario = "terciario"
    universitario = "universitario"
    posgrado = "posgrado"

class Education(UUIDMixin, Base):
    __tablename__ = "educations"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)
    institution: Mapped[str] = mapped_column(String(255), nullable=False)
    degree: Mapped[str] = mapped_column(String(255), nullable=False)
    level: Mapped[EducationLevel] = mapped_column(String(50), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    in_progress: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

class SkillLevel(str, enum.Enum):
    basico = "básico"
    intermedio = "intermedio"
    avanzado = "avanzado"
    experto = "experto"

class CandidateSkill(Base):
    __tablename__ = "candidate_skills"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    level: Mapped[SkillLevel] = mapped_column(String(50), nullable=False)

class LanguageLevel(str, enum.Enum):
    basico = "básico"
    intermedio = "intermedio"
    avanzado = "avanzado"
    nativo = "nativo"

class Language(UUIDMixin, Base):
    __tablename__ = "languages"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)
    language_name: Mapped[str] = mapped_column(String(100), nullable=False)
    level: Mapped[LanguageLevel] = mapped_column(String(50), nullable=False)
