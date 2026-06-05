from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid
from app.models.payment import SubscriptionStatus, PaymentType

class PlanCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    monthly_price: float
    currency: str = "ARS"
    max_active_job_postings: Optional[int] = None
    max_visible_applications_per_posting: Optional[int] = None
    includes_psychometric_results: bool = False
    includes_observatory_full: bool = False
    included_featured_per_month: int = 0
    features_json: Optional[dict[str, Any]] = None
    is_active: bool = True

class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    monthly_price: Optional[float] = None
    is_active: Optional[bool] = None
    features_json: Optional[dict[str, Any]] = None

class PlanResponse(PlanCreate):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    plan: PlanResponse
    status: SubscriptionStatus
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool
    
    class Config:
        from_attributes = True

class PaymentCheckoutResponse(BaseModel):
    init_point: str
    payment_id: uuid.UUID
