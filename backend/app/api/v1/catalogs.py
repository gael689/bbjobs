from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from pydantic import BaseModel
import uuid

from app.api.deps import get_db
from app.models.catalogs import Industry, Zone, ContractType

router = APIRouter()


class IndustryResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    class Config:
        from_attributes = True


class ZoneResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    class Config:
        from_attributes = True


class ContractTypeResponse(BaseModel):
    id: uuid.UUID
    name: str

    class Config:
        from_attributes = True


@router.get("/catalogs/industries", response_model=List[IndustryResponse])
async def list_industries(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Industry).where(Industry.is_active == True).order_by(Industry.name))
    return result.scalars().all()


@router.get("/catalogs/zones", response_model=List[ZoneResponse])
async def list_zones(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Zone).where(Zone.is_active == True).order_by(Zone.name))
    return result.scalars().all()


@router.get("/catalogs/contract-types", response_model=List[ContractTypeResponse])
async def list_contract_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ContractType).order_by(ContractType.name))
    return result.scalars().all()
