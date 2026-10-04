"""Prospección: sincronización desde el centro, filtros y cruce con las empresas registradas.

Ver PROSPECCION-Y-CAMPANAS-DE-OFERTA-PLAN.md §2–§4. Reglas que se aplican acá, del lado de
BBJobs (el centro aplica las suyas antes de mandar):

- Las supresiones que llegan (bajas, rebotes y quejas de leadgen) van a `email_suppressions`,
  la lista **única** del portal, y nunca se sacan desde una sincronización.
- Las consultoras de RRHH no entran: son competencia de Talency.
- Una empresa ya registrada en BBJobs queda `registrada`, no se le ofrece nada.
- Re-sincronizar actualiza datos de contacto y **nunca pisa** etapa ni notas de Eugenia.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urlparse

import structlog
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import CompanyProfile
from app.models.core import User
from app.models.email import EmailSuppression
from app.models.prospect import Prospect, ProspectEmail, ProspectEvent, ProspectStage, ProspectSync

logger = structlog.get_logger("app.services.prospects")

SIGNATURE_MAX_AGE_SECONDS = 300
MAX_BATCH = 200

# Proveedores de casillas personales: su dominio no identifica a una empresa.
FREE_PROVIDERS = frozenset({
    "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.ar", "outlook.com", "outlook.com.ar",
    "live.com", "live.com.ar", "yahoo.com", "yahoo.com.ar", "icloud.com", "me.com", "msn.com",
    "fibertel.com.ar", "speedy.com.ar", "arnet.com.ar", "ciudad.com.ar", "protonmail.com",
})

# Competencia de Talency: consultoras y agencias de selección (incluye el rubro "Consultoras y
# RRHH" del catálogo de leadgen).
_COMPETITOR = re.compile(
    r"recursos\s+humanos|\brr\.?\s?hh\b|selecci[oó]n\s+de\s+personal|consultora.{0,20}(rrhh|personal|talento)"
    r"|headhunt|recruit|agencia\s+de\s+(empleo|colocaci[oó]n)|bolsa\s+de\s+trabajo|employment\s+agency"
    r"|consultoras\s+y\s+rrhh",
    re.IGNORECASE,
)
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.IGNORECASE)


# ── Normalización ───────────────────────────────────────────────────────────────────────

def phone_key(phone: str | None) -> str | None:
    """Los últimos 10 dígitos (característica + número en Argentina), sin `+54`, `9` ni `0`.
    Sirve para cruzar `+54 9 291 455-1234` con `0291 455 1234`."""
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    return digits[-10:] if len(digits) >= 10 else None


def domain_of_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    domain = email.rsplit("@", 1)[1].strip().lower()
    return None if domain in FREE_PROVIDERS else domain or None


def domain_of_url(url: str | None) -> str | None:
    if not url:
        return None
    host = urlparse(url if "://" in url else f"https://{url}").netloc.lower()
    host = host.split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    return host or None


def is_competitor(name: str | None, category: str | None) -> bool:
    return bool(_COMPETITOR.search(f"{name or ''} {category or ''}"))


# ── Firma del centro ────────────────────────────────────────────────────────────────────

def sign(secret: str, timestamp: str, body: bytes) -> str:
    return hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()


def verify_signature(secret: str, timestamp: str | None, signature: str | None, body: bytes, now: float | None = None) -> bool:
    if not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs((now or time.time()) - ts) > SIGNATURE_MAX_AGE_SECONDS:
        return False  # evita que un lote capturado se reenvíe más tarde
    return hmac.compare_digest(sign(secret, timestamp, body), signature)


# ── Empresas registradas ────────────────────────────────────────────────────────────────

@dataclass
class RegisteredIndex:
    by_phone: dict[str, uuid.UUID] = field(default_factory=dict)
    by_domain: dict[str, uuid.UUID] = field(default_factory=dict)

    def match(self, phone_keys: list[str], domains: list[str]) -> uuid.UUID | None:
        for k in phone_keys:
            if k in self.by_phone:
                return self.by_phone[k]
        for d in domains:
            if d in self.by_domain:
                return self.by_domain[d]
        return None


async def registered_index(db: AsyncSession) -> RegisteredIndex:
    """Teléfono y dominios de cada empresa registrada (son decenas: entran en memoria)."""
    rows = (await db.execute(
        select(CompanyProfile.id, CompanyProfile.responsible_phone, CompanyProfile.responsible_email,
               CompanyProfile.website, User.email)
        .join(User, User.id == CompanyProfile.user_id)
        .where(User.deleted_at.is_(None))
    )).all()
    index = RegisteredIndex()
    for company_id, phone, resp_email, website, login_email in rows:
        if (k := phone_key(phone)):
            index.by_phone.setdefault(k, company_id)
        for d in (domain_of_email(resp_email), domain_of_email(login_email), domain_of_url(website)):
            if d:
                index.by_domain.setdefault(d, company_id)
    return index


async def mark_registered_for_company(db: AsyncSession, company: CompanyProfile, login_email: str | None) -> int:
    """Al terminar el onboarding de una empresa: si era un prospecto, pasa a `registrada`.
    No commitea. Devuelve cuántos prospectos marcó."""
    keys = [k for k in (phone_key(company.responsible_phone),) if k]
    domains = [d for d in (domain_of_email(company.responsible_email), domain_of_email(login_email),
                           domain_of_url(company.website)) if d]
    if not keys and not domains:
        return 0
    conds = []
    if keys:
        conds.append(Prospect.phone_key.in_(keys))
    if domains:
        conds.append(Prospect.domain.in_(domains))
    prospects = (await db.execute(
        select(Prospect).where(or_(*conds), Prospect.stage != ProspectStage.registrada.value)
    )).scalars().all()
    for p in prospects:
        p.stage = ProspectStage.registrada.value
        p.company_profile_id = company.id
        db.add(ProspectEvent(prospect_id=p.id, kind="registrada", detail=f"Se registró como '{company.legal_name}'"))
    return len(prospects)


# ── Sincronización ──────────────────────────────────────────────────────────────────────

@dataclass
class SyncResult:
    sync_id: str
    received: int = 0
    created: int = 0
    updated: int = 0
    discarded: int = 0
    suppressed: int = 0
    discarded_reasons: dict[str, int] = field(default_factory=dict)
    replayed: bool = False

    def discard(self, reason: str) -> None:
        self.discarded += 1
        self.discarded_reasons[reason] = self.discarded_reasons.get(reason, 0) + 1


async def _suppress(db: AsyncSession, emails: list[str]) -> int:
    count = 0
    for raw in emails:
        email = (raw or "").strip().lower()
        if not _EMAIL.match(email):
            continue
        stmt = pg_insert(EmailSuppression).values(email=email, reason="leadgen")
        result = await db.execute(stmt.on_conflict_do_nothing(index_elements=["email"]))
        count += result.rowcount or 0
    return count


async def _suppressed_set(db: AsyncSession, emails: list[str]) -> set[str]:
    if not emails:
        return set()
    rows = (await db.execute(select(EmailSuppression.email).where(EmailSuppression.email.in_(emails)))).scalars()
    return set(rows)


async def apply_sync(db: AsyncSession, payload: dict) -> SyncResult:
    """Aplica un lote del centro y commitea. Idempotente por `sync_id`."""
    sync_id = str(payload["sync_id"])[:100]
    previous = (await db.execute(select(ProspectSync).where(ProspectSync.sync_id == sync_id))).scalar_one_or_none()
    if previous is not None:
        return SyncResult(
            sync_id=sync_id, received=previous.received, created=previous.created, updated=previous.updated,
            discarded=previous.discarded, suppressed=previous.suppressed,
            discarded_reasons=dict(previous.discarded_reasons or {}), replayed=True,
        )

    companies = payload.get("companies") or []
    result = SyncResult(sync_id=sync_id, received=len(companies))
    result.suppressed = await _suppress(db, payload.get("suppressions") or [])
    registered = await registered_index(db)
    now = datetime.now(timezone.utc)

    for c in companies:
        external_id = str(c.get("external_id") or "").strip()
        name = str(c.get("name") or "").strip()
        if not external_id or not name:
            result.discard("sin_identificador")
            continue
        if is_competitor(name, c.get("category")):
            result.discard("competencia")
            continue

        emails = []
        for e in c.get("emails") or []:
            address = str(e.get("email") or "").strip().lower()
            if _EMAIL.match(address) and e.get("mx_valid") is not False:
                emails.append((address, e.get("mx_valid")))
        suppressed = await _suppressed_set(db, [a for a, _ in emails])
        emails = [(a, mx) for a, mx in emails if a not in suppressed]

        key = phone_key(c.get("phone")) or phone_key(c.get("whatsapp"))
        domain = next((d for d in (domain_of_email(a) for a, _ in emails) if d), None) or domain_of_url(c.get("website"))

        prospect = (await db.execute(
            select(Prospect).where(Prospect.source == "leadgen", Prospect.external_id == external_id)
        )).scalar_one_or_none()

        if prospect is None:
            # Otra empresa con el mismo teléfono o dominio: es la misma (dedupe P2).
            dup_conds = [Prospect.phone_key == key] if key else []
            if domain:
                dup_conds.append(Prospect.domain == domain)
            if dup_conds and (await db.execute(select(exists().where(or_(*dup_conds))))).scalar():
                result.discard("duplicada")
                continue
            prospect = Prospect(id=uuid.uuid4(), source="leadgen", external_id=external_id,
                                stage=ProspectStage.nueva.value, name=name)
            db.add(prospect)
            result.created += 1
            created = True
        else:
            result.updated += 1
            created = False

        # Datos de contacto: se actualizan siempre. Etapa y notas: nunca (las maneja Eugenia).
        prospect.name = name[:255]
        for attr in ("category", "locality", "address", "phone", "whatsapp", "website",
                     "instagram", "facebook", "linkedin"):
            value = c.get(attr)
            setattr(prospect, attr, str(value)[:500] if value else None)
        for attr in ("rating", "lat", "lng"):
            value = c.get(attr)
            setattr(prospect, attr, float(value) if isinstance(value, (int, float)) else None)
        prospect.phone_key = key
        prospect.domain = domain
        prospect.last_synced_at = now

        company_id = registered.match([key] if key else [], [domain] if domain else [])
        if company_id and prospect.stage != ProspectStage.registrada.value:
            prospect.stage = ProspectStage.registrada.value
            prospect.company_profile_id = company_id

        await db.flush()
        for i, (address, mx) in enumerate(emails):
            stmt = pg_insert(ProspectEmail).values(
                id=uuid.uuid4(), prospect_id=prospect.id, email=address, is_primary=(i == 0), mx_valid=mx,
            ).on_conflict_do_update(constraint="uq_prospect_emails_prospect_email", set_={"mx_valid": mx})
            await db.execute(stmt)
        if created:
            db.add(ProspectEvent(prospect_id=prospect.id, kind="sincronizada", detail=f"Llegó desde leadgen (lote {sync_id})"))

    db.add(ProspectSync(
        sync_id=sync_id, received=result.received, created=result.created, updated=result.updated,
        discarded=result.discarded, suppressed=result.suppressed, discarded_reasons=result.discarded_reasons,
    ))
    await db.commit()
    logger.info("prospect_sync", sync_id=sync_id, received=result.received, created=result.created,
                updated=result.updated, discarded=result.discarded, suppressed=result.suppressed)
    return result


# ── Filtros del panel ───────────────────────────────────────────────────────────────────

def has_email_clause():
    return exists().where(
        ProspectEmail.prospect_id == Prospect.id,
        ~exists().where(EmailSuppression.email == ProspectEmail.email),
    )


def filter_clauses(f: dict) -> list:
    """Filtros que usa Eugenia y que valen igual para "seleccionar todas las que cumplen"."""
    clauses = []
    if f.get("q"):
        clauses.append(Prospect.name.ilike(f"%{f['q']}%"))
    if f.get("category"):
        clauses.append(Prospect.category == f["category"])
    if f.get("locality"):
        clauses.append(Prospect.locality == f["locality"])
    if f.get("stage"):
        clauses.append(Prospect.stage == f["stage"])
    if f.get("has_email") is True:
        clauses.append(has_email_clause())
    if f.get("has_email") is False:
        clauses.append(~has_email_clause())
    if f.get("has_whatsapp") is True:
        clauses.append(Prospect.whatsapp.is_not(None))
    if f.get("never_contacted"):
        clauses.append(Prospect.last_contacted_at.is_(None))
    if f.get("contactable"):
        clauses.append(and_(Prospect.do_not_contact.is_(False),
                            Prospect.stage.notin_([ProspectStage.registrada.value, ProspectStage.descartada.value])))
    return clauses


async def count_matching(db: AsyncSession, f: dict) -> int:
    return (await db.execute(select(func.count()).select_from(Prospect).where(*filter_clauses(f)))).scalar_one()
