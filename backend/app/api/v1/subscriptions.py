from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.deps import get_db, require_role, require_verified_company
from app.models.core import UserRole
from app.models.company import CompanyProfile
from app.models.payment import Subscription, Plan
from app.schemas.payment import SubscriptionResponse

router = APIRouter()

@router.get("/me/company/subscription", response_model=SubscriptionResponse)
async def get_my_subscription(
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.company_id == company.id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    # Manual load of plan since we don't assume selectinload
    res_plan = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
    plan = res_plan.scalar_one_or_none()
    
    sub.plan = plan # dynamically attach for pydantic
    return sub
