"""Última vez que la persona entró (`users.last_seen_at`)

Para el aviso "¿Seguís buscando trabajo?" a la semana sin entrar (PDF de Eugenia, 08/10/2026).
Hasta ahora sólo se sabía cuándo había actualizado el perfil o se había postulado. Lo completa
`get_current_user` como mucho una vez por hora. Sin backfill: las cuentas existentes arrancan en
NULL y la reactivación usa la fecha de alta como respaldo.

Revision ID: d8e2f6a0b3c5
Revises: c7d1e5f9a2b4
Create Date: 2026-10-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d8e2f6a0b3c5"
down_revision: Union[str, None] = "c7d1e5f9a2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_seen_at")
