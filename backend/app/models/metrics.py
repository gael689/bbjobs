"""Medición propia del sitio público (panel de admin → "Métricas del sitio").

Una fila por evento del navegador, sólo de visitantes que aceptaron "Medición" en el banner de
cookies. **Nada personal**: ni IP, ni user agent completo, ni user_id, ni el Referer (el origen se
calcula en el servidor y se guarda sólo la categoría). `visitor_id` es un id aleatorio de la cookie
de primera parte `bbjobs_vid`, que se borra al retirar el consentimiento.

`job_id` no tiene FK a propósito: borrar una búsqueda no tiene que romper ni arrastrar su historial
de vistas. Retención: 13 meses (tarea diaria en core/scheduler.py).
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin


class SiteEvent(UUIDMixin, Base):
    __tablename__ = "site_events"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    event: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # Ruta sin query string (la búsqueda se mide aparte con el evento `search`).
    path: Mapped[str] = mapped_column(String(300), nullable=False)
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    # Normalizado: minúsculas, sin tildes, espacios colapsados.
    search_term: Mapped[str | None] = mapped_column(String(100), nullable=True)
    results: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Detalle corto del evento: `method` de sign_up (candidato/empresa), `topic` de generate_lead.
    label: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # google | bing | redes | ia | directo | otro | interno
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    # mobile | desktop
    device: Mapped[str] = mapped_column(String(10), nullable=False)
    visitor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    __table_args__ = (Index("ix_site_events_event_created_at", "event", "created_at"),)
