import json
import math

import httpx
import pytest
from pydantic import BaseModel

from app.core.config import settings
from app.integrations import gemini_client
from app.integrations.gemini_client import AIError, AIUnavailable, GeminiProvider, normalize


def _mount(monkeypatch, handler):
    monkeypatch.setattr(
        gemini_client,
        "_make_client",
        lambda: httpx.AsyncClient(
            base_url=gemini_client.GEMINI_BASE_URL, transport=httpx.MockTransport(handler)
        ),
    )


@pytest.fixture(autouse=True)
def _config(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "key-test")
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
    monkeypatch.setattr(settings, "GEMINI_EMBEDDING_DIM", 3)
    monkeypatch.setattr(settings, "GEMINI_GENERATION_MODEL", "gemini-test")

    async def no_sleep(_):  # los reintentos no tienen por qué hacer lenta la suite
        return None

    monkeypatch.setattr(gemini_client.asyncio, "sleep", no_sleep)


def _text_response(text: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}],
            "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
        },
    )


def test_normalize_gives_unit_vector():
    v = normalize([3.0, 4.0])
    assert v == pytest.approx([0.6, 0.8])
    assert math.sqrt(sum(x * x for x in v)) == pytest.approx(1.0)


def test_normalize_zero_vector_is_left_alone():
    assert normalize([0.0, 0.0]) == [0.0, 0.0]


def test_provider_without_key_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", None)
    with pytest.raises(AIUnavailable):
        GeminiProvider()
    assert gemini_client.is_configured() is False


async def test_embed_sends_task_type_and_dimension_and_normalizes(monkeypatch):
    seen = {}

    def handler(request):
        seen["path"] = request.url.path
        seen["key"] = request.headers["x-goog-api-key"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"embeddings": [{"values": [3, 4, 0]}, {"values": [0, 0, 2]}]})

    _mount(monkeypatch, handler)
    vectors = await GeminiProvider().embed(["uno", "dos"], task="document")

    assert seen["path"].endswith("/models/gemini-embedding-001:batchEmbedContents")
    assert seen["key"] == "key-test"
    req = seen["body"]["requests"][0]
    assert req["taskType"] == "RETRIEVAL_DOCUMENT"
    assert req["outputDimensionality"] == 3
    assert vectors == [pytest.approx([0.6, 0.8, 0.0]), pytest.approx([0.0, 0.0, 1.0])]


async def test_embed_splits_into_batches_of_100(monkeypatch):
    calls = []

    def handler(request):
        n = len(json.loads(request.content)["requests"])
        calls.append(n)
        return httpx.Response(200, json={"embeddings": [{"values": [1, 0, 0]}] * n})

    _mount(monkeypatch, handler)
    out = await GeminiProvider().embed([f"t{i}" for i in range(230)], task="query")
    assert calls == [100, 100, 30]
    assert len(out) == 230


async def test_embed_count_mismatch_is_error(monkeypatch):
    _mount(monkeypatch, lambda r: httpx.Response(200, json={"embeddings": [{"values": [1, 0, 0]}]}))
    with pytest.raises(AIError):
        await GeminiProvider().embed(["a", "b"], task="document")


async def test_embed_empty_makes_no_request(monkeypatch):
    def handler(request):
        raise AssertionError("no debería llamar a la API")

    _mount(monkeypatch, handler)
    assert await GeminiProvider().embed([], task="document") == []


async def test_transient_errors_are_retried_then_succeed(monkeypatch):
    attempts = {"n": 0}

    def handler(request):
        attempts["n"] += 1
        if attempts["n"] < 3:
            return httpx.Response(503)
        return _text_response("listo")

    _mount(monkeypatch, handler)
    assert await GeminiProvider().generate_text(system="s", prompt="p") == "listo"
    assert attempts["n"] == 3


async def test_persistent_transient_error_is_raised_as_transient(monkeypatch):
    _mount(monkeypatch, lambda r: httpx.Response(429))
    with pytest.raises(AIError) as exc:
        await GeminiProvider().generate_text(system="s", prompt="p")
    assert exc.value.transient is True


async def test_client_error_is_permanent_and_not_retried(monkeypatch):
    attempts = {"n": 0}

    def handler(request):
        attempts["n"] += 1
        return httpx.Response(400, json={"error": "bad"})

    _mount(monkeypatch, handler)
    with pytest.raises(AIError) as exc:
        await GeminiProvider().generate_text(system="s", prompt="p")
    assert exc.value.transient is False
    assert attempts["n"] == 1


async def test_blocked_prompt_is_permanent_error(monkeypatch):
    _mount(monkeypatch, lambda r: httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}}))
    with pytest.raises(AIError) as exc:
        await GeminiProvider().generate_text(system="s", prompt="p")
    assert exc.value.transient is False


async def test_empty_response_is_error(monkeypatch):
    _mount(
        monkeypatch,
        lambda r: httpx.Response(200, json={"candidates": [{"content": {"parts": []}, "finishReason": "SAFETY"}]}),
    )
    with pytest.raises(AIError):
        await GeminiProvider().generate_text(system="s", prompt="p")


class _Out(BaseModel):
    score: int
    reasons: list[str]


async def test_generate_json_validates_and_requests_json_mime(monkeypatch):
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return _text_response('{"score": 80, "reasons": ["a", "b"]}')

    _mount(monkeypatch, handler)
    out = await GeminiProvider().generate_json(system="sys", prompt="p", model=_Out)

    assert out == _Out(score=80, reasons=["a", "b"])
    assert seen["body"]["generationConfig"]["responseMimeType"] == "application/json"
    assert seen["body"]["systemInstruction"]["parts"][0]["text"] == "sys"


async def test_generate_json_strips_code_fences(monkeypatch):
    _mount(monkeypatch, lambda r: _text_response('```json\n{"score": 1, "reasons": []}\n```'))
    out = await GeminiProvider().generate_json(system="s", prompt="p", model=_Out)
    assert out.score == 1


async def test_generate_json_retries_once_on_invalid_output(monkeypatch):
    replies = iter(['{"score": "no es un numero"}', '{"score": 7, "reasons": ["ok"]}'])
    _mount(monkeypatch, lambda r: _text_response(next(replies)))
    out = await GeminiProvider().generate_json(system="s", prompt="p", model=_Out)
    assert out.score == 7


async def test_generate_json_gives_up_after_two_invalid_outputs(monkeypatch):
    _mount(monkeypatch, lambda r: _text_response("esto no es json"))
    with pytest.raises(AIError) as exc:
        await GeminiProvider().generate_json(system="s", prompt="p", model=_Out)
    assert exc.value.transient is False
