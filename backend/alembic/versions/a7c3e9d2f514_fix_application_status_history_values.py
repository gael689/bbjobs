"""Historial de estados: quitar el prefijo "ApplicationStatus." de los valores guardados

Hasta el 04/10/2026, `applications.py` guardaba `str(ApplicationStatus.x)`, que desde Python
3.11 es `"ApplicationStatus.x"` y no `"x"`. El candidato veía ese texto crudo en la línea de
tiempo de su postulación, y cualquier consulta por `to_status = 'selected'` daba cero.

Sólo toca filas con el prefijo, así que correrla dos veces no cambia nada. El downgrade no
vuelve a romper los datos: dejar el valor limpio es correcto con el código anterior y con el
nuevo.

Revision ID: a7c3e9d2f514
Revises: f3b9c2d6a4e8
Create Date: 2026-10-04
"""
from typing import Sequence, Union

from alembic import op


revision: str = "a7c3e9d2f514"
down_revision: Union[str, None] = "f3b9c2d6a4e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE application_status_history "
        "SET to_status = substr(to_status, length('ApplicationStatus.') + 1) "
        "WHERE to_status LIKE 'ApplicationStatus.%'"
    )
    op.execute(
        "UPDATE application_status_history "
        "SET from_status = substr(from_status, length('ApplicationStatus.') + 1) "
        "WHERE from_status LIKE 'ApplicationStatus.%'"
    )


def downgrade() -> None:
    pass
