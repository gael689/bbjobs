from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
import uuid
from app.models.payment import SubscriptionStatus, PaymentType, JobFeatureStatus

# Precio fijo de destacar una búsqueda — único producto pago de Fase 1. No es configurable por
# admin (a diferencia del viejo diseño de "duración configurable"): un número fijo en el código,
# igual que su espejo en el frontend (dashboard/company/types.ts::FEATURED_JOB_PRICE).
FEATURED_JOB_PRICE: float = 5000.0
FEATURED_JOB_CURRENCY: str = "ARS"

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


class JobFeatureResponse(BaseModel):
    id: uuid.UUID
    job_posting_id: uuid.UUID
    status: JobFeatureStatus
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FeatureStatusResponse(BaseModel):
    """Estado puntual de un job — usado por el frontend para el polling al volver del checkout
    de Mercado Pago. La fuente de verdad sigue siendo el webhook; esto sólo refleja lo que ya
    se resolvió."""
    payment_status: Optional[str] = None  # Payment.mp_status: approved/rejected/pending/None
    feature_status: Optional[JobFeatureStatus] = None
    is_featured: bool
    featured_until: Optional[datetime] = None


class FeatureHistoryItem(BaseModel):
    """Una fila del historial de 'destacar búsqueda' — reusada tanto por
    GET /me/company/features (scoped a la empresa logueada) como por GET /admin/features
    (todas las empresas, con company_name adicional)."""
    payment_id: uuid.UUID
    job_posting_id: uuid.UUID
    job_title: str
    company_name: Optional[str] = None  # sólo se completa en la vista admin
    amount: float
    currency: str
    payment_status: Optional[str] = None
    feature_status: JobFeatureStatus
    purchased_at: datetime
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None

