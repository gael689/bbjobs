"""Mails: cola de envío, plantillas editables, preferencias, bajas y campañas.

Ver MODULOS-MAILS-IA-PLAN.md §4.A. Una fila de `email_outbox` es un mail a una persona: sirve a
la vez de cola (mientras está `pending`) y de historial (después), y es de donde salen las
métricas de las campañas.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin


class EmailCategory(str, enum.Enum):
    """Agrupa los mails según si el usuario puede apagarlos (ver `ALWAYS_SENT`)."""
    cuenta = "cuenta"                    # verificación de empresa, pagos — llegan siempre
    postulaciones = "postulaciones"      # estado de postulaciones, postulaciones nuevas
    busquedas = "busquedas"              # ciclo de vida de las búsquedas de una empresa
    alertas = "alertas"                  # alertas de empleo y resumen semanal
    recordatorios = "recordatorios"      # perfil incompleto, búsqueda por vencer
    novedades = "novedades"              # campañas de Talency
    admin = "admin"                      # avisos para el equipo de Talency
    # Mails a empresas que todavía no están en BBJobs. Salen por otro canal (API key y
    # subdominio propios: services/email/prospect_sender.py), nunca por la cuenta de los avisos.
    prospeccion = "prospeccion"


# Los de la cuenta "llegan siempre" (PDF hoja 01): sin ellos una empresa no se entera de que la
# verificaron o de que su pago no entró.
ALWAYS_SENT = frozenset({EmailCategory.cuenta})


class EmailStatus(str, enum.Enum):
    pending = "pending"
    sending = "sending"      # reclamado por un dispatcher; vuelve a `pending` si éste se muere
    sent = "sent"
    failed = "failed"
    skipped = "skipped"      # no se mandó a propósito (sin cuenta, interruptor apagado, baja…)
    canceled = "canceled"


class EmailOutbox(UUIDMixin, Base):
    __tablename__ = "email_outbox"

    # SET NULL y no CASCADE: el historial de campañas (cuántos se mandaron, cuántos abrieron)
    # tiene que sobrevivir a que un usuario se borre. El mail y el contenido sí se borran en
    # `account_deletion` — acá sólo se suelta la referencia.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    template_key: Mapped[str] = mapped_column(String(80), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    html: Mapped[str] = mapped_column(Text, nullable=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=EmailStatus.pending.value)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    # Evita encolar dos veces el mismo aviso (ej. "vence pronto" de la misma búsqueda).
    dedupe_key: Mapped[str | None] = mapped_column(String(200), nullable=True, unique=True)
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("email_campaigns.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Entidad del aviso (postulación, búsqueda…), sin FK porque varía según el tipo. Sirve para
    # revalidar al enviar (ver `services/email/catalog.py`, `still_valid`).
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Mails de prospección: a quién (los prospectos no son usuarios) y qué toque es (1, 2, 3).
    prospect_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("prospects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    touch: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bounced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    complained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        # Lo que consulta el dispatcher en cada vuelta.
        Index("ix_email_outbox_status_scheduled", "status", "scheduled_at"),
    )


class EmailTemplate(UUIDMixin, Base):
    """Lo que Talency edita desde su panel: encender/apagar cada aviso y pisar su texto.

    La fila **no existe** hasta que alguien toca algo; mientras tanto vale el default del código
    (`services/email/catalog.py`). Así agregar un aviso nuevo no necesita una migración de datos."""
    __tablename__ = "email_templates"

    key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    subject_override: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class EmailPreference(UUIDMixin, Base):
    """Una fila por (usuario, categoría) que el usuario eligió. Si no hay fila, recibe."""
    __tablename__ = "email_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (UniqueConstraint("user_id", "category", name="uq_email_pref_user_category"),)


class EmailSuppression(UUIDMixin, Base):
    """Direcciones a las que no se le escribe más: rebote duro o queja de spam.

    Seguir escribiéndole a quien marcó spam es la forma más rápida de que Resend suspenda la
    cuenta de Talency. No depende de `users`: una dirección puede rebotar después de que la
    cuenta se haya borrado, y la supresión tiene que sobrevivir."""
    __tablename__ = "email_suppressions"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    reason: Mapped[str] = mapped_column(String(30), nullable=False)  # bounced | complained
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    sending = "sending"
    sent = "sent"
    canceled = "canceled"


class EmailCampaign(UUIDMixin, Base):
    __tablename__ = "email_campaigns"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    preheader: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Texto plano con saltos de línea y {{variables}}: sin HTML libre, para que nadie pueda
    # romper el layout ni colar un script en un mail que sale a toda la base.
    body: Mapped[str] = mapped_column(Text, nullable=False)
    cta_label: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cta_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # {"role": "candidate"|"company", "industry_id"?, "zone_id"?, "never_published"?, ...}
    audience: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default=CampaignStatus.draft.value)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recipients_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # users (ofertas a quienes ya están en BBJobs) | prospects (empresas que todavía no)
    target: Mapped[str] = mapped_column(String(20), nullable=False, default="users")
    audience_key: Mapped[str | None] = mapped_column(String(60), nullable=True)
    product: Mapped[str | None] = mapped_column(String(40), nullable=True)
    approved_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Sólo prospectos: [{"after_days": 7, "subject": "...", "body": "..."}, ...] (máximo 2).
    follow_ups: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    conversions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    conversions_measured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generated_by_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class EmailDigestState(UUIDMixin, Base):
    """Última vez que se le mandó a alguien un resumen (diario de postulaciones, semanal…).
    Dice desde cuándo contar lo nuevo en el próximo."""
    __tablename__ = "email_digest_state"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    last_sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "kind", name="uq_email_digest_user_kind"),)
