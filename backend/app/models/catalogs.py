import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin
import uuid

class Industry(UUIDMixin, Base):
    __tablename__ = "industries"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class Zone(UUIDMixin, Base):
    __tablename__ = "zones"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class ContractType(UUIDMixin, Base):
    __tablename__ = "contract_types"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

class SkillCategory(str, enum.Enum):
    """Los dos grupos que pidió Eugenia. El candidato elige hasta 6 de cada uno."""
    soft = "soft"
    technical = "technical"


# Habilidades con comportamiento especial en la UI. Se identifican por slug y no por nombre
# porque el nombre lo puede editar Talency desde la base sin romper nada.
SKILL_SLUG_IDIOMAS = "idiomas"   # al elegirla se abre el selector de idioma + nivel
SKILL_SLUG_OTRA = "otra"         # al elegirla se habilita un texto libre


class Skill(UUIDMixin, Base):
    """Catálogo cerrado, curado por Talency. No hay sugerencias de usuarios: el flujo de
    "sugerir habilidad → aprobar" se eliminó en agosto/2026 (la pantalla del admin ya no
    existía desde julio y su notificación llevaba a un 404)."""
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    category: Mapped[SkillCategory] = mapped_column(String(50), nullable=False)

    # Orden con el que se muestran dentro de su grupo — respeta el orden en que Eugenia las
    # escribió, que no es alfabético y agrupa por afinidad (administración, depósito, oficios).
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
