import structlog
from app.integrations.resend_client import send_email

logger = structlog.get_logger("app.services.email")

async def send_email_verification(email: str, token: str):
    """
    Enviar correo de verificación usando Resend.
    """
    logger.info("send_email_verification", email=email, token=token)
    html = f"<h1>Verifica tu email</h1><p>Tu token es: {token}</p>"
    return send_email(email, "Verifica tu cuenta en BBJobs", html)

async def send_password_reset(email: str, token: str):
    """
    Enviar correo de reseteo de contraseña.
    """
    logger.info("send_password_reset", email=email, token=token)
    html = f"<h1>Reseteo de Password</h1><p>Tu token es: {token}</p>"
    return send_email(email, "Resetea tu contraseña en BBJobs", html)

async def send_application_received(email: str, job_title: str):
    logger.info("send_application_received", email=email, job_title=job_title)
    html = f"<h2>Postulación recibida</h2><p>Tu postulación para la búsqueda <b>{job_title}</b> ha sido enviada con éxito.</p>"
    return send_email(email, "Postulación recibida", html)

