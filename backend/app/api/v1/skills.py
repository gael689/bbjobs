from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.api.deps import get_db, require_role, get_current_user
from app.models.catalogs import Skill, SkillStatus
from app.schemas.skill import SkillResponse, SkillSuggest
from app.models.core import User

router = APIRouter()

@router.get("/skills", response_model=List[SkillResponse])
async def list_skills(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Skill).where(Skill.status == SkillStatus.active))
    return result.scalars().all()

@router.post("/skills/suggest", response_model=SkillResponse)
async def suggest_skill(
    payload: SkillSuggest,
    current_user: User = Depends(get_current_user), # Any authenticated user can suggest
    db: AsyncSession = Depends(get_db)
):
    skill = Skill(
        name=payload.name,
        status=SkillStatus.pending,
        created_by_user_id=current_user.id
    )
    db.add(skill)
    await db.commit()
    await db.refresh(skill)
    return skill
