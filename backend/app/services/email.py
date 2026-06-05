import structlog

logger = structlog.get_logger("app.services.email")

async def send_email_verification(email: str, token: str):
    """
    Stub para enviar correo de verificación usando Resend + Jinja2.
    """
    logger.info("send_email_verification", email=email, token=token)
    # TODO: Implementar llamada real a resend.Emails.send(...)
    return True

async def send_password_reset(email: str, token: str):
    """
    Stub para enviar correo de reseteo de contraseña.
    """
    logger.info("send_password_reset", email=email, token=token)
    # TODO: Implementar llamada real a resend.Emails.send(...)
    return True
