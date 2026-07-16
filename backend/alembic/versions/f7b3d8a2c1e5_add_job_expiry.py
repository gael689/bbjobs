"""add_job_expiry

Revision ID: f7b3d8a2c1e5
Revises: e1a9c7d4f2b8
Create Date: 2026-07-15 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f7b3d8a2c1e5'
down_revision: Union[str, None] = 'e1a9c7d4f2b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'job_postings',
        sa.Column('duration_days', sa.Integer(), nullable=False, server_default='20'),
    )
    op.add_column(
        'job_postings',
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )
    # Backfill crítico: sin esto, las búsquedas ya publicadas quedarían con expires_at NULL y
    # el scheduler nunca las vencería, pero además rompería cualquier UI que asuma expires_at
    # presente en jobs activos/pausados. 20 días desde su publicación real.
    op.execute(
        """
        UPDATE job_postings
        SET expires_at = published_at + INTERVAL '20 days'
        WHERE published_at IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column('job_postings', 'expires_at')
    op.drop_column('job_postings', 'duration_days')
