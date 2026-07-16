"""job_company_fk_cascade

Revision ID: d3f8a1c6e9b7
Revises: a7c1e9d4b2f6
Create Date: 2026-07-08 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'd3f8a1c6e9b7'
down_revision: Union[str, None] = 'a7c1e9d4b2f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('job_postings_company_id_fkey', 'job_postings', type_='foreignkey')
    op.create_foreign_key(
        'job_postings_company_id_fkey', 'job_postings', 'company_profiles',
        ['company_id'], ['id'], ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('job_postings_company_id_fkey', 'job_postings', type_='foreignkey')
    op.create_foreign_key(
        'job_postings_company_id_fkey', 'job_postings', 'company_profiles',
        ['company_id'], ['id'], ondelete='SET NULL',
    )
