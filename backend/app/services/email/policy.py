"""Política de envío: para cada mail, ¿sale ahora, se difiere o se descarta?

Función pura —sin base ni red— para poder probar cada regla en una tabla. La llama el dispatcher
justo antes de mandar, con el estado de ese momento (no el del momento en que se encoló): así
una baja, un rebote o una cuenta borrada en el medio se respetan (auditoría M17, M18).

Reglas de MODULOS-V4-REGLAS-Y-REVISION-CV-PLAN.md §2.1:
R2 franja 08–21 · R3 críticos siempre · R4 tope por persona · R11 interruptores ·
preferencias, supresiones y cuentas borradas.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone

from app.services.email.catalog import Rule

# Argentina no tiene horario de verano desde 2009: UTC-3 fijo. Se evita `zoneinfo` porque en
# Windows (desarrollo) necesita el paquete `tzdata`, y un error de zona no puede frenar los mails.
AR_TZ = timezone(timedelta(hours=-3), "ART")

SEND_WINDOW_START = time(8, 0)
SEND_WINDOW_END = time(21, 0)
MAX_NONCRITICAL_PER_DAY = 2


@dataclass(frozen=True)
class Recipient:
    email: str
    is_active: bool
    deleted: bool
    suppressed: bool
    # La preferencia del usuario para la categoría del mail (sin fila = True).
    category_enabled: bool


@dataclass(frozen=True)
class Send:
    pass


@dataclass(frozen=True)
class Defer:
    until: datetime
    reason: str


@dataclass(frozen=True)
class Skip:
    reason: str


Decision = Send | Defer | Skip


def local_day_start(now: datetime) -> datetime:
    """Las 00:00 del día de Argentina que contiene `now`, en UTC."""
    local = now.astimezone(AR_TZ)
    return datetime.combine(local.date(), time(0, 0), AR_TZ).astimezone(timezone.utc)


def next_window_start(now: datetime) -> datetime:
    """El próximo comienzo de franja (08:00 ART) a partir de `now`, en UTC."""
    local = now.astimezone(AR_TZ)
    start_today = datetime.combine(local.date(), SEND_WINDOW_START, AR_TZ)
    target = start_today if local < start_today else start_today + timedelta(days=1)
    return target.astimezone(timezone.utc)


def in_send_window(now: datetime) -> bool:
    t = now.astimezone(AR_TZ).time()
    return SEND_WINDOW_START <= t < SEND_WINDOW_END


def decide(
    rule: Rule,
    recipient: Recipient,
    *,
    now: datetime,
    emails_enabled: bool,
    template_enabled: bool,
    sent_today_noncritical: int,
) -> Decision:
    """`now` en UTC con zona. `sent_today_noncritical` = mails no críticos que ya salieron hoy
    (día de Argentina) a esta persona."""
    if not emails_enabled:
        return Skip("interruptor general apagado")
    if not template_enabled:
        return Skip("aviso apagado por Talency")
    if recipient.deleted or not recipient.is_active:
        return Skip("cuenta borrada o inactiva")
    if recipient.email.lower().endswith(".invalid"):
        # Lápida de account_deletion: `eliminado+…@bbjobs.invalid` nunca recibe (M17).
        return Skip("dirección de lápida")
    if recipient.suppressed:
        return Skip("dirección suprimida (rebote o queja)")
    if rule.unsubscribable and not recipient.category_enabled:
        return Skip("la persona apagó esta categoría")

    if rule.critical:
        return Send()
    if not in_send_window(now):
        return Defer(next_window_start(now), "fuera de la franja 08–21")
    if not rule.exempt_daily_cap and sent_today_noncritical >= MAX_NONCRITICAL_PER_DAY:
        # Mañana a las 08:00. Cuando existan los resúmenes (T3) estos avisos se pliegan ahí.
        return Defer(next_window_start(local_day_start(now) + timedelta(days=1)), "tope diario por persona")
    return Send()
