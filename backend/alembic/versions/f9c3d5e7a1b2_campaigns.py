"""Campañas: a usuarios (ofertas) y a prospectos, con aprobación y medición de conversión

- `email_campaigns`: destino (`users` | `prospects`), audiencia predefinida, producto ofrecido,
  quién la aprobó, seguimientos (sólo prospectos) y conversiones medidas.
- `email_outbox`: `prospect_id` (los prospectos no son usuarios) y número de toque.

Ver PROSPECCION-Y-CAMPANAS-DE-OFERTA-PLAN.md §5–§6 y la v4 §4.5.

Revision ID: f9c3d5e7a1b2
Revises: e8b2c4d6f1a3
Create Date: 2026-10-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "f9c3d5e7a1b2"
down_revision: Union[str, None] = "e8b2c4d6f1a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("email_campaigns", sa.Column("target", sa.String(20), nullable=False, server_default="users"))
    op.add_column("email_campaigns", sa.Column("audience_key", sa.String(60), nullable=True))
    op.add_column("email_campaigns", sa.Column("product", sa.String(40), nullable=True))
    op.add_column("email_campaigns", sa.Column("approved_by_admin_id", UUID(as_uuid=True),
                                               sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("email_campaigns", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("email_campaigns", sa.Column("follow_ups", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column("email_campaigns", sa.Column("conversions", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("email_campaigns", sa.Column("conversions_measured_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("email_campaigns", sa.Column("generated_by_ai", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_check_constraint("ck_email_campaigns_target", "email_campaigns", "target IN ('users','prospects')")

    op.add_column("email_outbox", sa.Column("prospect_id", UUID(as_uuid=True),
                                            sa.ForeignKey("prospects.id", ondelete="SET NULL"), nullable=True))
    op.add_column("email_outbox", sa.Column("touch", sa.SmallInteger(), nullable=False, server_default="1"))
    op.create_index("ix_email_outbox_prospect_id", "email_outbox", ["prospect_id"])


def downgrade() -> None:
    op.drop_index("ix_email_outbox_prospect_id", table_name="email_outbox")
    op.drop_column("email_outbox", "touch")
    op.drop_column("email_outbox", "prospect_id")
    op.drop_constraint("ck_email_campaigns_target", "email_campaigns", type_="check")
    for col in ("generated_by_ai", "conversions_measured_at", "conversions", "follow_ups", "approved_at",
                "approved_by_admin_id", "product", "audience_key", "target"):
        op.drop_column("email_campaigns", col)
