"""Género preferido de la búsqueda (dato interno)

- `job_postings.preferred_gender`: masculino | femenino, nullable. Lo cargan la empresa y
  Talency; no sale en el aviso público, no frena postulaciones y la IA no lo lee. Sirve para
  ordenar postulantes a mano. Las búsquedas existentes quedan en NULL (sin preferencia).

Revision ID: f1b3d5e7a9c2
Revises: e6a8c0d2f4b7
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1b3d5e7a9c2"
down_revision: Union[str, Sequence[str], None] = "e6a8c0d2f4b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("job_postings", sa.Column("preferred_gender", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("job_postings", "preferred_gender")
