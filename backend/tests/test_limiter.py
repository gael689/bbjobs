"""key_func del rate limit: IP real detrás del proxy de Railway, sin creerle a cualquiera."""
from starlette.requests import Request

from app.core.limiter import client_ip, limiter


def _req(peer: str | None, **headers) -> Request:
    scope = {
        "type": "http", "method": "GET", "path": "/", "query_string": b"",
        "headers": [(k.replace("_", "-").lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (peer, 12345) if peer else None,
    }
    return Request(scope)


def test_detras_del_proxy_de_railway_usa_el_primer_x_forwarded_for():
    r = _req("100.64.0.7", x_forwarded_for="181.10.20.30, 100.64.0.2", x_real_ip="9.9.9.9")
    assert client_ip(r) == "181.10.20.30"


def test_sin_x_forwarded_for_cae_a_x_real_ip():
    assert client_ip(_req("100.64.0.7", x_real_ip="181.10.20.30")) == "181.10.20.30"


def test_sin_headers_usa_la_conexion():
    assert client_ip(_req("100.64.0.7")) == "100.64.0.7"


def test_conexion_directa_desde_internet_ignora_los_headers():
    # Alguien que le pega directo al contenedor no puede elegir su IP para el limitador.
    r = _req("181.10.20.30", x_forwarded_for="1.2.3.4", x_real_ip="5.6.7.8")
    assert client_ip(r) == "181.10.20.30"


def test_header_basura_no_se_usa():
    r = _req("10.0.0.5", x_forwarded_for="no-es-una-ip, 1.2.3.4", x_real_ip="tampoco")
    assert client_ip(r) == "10.0.0.5"


def test_ipv6_y_sin_cliente():
    assert client_ip(_req("100.64.0.7", x_forwarded_for="2800:810:1:2::5")) == "2800:810:1:2::5"
    assert client_ip(_req(None, x_forwarded_for="1.2.3.4")) == "127.0.0.1"


def test_el_limiter_usa_esta_key_func():
    assert limiter._key_func is client_ip
