"""add_job_moderation

Revision ID: a2c9e4f1b6d3
Revises: f7b3d8a2c1e5
Create Date: 2026-07-15 02:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a2c9e4f1b6d3'
down_revision: Union[str, None] = 'f7b3d8a2c1e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'job_postings',
        sa.Column('moderation_status', sa.String(length=50), nullable=False, server_default='pending_review'),
    )
    op.add_column('job_postings', sa.Column('moderation_notes', sa.Text(), nullable=True))
    op.add_column(
        'job_postings',
        sa.Column('moderated_by_admin_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column('job_postings', sa.Column('moderated_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        'job_postings_moderated_by_admin_id_fkey', 'job_postings', 'users',
        ['moderated_by_admin_id'], ['id'], ondelete='SET NULL',
    )

    # Backfill crítico: a partir de ahora toda búsqueda NUEVA nace pending_review y no aparece
    # en el portal hasta que un admin la apruebe (barrera dura). Sin este backfill, las
    # búsquedas YA publicadas hoy quedarían con el default 'pending_review' y desaparecerían
    # del portal público de golpe con este mismo deploy.
    op.execute("UPDATE job_postings SET moderation_status = 'approved'")


def downgrade() -> None:
    op.drop_constraint('job_postings_moderated_by_admin_id_fkey', 'job_postings', type_='foreignkey')
    op.drop_column('job_postings', 'moderated_at')
    op.drop_column('job_postings', 'moderated_by_admin_id')
    op.drop_column('job_postings', 'moderation_notes')
    op.drop_column('job_postings', 'moderation_status')
