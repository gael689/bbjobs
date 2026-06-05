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

class SkillStatus(str, enum.Enum):
    active = "active"
    pending = "pending"
    rejected = "rejected"
    merged = "merged"

class Skill(UUIDMixin, Base):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    status: Mapped[SkillStatus] = mapped_column(String(50), nullable=False, default=SkillStatus.pending)
    
    merged_into_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("skills.id", ondelete="SET NULL"), nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
