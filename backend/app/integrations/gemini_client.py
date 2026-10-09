"""Cliente de Gemini (embeddings y generación), sobre el SDK oficial `google-genai`.

La v1 iba con `httpx` a mano contra `generateContent`, que Google pasó a legado. Ahora:

- **Generación por la Interactions API** (`client.aio.interactions.create`), con salida JSON
  validada contra un esquema y **`store=False` siempre**: por defecto Google guarda pedido y
  respuesta 55 días, y acá viajan datos de candidatos (auditoría R21, plan v3 §0-bis).
- **Embeddings con `gemini-embedding-001`** (decisión P11 de la auditoría): soporta `task_type`
  (documento / consulta) y hay que normalizar a mano al truncar la dimensión.
- **Reproducibilidad:** `seed` fijo y `thinking_level="minimal"`. Los tokens de pensamiento se
  cobran como salida, así que se devuelven aparte para medir el gasto (auditoría R17).

Se expone detrás de `AIProvider`: el resto del sistema no conoce el SDK, y los tests reemplazan
`_make_client` por un doble sin red.
"""
from __future__ import annotations

import asyncio
import json
import math
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, Literal, Sequence, TypeVar

import httpx
import structlog
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = structlog.get_logger("app.integrations.gemini")

# batchEmbedContents admite hasta 100 textos por pedido.
MAX_EMBED_BATCH = 100
_MAX_ATTEMPTS = 3

EmbedTask = Literal["document", "query", "similarity"]
# `similarity`: comparar textos del mismo tipo entre sí (avisos contra avisos, al moderar).
_TASK_TYPES = {"document": "RETRIEVAL_DOCUMENT", "query": "RETRIEVAL_QUERY", "similarity": "SEMANTIC_SIMILARITY"}

# `deferred` figura en el SDK pero la guía de Flex dice que no existe: no se usa (auditoría R16).
ServiceTier = Literal["standard", "flex"]

T = TypeVar("T", bound=BaseModel)

# Las etiquetas de la API sólo aceptan minúsculas, dígitos, `_` y `-`, hasta 63 caracteres.
_LABEL_BAD_CHARS = re.compile(r"[^a-z0-9_-]")


class AIUnavailable(Exception):
    """No hay IA disponible (sin API key o interruptor apagado). No es un error: el que llama
    tiene que degradar con elegancia — mostrar el resumen por plantilla, no ordenar, etc."""


class AIError(Exception):
    """La llamada a la IA falló. `transient=True` = vale la pena reintentar más tarde."""

    def __init__(self, message: str, *, transient: bool):
        super().__init__(message)
        self.transient = transient


@dataclass(frozen=True)
class AIUsage:
    """Lo que costó una llamada, con los nombres de campo de la API (`usage.total_*`)."""

    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    thought_tokens: int = 0


@dataclass(frozen=True)
class AIResult(Generic[T]):
    data: T
    usage: AIUsage


@dataclass(frozen=True)
class AITextResult:
    text: str
    usage: AIUsage


class AIProvider(ABC):
    @abstractmethod
    async def embed(self, texts: Sequence[str], *, task: EmbedTask) -> list[list[float]]: ...

    @abstractmethod
    async def generate_json(
        self,
        *,
        system: str,
        prompt: str,
        model: type[T],
        feature: str,
        company_id: str | None = None,
        max_output_tokens: int = 2048,
        service_tier: ServiceTier = "standard",
    ) -> AIResult[T]: ...

    @abstractmethod
    async def generate_text(
        self,
        *,
        system: str,
        prompt: str,
        feature: str,
        company_id: str | None = None,
        max_output_tokens: int = 600,
    ) -> AITextResult: ...


