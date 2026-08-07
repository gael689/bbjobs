"""Estado de la educación (graduado/en curso/abandonado) + interruptores del sitio

Dos cosas del Bloque D (estadísticas), agosto/2026:

1. `educations.in_progress` (booleano) pasa a `educations.status` con tres valores. Eugenia
   pidió poder distinguir **Abandonado** en el gráfico de nivel educativo, y con un sí/no no
   se podía. Backfill: `in_progress = true` → `en_curso`, el resto → `graduado`. Nadie queda
   como abandonado automáticamente: es un dato que sólo puede declarar el candidato.

2. Tabla `site_settings`: los interruptores con los que Talency decide qué estadísticas se
   publican. Nacen **apagados** — las estadísticas se construyen igual y Eugenia las ve
   siempre desde su panel, pero no salen al portal hasta que ella las prenda.

Revision ID: a8d2f6c1e534
Revises: c3e7b1d5a92f
Create Date: 2026-08-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8d2f6c1e534"
down_revision: Union[str, None] = "c3e7b1d5a92f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── educations.in_progress → educations.status ─────────────────────────────
    op.add_column(
        "educations",
        sa.Column("status", sa.String(50), nullable=False, server_default="graduado"),
    )
    op.execute("UPDATE educations SET status = 'en_curso' WHERE in_progress = true")
    op.alter_column("educations", "status", server_default=None)
    op.drop_column("educations", "in_progress")

    # ── site_settings ─────────────────────────────────────────────────────────
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("key", sa.String(100), nullable=False, unique=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_site_settings_key", "site_settings", ["key"], unique=True)
    # Sin seed: las filas se crean solas la primera vez que Talency toca un interruptor.
    # Mientras no exista la fila, vale el default apagado (ver SETTING_DEFAULTS).


def downgrade() -> None:
    op.drop_index("ix_site_settings_key", table_name="site_settings")
    op.drop_table("site_settings")

    op.add_column(
        "educations",
        sa.Column("in_progress", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE educations SET in_progress = true WHERE status = 'en_curso'")
    op.alter_column("educations", "in_progress", server_default=None)
    op.drop_column("educations", "status")
