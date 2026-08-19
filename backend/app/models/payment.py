import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base, UUIDMixin
import uuid

class Plan(UUIDMixin, Base):
    __tablename__ = "plans"

    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False) # free, pro, premium
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    monthly_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="ARS")
    
    max_active_job_postings: Mapped[int | None] = mapped_column(nullable=True)
    max_visible_applications_per_posting: Mapped[int | None] = mapped_column(nullable=True)
    
    includes_psychometric_results: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    includes_observatory_full: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    included_featured_per_month: Mapped[int] = mapped_column(default=0, nullable=False)
    
    features_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class SubscriptionStatus(str, enum.Enum):
    active = "active"
    past_due = "past_due"
    canceled = "canceled"
    expired = "expired"

class Subscription(UUIDMixin, Base):
    __tablename__ = "subscriptions"

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("company_profiles.id", ondelete="CASCADE"), unique=True, nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    
    status: Mapped[SubscriptionStatus] = mapped_column(String(50), default=SubscriptionStatus.active, nullable=False)
    
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    mp_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class JobFeatureStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    active = "active"
    expired = "expired"
    canceled = "canceled"

class JobFeature(UUIDMixin, Base):
    __tablename__ = "job_features"

    job_posting_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    payment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("payments.id", ondelete="SET NULL", use_alter=True, name="fk_job_features_payment_id"),
        nullable=True,
    )
    
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    status: Mapped[JobFeatureStatus] = mapped_column(String(50), default=JobFeatureStatus.pending_payment, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class TalentPackStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    active = "active"
    exhausted = "exhausted"
    canceled = "canceled"


class TalentCreditPack(UUIDMixin, Base):
    """Pack de créditos para desbloquear perfiles de la Base de Talento.

    Se compra igual que un destacado: pago único por Mercado Pago. `exhausted` no se calcula
    solo — lo setea el endpoint de desbloqueo cuando consume el último crédito, para que el
    estado sea consultable sin contar filas.

    Los créditos **usados** NO se guardan acá: se cuentan desde `talent_unlocks`. Un contador
    se desincroniza en cuanto haya un borrado o un rollback; las filas son la fuente de verdad.
    """

    __tablename__ = "talent_credit_packs"

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("company_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credits_total: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[TalentPackStatus] = mapped_column(
        String(50), default=TalentPackStatus.pending_payment, nullable=False
    )

    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # NULL = no vence. Se deja la columna desde el día uno para que poner un plazo más adelante
    # sea cambiar un valor y no migrar la tabla (ver P3 del plan).
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Pack regalado por Talency (canje, prueba, compensación) — nace `active` y sin Payment.
    # Existe por el mismo motivo que el destacado manual de admin.py: si no está previsto,
    # termina cargándose a mano en la base.
    granted_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TalentUnlock(UUIDMixin, Base):
    """Un candidato desbloqueado por una empresa. Consume un crédito del pack.

    El UNIQUE (company_id, candidate_id) es lo que hace que desbloquear dos veces al mismo
    candidato sea gratis: sin él, volver a entrar a un perfil ya pagado descontaría otro
    crédito. Es el reclamo más previsible de todo el módulo.
    """

    __tablename__ = "talent_unlocks"
    __table_args__ = (
        UniqueConstraint("company_id", "candidate_id", name="uq_talent_unlocks_company_candidate"),
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("company_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pack_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("talent_credit_packs.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PaymentType(str, enum.Enum):
    subscription = "subscription"
    job_feature = "job_feature"
    talent_pack = "talent_pack"

class Payment(UUIDMixin, Base):
    __tablename__ = "payments"

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("company_profiles.id", ondelete="RESTRICT"), nullable=False)
    type: Mapped[PaymentType] = mapped_column(String(50), nullable=False)
    
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    
    mp_payment_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    mp_preference_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mp_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    related_subscription_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True)
    related_job_feature_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("job_features.id", ondelete="SET NULL"), nullable=True)
    related_talent_pack_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("talent_credit_packs.id", ondelete="SET NULL", use_alter=True, name="fk_payments_talent_pack_id"),
        nullable=True,
    )
    
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class MercadoPagoWebhookEvent(UUIDMixin, Base):
    __tablename__ = "mp_webhook_events"

    mp_event_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    topic: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
