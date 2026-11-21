"""Respuestas entrantes (`email_replies`) y tipo de rebote (`email_outbox.bounce_permanent`)

- `email_replies`: lo que contesta una persona a un mail nuestro (Resend `email.received`). Sólo
  texto, sin adjuntos; se vacía a los 90 días y se borra con la cuenta.
- `email_outbox.bounce_permanent`: rebote duro vs. transitorio. Sólo el duro suprime la dirección
  y cuenta para el freno por salud.

Ver LANZAMIENTO-PLAN.md.

Revision ID: a1c3e5b7d9f2
Revises: f1b3d5e7a9c2
Create Date: 2026-11-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a1c3e5b7d9f2"
down_revision: Union[str, None] = "f1b3d5e7a9c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("email_outbox", sa.Column("bounce_permanent", sa.Boolean(), nullable=True))
    op.create_table(
        "email_replies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("provider_email_id", sa.String(100), nullable=False, unique=True),
        sa.Column("from_email", sa.String(255), nullable=False),
        sa.Column("to_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False, server_default=""),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("outbox_id", UUID(as_uuid=True), sa.ForeignKey("email_outbox.id", ondelete="SET NULL")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("prospect_id", UUID(as_uuid=True), sa.ForeignKey("prospects.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(20), nullable=False, server_default="nueva"),
        sa.Column("attended_at", sa.DateTime(timezone=True)),
        sa.Column("attended_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_email_replies_from_email", "email_replies", ["from_email"])
    op.create_index("ix_email_replies_user_id", "email_replies", ["user_id"])
    op.create_index("ix_email_replies_status_received", "email_replies", ["status", "received_at"])


def downgrade() -> None:
    op.drop_table("email_replies")
    op.drop_column("email_outbox", "bounce_permanent")
