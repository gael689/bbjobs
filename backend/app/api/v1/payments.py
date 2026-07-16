from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid
from app.api.deps import get_db, require_verified_company
from app.core.config import settings
from app.models.company import CompanyProfile
from app.models.job import JobPosting, JobPostingStatus
from app.models.payment import Payment, PaymentType, JobFeature, JobFeatureStatus
from app.schemas.payment import (
    PaymentCheckoutResponse, FeatureStatusResponse, FeatureHistoryItem,
    FEATURED_JOB_PRICE, FEATURED_JOB_CURRENCY,
)
from app.integrations.mercado_pago import create_preference

router = APIRouter()

# Estados de JobFeature que impiden empezar un pago nuevo sobre la misma búsqueda — ya hay uno
# en curso o ya está destacada. Coincide con el índice único parcial de la migración
# e9f2a6c4b8d1 (mismo criterio a nivel aplicación y a nivel base de datos).
_BLOCKING_FEATURE_STATUSES = (JobFeatureStatus.pending_payment, JobFeatureStatus.active)


@router.post("/me/company/jobs/{id}/feature", response_model=PaymentCheckoutResponse)
async def feature_job(
    id: uuid.UUID,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    result_job = await db.execute(select(JobPosting).where(JobPosting.id == id, JobPosting.company_id == company.id))
    job = result_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found")

    # Se puede pagar con la búsqueda todavía pendiente de aprobación (gana prioridad de
    # revisión) o ya aprobada — sólo se bloquea si la búsqueda ya terminó su ciclo de vida.
    if job.status in (JobPostingStatus.closed, JobPostingStatus.expired):
        raise HTTPException(status_code=400, detail="No se puede destacar una búsqueda cerrada o vencida")

    result_existing = await db.execute(
        select(JobFeature).where(
            JobFeature.job_posting_id == job.id,
            JobFeature.status.in_(_BLOCKING_FEATURE_STATUSES),
        )
    )
    if result_existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Ya hay un pago en curso o un destacado activo para esta búsqueda",
        )

    payment = Payment(
        company_id=company.id,
        type=PaymentType.job_feature,
        amount=FEATURED_JOB_PRICE,
        currency=FEATURED_JOB_CURRENCY,
    )
    db.add(payment)
    await db.flush()

    feature = JobFeature(
        job_posting_id=job.id,
        payment_id=payment.id,
        status=JobFeatureStatus.pending_payment,
    )
    db.add(feature)
    await db.flush()

    success_url = f"{settings.FRONTEND_URL}/dashboard/company/pagos?payment_id={payment.id}&job_id={job.id}"
    init_point = create_preference(
        title=f"Destacar búsqueda: {job.title}",
        price=FEATURED_JOB_PRICE,
        external_reference=str(payment.id),
        success_url=success_url,
    )

    await db.commit()
    return {"init_point": init_point, "payment_id": payment.id}


@router.get("/me/company/jobs/{id}/feature/status", response_model=FeatureStatusResponse)
async def get_job_feature_status(
    id: uuid.UUID,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    """Chequeo puntual del estado de un destacado/pago — lo usa el frontend para el polling al
    volver del checkout de Mercado Pago. La fuente de verdad sigue siendo el webhook; esto sólo
    refleja lo que ya se resolvió en ese momento."""
    result_job = await db.execute(select(JobPosting).where(JobPosting.id == id, JobPosting.company_id == company.id))
    job = result_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found")

    result_feat = await db.execute(
        select(JobFeature)
        .where(JobFeature.job_posting_id == job.id)
        .order_by(JobFeature.created_at.desc())
        .limit(1)
    )
    feature = result_feat.scalar_one_or_none()

    payment_status = None
    if feature and feature.payment_id:
        result_pay = await db.execute(select(Payment.mp_status).where(Payment.id == feature.payment_id))
        payment_status = result_pay.scalar_one_or_none()

    return FeatureStatusResponse(
        payment_status=payment_status,
        feature_status=feature.status if feature else None,
        is_featured=job.is_featured,
        featured_until=job.featured_until,
    )


@router.get("/me/company/features", response_model=List[FeatureHistoryItem])
async def list_my_feature_history(
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment, JobFeature, JobPosting.title)
        .join(JobFeature, JobFeature.payment_id == Payment.id)
        .join(JobPosting, JobPosting.id == JobFeature.job_posting_id)
        .where(Payment.company_id == company.id, Payment.type == PaymentType.job_feature)
        .order_by(Payment.created_at.desc())
    )
    return [
        FeatureHistoryItem(
            payment_id=payment.id,
            job_posting_id=feature.job_posting_id,
            job_title=job_title,
            amount=payment.amount,
            currency=payment.currency,
            payment_status=payment.mp_status,
            feature_status=feature.status,
            purchased_at=payment.created_at,
            starts_at=feature.starts_at,
            ends_at=feature.ends_at,
        )
        for payment, feature, job_title in result.all()
    ]
