"""Arreglos de la auditoría del 20/11/2026 (LANZAMIENTO-PLAN.md): a Gemini no le llegan mails ni
teléfonos de avisos ni de frases del buscador, la clave de caché de las evaluaciones incluye los
requisitos, y el 429 de cuota diaria no se reintenta en segundos. Sin base ni red."""
import asyncio
import uuid

import pytest

from app.integrations import gemini_client
from app.integrations.gemini_client import AIProvider, AIResult, AITextResult, AIUsage, _classify
from app.services.ai import job_writer, moderation, requirements as reqs, search_interpret
from app.services.ai.redact import scrub_contacto

AVISO = ("Buscamos vendedor/a. Consultas a Marta al 291 456-7890 o a rrhh@empresa.com.ar "
         "(www.empresa.com.ar). Sueldo $1.500.000. Edad: 25 a 35 años. Experiencia 2018-2020.")


def test_scrub_tacha_contacto_y_deja_lo_que_importa():
    out = scrub_contacto(AVISO)
    assert "rrhh@" not in out and "456-7890" not in out and "www.empresa" not in out
    assert "$1.500.000" in out          # un sueldo no es un DNI
    assert "2018-2020" in out           # un rango de años no es un teléfono
    assert "Edad: 25 a 35 años" in out  # el Redactor tiene que verlo para poder avisar


def test_scrub_edad_solo_en_frases_de_visitantes():
    frase = "tengo 52 años busco algo en Punta Alta"
    assert "52" in scrub_contacto(frase)
    assert "52" not in scrub_contacto(frase, edad=True)
    assert "Punta Alta" in scrub_contacto(frase, edad=True)


def test_scrub_vacio():
    assert scrub_contacto(None) == "" and scrub_contacto("") == ""


class _Captura(AIProvider):
    def __init__(self):
        self.prompts: list[str] = []

    async def embed(self, texts, *, task):
        self.prompts += list(texts)
        return [[0.0] * 4 for _ in texts]

    async def generate_text(self, **kw):
        return AITextResult(text="", usage=AIUsage(model="m"))

    async def generate_json(self, *, system, prompt, model, feature, **kw):
        self.prompts.append(prompt)
        return AIResult(data=model.model_validate({"requisitos": []}), usage=AIUsage(model="m"))


@pytest.mark.asyncio
async def test_requisitos_no_manda_contactos_pero_si_el_texto_del_aviso():
    ia = _Captura()
    await reqs.extract(ia, title="Vendedor/a (llamar al 291 456-7890)", description=AVISO,
                       technical_skills=[], company_id=None)
    prompt = ia.prompts[0]
    assert "rrhh@" not in prompt and "456-7890" not in prompt
    assert "Edad: 25 a 35 años" in prompt


def test_redactor_de_busquedas_no_manda_contactos():
    prompt = job_writer.build_prompt(AVISO, title="Vendedor/a rrhh@empresa.com.ar", zone=None, modality=None,
                                     industries=[], skills=[])
    assert "rrhh@" not in prompt and "456-7890" not in prompt


def test_buscador_no_manda_contactos_ni_edad():
    cat = search_interpret.Catalog(zones=[], industries=[], contract_types=[])
    prompt = search_interpret.build_prompt("tengo 52 años, mi mail es juan@x.com, algo part time", cat)
    assert "52" not in prompt and "juan@" not in prompt and "part time" in prompt


def test_moderador_no_embebe_contactos():
    assert "rrhh@" not in moderation.job_text("Vendedor/a", AVISO)


def test_clave_de_cache_cambia_con_los_requisitos():
    base = "abc"
    respaldo = [reqs.Requirement(id="r1", texto="Manejo de autoelevador", tipo="excluyente", categoria="habilidad")]
    con_ia = respaldo + [reqs.Requirement(id="r2", texto="Zona Bahía Blanca", tipo="deseable", categoria="otro")]
    assert reqs.requirements_hash(base, respaldo) == reqs.requirements_hash(base, list(respaldo))
    assert reqs.requirements_hash(base, respaldo) != reqs.requirements_hash(base, con_ia)
    assert reqs.requirements_hash("otro", respaldo) != reqs.requirements_hash(base, respaldo)
    assert len(reqs.requirements_hash(base, con_ia)) == 64   # entra en la columna String(64)


class _Api429(Exception):
    def __init__(self, texto):
        super().__init__(texto)
        self.code = 429


def test_429_por_dia_se_distingue_del_429_por_minuto():
    dia = _classify(_Api429("RESOURCE_EXHAUSTED GenerateRequestsPerDayPerProjectPerModel-FreeTier"))
    minuto = _classify(_Api429("RESOURCE_EXHAUSTED GenerateRequestsPerMinutePerProjectPerModel"))
    assert dia.transient and dia.quota_day
    assert minuto.transient and not minuto.quota_day


@pytest.mark.asyncio
async def test_429_por_dia_no_se_reintenta_y_por_minuto_si(monkeypatch):
    async def sin_espera(_):
        return None

    monkeypatch.setattr(gemini_client.asyncio, "sleep", sin_espera)
    monkeypatch.setattr(gemini_client.settings, "GEMINI_API_KEY", "k")
    monkeypatch.setattr(gemini_client, "_make_client", lambda: object())
    proveedor = gemini_client.GeminiProvider()

    for texto, intentos in (("PerDay", 1), ("PerMinute", gemini_client._MAX_ATTEMPTS)):
        llamadas = 0

        async def call():
            nonlocal llamadas
            llamadas += 1
            raise _Api429(texto)

        with pytest.raises(gemini_client.AIError):
            await proveedor._with_retries(call)
        assert llamadas == intentos, texto
