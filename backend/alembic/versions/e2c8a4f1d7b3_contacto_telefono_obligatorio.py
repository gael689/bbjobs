"""Contacto: el mail pasa a ser opcional

Eugenia pidió (23/09/2026) que en el formulario de contacto el teléfono sea obligatorio y el
mail opcional: responde por WhatsApp y el mail era un campo más que frenaba.

Sólo cambia `email` a nullable. `phone` **no** pasa a NOT NULL: los mensajes anteriores no lo
tienen, y rellenarlos con un valor falso mostraría en el panel un teléfono roto con botón de
WhatsApp a ningún lado. La obligación del teléfono vive en el schema de la API
(`ContactMessageCreate`), que es el único camino de entrada a la tabla.

Revision ID: e2c8a4f1d7b3
Revises: c1b7e4a90d52
Create Date: 2026-09-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e2c8a4f1d7b3"
down_revision: Union[str, None] = "c1b7e4a90d52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("contact_messages", "email", existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    # Los mensajes nuevos pueden no tener mail: sin esto el SET NOT NULL falla.
    op.execute("UPDATE contact_messages SET email = '' WHERE email IS NULL")
    op.alter_column("contact_messages", "email", existing_type=sa.String(255), nullable=False)
