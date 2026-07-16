"""add_job_expiring_soon_notified

Revision ID: b4c7e1a9f3d6
Revises: d5e8f3a7c2b1
Create Date: 2026-07-15 04:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b4c7e1a9f3d6'
down_revision: Union[str, None] = 'd5e8f3a7c2b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'job_postings',
        sa.Column('expiring_soon_notified_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('job_postings', 'expiring_soon_notified_at')
