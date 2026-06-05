import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from app.core.config import settings
import structlog
import uuid

logger = structlog.get_logger("app.integrations.r2")

def get_s3_client():
    if not settings.R2_ACCOUNT_ID:
        return None
        
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )

def upload_file_to_r2(file_content: bytes, object_name: str, content_type: str) -> str:
    """
    Sube un archivo a Cloudflare R2 y retorna la URL pública.
    """
    s3_client = get_s3_client()
    if not s3_client:
        logger.warning("R2 no configurado. Simulando subida de archivo.", object_name=object_name)
        return f"https://mock-r2-url.com/{object_name}"
        
    try:
        s3_client.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=object_name,
            Body=file_content,
            ContentType=content_type
        )
        url = f"{settings.R2_PUBLIC_URL}/{object_name}"
        logger.info("file_uploaded_to_r2", url=url)
        return url
    except ClientError as e:
        logger.error("r2_upload_error", error=str(e))
        raise e

def generate_presigned_url(object_name: str, expiration=3600) -> str:
    """
    Genera URL firmada temporal (útil si el bucket es privado)
    """
    s3_client = get_s3_client()
    if not s3_client:
        return f"https://mock-r2-url.com/{object_name}?token=mock"
        
    try:
        response = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': settings.R2_BUCKET_NAME, 'Key': object_name},
            ExpiresIn=expiration
        )
        return response
    except ClientError as e:
        logger.error("r2_presigned_url_error", error=str(e))
        raise e
