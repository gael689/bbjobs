"""add_notification_type_and_link

Revision ID: a7c3e0b1f4d2
Revises: f4a2b8c3d1e9
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a7c3e0b1f4d2'
down_revision: Union[str, None] = 'f4a2b8c3d1e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('notifications', sa.Column('type', sa.String(length=50), nullable=False, server_default='generic'))
    op.add_column('notifications', sa.Column('link', sa.String(length=500), nullable=True))
    op.create_index(
        'ix_notifications_user_unread',
        'notifications',
        ['user_id', 'is_read', 'created_at'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_notifications_user_unread', table_name='notifications')
    op.drop_column('notifications', 'link')
    op.drop_column('notifications', 'type')
