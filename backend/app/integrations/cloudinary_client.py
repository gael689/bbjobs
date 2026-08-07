import re
import time
import cloudinary
import cloudinary.uploader
import cloudinary.utils
import structlog
from app.core.config import settings

logger = structlog.get_logger("app.integrations.cloudinary")

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_PDF_TYPES = {"application/pdf"}

# Cuánto vive el link firmado a un documento privado (CV, documentación de verificación).
# Corto a propósito: el link se genera recién cuando alguien con permiso aprieta "ver", así que
# no necesita sobrevivir a la sesión — y si se reenvía por mail o WhatsApp, se muere solo.
SIGNED_LINK_TTL_SECONDS = 300

# Los PDF se suben como `private`: nunca se entregan por el CDN, ni siquiera con la URL exacta.
# La única forma de bajarlos es el endpoint de descarga firmado (ver signed_document_url).
PRIVATE_DELIVERY_TYPE = "private"

# Los PDF viejos (subidos antes de este cambio) son `upload`. El tipo se deduce de la URL
# guardada en vez de agregar una columna: Cloudinary lo pone en el path.
# El `s--xxxxxxxx--/` es la firma que Cloudinary mete en la URL de entrega cuando el
# recurso es `private` o `authenticated`. Sin saltearla queda adentro del public_id y la
# URL firmada que se genera después apunta a un recurso inexistente: Cloudinary responde
# "Resource not found - s--uYtng0i9--/v1786107980/bbjobs/cvs/….pdf" — con la firma y la
# versión ahí metidas, que es la marca de este bug. Los CV subidos como `upload` no la
# llevan y por eso parseaban bien: fallaba sólo el que se subió privado.
_RAW_URL_RE = re.compile(
    r"/raw/(?P<delivery_type>upload|private|authenticated)/"
    r"(?:s--[^/]+--/)?"
    r"(?:v\d+/)?"
    r"(?P<public_id>.+)$"
)


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

    # Cloudinary sirve `resource_type="raw"` tal cual el public_id, sin inferir formato:
    # sin ".pdf" en el nombre, la URL no tiene extensión y el navegador descarga el
    # archivo como binario genérico (icono de "ejecutable" en vez de ícono de PDF).
    if not public_id.endswith(".pdf"):
        public_id = f"{public_id}.pdf"

    if not _configured():
        logger.warning("cloudinary_not_configured", folder=folder, public_id=public_id)
        return f"https://res.cloudinary.com/mock/{folder}/{public_id}"

    _configure()
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        public_id=public_id,
        resource_type="raw",
        type=PRIVATE_DELIVERY_TYPE,
        overwrite=True,
    )
    logger.info("cloudinary_pdf_uploaded", url=result["secure_url"])
    return result["secure_url"]


def signed_document_url(stored_url: str, *, attachment: bool = False) -> str | None:
    """Link firmado y de vida corta a un PDF privado, o None si la URL guardada no se entiende.

    Sirve tanto para los CV de los candidatos como para la documentación de verificación de
    empresas: las dos suben por `upload_pdf` y tenían el mismo 401.

    Va por el endpoint de descarga firmado de Cloudinary, no por el CDN: la cuenta tiene la
    entrega de PDF restringida y `res.cloudinary.com/.../raw/...` devuelve 401 **incluso para un
    archivo público y aun firmando la URL** (verificado contra la cuenta real el 06/08/2026 —
    era la causa del "Esta página no funciona / HTTP ERROR 401" que reportó Eugenia).

    `attachment=False` lo abre en el navegador; True fuerza la descarga.
    """
    if not stored_url:
        return None

    match = _RAW_URL_RE.search(stored_url)
    if not match:
        logger.warning("cloudinary_cv_url_no_parseable", url=stored_url)
        return None

    if not _configured():
        return stored_url

    _configure()
    # `format=None`: el public_id ya termina en ".pdf" (ver upload_pdf), y pasar el formato
    # aparte haría que Cloudinary lo agregue una segunda vez.
    return cloudinary.utils.private_download_url(
        match.group("public_id"),
        None,
        resource_type="raw",
        type=match.group("delivery_type"),
        attachment=attachment,
        expires_at=int(time.time()) + SIGNED_LINK_TTL_SECONDS,
    )


def delete_file(public_id: str, resource_type: str = "image", delivery_type: str = "upload") -> None:
    """Borra un asset. `delivery_type` importa: un PDF subido como `private` no se borra con el
    default `upload` — Cloudinary devuelve "not found" sin error y el archivo queda vivo."""
    if not _configured():
        return
    _configure()
    try:
        cloudinary.uploader.destroy(public_id, resource_type=resource_type, type=delivery_type)
    except Exception as e:
        logger.error("cloudinary_delete_error", public_id=public_id, error=str(e))
