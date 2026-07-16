"""add_candidate_completion_reminder

Revision ID: e1a9c7d4f2b8
Revises: c8f4b2a1d9e3
Create Date: 2026-07-15 00:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e1a9c7d4f2b8'
down_revision: Union[str, None] = 'c8f4b2a1d9e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'candidate_profiles',
        sa.Column('last_completion_reminder_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('candidate_profiles', 'last_completion_reminder_at')
