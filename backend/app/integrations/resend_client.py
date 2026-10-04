"""Cliente de Resend (mails transaccionales y campañas).

Sobre `httpx` directo y no sobre el SDK de Resend: la superficie que usamos son dos endpoints,
y así los tests la simulan con un transporte (ver `_make_client`) sin dependencias extra.

Dos reglas que ordenan el módulo:

1. **Distinguir error transitorio de permanente.** 429 y 5xx se reintentan; un 422 (mail mal
   formado, dominio sin verificar) no se arregla reintentando y hacerlo sólo quema el rate limit.
   Un 409 (misma clave de idempotencia con otro contenido) también es permanente.
   `EmailSendError.transient` es lo que el dispatcher consulta. El límite por defecto de la
   cuenta es de 2 pedidos por segundo: lo respeta el dispatcher, no este módulo.
2. **Idempotencia.** Cada envío lleva `Idempotency-Key`: si la respuesta se pierde y reintentamos,
   Resend no manda el mail dos veces.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger("app.integrations.resend")

RESEND_BASE_URL = "https://api.resend.com"
# Resend acepta hasta 100 mails por llamada en /emails/batch.
MAX_BATCH_SIZE = 100
_TIMEOUT_SECONDS = 20.0
# Resend: claves de hasta 256 caracteres, vigentes 24 h. Formato recomendado `<evento>/<id>`.
_MAX_IDEMPOTENCY_KEY = 256
# Los tags sólo admiten letras ASCII, dígitos, `_` y `-`. Un tag inválido hace rechazar el lote
# entero (batch es todo o nada), así que se limpian acá y no se confía en quien los arma.
_TAG_BAD_CHARS = re.compile(r"[^A-Za-z0-9_-]")
_MAX_TAG = 256


def idempotency_key(event: str, entity_id: object) -> str:
    """`<evento>/<id>`, el formato que recomienda Resend (p. ej. `outbox/3f1c…`)."""
    key = f"{event}/{entity_id}"
    if len(key) > _MAX_IDEMPOTENCY_KEY:
        raise ValueError("La clave de idempotencia supera los 256 caracteres")
    return key


def clean_tag(value: str) -> str:
    return _TAG_BAD_CHARS.sub("_", value)[:_MAX_TAG] or "_"


class EmailSendError(Exception):
    """Falló el envío. `transient=True` significa "vale la pena reintentar"."""

    def __init__(self, message: str, *, transient: bool, status_code: int | None = None):
        super().__init__(message)
        self.transient = transient
        self.status_code = status_code


@dataclass
class OutgoingEmail:
    to: str
    subject: str
    html: str
    text: str | None = None
    # Headers extra: `List-Unsubscribe` y `List-Unsubscribe-Post` en las campañas.
    headers: dict[str, str] = field(default_factory=dict)
    # Tags de Resend: llegan de vuelta en el webhook y sirven para agrupar métricas.
    tags: dict[str, str] = field(default_factory=dict)
    reply_to: str | None = None
    idempotency_key: str | None = None


def is_configured() -> bool:
    return settings.email_provider_configured


def _make_client() -> httpx.AsyncClient:
    """Punto único de construcción del cliente HTTP: los tests lo reemplazan por uno con
    `httpx.MockTransport` y nada toca la red."""
    return httpx.AsyncClient(base_url=RESEND_BASE_URL, timeout=_TIMEOUT_SECONDS)


def _payload(msg: OutgoingEmail) -> dict:
    body: dict = {
        "from": settings.RESEND_FROM_EMAIL,
        "to": [msg.to],
        "subject": msg.subject,
        "html": msg.html,
    }
    if msg.text:
        body["text"] = msg.text
    if msg.headers:
        body["headers"] = msg.headers
    reply_to = msg.reply_to or settings.RESEND_REPLY_TO
    if reply_to:
        body["reply_to"] = reply_to
    if msg.tags:
        body["tags"] = [{"name": clean_tag(k), "value": clean_tag(v)} for k, v in msg.tags.items()]
    return body


def _classify(response: httpx.Response) -> EmailSendError:
    transient = response.status_code == 429 or response.status_code >= 500
    try:
        detail = response.json().get("message") or response.text
    except ValueError:
        detail = response.text
    return EmailSendError(
        f"Resend respondió {response.status_code}: {str(detail)[:300]}",
        transient=transient,
        status_code=response.status_code,
    )


def _headers(idempotency_key: str | None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {settings.RESEND_API_KEY}"}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return headers


async def send_email(msg: OutgoingEmail) -> str:
    """Manda un mail y devuelve el id que le asignó Resend. Levanta `EmailSendError`."""
    if not is_configured():
        raise EmailSendError("RESEND_API_KEY no configurada", transient=False)
    try:
        async with _make_client() as client:
            response = await client.post(
                "/emails", json=_payload(msg), headers=_headers(msg.idempotency_key)
            )
    except httpx.HTTPError as exc:
        # Timeout / conexión caída: no sabemos si llegó. La Idempotency-Key hace seguro el reintento.
        raise EmailSendError(f"Error de red hablando con Resend: {exc}", transient=True) from exc

    if response.status_code >= 400:
        raise _classify(response)
    return str(response.json()["id"])


async def send_batch(
    messages: list[OutgoingEmail], *, idempotency_key: str | None = None
) -> list[str]:
    """Manda hasta `MAX_BATCH_SIZE` mails en una sola llamada. Devuelve los ids en el mismo orden.

    Es todo-o-nada: si Resend rechaza uno, rechaza el lote entero. El que llama (el dispatcher)
    es quien, ante un error permanente, reintenta de a uno para aislar al mail defectuoso en vez
    de perder los otros 99."""
    if not is_configured():
        raise EmailSendError("RESEND_API_KEY no configurada", transient=False)
    if not messages:
        return []
    if len(messages) > MAX_BATCH_SIZE:
        raise ValueError(f"Un lote admite como máximo {MAX_BATCH_SIZE} mails")
    try:
        async with _make_client() as client:
            response = await client.post(
                "/emails/batch",
                json=[_payload(m) for m in messages],
                headers=_headers(idempotency_key),
            )
    except httpx.HTTPError as exc:
        raise EmailSendError(f"Error de red hablando con Resend: {exc}", transient=True) from exc

    if response.status_code >= 400:
        raise _classify(response)

    data = response.json().get("data", [])
    if len(data) != len(messages):
        # No debería pasar. Si pasa, no podemos asociar ids con mails: mejor tratarlo como
        # fallo transitorio y que el reintento (idempotente) lo resuelva, que adivinar.
        raise EmailSendError(
            f"Resend devolvió {len(data)} ids para {len(messages)} mails", transient=True
        )
    return [str(item["id"]) for item in data]
