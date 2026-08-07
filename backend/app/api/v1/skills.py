from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from app.api.deps import get_db
from app.data.skills_catalog import IDIOMAS
from app.models.candidate import MAX_SKILLS_PER_CATEGORY, OTHER_SKILL_MAX_LENGTH
from app.models.catalogs import Skill, SkillCategory
from app.schemas.skill import SkillResponse, SkillCatalogResponse

router = APIRouter()


@router.get("/skills", response_model=SkillCatalogResponse)
async def list_skills(db: AsyncSession = Depends(get_db)):
    """El catálogo completo, agrupado en blandas y técnicas.

    Antes devolvía una lista plana filtrando por `status == active` sobre una tabla que nunca
    se sembró — de ahí el "no se despliegan habilidades" que reportó Eugenia.

    El catálogo es cerrado y lo cura Talency: el endpoint de sugerir habilidad se eliminó en
    agosto/2026 junto con su moderación (la pantalla del admin ya no existía desde julio y la
    notificación que mandaba llevaba a un 404).
    """
    result = await db.execute(
        select(Skill)
        .where(Skill.is_active == True)  # noqa: E712 — SQLAlchemy necesita ==, no `is`
        .order_by(Skill.sort_order.asc())
    )
    skills: List[Skill] = list(result.scalars().all())

    return SkillCatalogResponse(
        soft=[SkillResponse.model_validate(s) for s in skills if s.category == SkillCategory.soft],
        technical=[SkillResponse.model_validate(s) for s in skills if s.category == SkillCategory.technical],
        max_per_category=MAX_SKILLS_PER_CATEGORY,
        languages=IDIOMAS,
        other_skill_max_length=OTHER_SKILL_MAX_LENGTH,
    )
