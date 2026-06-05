from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid
import datetime
from app.api.deps import get_db, require_role, get_current_user
from app.models.core import UserRole, User
from app.models.candidate import CandidateProfile
from app.models.tests import PsychometricTest, TestSubmission, TestSubmissionStatus, TestAnswer, TestQuestion, TestQuestionOption
from app.schemas.test import PsychometricTestResponse, PsychometricTestDetailResponse, TestSubmissionResponse, SubmitAnswersRequest

router = APIRouter()

@router.get("/tests", response_model=List[PsychometricTestResponse])
async def list_tests(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PsychometricTest).where(PsychometricTest.is_active == True))
    return result.scalars().all()

@router.get("/tests/{id}", response_model=PsychometricTestDetailResponse)
async def get_test_details(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PsychometricTest).where(PsychometricTest.id == id, PsychometricTest.is_active == True))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
        
    # Ideally, we should use joinedload or selectinload, but since this is an async session and 
    # the relationship might not be fully configured for lazy='selectin' in the models yet,
    # let's fetch questions and options manually for safety or rely on the DTO.
    # To keep it robust without changing models now:
    res_q = await db.execute(select(TestQuestion).where(TestQuestion.test_id == test.id).order_by(TestQuestion.order))
    questions = res_q.scalars().all()
    
    q_ids = [q.id for q in questions]
    res_opts = await db.execute(select(TestQuestionOption).where(TestQuestionOption.question_id.in_(q_ids)).order_by(TestQuestionOption.order))
    options = res_opts.scalars().all()
    
    # Assembly
    q_dict = {}
    for q in questions:
        q_dict[q.id] = {"id": q.id, "text": q.text, "order": q.order, "question_type": q.question_type, "options": []}
        
    for o in options:
        if o.question_id in q_dict:
            q_dict[o.question_id]["options"].append(
                {"id": o.id, "text": o.text, "order": o.order}
            )
            
    response_data = {
        "id": test.id,
        "name": test.name,
        "description": test.description,
        "slug": test.slug,
        "scoring_method": test.scoring_method,
        "questions": list(q_dict.values())
    }
    return response_data

@router.post("/tests/{id}/start", response_model=TestSubmissionResponse)
async def start_test(
    id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    result_candidate = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    candidate = result_candidate.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate profile not found")

    result = await db.execute(select(PsychometricTest).where(PsychometricTest.id == id, PsychometricTest.is_active == True))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Cooldown check: 30 days
    cooldown_threshold = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=30)
    
    # Check for any completed submission in the last 30 days
    result_recent = await db.execute(
        select(TestSubmission).where(
            TestSubmission.candidate_id == candidate.id,
            TestSubmission.test_id == test.id,
            TestSubmission.status == TestSubmissionStatus.completed,
            TestSubmission.completed_at >= cooldown_threshold
        )
    )
    if result_recent.scalars().first():
        raise HTTPException(status_code=400, detail="Cooldown period of 30 days has not elapsed for this test.")

    # Check if there is an in-progress submission
    result_ip = await db.execute(
        select(TestSubmission).where(
            TestSubmission.candidate_id == candidate.id,
            TestSubmission.test_id == test.id,
            TestSubmission.status == TestSubmissionStatus.in_progress
        )
    )
    in_progress_sub = result_ip.scalars().first()
    if in_progress_sub:
        return in_progress_sub

    sub = TestSubmission(
        candidate_id=candidate.id,
        test_id=test.id,
        status=TestSubmissionStatus.in_progress,
        started_at=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub

@router.post("/tests/submissions/{sub_id}/complete", response_model=TestSubmissionResponse)
async def complete_test(
    sub_id: uuid.UUID,
    payload: SubmitAnswersRequest,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    result_candidate = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    candidate = result_candidate.scalar_one_or_none()
    
    result_sub = await db.execute(select(TestSubmission).where(TestSubmission.id == sub_id, TestSubmission.candidate_id == candidate.id))
    sub = result_sub.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    if sub.status == TestSubmissionStatus.completed:
        raise HTTPException(status_code=400, detail="Submission is already completed")
        
    # Save answers
    for ans in payload.answers:
        ta = TestAnswer(
            submission_id=sub.id,
            question_id=ans.question_id,
            selected_option_id=ans.selected_option_id
        )
        db.add(ta)
        
    # Calculate score (Simplified calculation: average of all selected options values)
    # Get values
    opt_ids = [ans.selected_option_id for ans in payload.answers]
    if opt_ids:
        result_opts = await db.execute(select(TestQuestionOption).where(TestQuestionOption.id.in_(opt_ids)))
        options = result_opts.scalars().all()
        
        total_val = sum([o.value for o in options])
        avg_score = total_val / len(options) if options else 0.0
        sub.score = avg_score
    else:
        sub.score = 0.0

    sub.status = TestSubmissionStatus.completed
    sub.completed_at = datetime.datetime.now(datetime.timezone.utc)
    
    await db.commit()
    await db.refresh(sub)
    return sub

@router.get("/me/candidate/tests", response_model=List[TestSubmissionResponse])
async def get_my_test_history(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    result_candidate = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == current_user.id))
    candidate = result_candidate.scalar_one_or_none()
    
    result = await db.execute(
        select(TestSubmission)
        .where(TestSubmission.candidate_id == candidate.id)
        .order_by(TestSubmission.started_at.desc())
    )
    return result.scalars().all()
