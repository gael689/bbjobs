import enum
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin
import uuid

class ScoringMethod(str, enum.Enum):
    sum = "sum"
    average = "average"
    scale = "scale"

class PsychometricTest(UUIDMixin, Base):
    __tablename__ = "psychometric_tests"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    
    scoring_method: Mapped[ScoringMethod] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class QuestionType(str, enum.Enum):
    single_choice = "single_choice"
    likert = "likert"

class TestQuestion(UUIDMixin, Base):
    __tablename__ = "test_questions"

    test_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("psychometric_tests.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(String(50), nullable=False)

class TestQuestionOption(UUIDMixin, Base):
    __tablename__ = "test_question_options"

    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("test_questions.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

class TestSubmissionStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"

class TestSubmission(UUIDMixin, Base):
    __tablename__ = "test_submissions"

    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False)
    test_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("psychometric_tests.id", ondelete="CASCADE"), nullable=False)
    
    status: Mapped[TestSubmissionStatus] = mapped_column(String(50), default=TestSubmissionStatus.in_progress, nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class TestAnswer(UUIDMixin, Base):
    __tablename__ = "test_answers"

    submission_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("test_submissions.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("test_questions.id", ondelete="CASCADE"), nullable=False)
    selected_option_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("test_question_options.id", ondelete="CASCADE"), nullable=False)
