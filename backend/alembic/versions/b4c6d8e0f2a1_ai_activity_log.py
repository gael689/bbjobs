"""Centro de IA: registro de actividad de la IA (`ai_activity_log`)

Una fila por cosa que hizo la IA (lectura de CV, recálculo de recomendados, resumen, revisión de
moderación, sugerencia de habilidades, borradores) o que Talency lanzó a mano. Sólo ids, conteos
y montos: nada de texto del CV ni datos personales. `candidate_id` es SET NULL (borrado total) y
la lápida de `account_deletion.py` lo pone en NULL a mano.

Revision ID: b4c6d8e0f2a1
Revises: f2b3c4d5e6a7
Create Date: 2026-10-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "b4c6d8e0f2a1"
down_revision: Union[str, None] = "f2b3c4d5e6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_activity_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidate_profiles.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("company_profiles.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("detail", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        sa.Column("alert", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ai_activity_log_kind", "ai_activity_log", ["kind"])
    op.create_index("ix_ai_activity_log_job_id", "ai_activity_log", ["job_id"])
    op.create_index("ix_ai_activity_log_candidate_id", "ai_activity_log", ["candidate_id"])
    op.create_index("ix_ai_activity_log_created_at", "ai_activity_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_ai_activity_log_created_at", table_name="ai_activity_log")
    op.drop_index("ix_ai_activity_log_candidate_id", table_name="ai_activity_log")
    op.drop_index("ix_ai_activity_log_job_id", table_name="ai_activity_log")
    op.drop_index("ix_ai_activity_log_kind", table_name="ai_activity_log")
    op.drop_table("ai_activity_log")
