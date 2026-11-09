"""IA de fondo: cola de recálculo al instante, resúmenes de candidatos y vectores de avisos

- `ai_recompute_queue`: una fila por búsqueda que pide recalcular sus recomendados (al aprobarse
  o al entrar una postulación). La fila única por búsqueda hace el debounce.
- `candidate_summaries`: resumen de 3 líneas por (búsqueda, candidato), cacheado por hash de la
  entrada. Datos personales → se borra también en la lápida de `account_deletion.py`.
- `job_posting_vectors`: un vector por aviso (título + descripción) para detectar duplicados y
  sector dudoso al moderar. Datos de la empresa.

Revision ID: f2b3c4d5e6a7
Revises: d8e2f6a0b3c5
Create Date: 2026-10-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "f2b3c4d5e6a7"
down_revision: Union[str, None] = "d8e2f6a0b3c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DIM = 768


def _job_pk() -> sa.Column:
    return sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"),
                     primary_key=True)


def upgrade() -> None:
    op.create_table(
        "ai_recompute_queue",
        _job_pk(),
        sa.Column("reason", sa.String(30), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_requested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "candidate_summaries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("lines", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("generated_with_ai", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("prompt_version", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("job_id", "candidate_id", name="uq_candidate_summaries_job_candidate"),
    )
    op.create_index("ix_candidate_summaries_candidate_id", "candidate_summaries", ["candidate_id"])

    op.create_table(
        "job_posting_vectors",
        _job_pk(),
        sa.Column("text_hash", sa.String(64), nullable=False),
        sa.Column("embedding", Vector(DIM), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("job_posting_vectors")
    op.drop_index("ix_candidate_summaries_candidate_id", table_name="candidate_summaries")
    op.drop_table("candidate_summaries")
    op.drop_table("ai_recompute_queue")