def normalize(vector: Sequence[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0:
        return list(vector)
    return [x / norm for x in vector]


def make_labels(feature: str, company_id: str | None) -> dict[str, str]:
    """Etiquetas para atribuir el costo en la factura de Google (por función y por empresa)."""
    labels = {"app": "bbjobs", "feature": feature}
    if company_id:
        labels["company"] = str(company_id)
    return {k: _LABEL_BAD_CHARS.sub("-", v.lower())[:63] for k, v in labels.items()}


def _status_code(exc: Exception) -> int | None:
    """El SDK levanta clases distintas según el endpoint (`errors.APIError.code` en `models`,
    `GenAiError.status_code` en `interactions`). Se lee el código sin importar clases privadas."""
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    return None


def _classify(exc: Exception) -> AIError:
    if isinstance(exc, (httpx.TransportError, asyncio.TimeoutError, TimeoutError)):
        return AIError(f"Error de red hablando con Gemini: {exc}", transient=True)
    code = _status_code(exc)
    if code is not None and (code == 429 or code >= 500):
        return AIError(f"Gemini respondió {code}", transient=True)
    return AIError(f"Gemini falló ({code}): {str(exc)[:300]}", transient=False)


def _make_client() -> Any:
    """Punto único de construcción del cliente: los tests lo reemplazan por un doble."""
    from google import genai

    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _usage_from(interaction: Any, model: str) -> AIUsage:
    usage = getattr(interaction, "usage", None)

    def tokens(name: str) -> int:
        return int(getattr(usage, name, None) or 0) if usage is not None else 0

    return AIUsage(
        model=model,
        input_tokens=tokens("total_input_tokens"),
        output_tokens=tokens("total_output_tokens"),
        thought_tokens=tokens("total_thought_tokens"),
    )


class GeminiProvider(AIProvider):
    def __init__(self) -> None:
        if not settings.GEMINI_API_KEY:
            raise AIUnavailable("GEMINI_API_KEY no configurada")
        self._client = _make_client()

    async def _with_retries(self, call, *, attempts: int = _MAX_ATTEMPTS):
        """Reintenta sólo lo transitorio (429, 5xx, red), con espera creciente: 1 s, 2 s."""
        last: AIError | None = None
        for attempt in range(attempts):
            if attempt:
                await asyncio.sleep(2 ** (attempt - 1))
            try:
                return await call()
            except AIError:
                raise
            except Exception as exc:  # el SDK no tiene una jerarquía única de errores
                last = _classify(exc)
                if not last.transient:
                    raise last from exc
        assert last is not None
        raise last

    async def embed(self, texts: Sequence[str], *, task: EmbedTask) -> list[list[float]]:
        if not texts:
            return []
        from google.genai import types

        model = settings.GEMINI_EMBEDDING_MODEL
        config = types.EmbedContentConfig(
            task_type=_TASK_TYPES[task],
            output_dimensionality=settings.GEMINI_EMBEDDING_DIM,
        )
        out: list[list[float]] = []
        for start in range(0, len(texts), MAX_EMBED_BATCH):
            chunk = list(texts[start:start + MAX_EMBED_BATCH])
            # Un Content por texto: con `gemini-embedding-2` una lista de strings sueltos se
            # combina en UN solo vector (auditoría R2). Con `-001` da igual, pero así el cliente
            # no se rompe en silencio si algún día se cambia el modelo.
            contents = [types.Content(parts=[types.Part.from_text(text=t)]) for t in chunk]

            async def call(contents=contents):
                return await self._client.aio.models.embed_content(
                    model=model, contents=contents, config=config
                )

            response = await self._with_retries(call)
            embeddings = list(getattr(response, "embeddings", None) or [])
            if len(embeddings) != len(chunk):
                raise AIError(
                    f"Gemini devolvió {len(embeddings)} embeddings para {len(chunk)} textos",
                    transient=True,
                )
            # `-001` no normaliza los vectores truncados: con norma 1, coseno = producto punto.
            out.extend(normalize(e.values) for e in embeddings)
        logger.info("gemini_embedded", texts=len(texts), model=model)
        return out

    async def _interact(
        self,
        *,
        system: str,
        prompt: str,
        feature: str,
        company_id: str | None,
        max_output_tokens: int,
        service_tier: ServiceTier,
        schema: dict | None,
    ) -> tuple[str, AIUsage]:
        model = settings.GEMINI_GENERATION_MODEL
        body: dict[str, Any] = {
            "model": model,
            "input": prompt,
            "system_instruction": system,
            "store": False,
            "service_tier": service_tier,
            "labels": make_labels(feature, company_id),
            "generation_config": {
                "thinking_level": settings.GEMINI_THINKING_LEVEL,
                "max_output_tokens": max_output_tokens,
                "seed": settings.GEMINI_SEED,
            },
        }
        if schema is not None:
            body["response_format"] = {
                "type": "text",
                "mime_type": "application/json",
                "schema": schema,
            }

        # Flex puede tardar 1–15 min o devolver 503/429 sin pasar solo a standard: un único
        # intento, y el barrido nocturno lo reintenta en la próxima corrida (auditoría R16).
        attempts = 1 if service_tier == "flex" else _MAX_ATTEMPTS

        async def call():
            return await self._client.aio.interactions.create(**body)

        interaction = await self._with_retries(call, attempts=attempts)
        usage = _usage_from(interaction, model)
        logger.info(
            "gemini_interaction",
            model=model,
            feature=feature,
            tier=service_tier,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            thought_tokens=usage.thought_tokens,
        )
        status = getattr(interaction, "status", None)
        if status not in (None, "completed"):
            raise AIError(f"Gemini terminó con estado {status}", transient=status != "failed")
        text = (getattr(interaction, "output_text", None) or "").strip()
        if not text:
            raise AIError("Gemini devolvió una respuesta vacía", transient=False)
        return text, usage

    async def generate_text(
        self,
        *,
        system: str,
        prompt: str,
        feature: str,
        company_id: str | None = None,
        max_output_tokens: int = 600,
    ) -> AITextResult:
        text, usage = await self._interact(
            system=system, prompt=prompt, feature=feature, company_id=company_id,
            max_output_tokens=max_output_tokens, service_tier="standard", schema=None,
        )
        return AITextResult(text=text, usage=usage)

    async def generate_json(
        self,
        *,
        system: str,
        prompt: str,
        model: type[T],
        feature: str,
        company_id: str | None = None,
        max_output_tokens: int = 2048,
        service_tier: ServiceTier = "standard",
    ) -> AIResult[T]:
        """Pide JSON con el esquema de `model` y lo valida igual con pydantic: la API acepta un
        subconjunto de JSON Schema y la salida de un modelo nunca se da por buena sin validar.
        Un reintento si no valida; los tokens de los dos intentos se suman."""
        schema = model.model_json_schema()
        total = AIUsage(model=settings.GEMINI_GENERATION_MODEL)
        last_error: Exception | None = None
        for _ in range(2):
            text, usage = await self._interact(
                system=system, prompt=prompt, feature=feature, company_id=company_id,
                max_output_tokens=max_output_tokens, service_tier=service_tier, schema=schema,
            )
            total = AIUsage(
                model=usage.model,
                input_tokens=total.input_tokens + usage.input_tokens,
                output_tokens=total.output_tokens + usage.output_tokens,
                thought_tokens=total.thought_tokens + usage.thought_tokens,
            )
            try:
                return AIResult(
                    data=model.model_validate(json.loads(_strip_code_fence(text))), usage=total
                )
            except (ValueError, ValidationError) as exc:
                last_error = exc
                logger.warning("gemini_invalid_json", feature=feature, error=str(exc)[:200])
        raise AIError(f"Gemini devolvió un JSON inválido: {last_error}", transient=False)


def _strip_code_fence(text: str) -> str:
    """Algunos modelos envuelven el JSON en ```json … ``` aun pidiendo JSON."""
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
