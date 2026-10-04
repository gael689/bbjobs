"""Los estados se guardan y se comparan por su valor, nunca con str() del enum.

Desde Python 3.11, `str(ApplicationStatus.selected)` es "ApplicationStatus.selected". Eso
rompió el historial de postulaciones y la comparación del estado de verificación al borrar
una empresa (el CUIT de una empresa suspendida se liberaba igual).
"""
from app.models.company import VerificationStatus
from app.models.job import ApplicationStatus
from app.services.history import _status_value


def test_status_value_de_enum_es_el_valor_crudo():
    assert _status_value(ApplicationStatus.selected) == "selected"


def test_status_value_de_texto_queda_igual():
    assert _status_value("in_process") == "in_process"


def test_status_value_de_none_es_none():
    assert _status_value(None) is None


def test_verificacion_leida_de_la_base_se_compara_contra_el_enum():
    # La columna es String(50): de la base vuelve texto plano.
    desde_la_base = "suspended"
    assert desde_la_base in (VerificationStatus.suspended, VerificationStatus.rejected)
    assert "verified" not in (VerificationStatus.suspended, VerificationStatus.rejected)


def test_verificacion_como_enum_tambien_compara():
    assert VerificationStatus.rejected in (VerificationStatus.suspended, VerificationStatus.rejected)
