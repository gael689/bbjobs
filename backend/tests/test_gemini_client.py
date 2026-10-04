"""Cliente de Gemini sobre el SDK `google-genai`, probado con un doble: nada toca la red."""
import json
import math
from types import SimpleNamespace

import httpx
import pytest
from pydantic import BaseModel

from app.core.config import settings
from app.integrations import gemini_client
from app.integrations.gemini_client import (
    AIError,
    AIUnavailable,
    GeminiProvider,
    make_labels,
    normalize,
)


class _ApiError(Exception):
    """Imita los errores del SDK: sólo importa el código HTTP."""

    def __init__(self, code: int):
        super().__init__(f"error {code}")
        self.code = code


class FakeClient:
    """Responde con lo que se encole en `interactions` / `embeddings` y guarda los pedidos."""

    def __init__(self):
        self.interaction_calls: list[dict] = []
        self.embed_calls: list[dict] = []
        self.interactions: list = []
        self.embeddings: list = []
        fake = self

        class _Interactions:
            async def create(self, **body):
                fake.interaction_calls.append(body)
                item = fake.interactions.pop(0)
                if isinstance(item, Exception):
                    raise item
                return item

        class _Models:
            async def embed_content(self, *, model, contents, config):
                fake.embed_calls.append({"model": model, "contents": contents, "config": config})
                item = fake.embeddings.pop(0)
                if isinstance(item, Exception):
                    raise item
                return item

        self.aio = SimpleNamespace(interactions=_Interactions(), models=_Models())


def _interaction(text: str, *, status="completed", tokens=(10, 5, 2)):
    return SimpleNamespace(
        status=status,
        output_text=text,
        usage=SimpleNamespace(
            total_input_tokens=tokens[0], total_output_tokens=tokens[1], total_thought_tokens=tokens[2]
        ),
    )


def _embeddings(*vectors):
    return SimpleNamespace(embeddings=[SimpleNamespace(values=list(v)) for v in vectors])


