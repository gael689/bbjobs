"""El parseo de las URLs guardadas de Cloudinary.

De acá sale el link firmado con el que se ven los CV. Si el parseo falla, el CV vuelve a ser
inaccesible — que es exactamente el bug que reportó Eugenia (HTTP 401 al abrir el PDF).

El punto delicado es el `type` de entrega: los CV subidos antes de agosto/2026 son `upload` y
los nuevos son `private`. Firmar con el type equivocado devuelve 404, así que tiene que salir
de la URL guardada, no asumirse.
"""
import pytest

from app.integrations.cloudinary_client import _RAW_URL_RE


def _parse(url: str):
    m = _RAW_URL_RE.search(url)
    return (m.group("delivery_type"), m.group("public_id")) if m else None


BASE = "https://res.cloudinary.com/dbvu6oplq/raw"


@pytest.mark.parametrize(
    "url, esperado",
    [
        # CV viejos: type=upload, con version. Es la forma real que quedó en la base.
        (
            f"{BASE}/upload/v1785882272/bbjobs/cvs/3f9d946b-1234-5678-9abc-def012345678.pdf",
            ("upload", "bbjobs/cvs/3f9d946b-1234-5678-9abc-def012345678.pdf"),
        ),
        # CV nuevos: type=private.
        (
            f"{BASE}/private/v1786020278/bbjobs/cvs/abc.pdf",
            ("private", "bbjobs/cvs/abc.pdf"),
        ),
        # Sin segmento de version — Cloudinary no siempre lo incluye.
        (f"{BASE}/upload/bbjobs/cvs/abc.pdf", ("upload", "bbjobs/cvs/abc.pdf")),
        # Documentación de verificación de empresa: mismo mecanismo, carpeta anidada.
        (
            f"{BASE}/private/v1/bbjobs/verification_docs/empresa-1/doc-2.pdf",
            ("private", "bbjobs/verification_docs/empresa-1/doc-2.pdf"),
        ),
    ],
)
def test_extrae_tipo_de_entrega_y_public_id(url, esperado):
    assert _parse(url) == esperado


def test_no_confunde_una_imagen_con_un_raw():
    """Las fotos e isologos van por resource_type=image y no se firman por esta vía."""
    assert _parse(f"https://res.cloudinary.com/dbvu6oplq/image/upload/v1/bbjobs/logos/x.png") is None


def test_url_desconocida_no_revienta():
    assert _parse("https://ejemplo.com/algo.pdf") is None
    assert _parse("") is None

def test_url_privada_con_firma_no_se_come_el_public_id():
    """La entrega privada mete `s--xxxx--/` antes de la version.

    Sin saltearla quedaba adentro del public_id y Cloudinary respondia
    "Resource not found - s--uYtng0i9--/v1786107980/bbjobs/cvs/....pdf".
    Rompia SOLO los CV subidos como private: los `upload` no llevan firma, y
    por eso 14 de 15 andaban y el bug parecia aleatorio.
    """
    url = ("https://res.cloudinary.com/dbvu6oplq/raw/private/s--uYtng0i9--/"
           "v1786107980/bbjobs/cvs/5f4111aa-1ad9-4390-b8f5-015212d3f02a.pdf")
    m = _RAW_URL_RE.search(url)
    assert m is not None
    assert m.group("delivery_type") == "private"
    assert m.group("public_id") == "bbjobs/cvs/5f4111aa-1ad9-4390-b8f5-015212d3f02a.pdf"
