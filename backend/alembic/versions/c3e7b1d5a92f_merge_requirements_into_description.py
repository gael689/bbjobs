"""Un solo cuadro para el aviso: se fusiona `requirements` dentro de `description`

Pedido de Eugenia (agosto/2026): "que sea un solo recuadro donde se vea el aviso completo, que
no esté separado entre descripción y requisitos".

Se eligió eliminar la columna en vez de dejarla opcional y oculta: dejándola, los avisos ya
publicados seguían mostrando el bloque "Requisitos" aparte en el portal público, que es
exactamente la separación que le molesta.

El backfill pega los requisitos al final de la descripción con un encabezado, para no perder
el texto que las empresas ya escribieron ni que se lea como un párrafo pegado de golpe. Al
06/08/2026 hay 3 avisos, los 3 con requisitos cargados.

Revision ID: c3e7b1d5a92f
Revises: f1a4c7e2b9d8
Create Date: 2026-08-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3e7b1d5a92f"
down_revision: Union[str, None] = "f1a4c7e2b9d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE job_postings
        SET description = description || E'\n\nRequisitos\n' || requirements
        WHERE requirements IS NOT NULL AND btrim(requirements) <> ''
        """
    )
    op.drop_column("job_postings", "requirements")


def downgrade() -> None:
    # El texto fusionado no se puede volver a separar de forma confiable: queda todo en
    # `description` y la columna vuelve vacía. Es una pérdida asumida — bajar de esta revisión
    # no reconstruye la separación original.
    op.add_column(
        "job_postings",
        sa.Column("requirements", sa.Text(), nullable=False, server_default=""),
    )
    op.alter_column("job_postings", "requirements", server_default=None)
