"""Landing stats: fuentes calculadas + hide_when_zero, y seed de los 4 indicadores base

Revision ID: 3a7e1b9c4d20
Revises: 2d5cf632f025
Create Date: 2026-07-27

Los indicadores de la landing pasan de ser texto manual a poder calcularse solos contra la
base (pedido de Eugenia: "que se muestren los indicadores sería un golazo"). `manual` sigue
existiendo para los estáticos tipo "Bahía Blanca y la zona".
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3a7e1b9c4d20"
down_revision: Union[str, None] = "2d5cf632f025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SOURCE_ENUM = sa.Enum(
    "manual",
    "active_jobs",
    "verified_companies",
    "registered_candidates",
    "total_applications",
    name="landingstatsource",
)

# Los 4 que Eugenia pidió textualmente en el PDF, en su orden. Todos calculados y todos
# con hide_when_zero=True, así una plataforma recién lanzada no muestra "0 empleos activos".
SEED_ROWS = [
    ("BriefcaseIcon", "active_jobs", "empleos activos", 10),
    ("ShieldCheckIcon", "verified_companies", "empresas verificadas", 20),
    ("UserGroupIcon", "registered_candidates", "candidatos registrados", 30),
    ("CursorArrowRaysIcon", "total_applications", "postulaciones realizadas", 40),
]


def upgrade() -> None:
    bind = op.get_bind()
    SOURCE_ENUM.create(bind, checkfirst=True)

    op.add_column(
        "landing_stats",
        sa.Column("source", SOURCE_ENUM, nullable=False, server_default="manual"),
    )
    op.add_column(
        "landing_stats",
        sa.Column("hide_when_zero", sa.Boolean(), nullable=False, server_default="true"),
    )
    # `value` deja de ser obligatorio de hecho: en los calculados no se usa.
    op.alter_column("landing_stats", "value", existing_type=sa.String(length=100), server_default="")

    # Seed idempotente: sólo inserta si la tabla está vacía, para no duplicar filas si
    # alguien ya cargó indicadores a mano antes de esta migración.
    existing = bind.execute(sa.text("SELECT COUNT(*) FROM landing_stats")).scalar()
    if not existing:
        for icon, source, label, order in SEED_ROWS:
            bind.execute(
                sa.text(
                    "INSERT INTO landing_stats (id, icon, source, value, label, sort_order,"
                    " visible, hide_when_zero, created_at, updated_at)"
                    " VALUES (gen_random_uuid(), :icon, CAST(:source AS landingstatsource),"
                    " '', :label, :order, true, true, now(), now())"
                ),
                {"icon": icon, "source": source, "label": label, "order": order},
            )


def downgrade() -> None:
    op.drop_column("landing_stats", "hide_when_zero")
    op.drop_column("landing_stats", "source")
    SOURCE_ENUM.drop(op.get_bind(), checkfirst=True)
