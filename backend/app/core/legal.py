"""Versión vigente de los términos y la política de privacidad.

Una sola versión para los dos documentos: se publican y se aceptan juntos. Al cambiar el texto de
`/terminos` o `/privacidad` de forma importante, se sube la versión acá y en
`frontend/src/lib/legal.ts`: quien tenga aceptada una anterior la vuelve a aceptar al entrar a su
panel.

Hay dos textos vivos:
- **2.0** (06/10/2026): lo que hace la plataforma con la compuerta de módulos nuevos cerrada.
- **3.0**: suma IA, mails, Revisión de CV, observaciones de las empresas, "Vieron tu CV" y el aviso
  de "está en otro proceso". Rige **sólo con la compuerta abierta** (el frontend la muestra con
  `NEXT_PUBLIC_MODULOS_NUEVOS=true`), así que abrir la compuerta pide la re-aceptación a todos.

Lo nuevo que se apoya en el consentimiento de la 3.0 (la IA y el aviso de otro proceso) **sólo se
aplica a quien la aceptó**: `accepted_ai_terms` es ese filtro (Ley 25.326, art. 5 y 11).
"""
from datetime import date

from sqlalchemy import and_, exists

from app.core.features import new_modules_enabled

LEGAL_VERSION_BASE = "2.0"
LEGAL_VIGENTE_DESDE_BASE = date(2026, 10, 6)
LEGAL_VERSION_MODULOS = "3.0"
LEGAL_DOCUMENTS = ("terminos", "privacidad")
# Versiones que informan y piden consentimiento para la IA. Al publicar una 3.1, 4.0, etc. que lo
# siga incluyendo, se suma acá.
AI_CONSENT_VERSIONS = (LEGAL_VERSION_MODULOS,)


def current_version() -> str:
    return LEGAL_VERSION_MODULOS if new_modules_enabled() else LEGAL_VERSION_BASE


def current_vigente_desde() -> date:
    """La 3.0 rige desde `LEGAL_V3_VIGENTE_DESDE` (el día que se abre la compuerta en producción)."""
    from app.core.config import settings

    if new_modules_enabled():
        return settings.LEGAL_V3_VIGENTE_DESDE or date.today()
    return LEGAL_VIGENTE_DESDE_BASE


def accepted_ai_terms(user_id_column):
    """Condición SQL: el usuario de `user_id_column` aceptó una versión de privacidad que informa la IA."""
    from app.models.legal import LegalAcceptance

    return exists().where(and_(
        LegalAcceptance.user_id == user_id_column,
        LegalAcceptance.document == "privacidad",
        LegalAcceptance.version.in_(AI_CONSENT_VERSIONS),
    ))
