from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
from app.models.tests import ScoringMethod, QuestionType, TestSubmissionStatus

class TestQuestionOptionResponse(BaseModel):
    id: uuid.UUID
    text: str
    order: int

    class Config:
        from_attributes = True

class TestQuestionResponse(BaseModel):
    id: uuid.UUID
    text: str
    order: int
    question_type: QuestionType
    options: List[TestQuestionOptionResponse] = []

    class Config:
        from_attributes = True

class PsychometricTestResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    slug: str
    scoring_method: ScoringMethod
    
    class Config:
        from_attributes = True

class PsychometricTestDetailResponse(PsychometricTestResponse):
    questions: List[TestQuestionResponse] = []

class TestSubmissionResponse(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    test_id: uuid.UUID
    status: TestSubmissionStatus
    score: Optional[float] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TestAnswerCreate(BaseModel):
    question_id: uuid.UUID
    selected_option_id: uuid.UUID

class SubmitAnswersRequest(BaseModel):
    answers: List[TestAnswerCreate]
