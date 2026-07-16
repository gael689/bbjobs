from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from pydantic import BaseModel
from app.api.deps import get_db, require_role
from app.models.core import User, UserRole
from app.models.candidate import (
    CandidateProfile, Experience, Education, CandidateSkill, Language, SkillLevel
)
from app.models.catalogs import Skill
from app.schemas.candidate import (
    CandidateProfileResponse, CandidateProfileUpdate,
    ExperienceCreate, ExperienceResponse,
    EducationCreate, EducationResponse,
    CandidateSkillCreate, CandidateSkillResponse,
    LanguageCreate, LanguageResponse,
)
from app.integrations.cloudinary_client import upload_pdf
from app.services.profile_completion import compute_profile_completion_for_candidate
from app.services.history import log_candidate_activity
import uuid
import datetime

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_candidate_profile(user_id: uuid.UUID, db: AsyncSession) -> CandidateProfile:
    result = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# ── Profile ───────────────────────────────────────────────────────────────────

async def _build_profile_response(profile: CandidateProfile, db: AsyncSession) -> CandidateProfileResponse:
    completion = await compute_profile_completion_for_candidate(db, profile)
    response = CandidateProfileResponse.model_validate(profile)
    return response.model_copy(update={
        "completion_percent": completion.percent,
        "missing_fields": completion.missing,
    })


