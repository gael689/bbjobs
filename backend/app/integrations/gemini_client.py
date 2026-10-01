"""Cliente de Gemini (embeddings y generación de texto).

Sobre `httpx` directo, igual que `resend_client.py`. Se expone detrás de `AIProvider` porque el
PDF de Eugenia le ofrece Claude *o* Gemini y promete que "se puede cambiar de una a otra sin
rehacer nada": el resto del sistema sólo conoce esa interfaz, así que un `ClaudeProvider` futuro
es un archivo nuevo y no un refactor.

Dos decisiones deliberadas:

- **No se manda `responseSchema` a la API.** El formato exacto del schema que acepta Gemini ha
  cambiado entre versiones; en cambio `responseMimeType: application/json` es estable. El schema
  de verdad lo imponemos **nosotros** validando con pydantic (que además hay que hacer igual: no
  se confía en la salida de un modelo), con un reintento si no valida.
- **Los embeddings se normalizan acá**, una sola vez. El modelo permite truncar la dimensión
  (`outputDimensionality`) y los vectores truncados no vienen normalizados; con vectores de
  norma 1 la similitud coseno del resto del sistema es un producto punto.
"""
from __future__ import annotations

import asyncio
import json
import math
from abc import ABC, abstractmethod
from typing import Literal, Sequence, TypeVar

import httpx
import structlog
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = structlog.get_logger("app.integrations.gemini")

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
_TIMEOUT_SECONDS = 60.0
# La API admite hasta 100 textos por llamada de batchEmbedContents.
MAX_EMBED_BATCH = 100
_MAX_ATTEMPTS = 3

EmbedTask = Literal["document", "query"]
_TASK_TYPES = {"document": "RETRIEVAL_DOCUMENT", "query": "RETRIEVAL_QUERY"}

T = TypeVar("T", bound=BaseModel)


class AIUnavailable(Exception):
    """No hay IA disponible (sin API key o interruptor apagado). No es un error: el que llama
    tiene que degradar con elegancia — mostrar el resumen por plantilla, no ordenar, etc."""


class AIError(Exception):
    """La llamada a la IA falló. `transient=True` = vale la pena reintentar más tarde."""

    def __init__(self, message: str, *, transient: bool):
        super().__init__(message)
        self.transient = transient


class AIProvider(ABC):
    @abstractmethod
    async def embed(self, texts: Sequence[str], *, task: EmbedTask) -> list[list[float]]: ...

    @abstractmethod
    async def generate_json(self, *, system: str, prompt: str, model: type[T]) -> T: ...

    @abstractmethod
    async def generate_text(self, *, system: str, prompt: str, max_tokens: int = 400) -> str: ...


