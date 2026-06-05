from apscheduler.schedulers.asyncio import AsyncIOScheduler
import structlog
from app.db.session import async_session_maker
from sqlalchemy.future import select
from app.models.job import JobPosting
from app.models.payment import JobFeature, JobFeatureStatus
import datetime

logger = structlog.get_logger("app.core.scheduler")
scheduler = AsyncIOScheduler()

async def check_expired_features():
    logger.info("running_job_check_expired_features")
    async with async_session_maker() as db:
        now = datetime.datetime.now(datetime.timezone.utc)
        
        # Encuentra features activos que ya pasaron ends_at
        res_feat = await db.execute(
            select(JobFeature).where(
                JobFeature.status == JobFeatureStatus.active,
                JobFeature.ends_at < now
            )
        )
        expired_features = res_feat.scalars().all()
        
        for feature in expired_features:
            feature.status = JobFeatureStatus.expired
            res_job = await db.execute(select(JobPosting).where(JobPosting.id == feature.job_posting_id))
            job = res_job.scalar_one_or_none()
            if job:
                job.is_featured = False
                
        if expired_features:
            logger.info("expired_features_processed", count=len(expired_features))
            await db.commit()

def start_scheduler():
    scheduler.add_job(check_expired_features, "interval", hours=1)
    scheduler.start()
    logger.info("scheduler_started")
