"""A quién le entrega el dispatcher los mails: Resend de verdad o un simulador.

Tres modos (`EMAIL_MODE`), y la cuenta de Resend es el último paso del plan (v4 §0):

- `off`: no se manda nada. El dispatcher marca los mails `skipped` en lugar de dejarlos
  `pending`, para que el día que se cargue la key no salga un aluvión de avisos viejos (v3 §3).
- `simulate`: se arma todo igual que en producción y el "envío" sólo queda en el log, con un id
  `sim_…`. Sirve para probar el circuito entero y para que Eugenia vea cada aviso antes de que
  exista la cuenta (regla R14).
- `resend`: envío real.

`auto` (por defecto) es `resend` si hay `RESEND_API_KEY` y `off` si no. **Nunca cae en
`simulate` solo**: en producción, simular sin querer sería perder mails creyendo que salieron.
"""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import Literal

import structlog

from app.core.config import settings
from app.integrations import resend_client
from app.integrations.resend_client import OutgoingEmail

logger = structlog.get_logger("app.services.email.provider")

EmailMode = Literal["off", "simulate", "resend"]


class EmailProvider(ABC):
    name: str

    @abstractmethod
    async def send(self, msg: OutgoingEmail) -> str: ...

    @abstractmethod
    async def send_batch(
        self, messages: list[OutgoingEmail], *, idempotency_key: str | None = None
    ) -> list[str]: ...


class ResendProvider(EmailProvider):
    name = "resend"

    async def send(self, msg: OutgoingEmail) -> str:
        return await resend_client.send_email(msg)

    async def send_batch(
        self, messages: list[OutgoingEmail], *, idempotency_key: str | None = None
    ) -> list[str]:
        return await resend_client.send_batch(messages, idempotency_key=idempotency_key)


class SimulatedProvider(EmailProvider):
    """No sale nada a la red. Guarda lo "enviado" para que los tests lo puedan mirar."""

    name = "simulate"

    def __init__(self) -> None:
        self.sent: list[OutgoingEmail] = []

    async def send(self, msg: OutgoingEmail) -> str:
        return (await self.send_batch([msg]))[0]

    async def send_batch(
        self, messages: list[OutgoingEmail], *, idempotency_key: str | None = None
    ) -> list[str]:
        if len(messages) > resend_client.MAX_BATCH_SIZE:
            # Mismo límite que Resend: si el dispatcher arma lotes de más, que falle acá también.
            raise ValueError(f"Un lote admite como máximo {resend_client.MAX_BATCH_SIZE} mails")
        ids = []
        for msg in messages:
            self.sent.append(msg)
            ids.append(f"sim_{uuid.uuid4().hex}")
            logger.info("email_simulado", subject=msg.subject, tags=msg.tags)
        return ids


def resolve_mode() -> EmailMode:
    mode = (settings.EMAIL_MODE or "auto").lower()
    if mode == "auto":
        return "resend" if settings.email_provider_configured else "off"
    if mode not in ("off", "simulate", "resend"):
        raise ValueError(f"EMAIL_MODE inválido: {settings.EMAIL_MODE!r}")
    if mode == "resend" and not settings.email_provider_configured:
        # Pedir Resend sin key es un error de configuración: mejor no mandar que fallar en loop.
        logger.error("email_mode_resend_sin_key")
        return "off"
    return mode  # type: ignore[return-value]


def get_email_provider() -> EmailProvider | None:
    """El proveedor activo, o `None` si el modo es `off` (el dispatcher marca `skipped`)."""
    mode = resolve_mode()
    if mode == "resend":
        return ResendProvider()
    if mode == "simulate":
        return SimulatedProvider()
    return None
