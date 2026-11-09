"""Revisión de CV: pagos de candidatos y órdenes de revisión

Hasta acá sólo pagaban empresas (`payments.company_id NOT NULL`). La Revisión de CV la paga un
postulante, así que un pago pasa a ser de una empresa **o** de un candidato, nunca de los dos
ni de ninguno (CHECK). Las filas existentes tienen todas `company_id`, así que lo cumplen.

`candidate_id` es RESTRICT, igual que `company_id`: un pago es contable y no se puede perder
en cascada. El borrado de cuentas deja al candidato en lápida si tiene una revisión pagada.

Ver MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md §6.

Revision ID: c5e1a9d3b7f2
Revises: b1e4c7a2d905
Create Date: 2026-10-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "c5e1a9d3b7f2"
down_revision: Union[str, None] = "b1e4c7a2d905"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OPEN_STATUSES = "('pending_payment', 'paid', 'in_progress')"


def _ts(name: str, **kw) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), **kw)


def upgrade() -> None:
    op.create_table(
        "cv_review_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", UUID(as_uuid=True),
                  sa.ForeignKey("candidate_profiles.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending_payment"),
        sa.Column("cv_file_url_snapshot", sa.String(1024), nullable=True),
        _ts("cv_uploaded_at_snapshot", nullable=True),
        sa.Column("objective", sa.String(500), nullable=True),
        sa.Column("contact_channel", sa.String(20), nullable=False),
        sa.Column("contact_value", sa.String(255), nullable=True),
        _ts("contact_consent_at", nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="ARS"),
        _ts("paid_at", nullable=True),
        _ts("taken_at", nullable=True),
        _ts("delivered_at", nullable=True),
        _ts("refunded_at", nullable=True),
        _ts("canceled_at", nullable=True),
        sa.Column("taken_by_admin_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        _ts("reminder_24h_sent_at", nullable=True),
        _ts("reminder_48h_sent_at", nullable=True),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('pending_payment','paid','in_progress','delivered','refunded','canceled')",
            name="ck_cv_review_orders_status",
        ),
        sa.CheckConstraint("contact_channel IN ('whatsapp','email')", name="ck_cv_review_orders_channel"),
    )
    op.create_index("ix_cv_review_orders_candidate_id", "cv_review_orders", ["candidate_id"])
    op.create_index("ix_cv_review_orders_status", "cv_review_orders", ["status"])
    # Una sola revisión abierta por candidato (regla C3).
    op.execute(
        "CREATE UNIQUE INDEX uq_cv_review_orders_one_open ON cv_review_orders (candidate_id) "
        f"WHERE status IN {OPEN_STATUSES}"
    )

    op.alter_column("payments", "company_id", existing_type=UUID(as_uuid=True), nullable=True)
    op.add_column("payments", sa.Column(
        "candidate_id", UUID(as_uuid=True),
        sa.ForeignKey("candidate_profiles.id", ondelete="RESTRICT", name="fk_payments_candidate_id"),
        nullable=True,
    ))
    op.create_index("ix_payments_candidate_id", "payments", ["candidate_id"])
    op.add_column("payments", sa.Column("related_cv_review_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_payments_cv_review_id", "payments", "cv_review_orders",
        ["related_cv_review_id"], ["id"], ondelete="SET NULL",
    )
    op.create_check_constraint(
        "ck_payments_one_payer", "payments", "num_nonnulls(company_id, candidate_id) = 1"
    )


def downgrade() -> None:
    # Volver atrás pierde los pagos de candidatos: se borran explícitamente antes de restaurar
    # el NOT NULL, que si no fallaría. Sólo tiene sentido antes de cobrar la primera revisión.
    op.drop_constraint("ck_payments_one_payer", "payments", type_="check")
    op.drop_constraint("fk_payments_cv_review_id", "payments", type_="foreignkey")
    op.drop_column("payments", "related_cv_review_id")
    op.execute("DELETE FROM payments WHERE company_id IS NULL")
    op.drop_index("ix_payments_candidate_id", table_name="payments")
    op.drop_column("payments", "candidate_id")
    op.alter_column("payments", "company_id", existing_type=UUID(as_uuid=True), nullable=False)
    op.execute("DROP INDEX IF EXISTS uq_cv_review_orders_one_open")
    op.drop_index("ix_cv_review_orders_status", table_name="cv_review_orders")
    op.drop_index("ix_cv_review_orders_candidate_id", table_name="cv_review_orders")
    op.drop_table("cv_review_orders")