def normalize(vector: Sequence[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0:
        return list(vector)
    return [x / norm for x in vector]


def _make_client() -> httpx.AsyncClient:
    """Los tests lo reemplazan por un cliente con `httpx.MockTransport`."""
    return httpx.AsyncClient(base_url=GEMINI_BASE_URL, timeout=_TIMEOUT_SECONDS)


class GeminiProvider(AIProvider):
    def __init__(self) -> None:
        if not settings.GEMINI_API_KEY:
            raise AIUnavailable("GEMINI_API_KEY no configurada")

    async def _post(self, path: str, body: dict) -> dict:
        """POST con reintentos sólo ante 429/5xx/red (espera creciente: 1 s, 2 s)."""
        last: AIError | None = None
        for attempt in range(_MAX_ATTEMPTS):
            if attempt:
                await asyncio.sleep(2 ** (attempt - 1))
            try:
                async with _make_client() as client:
                    response = await client.post(
                        path, json=body, headers={"x-goog-api-key": settings.GEMINI_API_KEY or ""}
                    )
            except httpx.HTTPError as exc:
                last = AIError(f"Error de red hablando con Gemini: {exc}", transient=True)
                continue

            if response.status_code == 429 or response.status_code >= 500:
                last = AIError(f"Gemini respondió {response.status_code}", transient=True)
                continue
            if response.status_code >= 400:
                raise AIError(
                    f"Gemini respondió {response.status_code}: {response.text[:300]}",
                    transient=False,
                )
            return response.json()
        assert last is not None
        raise last

    async def embed(self, texts: Sequence[str], *, task: EmbedTask) -> list[list[float]]:
        if not texts:
            return []
        model = settings.GEMINI_EMBEDDING_MODEL
        out: list[list[float]] = []
        for start in range(0, len(texts), MAX_EMBED_BATCH):
            chunk = texts[start:start + MAX_EMBED_BATCH]
            data = await self._post(
                f"/models/{model}:batchEmbedContents",
                {
                    "requests": [
                        {
                            "model": f"models/{model}",
                            "content": {"parts": [{"text": t}]},
                            "taskType": _TASK_TYPES[task],
                            "outputDimensionality": settings.GEMINI_EMBEDDING_DIM,
                        }
                        for t in chunk
                    ]
                },
            )
            embeddings = data.get("embeddings", [])
            if len(embeddings) != len(chunk):
                raise AIError(
                    f"Gemini devolvió {len(embeddings)} embeddings para {len(chunk)} textos",
                    transient=True,
                )
            out.extend(normalize(e["values"]) for e in embeddings)
        logger.info("gemini_embedded", texts=len(texts), model=model)
        return out

    async def _generate(
        self, *, system: str, prompt: str, max_tokens: int, json_mode: bool
    ) -> str:
        generation_config: dict = {"temperature": 0.2, "maxOutputTokens": max_tokens}
        if json_mode:
            generation_config["responseMimeType"] = "application/json"
        model = settings.GEMINI_GENERATION_MODEL
        data = await self._post(
            f"/models/{model}:generateContent",
            {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": generation_config,
            },
        )
        usage = data.get("usageMetadata", {})
        logger.info(
            "gemini_generated",
            model=model,
            prompt_tokens=usage.get("promptTokenCount"),
            output_tokens=usage.get("candidatesTokenCount"),
        )
        feedback = data.get("promptFeedback", {})
        if feedback.get("blockReason"):
            raise AIError(f"Gemini bloqueó el pedido: {feedback['blockReason']}", transient=False)
        candidates = data.get("candidates") or []
        if not candidates:
            raise AIError("Gemini no devolvió candidatos", transient=True)
        candidate = candidates[0]
        parts = (candidate.get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts).strip()
        if not text:
            # finishReason SAFETY / MAX_TOKENS sin texto: reintentar da lo mismo.
            raise AIError(
                f"Gemini devolvió una respuesta vacía ({candidate.get('finishReason')})",
                transient=False,
            )
        return text

    async def generate_text(self, *, system: str, prompt: str, max_tokens: int = 400) -> str:
        return await self._generate(
            system=system, prompt=prompt, max_tokens=max_tokens, json_mode=False
        )

    async def generate_json(self, *, system: str, prompt: str, model: type[T]) -> T:
        """Pide JSON y lo valida contra `model`. Un reintento si la salida no valida: los modelos
        chicos a veces cierran mal el JSON, y casi siempre sale bien la segunda vez."""
        last_error: Exception | None = None
        for _ in range(2):
            text = await self._generate(
                system=system, prompt=prompt, max_tokens=2048, json_mode=True
            )
            try:
                return model.model_validate(json.loads(_strip_code_fence(text)))
            except (ValueError, ValidationError) as exc:
                last_error = exc
                logger.warning("gemini_invalid_json", error=str(exc)[:200])
        raise AIError(f"Gemini devolvió un JSON inválido: {last_error}", transient=False)


def _strip_code_fence(text: str) -> str:
    """Algunos modelos envuelven el JSON en ```json … ``` aun con responseMimeType."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return text.strip()


def get_provider() -> AIProvider:
    """El proveedor activo. Levanta `AIUnavailable` si no hay cuenta cargada."""
    return GeminiProvider()


def is_configured() -> bool:
    return settings.ai_provider_configured