@pytest.fixture
def fake(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(gemini_client, "_make_client", lambda: client)
    return client


@pytest.fixture(autouse=True)
def _config(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "key-test")
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_DIM", 3)
    monkeypatch.setattr(settings, "GEMINI_GENERATION_MODEL", "gemini-test")

    async def no_sleep(_):  # los reintentos no tienen por qué hacer lenta la suite
        return None

    monkeypatch.setattr(gemini_client.asyncio, "sleep", no_sleep)


class Requisitos(BaseModel):
    requisitos: list[str]


# --- utilidades -------------------------------------------------------------------------

def test_normalize_gives_unit_vector():
    v = normalize([3.0, 4.0])
    assert v == pytest.approx([0.6, 0.8])
    assert math.sqrt(sum(x * x for x in v)) == pytest.approx(1.0)


def test_normalize_zero_vector_is_left_alone():
    assert normalize([0.0, 0.0]) == [0.0, 0.0]


def test_labels_only_use_allowed_characters():
    labels = make_labels("Rerank Candidatos", "6F1C-ABC")
    assert labels == {"app": "bbjobs", "feature": "rerank-candidatos", "company": "6f1c-abc"}
    assert all(len(v) <= 63 for v in labels.values())


def test_provider_without_key_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    with pytest.raises(AIUnavailable):
        GeminiProvider()
    assert gemini_client.is_configured() is False


# --- embeddings -------------------------------------------------------------------------

async def test_embed_sends_task_type_dimension_and_normalizes(fake):
    fake.embeddings.append(_embeddings([3, 4, 0], [0, 0, 2]))
    vectors = await GeminiProvider().embed(["uno", "dos"], task="document")

    call = fake.embed_calls[0]
    assert call["model"] == "gemini-embedding-001"
    assert call["config"].task_type == "RETRIEVAL_DOCUMENT"
    assert call["config"].output_dimensionality == 3
    assert vectors == [pytest.approx([0.6, 0.8, 0.0]), pytest.approx([0.0, 0.0, 1.0])]


async def test_embed_wraps_each_text_in_its_own_content(fake):
    # Con una lista de strings sueltos, `gemini-embedding-2` devuelve UN vector combinado.
    fake.embeddings.append(_embeddings([1, 0, 0], [0, 1, 0]))
    await GeminiProvider().embed(["uno", "dos"], task="query")

    contents = fake.embed_calls[0]["contents"]
    assert len(contents) == 2
    assert [c.parts[0].text for c in contents] == ["uno", "dos"]
    assert fake.embed_calls[0]["config"].task_type == "RETRIEVAL_QUERY"


async def test_embed_splits_into_batches_of_100(fake):
    fake.embeddings.append(_embeddings(*([[1, 0, 0]] * 100)))
    fake.embeddings.append(_embeddings(*([[0, 1, 0]] * 50)))
    vectors = await GeminiProvider().embed([f"t{i}" for i in range(150)], task="document")
    assert len(fake.embed_calls) == 2
    assert len(vectors) == 150


async def test_embed_count_mismatch_is_an_error(fake):
    # Si vuelven menos vectores que textos no se puede saber cuál es de quién.
    fake.embeddings.append(_embeddings([1, 0, 0]))
    with pytest.raises(AIError) as err:
        await GeminiProvider().embed(["uno", "dos"], task="document")
    assert err.value.transient is True


async def test_embed_empty_input_makes_no_call(fake):
    assert await GeminiProvider().embed([], task="document") == []
    assert fake.embed_calls == []


# --- generación -------------------------------------------------------------------------

async def test_generate_json_sends_store_false_schema_and_reproducibility(fake):
    fake.interactions.append(_interaction(json.dumps({"requisitos": ["Licencia de conducir"]})))
    result = await GeminiProvider().generate_json(
        system="Extraé requisitos.", prompt="Aviso…", model=Requisitos,
        feature="requisitos", company_id="ABC-1",
    )

    body = fake.interaction_calls[0]
    assert body["store"] is False
    assert body["model"] == "gemini-test"
    assert body["system_instruction"] == "Extraé requisitos."
    assert body["response_format"]["mime_type"] == "application/json"
    assert body["response_format"]["schema"]["properties"]["requisitos"]["type"] == "array"
    assert body["generation_config"]["thinking_level"] == "minimal"
    assert body["generation_config"]["seed"] == settings.GEMINI_SEED
    assert "temperature" not in body["generation_config"]
    assert body["labels"]["company"] == "abc-1"
    assert body["service_tier"] == "standard"
    assert result.data.requisitos == ["Licencia de conducir"]
    assert (result.usage.input_tokens, result.usage.output_tokens, result.usage.thought_tokens) == (10, 5, 2)


async def test_generate_json_retries_once_on_invalid_json_and_adds_usage(fake):
    fake.interactions.append(_interaction("no es json"))
    fake.interactions.append(_interaction('```json\n{"requisitos": []}\n```'))
    result = await GeminiProvider().generate_json(
        system="s", prompt="p", model=Requisitos, feature="requisitos"
    )
    assert result.data.requisitos == []
    assert result.usage.input_tokens == 20


async def test_generate_json_gives_up_after_two_invalid_outputs(fake):
    fake.interactions.extend([_interaction("{}"), _interaction('{"otra": 1}')])
    with pytest.raises(AIError) as err:
        await GeminiProvider().generate_json(system="s", prompt="p", model=Requisitos, feature="x")
    assert err.value.transient is False


async def test_transient_errors_are_retried(fake):
    fake.interactions.extend([_ApiError(503), _ApiError(429), _interaction("hola")])
    result = await GeminiProvider().generate_text(system="s", prompt="p", feature="x")
    assert result.text == "hola"
    assert len(fake.interaction_calls) == 3


async def test_network_errors_are_transient(fake):
    fake.interactions.extend([httpx.ConnectError("caído")] * 3)
    with pytest.raises(AIError) as err:
        await GeminiProvider().generate_text(system="s", prompt="p", feature="x")
    assert err.value.transient is True


async def test_permanent_errors_are_not_retried(fake):
    fake.interactions.append(_ApiError(400))
    with pytest.raises(AIError) as err:
        await GeminiProvider().generate_text(system="s", prompt="p", feature="x")
    assert err.value.transient is False
    assert len(fake.interaction_calls) == 1


async def test_flex_tries_only_once(fake):
    # Flex puede devolver 503 sin pasar solo a standard: lo reintenta la próxima corrida.
    fake.interactions.append(_ApiError(503))
    with pytest.raises(AIError) as err:
        await GeminiProvider().generate_json(
            system="s", prompt="p", model=Requisitos, feature="x", service_tier="flex"
        )
    assert err.value.transient is True
    assert len(fake.interaction_calls) == 1
    assert fake.interaction_calls[0]["service_tier"] == "flex"


async def test_empty_or_failed_output_is_an_error(fake):
    fake.interactions.append(_interaction(""))
    with pytest.raises(AIError):
        await GeminiProvider().generate_text(system="s", prompt="p", feature="x")

    fake.interactions.append(_interaction("algo", status="failed"))
    with pytest.raises(AIError) as err:
        await GeminiProvider().generate_text(system="s", prompt="p", feature="x")
    assert err.value.transient is False
