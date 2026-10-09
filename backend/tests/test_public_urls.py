"""El slug del backend tiene que dar EXACTAMENTE la misma URL que frontend/src/lib/seo/urls.ts.

Los valores esperados salen de correr slugify()/jobUrl() del archivo TS con node (08/10/2026).
Si se cambia urls.ts, regenerarlos y actualizar app/core/urls.py en el mismo commit.
"""
import uuid
from types import SimpleNamespace

import pytest

from app.core.urls import (
    SITE_URL, industry_page_path, job_path, job_public_path, job_public_url, slugify,
    zone_page_path,
)

# (entrada, salida de slugify() en urls.ts)
CASOS_TS = [
    ("Vendedor/a — Bahía Blanca", "vendedor-a-bahia-blanca"),
    ("  CAJERO   Part-Time!! ", "cajero-part-time"),
    ("Diseñador/a Gráfico/a (Sr.)", "disenador-a-grafico-a-sr"),
    ("Técnico en Electrónica -- Turno Noche", "tecnico-en-electronica-turno-noche"),
    ("---Ñandú---", "nandu"),
    ("Señor/a de limpieza", "senor-a-de-limpieza"),
    ("Programador C++ / C#", "programador-c-c"),
    ("100% remoto: Atención al cliente", "100-remoto-atencion-al-cliente"),
    ("Über Fahrer ÇA", "uber-fahrer-ca"),
    (
        "Encargado/a de depósito y logística para cadena de supermercados en la zona sur de "
        "Bahía Blanca con experiencia",
        "encargado-a-de-deposito-y-logistica-para-cadena-de-supermercados-en-la-zona-sur",
    ),
    ("€€€", ""),
    ("İstanbul", "istanbul"),
]


@pytest.mark.parametrize("entrada,esperado", CASOS_TS)
def test_slugify_igual_que_el_frontend(entrada, esperado):
    assert slugify(entrada) == esperado


def test_job_path_igual_que_jobUrl():
    jid = "3F2A1B4C-1111-4222-8333-944445555666"
    assert job_path(jid, "Vendedor/a — Bahía Blanca") == (
        "/empleos/vendedor-a-bahia-blanca-3f2a1b4c-1111-4222-8333-944445555666")
    # título que queda vacío o sin título → sólo el uuid
    assert job_path(jid, "€€€") == "/empleos/3f2a1b4c-1111-4222-8333-944445555666"
    assert job_path(jid, None) == "/empleos/3f2a1b4c-1111-4222-8333-944445555666"


def test_job_public_url_desde_un_job():
    job = SimpleNamespace(id=uuid.UUID("3f2a1b4c-1111-4222-8333-944445555666"), title="Cajero/a")
    assert job_public_path(job) == "/empleos/cajero-a-3f2a1b4c-1111-4222-8333-944445555666"
    assert job_public_url(job) == SITE_URL + job_public_path(job)
    assert SITE_URL == "https://www.bbjobs.com.ar"


def test_paginas_de_zona_y_sector_como_indice_ts():
    assert zone_page_path("bahia-blanca") == "/trabajo-en/bahia-blanca"
    assert zone_page_path("zona-norte") == "/trabajo-en/bahia-blanca"
    assert zone_page_path("zona-sur") == "/trabajo-en/bahia-blanca"
    assert zone_page_path("coronel-suarez") == "/trabajo-en/coronel-suarez"
    assert zone_page_path("otra") is None and zone_page_path(None) is None
    assert industry_page_path("recursos-humanos") == "/empleos-de/recursos-humanos"
    assert industry_page_path("otro") is None and industry_page_path(None) is None


def test_mapa_de_paginas_coincide_con_indice_ts():
    """Lee frontend/src/lib/seo/indice.ts y compara cada entrada del catálogo con el backend."""
    import re
    from pathlib import Path

    ts = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "seo" / "indice.ts"
    if not ts.exists():
        pytest.skip("sin el frontend al lado")
    texto = ts.read_text(encoding="utf-8")
    entrada = re.compile(r'\{\s*slug:\s*"([^"]+)",\s*nombre:\s*"[^"]*",\s*catalogo:\s*\[([^\]]*)\]')
    bloques = {
        "ZONAS_INDICE": zone_page_path, "RUBROS_INDICE": industry_page_path,
    }
    for nombre, fn in bloques.items():
        cuerpo = texto.split(f"export const {nombre}", 1)[1].split("];", 1)[0]
        pares = entrada.findall(cuerpo)
        assert pares, nombre
        prefijo = "/trabajo-en/" if nombre == "ZONAS_INDICE" else "/empleos-de/"
        for slug, catalogo in pares:
            for cat in re.findall(r'"([^"]+)"', catalogo):
                assert fn(cat) == prefijo + slug, (nombre, cat)
