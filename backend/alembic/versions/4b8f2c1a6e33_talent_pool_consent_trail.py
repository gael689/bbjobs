"""Base de Talento: traza de consentimiento (asked_at / decided_at)

Revision ID: 4b8f2c1a6e33
Revises: 3a7e1b9c4d20
Create Date: 2026-07-27

`visible_in_talent_pool` solo no alcanza: sobre este consentimiento se va a cobrar un plan a
las empresas, así que hace falta poder demostrar cuándo se le preguntó al candidato y cuándo
respondió. Los candidatos que ya eligieron en el onboarding se backfillean con su updated_at.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4b8f2c1a6e33"
down_revision: Union[str, None] = "3a7e1b9c4d20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("candidate_profiles", sa.Column("talent_pool_asked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidate_profiles", sa.Column("talent_pool_decided_at", sa.DateTime(timezone=True), nullable=True))

    # Quien ya está en la base de talento es porque tildó la casilla en el onboarding —
    # se le preguntó y dijo que sí. Sin esto volveríamos a mostrarle el aviso.
    op.execute(
        "UPDATE candidate_profiles"
        " SET talent_pool_asked_at = updated_at, talent_pool_decided_at = updated_at"
        " WHERE visible_in_talent_pool = true"
    )


def downgrade() -> None:
    op.drop_column("candidate_profiles", "talent_pool_decided_at")
    op.drop_column("candidate_profiles", "talent_pool_asked_at")