@router.get("/me/candidate/profile", response_model=CandidateProfileResponse)
async def get_my_candidate_profile(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    return await _build_profile_response(profile, db)

@router.patch("/me/candidate/profile", response_model=CandidateProfileResponse)
async def update_my_candidate_profile(
    payload: CandidateProfileUpdate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(profile, key):
            setattr(profile, key, value)

    if update_data:
        await log_candidate_activity(
            db, candidate_id=profile.id, event_type="profile_update",
            summary="Actualizó sus datos personales",
        )

    await db.commit()
    await db.refresh(profile)
    return await _build_profile_response(profile, db)

@router.post("/me/candidate/cv", response_model=CandidateProfileResponse)
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo muy grande. Máximo 5MB")

    profile = await _get_candidate_profile(current_user.id, db)

    try:
        url = upload_pdf(
            content,
            folder="bbjobs/cvs",
            public_id=str(profile.id),
            content_type="application/pdf",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    profile.cv_file_url = url
    profile.cv_uploaded_at = datetime.datetime.now(datetime.timezone.utc)

    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="cv_upload", summary="Subió/actualizó su CV",
    )

    await db.commit()
    await db.refresh(profile)
    return await _build_profile_response(profile, db)


# ── Experience ────────────────────────────────────────────────────────────────

@router.get("/me/candidate/experience", response_model=List[ExperienceResponse])
async def list_experience(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    result = await db.execute(select(Experience).where(Experience.candidate_id == profile.id))
    return result.scalars().all()

@router.post("/me/candidate/experience", response_model=ExperienceResponse)
async def add_experience(
    payload: ExperienceCreate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    exp = Experience(
        candidate_id=profile.id,
        company_name=payload.company_name,
        role_title=payload.role_title,
        start_date=payload.start_date,
        end_date=payload.end_date,
        description=payload.description,
    )
    db.add(exp)
    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="experience_add",
        summary=f"Agregó experiencia: {payload.role_title} en {payload.company_name}",
    )
    await db.commit()
    await db.refresh(exp)
    return exp

@router.delete("/me/candidate/experience/{exp_id}", status_code=204)
async def delete_experience(
    exp_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    result = await db.execute(
        select(Experience).where(Experience.id == exp_id, Experience.candidate_id == profile.id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")

    await db.delete(exp)
    await db.commit()


# ── Education ─────────────────────────────────────────────────────────────────

@router.get("/me/candidate/education", response_model=List[EducationResponse])
async def list_education(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    result = await db.execute(select(Education).where(Education.candidate_id == profile.id))
    return result.scalars().all()

@router.post("/me/candidate/education", response_model=EducationResponse)
async def add_education(
    payload: EducationCreate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    edu = Education(
        candidate_id=profile.id,
        institution=payload.institution,
        degree=payload.degree,
        level=payload.level,
        start_date=payload.start_date,
        end_date=payload.end_date,
        in_progress=payload.in_progress,
    )
    db.add(edu)
    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="education_add",
        summary=f"Agregó educación: {payload.degree} en {payload.institution}",
    )
    await db.commit()
    await db.refresh(edu)
    return edu

@router.delete("/me/candidate/education/{edu_id}", status_code=204)
async def delete_education(
    edu_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    result = await db.execute(
        select(Education).where(Education.id == edu_id, Education.candidate_id == profile.id)
    )
    edu = result.scalar_one_or_none()
    if not edu:
        raise HTTPException(status_code=404, detail="Education not found")

    await db.delete(edu)
    await db.commit()


# ── Skills ────────────────────────────────────────────────────────────────────

class CandidateSkillWithName(BaseModel):
    skill_id: uuid.UUID
    skill_name: str
    level: SkillLevel

    class Config:
        from_attributes = True


@router.get("/me/candidate/skills", response_model=List[CandidateSkillWithName])
async def list_my_skills(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    result = await db.execute(
        select(CandidateSkill, Skill.name)
        .join(Skill, CandidateSkill.skill_id == Skill.id)
        .where(CandidateSkill.candidate_id == profile.id)
    )
    return [
        CandidateSkillWithName(skill_id=cs.skill_id, skill_name=name, level=cs.level)
        for cs, name in result.all()
    ]


@router.post("/me/candidate/skills", response_model=CandidateSkillResponse)
async def add_skill(
    payload: CandidateSkillCreate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    # Check if skill already added
    existing = await db.execute(
        select(CandidateSkill).where(
            CandidateSkill.candidate_id == profile.id,
            CandidateSkill.skill_id == payload.skill_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Skill already added")

    cs = CandidateSkill(
        candidate_id=profile.id,
        skill_id=payload.skill_id,
        level=payload.level,
    )
    db.add(cs)

    skill_result = await db.execute(select(Skill.name).where(Skill.id == payload.skill_id))
    skill_name = skill_result.scalar_one_or_none() or "una habilidad"
    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="skill_add",
        summary=f"Agregó la habilidad '{skill_name}' a su perfil",
    )

    await db.commit()
    await db.refresh(cs)
    return cs

@router.delete("/me/candidate/skills/{skill_id}", status_code=204)
async def remove_skill(
    skill_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    result = await db.execute(
        select(CandidateSkill).where(
            CandidateSkill.candidate_id == profile.id,
            CandidateSkill.skill_id == skill_id
        )
    )
    cs = result.scalar_one_or_none()
    if not cs:
        raise HTTPException(status_code=404, detail="Skill not found")

    await db.delete(cs)
    await db.commit()


# ── Languages ─────────────────────────────────────────────────────────────────

@router.get("/me/candidate/languages", response_model=List[LanguageResponse])
async def list_languages(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    result = await db.execute(select(Language).where(Language.candidate_id == profile.id))
    return result.scalars().all()

@router.post("/me/candidate/languages", response_model=LanguageResponse)
async def add_language(
    payload: LanguageCreate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    lang = Language(
        candidate_id=profile.id,
        language_name=payload.language_name,
        level=payload.level,
    )
    db.add(lang)
    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="language_add",
        summary=f"Agregó idioma: {payload.language_name} ({payload.level})",
    )
    await db.commit()
    await db.refresh(lang)
    return lang

@router.delete("/me/candidate/languages/{lang_id}", status_code=204)
async def delete_language(
    lang_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    result = await db.execute(
        select(Language).where(Language.id == lang_id, Language.candidate_id == profile.id)
    )
    lang = result.scalar_one_or_none()
    if not lang:
        raise HTTPException(status_code=404, detail="Language not found")

    await db.delete(lang)
    await db.commit()
