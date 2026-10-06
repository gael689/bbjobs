"""Versión vigente de los términos y la política de privacidad.

Una sola versión para los dos documentos: se publican y se aceptan juntos. Al cambiar el texto de
`/terminos` o `/privacidad` de forma importante, se sube la versión acá y en
`frontend/src/lib/legal.ts`: quien tenga aceptada una anterior la vuelve a aceptar al entrar a su
panel.
"""
from datetime import date

LEGAL_VERSION = "2.0"
LEGAL_VIGENTE_DESDE = date(2026, 10, 6)
LEGAL_DOCUMENTS = ("terminos", "privacidad")
