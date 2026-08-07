import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin


class SettingKey(str, enum.Enum):
    """Interruptores que maneja Talency desde su panel.

    La idea es que las estadísticas se construyan una sola vez y Eugenia decida **cuándo**
    publicarlas: hoy el portal tiene poco volumen y un gráfico con 3 postulantes dice más de
    esas 3 personas que del mercado. Cuando crezca, las prende sin que haya que tocar código.
    """
    # ¿El candidato ve los gráficos comparativos contra los demás postulantes de la vacante?
    stats_visibles_para_candidatos = "stats_visibles_para_candidatos"
    # ¿La home muestra el bloque público de estadísticas del mercado?
    stats_visibles_en_landing = "stats_visibles_en_landing"


# Apagados por defecto: se publican recién cuando Talency lo decide.
SETTING_DEFAULTS: dict[SettingKey, bool] = {
    SettingKey.stats_visibles_para_candidatos: False,
    SettingKey.stats_visibles_en_landing: False,
}


class SiteSetting(UUIDMixin, Base):
    """Un interruptor on/off del sitio.

    Tabla clave-valor a propósito y no columnas fijas: son decisiones de producto que Talency
    prende y apaga, y agregar una no debería costar una migración.
    """
    __tablename__ = "site_settings"

    key: Mapped[SettingKey] = mapped_column(String(100), unique=True, index=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
