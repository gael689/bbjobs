"""Cercanía entre zonas (plan final §2.1): una sola tabla para el puntaje y los mails."""
import uuid

import pytest

from app.services.zonas import DESCONOCIDA, proximidad, proximidad_ids

BAHIA = ("bahia-blanca", "zona-norte", "zona-sur")


@pytest.mark.parametrize("a", BAHIA)
@pytest.mark.parametrize("b", BAHIA)
def test_bahia_y_sus_zonas_son_lo_mismo(a, b):
    assert proximidad(a, b) == 1.0


@pytest.mark.parametrize("b", BAHIA)
def test_punta_alta_esta_cerca(b):
    assert proximidad("punta-alta", b) == proximidad(b, "punta-alta") == 0.8


@pytest.mark.parametrize("lejos", ["monte-hermoso", "coronel-suarez"])
@pytest.mark.parametrize("otra", [*BAHIA, "punta-alta"])
def test_monte_hermoso_y_coronel_suarez_estan_lejos(lejos, otra):
    assert proximidad(lejos, otra) == proximidad(otra, lejos) == 0.25


def test_monte_hermoso_y_coronel_suarez_entre_si():
    assert proximidad("monte-hermoso", "coronel-suarez") == 0.25
    assert proximidad("monte-hermoso", "monte-hermoso") == 1.0


def test_zona_nueva_vale_la_mitad_y_sin_zona_no_cuenta():
    assert proximidad("villarino", "bahia-blanca") == DESCONOCIDA == 0.5
    assert proximidad(None, "bahia-blanca") is None
    assert proximidad("bahia-blanca", "") is None


def test_por_id_con_el_mapa_cargado():
    bb, zn, x = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    slugs = {bb: "bahia-blanca", zn: "zona-norte"}
    assert proximidad_ids(bb, zn, slugs) == 1.0
    assert proximidad_ids(x, x, slugs) == 1.0          # misma zona aunque no esté en el mapa
    assert proximidad_ids(x, bb, slugs) == DESCONOCIDA
    assert proximidad_ids(None, bb, slugs) is None
