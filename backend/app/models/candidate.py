import enum
from datetime import date, datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin
import uuid

# Tope de habilidades por grupo — lo pidió Eugenia explícitamente ("que no le permita
# seleccionar más de 6 blandas ni más de 6 técnicas"). Se valida en el backend, no sólo en la UI.
MAX_SKILLS_PER_CATEGORY = 6

# Largo del texto libre de la habilidad "Otra".
OTHER_SKILL_MAX_LENGTH = 80

# Edad mínima para tener perfil de candidato (decisión de Talency, 06/08/2026).
# Antes no se validaba nada: se podía declarar una fecha de nacimiento futura.
MIN_CANDIDATE_AGE_YEARS = 18


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

    # Texto libre que se habilita al elegir la habilidad técnica "Otra". Corto a propósito:
    # es para nombrar un oficio que no está en el catálogo, no para una segunda descripción.
    other_skill: Mapped[str | None] = mapped_column(String(OTHER_SKILL_MAX_LENGTH), nullable=True)

    cv_file_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    cv_uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    accepts_remote: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    accepts_hybrid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    accepts_onsite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Base de Talento — consentimiento para que empresas con plan pago puedan encontrar el
    # perfil sin que el candidato se haya postulado a esa búsqueda. Es la base de un producto
    # cobrado, así que no alcanza con el booleano: hace falta poder demostrar *cuándo* se
    # preguntó y *cuándo* respondió qué. `asked_at` además evita volver a mostrar el aviso.
    visible_in_talent_pool: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    talent_pool_asked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    talent_pool_decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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

class EducationStatus(str, enum.Enum):
    """Cómo terminó (o no) ese estudio.

    Reemplazó al booleano `in_progress` en agosto/2026: Eugenia pidió poder distinguir
    "Abandonado" en las estadísticas de nivel educativo, y con un sí/no no se podía."""
    graduado = "graduado"
    en_curso = "en_curso"
    abandonado = "abandonado"


class Education(UUIDMixin, Base):
    __tablename__ = "educations"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)
    institution: Mapped[str] = mapped_column(String(255), nullable=False)
    degree: Mapped[str] = mapped_column(String(255), nullable=False)
    level: Mapped[EducationLevel] = mapped_column(String(50), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[EducationStatus] = mapped_column(String(50), default=EducationStatus.graduado, nullable=False)

class CandidateSkill(Base):
    """El candidato tilda la habilidad y listo — sin nivel.

    Tenía un nivel autoevaluado (básico → experto) que se eliminó en agosto/2026: declararse
    "experto en trabajo en equipo" no le sirve a nadie para decidir, y eran 12 selectores más
    en un formulario que se completa mayormente desde el celular."""
    __tablename__ = "candidate_skills"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)

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
