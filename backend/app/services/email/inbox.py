"""Respuestas entrantes: lo que contesta una persona a un mail nuestro (Resend `email.received`).

El webhook trae sólo metadatos; el cuerpo se pide aparte (`get_received_email`). Reglas:
- **Una vez por mail** (`provider_email_id` único): Resend reintenta.
- **Nada de adjuntos**: los postulantes contestan con su CV; ese PDF no se guarda acá.
- **Las respuestas automáticas no entran** (fuera de oficina, rebotes que llegan como mail).
- Se asocia al mail nuestro por el token del Reply-To (`hola+<id>@…`) o, si no hay, por la
  dirección de quien contesta. Si es un prospecto, pasa a "respondió" (los seguimientos
  automáticos se cancelan solos) y un "no me escriban más" lo da de baja.
"""
from __future__ import annotations

import re
import uuid
from typing import Awaitable, Callable

import structlog
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations import resend_client
from app.models.core import User
from app.models.email import EmailOutbox, EmailReply
from app.models.prospect import Prospect, ProspectEmail, ProspectEvent, ProspectStage

logger = structlog.get_logger("app.services.email.inbox")

MAX_BODY = 6000
UNSUB_LOOKS_AT = 600       # el pedido de baja está al principio; no se busca en el texto citado

_ADDR = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_TOKEN = re.compile(r"^[^+@]+\+([0-9a-f]{32})@", re.IGNORECASE)
_AUTO_SUBJECT = re.compile(
    r"^\s*(re:\s*)?(respuesta autom[aá]tica|automatic reply|auto[- ]?reply|out of office|fuera de (la )?oficina|"
    r"undeliverable|delivery status notification|mail delivery (failed|subsystem)|no se pudo entregar)",
    re.IGNORECASE)
_UNSUB = re.compile(
    r"\b(baja|d[ae]r(me|nos)? de baja|no me (escriban|env[ií]en|manden|contacten)|"
    r"no (quiero|queremos|deseo|deseamos) recibir|desuscrib\w+|unsubscribe|remove me|stop)\b", re.IGNORECASE)
_TAGS = re.compile(r"<[^>]+>")

Fetch = Callable[[str], Awaitable[dict]]


def extract_address(raw: str | None) -> str:
    m = _ADDR.search(raw or "")
    return m.group(0).lower() if m else ""


def is_auto_reply(subject: str, headers: dict) -> bool:
    h = {str(k).lower(): str(v).lower() for k, v in (headers or {}).items()}
    if h.get("auto-submitted", "no") != "no" or "x-autoreply" in h or "x-autorespond" in h:
        return True
    if h.get("precedence") in {"bulk", "junk", "list", "auto_reply"}:
        return True
    return bool(_AUTO_SUBJECT.search(subject or ""))


def wants_unsubscribe(body: str) -> bool:
    return bool(_UNSUB.search((body or "")[:UNSUB_LOOKS_AT]))


def _plain(content: dict) -> str:
    text = content.get("text")
    if not text:
        text = _TAGS.sub(" ", content.get("html") or "")
    return re.sub(r"\n{3,}", "\n\n", (text or "").strip())[:MAX_BODY]


async def _default_fetch(email_id: str) -> dict:
    return await resend_client.get_received_email(
        email_id, api_key=settings.PROSPECT_RESEND_API_KEY or settings.RESEND_API_KEY)


async def handle_received(db: AsyncSession, data: dict, *, fetch: Fetch | None = None) -> str:
    """Procesa un `email.received`. Devuelve qué pasó: `stored`, `duplicate`, `auto`, `propio` o
    `sin_id`. No commitea."""
    email_id = str(data.get("email_id") or "")
    if not email_id:
        return "sin_id"
    if (await db.execute(select(EmailReply.id).where(EmailReply.provider_email_id == email_id))).first():
        return "duplicate"

    sender = extract_address(data.get("from"))
    recipients = [extract_address(t) for t in (data.get("to") or []) if isinstance(t, str)]
    subject = str(data.get("subject") or "")[:500]
    if not sender or any(sender.endswith("@" + d) for d in _own_domains()):
        return "propio"       # un mail nuestro que vuelve a entrar: nunca se contesta ni se guarda

    try:
        content = await (fetch or _default_fetch)(email_id)
    except Exception as exc:  # sin cuerpo igual se guarda: Talency sabe que contestaron
        logger.warning("respuesta_sin_cuerpo", email_id=email_id, error=str(exc)[:200])
        content = {}
    if is_auto_reply(subject, content.get("headers") or {}):
        return "auto"
    body = _plain(content)

    outbox = None
    for to in data.get("to") or []:
        token = _TOKEN.match(to if isinstance(to, str) else "")
        if token:
            outbox = (await db.execute(select(EmailOutbox).where(
                EmailOutbox.id == uuid.UUID(token.group(1))))).scalar_one_or_none()
            if outbox is not None:
                break
    user_id = outbox.user_id if outbox else None
    prospect_id = outbox.prospect_id if outbox else None
    if user_id is None and prospect_id is None:
        user_id = (await db.execute(select(User.id).where(User.email == sender))).scalar_one_or_none()
        if user_id is None:
            prospect_id = (await db.execute(select(ProspectEmail.prospect_id).where(
                ProspectEmail.email == sender))).scalars().first()

    inserted = (await db.execute(pg_insert(EmailReply).values(
        id=uuid.uuid4(), provider_email_id=email_id, from_email=sender, to_email=(recipients or [""])[0],
        subject=subject, body=body, outbox_id=outbox.id if outbox else None, user_id=user_id,
        prospect_id=prospect_id,
    ).on_conflict_do_nothing(index_elements=["provider_email_id"]).returning(EmailReply.id))).first()
    if inserted is None:
        return "duplicate"

    if prospect_id is not None:
        prospect = (await db.execute(select(Prospect).where(Prospect.id == prospect_id))).scalar_one_or_none()
        if prospect is not None:
            if prospect.stage in (ProspectStage.nueva.value, ProspectStage.contactada.value):
                prospect.stage = ProspectStage.respondio.value
            db.add(ProspectEvent(prospect_id=prospect.id, kind="respuesta", detail="Respondió por mail"))
            if wants_unsubscribe(body) and not prospect.do_not_contact:
                prospect.do_not_contact, prospect.do_not_contact_reason = True, "respuesta"
                db.add(ProspectEvent(prospect_id=prospect.id, kind="baja", detail="Pidió la baja respondiendo el mail"))
    return "stored"


def _own_domains() -> list[str]:
    """Dominios desde los que enviamos: lo que sale de ahí y vuelve a entrar no es una respuesta."""
    out = []
    for raw in (settings.RESEND_FROM_EMAIL, settings.RESEND_FROM_EMAIL_NOVEDADES, settings.PROSPECT_FROM_EMAIL):
        addr = extract_address(raw)
        if addr:
            out.append(addr.split("@", 1)[1])
    return out
