"""add_candidate_availability_fields

Revision ID: c8f4b2a1d9e3
Revises: d3f8a1c6e9b7
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c8f4b2a1d9e3'
down_revision: Union[str, None] = 'd3f8a1c6e9b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('candidate_profiles', sa.Column('has_own_transport', sa.Boolean(), nullable=True))
    op.add_column('candidate_profiles', sa.Column('availability', sa.String(length=50), nullable=True))
    op.add_column('candidate_profiles', sa.Column('immediate_availability', sa.Boolean(), nullable=True))
    # gender ya existía como String(50) libre — se normaliza a nivel aplicación (enum Gender),
    # sin backfill: valores previos no coincidentes simplemente quedan sin match en filtros.


def downgrade() -> None:
    op.drop_column('candidate_profiles', 'immediate_availability')
    op.drop_column('candidate_profiles', 'availability')
    op.drop_column('candidate_profiles', 'has_own_transport')
