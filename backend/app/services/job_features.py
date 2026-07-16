from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.job import JobPosting
from app.models.payment import JobFeature, JobFeatureStatus


async def end_active_feature_for_job(db: AsyncSession, job: JobPosting) -> None:
    """Apaga el destacado de una búsqueda que deja de estar activa — vencida, cerrada por la
    empresa, o dada de baja por un admin, sin importar el motivo. La duración del destacado no
    es un timer propio: dura exactamente lo que dure la búsqueda, así que se apaga como
    consecuencia directa de que la búsqueda deja de estar activa, en el mismo momento en que eso
    pasa. No manda notificación aparte — la búsqueda ya notifica su propio evento (vencimiento,
    baja), avisar también "se terminó tu destacado" sería ruido redundante."""
    result = await db.execute(
        select(JobFeature).where(
            JobFeature.job_posting_id == job.id,
            JobFeature.status == JobFeatureStatus.active,
        )
    )
    feature = result.scalar_one_or_none()
    if feature:
        feature.status = JobFeatureStatus.expired

    job.is_featured = False
    job.featured_until = None
