"""IA: fragmentos de candidatos, perfiles de búsquedas, recomendados y consumo (migración e8b2c4d6f1a3)."""
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDMixin

DIM = 768


class CandidateCvText(Base):
    """Texto **ya redactado** del CV (nunca el crudo). `source_hash` = hash de la URL del CV:
    si cambia, se vuelve a extraer."""
    __tablename__ = "candidate_cv_texts"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    source_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    redaction_stats: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    notes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    extracted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CandidateAiIndex(Base):
    __tablename__ = "candidate_ai_index"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_profiles.id", ondelete="CASCADE"), primary_key=True
    )
    ficha_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    chunks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    injection_flags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    indexed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CandidateChunk(UUIDMixin, Base):
    __tablename__ = "candidate_chunks"

    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(DIM), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class JobAiProfile(Base):
    __tablename__ = "job_ai_profiles"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), primary_key=True
    )
    job_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    requirements: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    discarded: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    injection_flags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    extracted_with_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    extracted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class JobRequirementVector(UUIDMixin, Base):
    __tablename__ = "job_requirement_vectors"
    __table_args__ = (UniqueConstraint("job_id", "req_id", name="uq_job_requirement_vectors_job_req"),)

    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    req_id: Mapped[str] = mapped_column(String(10), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(DIM), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)


class JobRecommendation(UUIDMixin, Base):
    __tablename__ = "job_recommendations"
    __table_args__ = (UniqueConstraint("job_id", "candidate_id", name="uq_job_recommendations_job_candidate"),)

    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    hybrid_fit: Mapped[float] = mapped_column(Float, nullable=False)
    coverage: Mapped[float] = mapped_column(Float, nullable=False)
    semantic_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    criteria: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    req_evals: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    evidence: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    reasons: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    final_score: Mapped[int] = mapped_column(Integer, nullable=False)
    rerank_status: Mapped[str] = mapped_column(String(30), nullable=False, default="none")
    job_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ficha_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    weights_version: Mapped[str] = mapped_column(String(40), nullable=False)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    feedback: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AiUsageLog(UUIDMixin, Base):
    __tablename__ = "ai_usage_log"

    feature: Mapped[str] = mapped_column(String(40), nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("company_profiles.id", ondelete="SET NULL"), nullable=True)
    job_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("job_postings.id", ondelete="SET NULL"), nullable=True)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    thought_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class RecommendationRefresh(UUIDMixin, Base):
    """Refrescos manuales de una empresa: tope de 10 por día (auditoría LLM10)."""
    __tablename__ = "recommendation_refreshes"

    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("company_profiles.id", ondelete="CASCADE"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AiRecomputeQueue(Base):
    """Búsquedas que piden recalcular sus recomendados "al instante" (aprobación, postulación
    nueva). Una fila por búsqueda: varias postulaciones seguidas se juntan en un solo recálculo
    (migración f2b3c4d5e6a7). La procesa la tarea de 10 minutos, con presupuesto."""
    __tablename__ = "ai_recompute_queue"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), primary_key=True
    )
    reason: Mapped[str] = mapped_column(String(30), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CandidateSummary(UUIDMixin, Base):
    """Resumen de 3 líneas de un candidato para UNA búsqueda (lo ve esa empresa en Recomendados).
    Habla de la persona: se borra en la lápida de `account_deletion.py`. Cache por `input_hash`
    (ficha + evaluación + requisitos): si nada cambió, no se vuelve a pagar."""
    __tablename__ = "candidate_summaries"
    __table_args__ = (UniqueConstraint("job_id", "candidate_id", name="uq_candidate_summaries_job_candidate"),)

    job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    lines: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    generated_with_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class JobPostingVector(Base):
    """Un vector por aviso (título + descripción), para detectar duplicados y sector dudoso al
    moderar. Datos de la empresa, no de personas. Cache por `text_hash`."""
    __tablename__ = "job_posting_vectors"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="CASCADE"), primary_key=True
    )
    text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    embedding = mapped_column(Vector(DIM), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
