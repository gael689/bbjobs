"""add_history_tables

Revision ID: d5e8f3a7c2b1
Revises: a2c9e4f1b6d3
Create Date: 2026-07-15 03:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd5e8f3a7c2b1'
down_revision: Union[str, None] = 'a2c9e4f1b6d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'application_status_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('from_status', sa.String(length=50), nullable=True),
        sa.Column('to_status', sa.String(length=50), nullable=False),
        sa.Column('changed_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index(
        'ix_application_status_history_application_id',
        'application_status_history', ['application_id'],
    )

    op.create_table(
        'candidate_activity_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidate_profiles.id'], ondelete='CASCADE'),
    )
    op.create_index(
        'ix_candidate_activity_log_candidate_id',
        'candidate_activity_log', ['candidate_id'],
    )
    # Sin backfill: tablas nuevas, vacías desde ahora — no hay historial retroactivo posible
    # para postulaciones/actividad que ya ocurrieron antes de este deploy.


def downgrade() -> None:
    op.drop_index('ix_candidate_activity_log_candidate_id', table_name='candidate_activity_log')
    op.drop_table('candidate_activity_log')
    op.drop_index('ix_application_status_history_application_id', table_name='application_status_history')
    op.drop_table('application_status_history')
