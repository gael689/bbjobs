"""Medición propia: tabla site_events

Eventos del sitio público (page_view, search, view_item, apply, sign_up, generate_lead,
publish_job) de quienes aceptaron "Medición" en el banner de cookies. Sin datos personales: ni IP,
ni user agent, ni user_id, ni Referer (sólo la categoría de origen calculada en el servidor).
`job_id` sin FK a propósito: borrar una búsqueda no rompe su historial. Ver app/models/metrics.py.

Índice compuesto (event, created_at): todas las consultas del panel filtran por evento y período.

Revision ID: a9e3f1c5b7d2
Revises: c7d1e5f9a2b4
Create Date: 2026-10-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a9e3f1c5b7d2"
down_revision: Union[str, None] = "c7d1e5f9a2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "site_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("event", sa.String(30), nullable=False),
        sa.Column("path", sa.String(300), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("search_term", sa.String(100), nullable=True),
        sa.Column("results", sa.Integer(), nullable=True),
        sa.Column("label", sa.String(30), nullable=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("device", sa.String(10), nullable=False),
        sa.Column("visitor_id", sa.String(36), nullable=True),
        sa.Column("session_id", sa.String(36), nullable=True),
    )
    op.create_index("ix_site_events_created_at", "site_events", ["created_at"])
    op.create_index("ix_site_events_event", "site_events", ["event"])
    op.create_index("ix_site_events_job_id", "site_events", ["job_id"])
    op.create_index("ix_site_events_event_created_at", "site_events", ["event", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_site_events_event_created_at", table_name="site_events")
    op.drop_index("ix_site_events_job_id", table_name="site_events")
    op.drop_index("ix_site_events_event", table_name="site_events")
    op.drop_index("ix_site_events_created_at", table_name="site_events")
    op.drop_table("site_events")
