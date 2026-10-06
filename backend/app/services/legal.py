"""Registro de aceptación de términos y privacidad (ver `app/core/legal.py`)."""
from fastapi import Request
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.legal import LEGAL_DOCUMENTS, LEGAL_VERSION
from app.models.core import User, UserRole
from app.models.legal import LegalAcceptance


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    # Railway y Vercel van delante: la IP real es la primera de X-Forwarded-For.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host[:64] if request.client else None


async def record_acceptance(db: AsyncSession, user: User, request: Request | None) -> None:
    """Registra la versión vigente de los dos documentos. Aceptar dos veces no duplica filas."""
    ip = _client_ip(request)
    agent = (request.headers.get("user-agent") or "")[:300] if request else None
    for document in LEGAL_DOCUMENTS:
        await db.execute(
            pg_insert(LegalAcceptance)
            .values(user_id=user.id, document=document, version=LEGAL_VERSION, ip=ip, user_agent=agent or None)
            .on_conflict_do_nothing(constraint="uq_legal_acceptances_user_doc_version")
        )


async def pending_acceptance(db: AsyncSession, user: User) -> bool:
    """¿Le falta aceptar la versión vigente? Los admins (el equipo de Talency) no aceptan."""
    if user.role == UserRole.admin:
        return False
    accepted = set((await db.execute(
        select(LegalAcceptance.document).where(
            LegalAcceptance.user_id == user.id, LegalAcceptance.version == LEGAL_VERSION
        )
    )).scalars())
    return not set(LEGAL_DOCUMENTS) <= accepted
