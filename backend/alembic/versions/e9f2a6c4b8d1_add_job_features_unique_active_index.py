"""add_job_features_unique_active_index

Revision ID: e9f2a6c4b8d1
Revises: b4c7e1a9f3d6
Create Date: 2026-07-16 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e9f2a6c4b8d1'
down_revision: Union[str, None] = 'b4c7e1a9f3d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Resguardo a nivel de base de datos: dos intentos de pago simultáneos sobre la misma
    # búsqueda no pueden generar dos JobFeature "en curso" en paralelo. El chequeo de
    # aplicación (feature_job) ya lo previene en el camino normal; esto cubre condiciones de
    # carrera — vale la pena el resguardo extra tratándose de dinero real.
    op.create_index(
        'uq_job_features_active_per_job',
        'job_features',
        ['job_posting_id'],
        unique=True,
        postgresql_where=sa.text("status IN ('pending_payment', 'active')"),
    )


def downgrade() -> None:
    op.drop_index('uq_job_features_active_per_job', table_name='job_features')
