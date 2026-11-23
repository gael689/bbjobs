"""Prospección automática (Gael, 23/11/2026: "como el centro-nuevo, que ella lo pueda modificar").

Una sola secuencia fija de 3 mails a las empresas a contactar: el primero y dos seguimientos
(a los 4 y a los 10 días del primero, como centro-nuevo). Corre sola:

- Cada vuelta del reloj de campañas, `enqueue_new` toma empresas **nuevas** (etapa `nueva`, con
  mail válido, sin baja) que todavía no entraron a la secuencia y les encola el 1.º mail, sin
  pasarse del tope diario de prospección (no llena la cola de golpe).
- El envío, las casillas, los topes, la franja horaria y los seguimientos son los de siempre
  (`prospect_dispatch`): el 2.º y el 3.º salen sólo si el anterior se entregó y la empresa no
  respondió; una respuesta, una baja o un rebote cortan la secuencia.
- Eugenia edita el texto de cada paso desde Admin → Prospección automática; lo nuevo vale para
  los mails que todavía no salieron. No hay aprobación por envío: el interruptor
  `prospeccion_automatica_activa` la prende y la pausa.

La secuencia es una fila de `email_campaigns` con `audience_key = "secuencia_auto"`: reusa el
modelo y el despacho de las campañas a prospectos sin tabla nueva. No aparece en Campañas.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.features import new_modules_enabled
from app.models.email import EmailCampaign, EmailCategory, EmailOutbox, EmailStatus
from app.models.prospect import Prospect, ProspectStage
from app.models.settings import SettingKey
from app.services.settings import get_setting

logger = structlog.get_logger("app.services.email.secuencia")

AUTO_KEY = "secuencia_auto"
STATUS_AUTO = "auto"
# Días desde el mail anterior: 4 → el 2.º el día 4; 6 → el 3.º el día 10 (centro-nuevo).
DEFAULT_AFTER = (4, 6)

DEFAULT_STEPS = [
    {
        "subject": "Búsquedas de personal en {{localidad}} para {{empresa}}",
        "body": (
            "Hola, ¿qué tal?\n\n"
            "Les escribo de BBJobs, el portal de empleo de Bahía Blanca y la zona, de Talency.\n\n"
            "Si en {{empresa}} necesitan sumar gente, pueden publicar sus búsquedas gratis en BBJobs: "
            "les llegan postulantes de la zona, los ven ordenados y, con cada búsqueda, les mostramos los "
            "perfiles que mejor encajan.\n\n"
            "¿Les interesa que les cuente cómo funciona? Pueden responder este mail o crear la cuenta "
            "en bbjobs.com.ar/publicar-empleo.\n\n"
            "Saludos,\nEugenia\nBBJobs · Talency"
        ),
    },
    {
        "subject": "",
        "body": (
            "Hola de nuevo,\n\n"
            "Les escribí hace unos días por BBJobs. Publicar una búsqueda lleva unos minutos y es gratis "
            "para empresas de la zona.\n\n"
            "Si prefieren que nos ocupemos de toda la selección, en Talency lo hacemos por ustedes.\n\n"
            "¿Les sirve que hablemos 10 minutos esta semana?\n\n"
            "Saludos,\nEugenia"
        ),
    },
    {
        "subject": "",
        "body": (
            "Hola,\n\n"
            "Último mensaje de mi parte, para no molestar. Si más adelante necesitan personal, BBJobs "
            "queda a disposición: bbjobs.com.ar/publicar-empleo.\n\n"
            "¡Éxitos!\nEugenia"
        ),
    },
]

VARIABLES = {"empresa": "Nombre de la empresa", "localidad": "Su localidad (si no hay, Bahía Blanca)"}


async def get_or_create(db: AsyncSession) -> EmailCampaign:
    c = (await db.execute(select(EmailCampaign).where(EmailCampaign.audience_key == AUTO_KEY)
                          .order_by(EmailCampaign.created_at))).scalars().first()
    if c is None:
        c = EmailCampaign(
            id=uuid.uuid4(), name="Prospección automática", subject=DEFAULT_STEPS[0]["subject"],
            body=DEFAULT_STEPS[0]["body"], target="prospects", audience_key=AUTO_KEY, audience={},
            status=STATUS_AUTO,
            follow_ups=[{"after_days": d, "subject": s["subject"], "body": s["body"]}
                        for d, s in zip(DEFAULT_AFTER, DEFAULT_STEPS[1:])],
        )
        db.add(c)
        await db.flush()
    return c


def steps_of(c: EmailCampaign) -> list[dict]:
    """Los 3 pasos en el formato del panel: número, días después del anterior, asunto y texto."""
    out = [{"n": 1, "after_days": 0, "subject": c.subject, "body": c.body}]
    for i, fu in enumerate((c.follow_ups or [])[:2], start=2):
        out.append({"n": i, "after_days": int(fu.get("after_days") or DEFAULT_AFTER[i - 2]),
                    "subject": fu.get("subject") or "", "body": fu.get("body") or ""})
    return out


class SequenceError(ValueError):
    pass


def apply_steps(c: EmailCampaign, steps: list[dict]) -> None:
    """Guarda lo que editó Eugenia. El 1.º necesita asunto y texto; un seguimiento sin texto no
    sale (la secuencia termina antes). Lo nuevo vale para lo que todavía no salió."""
    if not steps or not (steps[0].get("subject") or "").strip() or not (steps[0].get("body") or "").strip():
        raise SequenceError("El primer mail necesita asunto y texto")
    if len(steps) > 3:
        raise SequenceError("Como máximo tres mails")
    follow = []
    for s in steps[1:]:
        days = int(s.get("after_days") or 0)
        if not 1 <= days <= 30:
            raise SequenceError("Los seguimientos salen entre 1 y 30 días después del mail anterior")
        follow.append({"after_days": days, "subject": (s.get("subject") or "").strip()[:300],
                       "body": (s.get("body") or "").strip()})
    c.subject = steps[0]["subject"].strip()[:300]
    c.body = steps[0]["body"].strip()
    c.follow_ups = follow


async def rerender_pending(db: AsyncSession, c: EmailCampaign) -> int:
    """Al guardar textos nuevos, los mails que esperan en la cola se vuelven a armar con ellos:
    el texto se congela al encolar, y "lo nuevo vale para lo que no salió" tiene que ser cierto."""
    from app.services.email.prospect_dispatch import render_for_prospect

    pasos = steps_of(c)
    rows = (await db.execute(select(EmailOutbox, Prospect).join(Prospect, Prospect.id == EmailOutbox.prospect_id).where(
        EmailOutbox.campaign_id == c.id, EmailOutbox.status == EmailStatus.pending.value))).all()
    n = 0
    for row, prospect in rows:
        if row.touch > len(pasos):
            continue
        paso = pasos[row.touch - 1]
        if not paso["body"].strip():
            row.status = EmailStatus.canceled.value
            row.last_error = "ese mail de la secuencia quedó vacío"
            continue
        subject = paso["subject"] or (f"Re: {pasos[0]['subject']}" if row.touch > 1 else row.subject)
        row.subject, rendered = render_for_prospect(prospect, subject=subject, body=paso["body"],
                                                    cta_label=c.cta_label, cta_url=c.cta_url)
        row.html, row.text = rendered.html, rendered.text
        n += 1
    return n


async def is_active(db: AsyncSession) -> bool:
    return new_modules_enabled() and await get_setting(db, SettingKey.prospeccion_automatica_activa)


def _eligible_new():
    """Empresas nuevas con mail válido, sin baja, que todavía no entraron a la secuencia."""
    from app.services.email.campaigns import prospect_recipients_query

    already = exists().where(EmailOutbox.prospect_id == Prospect.id,
                             EmailOutbox.category == EmailCategory.prospeccion.value)
    return prospect_recipients_query({}).where(Prospect.stage == ProspectStage.nueva.value, ~already)


async def pending_first(db: AsyncSession, c: EmailCampaign) -> int:
    return (await db.execute(select(func.count()).select_from(EmailOutbox).where(
        EmailOutbox.campaign_id == c.id, EmailOutbox.touch == 1,
        EmailOutbox.status.in_([EmailStatus.pending.value, EmailStatus.sending.value])))).scalar_one()


async def enqueue_new(db: AsyncSession, now: datetime | None = None) -> int:
    """Encola el 1.º mail a empresas nuevas, sin pasarse del tope diario. No commitea."""
    from app.services.email.prospect_dispatch import render_for_prospect

    now = now or datetime.now(timezone.utc)
    if not await is_active(db):
        return 0
    c = await get_or_create(db)
    room = settings.PROSPECT_DAILY_CAP - await pending_first(db, c)
    if room <= 0:
        return 0
    rows = (await db.execute(_eligible_new().order_by(Prospect.created_at).limit(room))).all()
    for prospect, email in rows:
        subject, rendered = render_for_prospect(prospect, subject=c.subject, body=c.body,
                                                cta_label=c.cta_label, cta_url=c.cta_url)
        db.add(EmailOutbox(
            id=uuid.uuid4(), user_id=None, prospect_id=prospect.id, to_email=email,
            category=EmailCategory.prospeccion.value, template_key="prospeccion", subject=subject,
            html=rendered.html, text=rendered.text, status=EmailStatus.pending.value, attempts=0,
            campaign_id=c.id, touch=1, dedupe_key=f"campaign:{c.id}:{prospect.id}", scheduled_at=now,
        ))
    if rows:
        logger.info("secuencia_encolada", empresas=len(rows))
    return len(rows)


async def stats(db: AsyncSession, c: EmailCampaign) -> dict:
    from app.services.email.policy import local_day_start

    now = datetime.now(timezone.utc)
    base = select(func.count()).select_from(EmailOutbox).where(EmailOutbox.campaign_id == c.id)
    sent = EmailOutbox.status == EmailStatus.sent.value
    por_paso = dict((await db.execute(select(EmailOutbox.touch, func.count()).where(
        EmailOutbox.campaign_id == c.id, sent).group_by(EmailOutbox.touch))).all())
    contacted = select(EmailOutbox.prospect_id).where(EmailOutbox.campaign_id == c.id, sent)
    respondieron = (await db.execute(select(func.count()).select_from(Prospect).where(
        Prospect.id.in_(contacted), Prospect.stage.in_([ProspectStage.respondio.value, ProspectStage.reunion.value,
                                                        ProspectStage.cliente.value, ProspectStage.registrada.value])))).scalar_one()
    bajas = (await db.execute(select(func.count()).select_from(Prospect).where(
        Prospect.id.in_(contacted), Prospect.do_not_contact.is_(True)))).scalar_one()
    return {
        "en_cola": (await db.execute(base.where(EmailOutbox.status == EmailStatus.pending.value))).scalar_one(),
        "enviados_hoy": (await db.execute(base.where(sent, EmailOutbox.sent_at >= local_day_start(now)))).scalar_one(),
        "enviados_por_paso": {str(k): v for k, v in por_paso.items()},
        "empresas_contactadas": (await db.execute(select(func.count(func.distinct(EmailOutbox.prospect_id))).where(
            EmailOutbox.campaign_id == c.id, sent))).scalar_one(),
        "respondieron": respondieron,
        "bajas": bajas,
        "por_entrar": (await db.execute(select(func.count()).select_from(_eligible_new().subquery()))).scalar_one(),
        "tope_diario": settings.PROSPECT_DAILY_CAP,
    }
