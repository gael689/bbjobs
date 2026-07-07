"""add_suspended_to_verification_status

Revision ID: c40ee9c5dca9
Revises: dd19f874f2f7
Create Date: 2026-06-22 17:52:27.617501

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c40ee9c5dca9'
down_revision: Union[str, None] = 'dd19f874f2f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # verification_status is stored as String(50), not a native PG enum — no ALTER TYPE needed
    pass


def downgrade() -> None:
    pass
