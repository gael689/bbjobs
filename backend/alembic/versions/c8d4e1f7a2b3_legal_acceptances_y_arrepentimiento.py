"""Aceptación de términos y privacidad, y código de trámite del botón de arrepentimiento

- `legal_acceptances`: qué versión aceptó cada usuario y cuándo. Hasta acá nadie aceptaba nada
  al registrarse.
- `contact_messages.tracking_code`: el código que se le da a quien usa el botón de
  arrepentimiento (Disposición 954/2025). Los mensajes de contacto comunes no lo tienen.

Revision ID: c8d4e1f7a2b3
Revises: a7c3e9d2f514
Create Date: 2026-10-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "c8d4e1f7a2b3"
down_revision: Union[str, None] = "a7c3e9d2f514"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "legal_acceptances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document", sa.String(20), nullable=False),
        sa.Column("version", sa.String(10), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(300), nullable=True),
        sa.UniqueConstraint("user_id", "document", "version", name="uq_legal_acceptances_user_doc_version"),
    )
    op.create_index("ix_legal_acceptances_user_id", "legal_acceptances", ["user_id"])
    op.add_column("contact_messages", sa.Column("tracking_code", sa.String(20), nullable=True))
    op.create_index("ix_contact_messages_tracking_code", "contact_messages", ["tracking_code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_contact_messages_tracking_code", table_name="contact_messages")
    op.drop_column("contact_messages", "tracking_code")
    op.drop_index("ix_legal_acceptances_user_id", table_name="legal_acceptances")
    op.drop_table("legal_acceptances")
