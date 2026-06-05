import resend
from app.core.config import settings
import structlog

logger = structlog.get_logger("app.integrations.resend")

def get_resend_client():
    if not settings.RESEND_API_KEY:
        return None
    resend.api_key = settings.RESEND_API_KEY
    return resend

def send_email(to: str, subject: str, html_content: str):
    client = get_resend_client()
    if not client:
        logger.warning("Resend not configured. Simulating email.", to=to, subject=subject, html_preview=html_content[:50])
        return {"id": "mock_email_id"}
        
    try:
        r = client.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": to,
            "subject": subject,
            "html": html_content
        })
        logger.info("email_sent", to=to, resend_id=r.get("id"))
        return r
    except Exception as e:
        logger.error("email_send_failed", error=str(e), to=to)
        raise e
