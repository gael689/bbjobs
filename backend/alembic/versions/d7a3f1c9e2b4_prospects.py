"""Prospección: empresas sincronizadas desde leadgen, sus mails, su historial y los lotes

Ver PROSPECCION-Y-CAMPANAS-DE-OFERTA-PLAN.md §4.

Revision ID: d7a3f1c9e2b4
Revises: c5e1a9d3b7f2
Create Date: 2026-10-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "d7a3f1c9e2b4"
down_revision: Union[str, None] = "c5e1a9d3b7f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

STAGES = "('nueva','contactada','respondio','reunion','cliente','registrada','descartada')"


def _ts(name: str, **kw) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), **kw)


def upgrade() -> None:
    op.create_table(
        "prospects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(30), nullable=False, server_default="leadgen"),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(255), nullable=True),
        sa.Column("locality", sa.String(255), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("whatsapp", sa.String(50), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("instagram", sa.String(500), nullable=True),
        sa.Column("facebook", sa.String(500), nullable=True),
        sa.Column("linkedin", sa.String(500), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lng", sa.Float(), nullable=True),
        sa.Column("phone_key", sa.String(20), nullable=True),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("stage", sa.String(20), nullable=False, server_default="nueva"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("company_profile_id", UUID(as_uuid=True),
                  sa.ForeignKey("company_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("do_not_contact", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("do_not_contact_reason", sa.String(50), nullable=True),
        _ts("last_contacted_at", nullable=True),
        _ts("last_synced_at", nullable=True),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
        _ts("updated_at", nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("source", "external_id", name="uq_prospects_source_external"),
        sa.CheckConstraint(f"stage IN {STAGES}", name="ck_prospects_stage"),
    )
    op.create_index("ix_prospects_stage", "prospects", ["stage"])
    op.create_index("ix_prospects_phone_key", "prospects", ["phone_key"])
    op.create_index("ix_prospects_domain", "prospects", ["domain"])

    op.create_table(
        "prospect_emails",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("prospect_id", UUID(as_uuid=True), sa.ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("mx_valid", sa.Boolean(), nullable=True),
        sa.UniqueConstraint("prospect_id", "email", name="uq_prospect_emails_prospect_email"),
    )
    op.create_index("ix_prospect_emails_prospect_id", "prospect_emails", ["prospect_id"])
    op.create_index("ix_prospect_emails_email", "prospect_emails", ["email"])

    op.create_table(
        "prospect_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("prospect_id", UUID(as_uuid=True), sa.ForeignKey("prospects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("actor_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_prospect_events_prospect_id", "prospect_events", ["prospect_id"])

    op.create_table(
        "prospect_syncs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("sync_id", sa.String(100), nullable=False, unique=True),
        sa.Column("received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("discarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("suppressed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("discarded_reasons", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("prospect_syncs")
    op.drop_index("ix_prospect_events_prospect_id", table_name="prospect_events")
    op.drop_table("prospect_events")
    op.drop_index("ix_prospect_emails_email", table_name="prospect_emails")
    op.drop_index("ix_prospect_emails_prospect_id", table_name="prospect_emails")
    op.drop_table("prospect_emails")
    op.drop_index("ix_prospects_domain", table_name="prospects")
    op.drop_index("ix_prospects_phone_key", table_name="prospects")
    op.drop_index("ix_prospects_stage", table_name="prospects")
    op.drop_table("prospects")
