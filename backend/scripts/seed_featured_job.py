"""
Ad-hoc: marca una búsqueda existente como destacada (con Payment + JobFeature "aprobados",
igual al estado final que deja el webhook real de Mercado Pago) para poder ver el estilo
"Destacada" en el frontend sin pasar por un pago real. Sólo para desarrollo local.

Uso: python scripts/seed_featured_job.py
"""
import asyncio
import datetime
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.future import select

from app.db.session import async_session_maker
from app.models.company import CompanyProfile
from app.models.job import JobModerationStatus, JobPosting, JobPostingStatus
from app.models.payment import JobFeature, JobFeatureStatus, Payment, PaymentType
from app.schemas.payment import FEATURED_JOB_CURRENCY, FEATURED_JOB_PRICE


async def main():
    async with async_session_maker() as db:
        result = await db.execute(
            select(JobPosting).where(
                JobPosting.company_id.is_not(None),
                JobPosting.is_featured.is_(False),
            ).limit(1)
        )
        job = result.scalar_one_or_none()

        if not job:
            print("No hay ninguna búsqueda sin destacar en la base — publicá una desde el panel de empresa primero.")
            return

        # Fuerza la búsqueda a estado visible en el portal público, para que el destacado
        # se note en /empleos y no sólo en los paneles internos.
        job.status = JobPostingStatus.active
        job.moderation_status = JobModerationStatus.approved
        now = datetime.datetime.now(datetime.timezone.utc)
        if not job.expires_at:
            job.expires_at = now + datetime.timedelta(days=20)

        payment = Payment(
            company_id=job.company_id,
            type=PaymentType.job_feature,
            amount=FEATURED_JOB_PRICE,
            currency=FEATURED_JOB_CURRENCY,
            mp_payment_id=f"seed-{job.id}",
            mp_status="approved",
            paid_at=now,
        )
        db.add(payment)
        await db.flush()

        feature = JobFeature(
            job_posting_id=job.id,
            payment_id=payment.id,
            starts_at=now,
            ends_at=job.expires_at,
            status=JobFeatureStatus.active,
        )
        db.add(feature)
        await db.flush()

        payment.related_job_feature_id = feature.id
        job.is_featured = True
        job.featured_until = job.expires_at

        await db.commit()

        result = await db.execute(select(CompanyProfile).where(CompanyProfile.id == job.company_id))
        company = result.scalar_one_or_none()
        print(f"Listo: '{job.title}' ({company.legal_name if company else job.company_id}) ahora está destacada.")
        print(f"Estado: {job.status.value} / {job.moderation_status.value} — destacada hasta {job.featured_until}")


if __name__ == "__main__":
    asyncio.run(main())
