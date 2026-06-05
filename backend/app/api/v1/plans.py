from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid
from app.api.deps import get_db, require_role
from app.models.core import UserRole
from app.models.payment import Plan
from app.schemas.payment import PlanResponse, PlanCreate, PlanUpdate

router = APIRouter()

@router.get("/admin/plans", response_model=List[PlanResponse])
async def list_plans(
    # current_user = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Plan).order_by(Plan.monthly_price))
    return result.scalars().all()

@router.post("/admin/plans", response_model=PlanResponse)
async def create_plan(
    payload: PlanCreate,
    current_user = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db)
):
    plan = Plan(**payload.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan

@router.patch("/admin/plans/{id}", response_model=PlanResponse)
async def update_plan(
    id: uuid.UUID,
    payload: PlanUpdate,
    current_user = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Plan).where(Plan.id == id))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(plan, key, value)
        
    await db.commit()
    await db.refresh(plan)
    return plan
