"""Prospección: empresas que todavía no están en BBJobs, para que Talency les ofrezca sus
servicios y las invite al portal (PROSPECCION-Y-CAMPANAS-DE-OFERTA-PLAN.md).

Las empresas llegan desde la base de `leadgen` de Gael, que el centro **empuja** por un endpoint
firmado. BBJobs nunca lee esa base. Lo que hace Talency (etapas, notas) vive sólo acá.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin


class ProspectStage(str, enum.Enum):
    nueva = "nueva"
    contactada = "contactada"
    respondio = "respondio"
    reunion = "reunion"
    cliente = "cliente"          # contrató selección de personal u otro servicio de Talency
    registrada = "registrada"    # se dio de alta en BBJobs (automático)
    descartada = "descartada"


class Prospect(UUIDMixin, Base):
    __tablename__ = "prospects"
    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_prospects_source_external"),
        Index("ix_prospects_stage", "stage"),
        Index("ix_prospects_phone_key", "phone_key"),
        Index("ix_prospects_domain", "domain"),
    )

    source: Mapped[str] = mapped_column(String(30), nullable=False, default="leadgen")
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)  # place_id de Google

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    locality: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    instagram: Mapped[str | None] = mapped_column(String(500), nullable=True)
    facebook: Mapped[str | None] = mapped_column(String(500), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Claves para cruzar con las empresas registradas y para no duplicar.
    phone_key: Mapped[str | None] = mapped_column(String(20), nullable=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)

    stage: Mapped[str] = mapped_column(String(20), nullable=False, default=ProspectStage.nueva.value)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    company_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("company_profiles.id", ondelete="SET NULL"), nullable=True
    )
    do_not_contact: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    do_not_contact_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)

    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ProspectEmail(UUIDMixin, Base):
    __tablename__ = "prospect_emails"
    __table_args__ = (UniqueConstraint("prospect_id", "email", name="uq_prospect_emails_prospect_email"),)

    prospect_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)  # siempre en minúsculas
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mx_valid: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class ProspectEvent(UUIDMixin, Base):
    """Historial de cada empresa: de acá sale el seguimiento."""
    __tablename__ = "prospect_events"

    prospect_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # sincronizada | etapa | nota | whatsapp | llamada | mail_enviado | respuesta | registrada | baja
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ProspectSync(UUIDMixin, Base):
    """Un lote recibido del centro. `sync_id` hace idempotente el reintento de un lote."""
    __tablename__ = "prospect_syncs"

    sync_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    received: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    discarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    suppressed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    discarded_reasons: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
