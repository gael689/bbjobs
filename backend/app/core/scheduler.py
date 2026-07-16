from apscheduler.schedulers.asyncio import AsyncIOScheduler
import structlog
from app.db.session import async_session_maker
from sqlalchemy.future import select
from app.models.company import CompanyProfile
from app.models.job import JobPosting, JobPostingStatus
from app.services.notifications import create_notification
from app.services.job_features import end_active_feature_for_job
import datetime

logger = structlog.get_logger("app.core.scheduler")
scheduler = AsyncIOScheduler()

# Aviso "vence pronto" — se manda una única vez por búsqueda, cuando entra en esta ventana.
EXPIRING_SOON_WINDOW_DAYS = 3

# El destacado ya no vence por su propio timer (ver services/job_features.py) — se apaga como
# consecuencia directa de que la búsqueda deja de estar activa, dentro de expire_jobs() (acá
# abajo), en admin.py::takedown_job y en jobs.py::update_job_posting al cerrarla manualmente.

async def expire_jobs():
    logger.info("running_job_expire_jobs")
    async with async_session_maker() as db:
        now = datetime.datetime.now(datetime.timezone.utc)

        res_jobs = await db.execute(
            select(JobPosting).where(
                JobPosting.status == JobPostingStatus.active,
                JobPosting.expires_at.is_not(None),
                JobPosting.expires_at < now,
            )
        )
        expired_jobs = res_jobs.scalars().all()

        for job in expired_jobs:
            job.status = JobPostingStatus.expired
            job.closed_at = now
            if job.is_featured:
                await end_active_feature_for_job(db, job)
            if job.company_id:
                res_company = await db.execute(
                    select(CompanyProfile).where(CompanyProfile.id == job.company_id)
                )
                company = res_company.scalar_one_or_none()
                if company:
                    await create_notification(
                        db,
                        user_id=company.user_id,
                        type="job_expired",
                        title="Tu búsqueda venció",
                        body=f"La búsqueda '{job.title}' llegó a su plazo máximo de {job.duration_days} días y dejó de estar visible en el portal.",
                        link="/dashboard/company/estadisticas",
                    )

        if expired_jobs:
            logger.info("jobs_expired_processed", count=len(expired_jobs))
            await db.commit()


async def notify_expiring_soon():
    logger.info("running_job_notify_expiring_soon")
    async with async_session_maker() as db:
        now = datetime.datetime.now(datetime.timezone.utc)
        soon_cutoff = now + datetime.timedelta(days=EXPIRING_SOON_WINDOW_DAYS)

        res_jobs = await db.execute(
            select(JobPosting).where(
                JobPosting.status == JobPostingStatus.active,
                JobPosting.expires_at.is_not(None),
                JobPosting.expires_at <= soon_cutoff,
                JobPosting.expires_at > now,
                JobPosting.expiring_soon_notified_at.is_(None),
            )
        )
        jobs_expiring_soon = res_jobs.scalars().all()

        for job in jobs_expiring_soon:
            job.expiring_soon_notified_at = now
            if job.company_id:
                res_company = await db.execute(
                    select(CompanyProfile).where(CompanyProfile.id == job.company_id)
                )
                company = res_company.scalar_one_or_none()
                if company:
                    days_left = max(0, (job.expires_at - now).days)
                    await create_notification(
                        db,
                        user_id=company.user_id,
                        type="job_expiring_soon",
                        title="Tu búsqueda está por vencer",
                        body=f"'{job.title}' se va a dar de baja en {days_left} día{'s' if days_left != 1 else ''} por llegar a su plazo máximo. Revisá el estado de tus búsquedas desde tu panel.",
                        link="/dashboard/company/estadisticas",
                    )

        if jobs_expiring_soon:
            logger.info("expiring_soon_notified", count=len(jobs_expiring_soon))
            await db.commit()


def start_scheduler():
    scheduler.add_job(expire_jobs, "interval", hours=1)
    scheduler.add_job(notify_expiring_soon, "interval", hours=1)
    scheduler.start()
    logger.info("scheduler_started")
