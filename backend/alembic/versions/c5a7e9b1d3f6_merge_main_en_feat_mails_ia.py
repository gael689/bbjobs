"""Une la cadena de main (estrella y visto de Talency) con la de feat/mails-ia (Centro de IA)

Sin cambios de esquema: dos ramas de migraciones nacieron en paralelo y esta revisión las junta
en una sola cabeza.

Revision ID: c5a7e9b1d3f6
Revises: b3f8d1e6a2c4, b4c6d8e0f2a1
"""
from typing import Sequence, Union

revision: str = "c5a7e9b1d3f6"
down_revision: Union[str, Sequence[str], None] = ("b3f8d1e6a2c4", "b4c6d8e0f2a1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
