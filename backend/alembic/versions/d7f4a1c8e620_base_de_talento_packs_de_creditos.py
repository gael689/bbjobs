"""Base de Talento: packs de créditos y desbloqueos

Decisión de Eugenia del 18/08/2026, precisada por Gael el 19/08: **no** es una suscripción
mensual, es un **pack cerrado** — se paga $49.900 una vez y se reciben 15 créditos para
desbloquear los perfiles que la empresa quiera.

Eso hace que el cobro sea el mismo que el del destacado de $5.000 (preferencia de Checkout Pro
+ webhook de `payment`), sin nada de preapproval. Por eso acá no se toca `subscriptions` ni
`plans`: quedan como estaban, sin uso.

Dos decisiones de modelado que se explican solas pero conviene dejar por escrito:

- **`UNIQUE (company_id, candidate_id)` en `talent_unlocks`.** Desbloquear dos veces al mismo
  candidato no puede consumir dos créditos. Sin esta restricción, volver a abrir un perfil ya
  pagado descontaría de nuevo — el reclamo más previsible del módulo.
- **Los créditos usados no se guardan como contador.** Se cuentan desde `talent_unlocks`. Un
  contador se desincroniza ante cualquier borrado o rollback; las filas son la fuente de verdad.

`expires_at` nace en NULL a propósito: el pack **no vence**. La columna existe desde el día uno
para que poner un plazo más adelante sea cambiar un valor y no migrar la tabla.

Revision ID: d7f4a1c8e620
Revises: b5c9e0a3f712
Create Date: 2026-08-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7f4a1c8e620"
down_revision: Union[str, None] = "b5c9e0a3f712"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "talent_credit_packs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("credits_total", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending_payment"),
        sa.Column("purchased_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("granted_by_admin_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["company_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["granted_by_admin_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_talent_credit_packs_company_id", "talent_credit_packs", ["company_id"])

    op.create_table(
        "talent_unlocks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("candidate_id", sa.Uuid(), nullable=False),
        sa.Column("pack_id", sa.Uuid(), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["company_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidate_profiles.id"], ondelete="CASCADE"),
        # RESTRICT y no CASCADE: borrar un pack que ya se usó dejaría desbloqueos huérfanos y
        # sin forma de auditar con qué se pagaron.
        sa.ForeignKeyConstraint(["pack_id"], ["talent_credit_packs.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("company_id", "candidate_id", name="uq_talent_unlocks_company_candidate"),
    )
    op.create_index("ix_talent_unlocks_company_id", "talent_unlocks", ["company_id"])
    op.create_index("ix_talent_unlocks_candidate_id", "talent_unlocks", ["candidate_id"])
    op.create_index("ix_talent_unlocks_pack_id", "talent_unlocks", ["pack_id"])

    # Espeja related_job_feature_id: el webhook resuelve el Payment por external_reference y
    # necesita saber qué pack activar. `use_alter` porque las dos tablas se referencian.
    op.add_column("payments", sa.Column("related_talent_pack_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_payments_talent_pack_id",
        "payments",
        "talent_credit_packs",
        ["related_talent_pack_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_payments_talent_pack_id", "payments", type_="foreignkey")
    op.drop_column("payments", "related_talent_pack_id")

    op.drop_index("ix_talent_unlocks_pack_id", table_name="talent_unlocks")
    op.drop_index("ix_talent_unlocks_candidate_id", table_name="talent_unlocks")
    op.drop_index("ix_talent_unlocks_company_id", table_name="talent_unlocks")
    op.drop_table("talent_unlocks")

    op.drop_index("ix_talent_credit_packs_company_id", table_name="talent_credit_packs")
    op.drop_table("talent_credit_packs")
