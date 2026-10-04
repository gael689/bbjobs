"""Mails: cola de envío, plantillas, preferencias, bajas, campañas y frecuencia de alertas

Revision ID: b1e4c7a2d905
Revises: a7c3e9d2f514
Create Date: 2026-10-01 00:00:00.000000

Ver MODULOS-MAILS-IA-PLAN.md §4.A.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision: str = 'b1e4c7a2d905'
down_revision: Union[str, None] = 'a7c3e9d2f514'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts(name: str, **kw) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), **kw)


def upgrade() -> None:
    # Campañas primero: el outbox la referencia.
    op.create_table(
        'email_campaigns',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('subject', sa.String(300), nullable=False),
        sa.Column('preheader', sa.String(300), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('cta_label', sa.String(80), nullable=True),
        sa.Column('cta_url', sa.String(500), nullable=True),
        sa.Column('image_url', sa.String(500), nullable=True),
        sa.Column('audience', JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        _ts('scheduled_at', nullable=True),
        _ts('sent_at', nullable=True),
        sa.Column('recipients_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by_admin_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        _ts('created_at', nullable=False, server_default=sa.func.now()),
        _ts('updated_at', nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'email_outbox',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('to_email', sa.String(255), nullable=False),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('template_key', sa.String(80), nullable=False),
        sa.Column('subject', sa.String(500), nullable=False),
        sa.Column('html', sa.Text(), nullable=False),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('provider_message_id', sa.String(100), nullable=True),
        sa.Column('dedupe_key', sa.String(200), nullable=True, unique=True),
        sa.Column('campaign_id', UUID(as_uuid=True), sa.ForeignKey('email_campaigns.id', ondelete='CASCADE'), nullable=True),
        _ts('scheduled_at', nullable=False, server_default=sa.func.now()),
        _ts('claimed_at', nullable=True),
        _ts('sent_at', nullable=True),
        _ts('delivered_at', nullable=True),
        _ts('opened_at', nullable=True),
        _ts('clicked_at', nullable=True),
        _ts('bounced_at', nullable=True),
        _ts('complained_at', nullable=True),
        _ts('created_at', nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_email_outbox_user_id', 'email_outbox', ['user_id'])
    op.create_index('ix_email_outbox_provider_message_id', 'email_outbox', ['provider_message_id'])
    op.create_index('ix_email_outbox_campaign_id', 'email_outbox', ['campaign_id'])
    op.create_index('ix_email_outbox_status_scheduled', 'email_outbox', ['status', 'scheduled_at'])

    op.create_table(
        'email_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('key', sa.String(80), nullable=False, unique=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('subject_override', sa.String(500), nullable=True),
        sa.Column('body_override', sa.Text(), nullable=True),
        _ts('updated_at', nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'email_preferences',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        _ts('updated_at', nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'category', name='uq_email_pref_user_category'),
    )
    op.create_index('ix_email_preferences_user_id', 'email_preferences', ['user_id'])

    op.create_table(
        'email_suppressions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('reason', sa.String(30), nullable=False),
        _ts('created_at', nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'email_digest_state',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(40), nullable=False),
        _ts('last_sent_at', nullable=False),
        sa.UniqueConstraint('user_id', 'kind', name='uq_email_digest_user_kind'),
    )
    op.create_index('ix_email_digest_state_user_id', 'email_digest_state', ['user_id'])

    # Las alertas de empleo ya existían (sin ningún endpoint). Las filas viejas, si las hubiera,
    # quedan en `daily`, que es lo que promete el PDF por defecto.
    op.add_column('job_alerts', sa.Column('frequency', sa.String(10), nullable=False, server_default='daily'))


def downgrade() -> None:
    op.drop_column('job_alerts', 'frequency')
    op.drop_table('email_digest_state')
    op.drop_table('email_suppressions')
    op.drop_table('email_preferences')
    op.drop_table('email_templates')
    op.drop_table('email_outbox')
    op.drop_table('email_campaigns')
