from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid
import datetime
from app.api.deps import get_db, require_verified_company
from app.models.company import CompanyProfile
from app.models.job import JobPosting
from app.models.payment import Payment, PaymentType, JobFeature, JobFeatureStatus
from app.schemas.payment import PaymentCheckoutResponse
from app.integrations.mercado_pago import create_preference

router = APIRouter()

@router.post("/me/company/jobs/{id}/feature", response_model=PaymentCheckoutResponse)
async def feature_job(
    id: uuid.UUID,
    company: CompanyProfile = Depends(require_verified_company),
    db: AsyncSession = Depends(get_db)
):
    # Retrieve job
    result_job = await db.execute(select(JobPosting).where(JobPosting.id == id, JobPosting.company_id == company.id))
    job = result_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job posting not found")
        
    # Check if already featured
    if job.is_featured:
        raise HTTPException(status_code=400, detail="Job is already featured")
        
    # Create internal Payment record in pending state
    # Fixed price for featuring for simplicity: 5000 ARS
    payment = Payment(
        company_id=company.id,
        type=PaymentType.job_feature,
        amount=5000.0,
        currency="ARS",
    )
    db.add(payment)
    await db.flush()
    
    # Create internal JobFeature record
    feature = JobFeature(
        job_posting_id=job.id,
        payment_id=payment.id,
        status=JobFeatureStatus.pending_payment
    )
    db.add(feature)
    await db.flush()
    
    # Generate MP preference
    success_url = f"http://localhost:3000/me/company/jobs/{job.id}" # Hardcoded for now
    init_point = create_preference(
        title=f"Destacar búsqueda: {job.title}",
        price=5000.0,
        external_reference=str(payment.id),
        success_url=success_url
    )
    
    await db.commit()
    return {"init_point": init_point, "payment_id": payment.id}
