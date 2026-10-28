"""Oposición del postulante a la IA y al aviso de "está en otro proceso"

`candidate_profiles.ai_opt_out_at`: con fecha, el perfil queda fuera de todo el circuito de IA.
`candidate_profiles.other_processes_opt_out_at`: con fecha, no se le cuenta a otra empresa que la
persona está avanzada en un proceso. Política de privacidad 3.0. Nullable y sin default.

Revision ID: d2f4a6c8e0b1
Revises: c5a7e9b1d3f6
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d2f4a6c8e0b1"
down_revision: Union[str, Sequence[str], None] = "c5a7e9b1d3f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("candidate_profiles", sa.Column("ai_opt_out_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidate_profiles",
                  sa.Column("other_processes_opt_out_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("candidate_profiles", "other_processes_opt_out_at")
    op.drop_column("candidate_profiles", "ai_opt_out_at")
