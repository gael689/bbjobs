"""IA: pgvector, fragmentos de candidatos, perfiles de búsquedas, recomendados y consumo

pgvector está disponible en el Postgres de Railway (0.8.6, medido el 04/10/2026) pero sin
activar: `CREATE EXTENSION` corre con el rol de migraciones (`MIGRATIONS_DATABASE_URL`).
Vectores de 768 dimensiones (`gemini-embedding-001` truncado; GEMINI_EMBEDDING_DIM debe ser 768).

Todo lo que cuelga de un candidato es `ON DELETE CASCADE` y además se borra explícitamente en
la lápida de `account_deletion.py` (la fila del candidato sobrevive en ese modo).

Revision ID: e8b2c4d6f1a3
Revises: d7a3f1c9e2b4
Create Date: 2026-10-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "e8b2c4d6f1a3"
down_revision: Union[str, None] = "d7a3f1c9e2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DIM = 768


def _ts(name: str, **kw) -> sa.Column:
    return sa.Column(name, sa.DateTime(timezone=True), **kw)


def _cand_fk() -> sa.Column:
    return sa.Column("candidate_id", UUID(as_uuid=True),
                     sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "candidate_cv_texts",
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("source_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("redaction_stats", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("notes", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        _ts("extracted_at", nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "candidate_ai_index",
        sa.Column("candidate_id", UUID(as_uuid=True), sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("ficha_hash", sa.String(64), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("chunks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("injection_flags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        _ts("indexed_at", nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "candidate_chunks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        _cand_fk(),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(DIM), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_candidate_chunks_candidate_id", "candidate_chunks", ["candidate_id"])

    op.create_table(
        "job_ai_profiles",
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("job_hash", sa.String(64), nullable=False),
        sa.Column("requirements", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("discarded", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("injection_flags", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("extracted_with_ai", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("prompt_version", sa.String(40), nullable=True),
        _ts("extracted_at", nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "job_requirement_vectors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("req_id", sa.String(10), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(DIM), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.UniqueConstraint("job_id", "req_id", name="uq_job_requirement_vectors_job_req"),
    )

    op.create_table(
        "job_recommendations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        _cand_fk(),
        sa.Column("source", sa.String(20), nullable=False),          # applicant | talent
        sa.Column("hybrid_fit", sa.Float(), nullable=False),
        sa.Column("coverage", sa.Float(), nullable=False),
        sa.Column("semantic_pct", sa.Float(), nullable=True),
        sa.Column("criteria", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("req_evals", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("evidence", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("reasons", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("final_score", sa.Integer(), nullable=False),
        sa.Column("rerank_status", sa.String(30), nullable=False, server_default="none"),
        sa.Column("job_hash", sa.String(64), nullable=True),
        sa.Column("ficha_hash", sa.String(64), nullable=True),
        sa.Column("prompt_version", sa.String(40), nullable=True),
        sa.Column("weights_version", sa.String(40), nullable=False),
        sa.Column("model", sa.String(80), nullable=True),
        sa.Column("feedback", sa.SmallInteger(), nullable=True),
        _ts("computed_at", nullable=False, server_default=sa.func.now()),
        _ts("notified_at", nullable=True),
        sa.UniqueConstraint("job_id", "candidate_id", name="uq_job_recommendations_job_candidate"),
    )
    op.create_index("ix_job_recommendations_job_score", "job_recommendations", ["job_id", "final_score"])
    op.create_index("ix_job_recommendations_candidate_id", "job_recommendations", ["candidate_id"])

    op.create_table(
        "ai_usage_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("feature", sa.String(40), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("company_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="SET NULL"), nullable=True),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("thought_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=False, server_default="0"),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ai_usage_log_created_at", "ai_usage_log", ["created_at"])

    op.create_table(
        "recommendation_refreshes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), sa.ForeignKey("company_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", UUID(as_uuid=True), sa.ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False),
        _ts("created_at", nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_recommendation_refreshes_company", "recommendation_refreshes", ["company_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_recommendation_refreshes_company", table_name="recommendation_refreshes")
    op.drop_table("recommendation_refreshes")
    op.drop_index("ix_ai_usage_log_created_at", table_name="ai_usage_log")
    op.drop_table("ai_usage_log")
    op.drop_index("ix_job_recommendations_candidate_id", table_name="job_recommendations")
    op.drop_index("ix_job_recommendations_job_score", table_name="job_recommendations")
    op.drop_table("job_recommendations")
    op.drop_table("job_requirement_vectors")
    op.drop_table("job_ai_profiles")
    op.drop_index("ix_candidate_chunks_candidate_id", table_name="candidate_chunks")
    op.drop_table("candidate_chunks")
    op.drop_table("candidate_ai_index")
    op.drop_table("candidate_cv_texts")
    # La extensión no se borra: otra cosa podría estar usándola y no ocupa lugar.
