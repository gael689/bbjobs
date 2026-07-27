from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc, asc
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from app.api.deps import get_db, require_role
from app.models.core import User, UserRole
from app.models.landing import LandingStat
from pydantic import BaseModel

router = APIRouter()

class LandingStatResponse(BaseModel):
    id: uuid.UUID
    icon: str
    value: str
    label: str
    sort_order: int
    visible: bool
    class Config:
        from_attributes = True

class LandingStatCreate(BaseModel):
    icon: str = "BriefcaseIcon"
    value: str
    label: str
    sort_order: int = 0
    visible: bool = True

class LandingStatUpdate(BaseModel):
    icon: Optional[str] = None
    value: Optional[str] = None
    label: Optional[str] = None
    sort_order: Optional[int] = None
    visible: Optional[bool] = None

class ReorderItem(BaseModel):
    id: uuid.UUID
    sort_order: int

class ReorderPayload(BaseModel):
    items: List[ReorderItem]

@router.get("/public/landing-stats", response_model=List[LandingStatResponse])
async def get_public_landing_stats(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LandingStat)
        .where(LandingStat.visible == True)
        .order_by(LandingStat.sort_order.asc())
    )
    return result.scalars().all()

@router.get("/admin/landing-stats", response_model=List[LandingStatResponse])
async def get_admin_landing_stats(
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LandingStat).order_by(LandingStat.sort_order.asc())
    )
    return result.scalars().all()

@router.post("/admin/landing-stats", response_model=LandingStatResponse)
async def create_landing_stat(
    payload: LandingStatCreate,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    stat = LandingStat(**payload.model_dump())
    db.add(stat)
    await db.commit()
    await db.refresh(stat)
    return stat

@router.patch("/admin/landing-stats/reorder")
async def reorder_landing_stats(
    payload: ReorderPayload,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all items to update
    stat_ids = [item.id for item in payload.items]
    result = await db.execute(select(LandingStat).where(LandingStat.id.in_(stat_ids)))
    stats = result.scalars().all()
    
    stat_map = {stat.id: stat for stat in stats}
    for item in payload.items:
        if item.id in stat_map:
            stat_map[item.id].sort_order = item.sort_order
            
    await db.commit()
    return {"status": "ok"}

@router.patch("/admin/landing-stats/{id}", response_model=LandingStatResponse)
async def update_landing_stat(
    id: uuid.UUID,
    payload: LandingStatUpdate,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LandingStat).where(LandingStat.id == id))
    stat = result.scalar_one_or_none()
    if not stat:
        raise HTTPException(status_code=404, detail="Landing stat not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(stat, key, value)
    
    await db.commit()
    await db.refresh(stat)
    return stat

@router.delete("/admin/landing-stats/{id}")
async def delete_landing_stat(
    id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LandingStat).where(LandingStat.id == id))
    stat = result.scalar_one_or_none()
    if not stat:
        raise HTTPException(status_code=404, detail="Landing stat not found")
    
    await db.delete(stat)
    await db.commit()
    return {"status": "ok"}
