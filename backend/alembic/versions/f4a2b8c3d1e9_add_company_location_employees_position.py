"""add_company_location_employees_position

Revision ID: f4a2b8c3d1e9
Revises: c40ee9c5dca9
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'f4a2b8c3d1e9'
down_revision: Union[str, None] = 'c40ee9c5dca9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('company_profiles', sa.Column('province', sa.String(100), nullable=True))
    op.add_column('company_profiles', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('company_profiles', sa.Column('employee_count', sa.String(20), nullable=True))
    op.add_column('company_profiles', sa.Column('responsible_position', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('company_profiles', 'responsible_position')
    op.drop_column('company_profiles', 'employee_count')
    op.drop_column('company_profiles', 'city')
    op.drop_column('company_profiles', 'province')
