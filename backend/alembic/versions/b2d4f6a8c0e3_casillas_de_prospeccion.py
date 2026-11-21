"""Casillas de prospección (`email_mailboxes`) y `email_outbox.from_email`

Cada casilla tiene su tope diario y su historial de salud; el mail guarda desde cuál salió.

Revision ID: b2d4f6a8c0e3
Revises: a1c3e5b7d9f2
Create Date: 2026-11-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "b2d4f6a8c0e3"
down_revision: Union[str, None] = "a1c3e5b7d9f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("email_outbox", sa.Column("from_email", sa.String(255), nullable=True))
    op.create_index("ix_email_outbox_from_email", "email_outbox", ["from_email"])
    op.create_table(
        "email_mailboxes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("address", sa.String(255), nullable=False, unique=True),
        sa.Column("display_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("daily_limit", sa.Integer(), nullable=False, server_default="40"),
        sa.Column("status", sa.String(20), nullable=False, server_default="activa"),
        sa.Column("status_reason", sa.String(300)),
        sa.Column("health_since", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_check_constraint("ck_email_mailboxes_status", "email_mailboxes",
                               "status IN ('activa','pausada','inactiva')")


def downgrade() -> None:
    op.drop_table("email_mailboxes")
    op.drop_index("ix_email_outbox_from_email", table_name="email_outbox")
    op.drop_column("email_outbox", "from_email")
