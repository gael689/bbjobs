"""add_clerk_user_id

Revision ID: b3f2d5c9e1a4
Revises: a7c3e0b1f4d2
Create Date: 2026-07-06 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b3f2d5c9e1a4'
down_revision: Union[str, None] = 'a7c3e0b1f4d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('clerk_user_id', sa.String(length=255), nullable=True))
    op.create_index('ix_users_clerk_user_id', 'users', ['clerk_user_id'], unique=True)
    op.alter_column('users', 'password_hash', existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'password_hash', existing_type=sa.String(length=255), nullable=False)
    op.drop_index('ix_users_clerk_user_id', table_name='users')
    op.drop_column('users', 'clerk_user_id')
