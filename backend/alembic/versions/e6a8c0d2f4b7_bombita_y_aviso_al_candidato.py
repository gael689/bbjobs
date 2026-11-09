"""Recomendados que la empresa todavía no miró y aviso "Hay una búsqueda que encaja con tu perfil"

- `job_recommendations.company_viewed_at`: cuándo la empresa abrió los Recomendados de esa
  búsqueda con la fila a la vista. La "bombita" del panel y el contador "Recomendados (N)"
  cuentan las que siguen en NULL. Nullable y sin default: las filas que ya existen quedan
  pendientes (en producción no hay recomendados todavía).
- `candidate_job_matches`: qué búsqueda encajó con qué candidato, para el aviso inmediato al
  candidato (uno cada 24 h como mucho, nunca la misma búsqueda dos veces). Datos de la persona:
  se borran en la lápida de `account_deletion.py` y por CASCADE en el borrado total.

Revision ID: e6a8c0d2f4b7
Revises: d2f4a6c8e0b1
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e6a8c0d2f4b7"
down_revision: Union[str, Sequence[str], None] = "d2f4a6c8e0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("job_recommendations",
                  sa.Column("company_viewed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "candidate_job_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("via", sa.String(10), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("candidate_id", "job_id", name="uq_candidate_job_matches_candidate_job"),
    )
    op.create_index("ix_candidate_job_matches_candidate_id", "candidate_job_matches", ["candidate_id"])
    op.create_index("ix_candidate_job_matches_job_id", "candidate_job_matches", ["job_id"])


def downgrade() -> None:
    op.drop_index("ix_candidate_job_matches_job_id", table_name="candidate_job_matches")
    op.drop_index("ix_candidate_job_matches_candidate_id", table_name="candidate_job_matches")
    op.drop_table("candidate_job_matches")
    op.drop_column("job_recommendations", "company_viewed_at")
