import enum
from datetime import datetime
from sqlalchemy import String, Boolean, Integer, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin


class LandingStatSource(str, enum.Enum):
    """De dónde sale el número que se muestra en la landing.

    `manual` usa el texto de `value` tal cual (para indicadores estáticos tipo
    "Bahía Blanca y la zona"). El resto se calcula contra la base en cada request —
    Eugenia no tiene que actualizar nada a mano."""
    manual = "manual"
    active_jobs = "active_jobs"
    verified_companies = "verified_companies"
    registered_candidates = "registered_candidates"
    total_applications = "total_applications"


class LandingStat(UUIDMixin, Base):
    __tablename__ = "landing_stats"

    icon: Mapped[str] = mapped_column(String(50), nullable=False, default="BriefcaseIcon")
    source: Mapped[LandingStatSource] = mapped_column(
        Enum(LandingStatSource, name="landingstatsource"),
        nullable=False,
        default=LandingStatSource.manual,
    )
    # Sólo se usa cuando source == manual. En los calculados queda como fallback si la
    # query falla, para no romper la landing entera por un indicador.
    value: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Pedido explícito de Eugenia: "si alguno aparece en cero tendría que tener opción de
    # no mostrarlo". Sólo aplica a los calculados — un manual nunca "vale" cero.
    hide_when_zero: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
