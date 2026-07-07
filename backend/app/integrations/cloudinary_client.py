import cloudinary
import cloudinary.uploader
import structlog
from app.core.config import settings

logger = structlog.get_logger("app.integrations.cloudinary")

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_PDF_TYPES = {"application/pdf"}


def _configured() -> bool:
    return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)


def _configure():
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_image(file_bytes: bytes, folder: str, public_id: str, content_type: str) -> str:
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError(f"Tipo de archivo no permitido: {content_type}")

    if not _configured():
        logger.warning("cloudinary_not_configured", folder=folder, public_id=public_id)
        return f"https://res.cloudinary.com/mock/{folder}/{public_id}"

    _configure()
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        public_id=public_id,
        resource_type="image",
        overwrite=True,
    )
    logger.info("cloudinary_image_uploaded", url=result["secure_url"])
    return result["secure_url"]


def upload_pdf(file_bytes: bytes, folder: str, public_id: str, content_type: str) -> str:
    if content_type not in ALLOWED_PDF_TYPES:
        raise ValueError(f"Solo se permiten archivos PDF")

    if not _configured():
        logger.warning("cloudinary_not_configured", folder=folder, public_id=public_id)
        return f"https://res.cloudinary.com/mock/{folder}/{public_id}.pdf"

    _configure()
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        public_id=public_id,
        resource_type="raw",
        overwrite=True,
    )
    logger.info("cloudinary_pdf_uploaded", url=result["secure_url"])
    return result["secure_url"]


def delete_file(public_id: str, resource_type: str = "image") -> None:
    if not _configured():
        return
    _configure()
    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    except Exception as e:
        logger.error("cloudinary_delete_error", public_id=public_id, error=str(e))
