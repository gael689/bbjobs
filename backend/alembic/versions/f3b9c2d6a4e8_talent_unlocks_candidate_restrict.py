"""Base de Talento: un candidato desbloqueado no se puede borrar en cascada

Los créditos usados de un pack no se guardan en un contador: se cuentan desde `talent_unlocks`
(ver d7f4a1c8e620). Con `candidate_id ON DELETE CASCADE`, borrar un candidato que alguna
empresa desbloqueó borraba el desbloqueo y **le devolvía el crédito a la empresa en silencio**
(y un pack `exhausted` quedaba agotado con créditos disponibles).

Desde el 23/09/2026 el borrado de cuentas (services/account_deletion.py) nunca hace eso: a un
candidato con desbloqueos lo deja en lápida. Esta FK es la red por si alguien borra a mano:
el DELETE falla en lugar de alterar créditos ya cobrados.

La FK se creó sin nombre, así que tiene el que le puso Postgres: `talent_unlocks_candidate_id_fkey`.

Revision ID: f3b9c2d6a4e8
Revises: e2c8a4f1d7b3
Create Date: 2026-09-23
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f3b9c2d6a4e8"
down_revision: Union[str, None] = "e2c8a4f1d7b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK = "talent_unlocks_candidate_id_fkey"


def upgrade() -> None:
    op.drop_constraint(FK, "talent_unlocks", type_="foreignkey")
    op.create_foreign_key(FK, "talent_unlocks", "candidate_profiles", ["candidate_id"], ["id"], ondelete="RESTRICT")


def downgrade() -> None:
    op.drop_constraint(FK, "talent_unlocks", type_="foreignkey")
    op.create_foreign_key(FK, "talent_unlocks", "candidate_profiles", ["candidate_id"], ["id"], ondelete="CASCADE")
