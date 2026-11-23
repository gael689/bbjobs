"""Admin → Prospección automática (services/email/secuencia.py): ver cómo va, editar los 3
mails, prenderla o pausarla y mandarse una prueba."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.features import require_new_modules
from app.models.core import User, UserRole
from app.models.email import EmailCategory, EmailMailbox, EmailOutbox, EmailStatus
from app.models.prospect import Prospect
from app.models.settings import SettingKey
from app.services.email import secuencia
from app.services.settings import get_setting, set_setting

router = APIRouter(dependencies=[Depends(require_new_modules)])
_admin = require_role([UserRole.admin])


class Paso(BaseModel):
    n: int = Field(ge=1, le=3)
    after_days: int = Field(default=0, ge=0, le=30)
    subject: str = Field(default="", max_length=300)
    body: str = Field(default="", max_length=6000)


class SecuenciaOut(BaseModel):
    activa: bool
    pasos: list[Paso]
    variables: dict[str, str]
    stats: dict
    casillas_activas: int


class PasosIn(BaseModel):
    pasos: list[Paso] = Field(min_length=1, max_length=3)


class ActivaIn(BaseModel):
    activa: bool


class PruebaIn(BaseModel):
    n: int = Field(default=1, ge=1, le=3)


async def _out(db: AsyncSession) -> SecuenciaOut:
    c = await secuencia.get_or_create(db)
    casillas = (await db.execute(select(func.count()).select_from(EmailMailbox).where(
        EmailMailbox.status == "activa"))).scalar_one()
    return SecuenciaOut(
        activa=await get_setting(db, SettingKey.prospeccion_automatica_activa),
        pasos=[Paso(**p) for p in secuencia.steps_of(c)],
        variables=secuencia.VARIABLES, stats=await secuencia.stats(db, c), casillas_activas=casillas,
    )


@router.get("/admin/prospecting/sequence", response_model=SecuenciaOut)
async def get_sequence(_: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    out = await _out(db)
    await db.commit()   # la primera vez crea la secuencia con los textos de arranque
    return out


@router.put("/admin/prospecting/sequence", response_model=SecuenciaOut)
async def save_sequence(payload: PasosIn, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    c = await secuencia.get_or_create(db)
    pasos = sorted(payload.pasos, key=lambda p: p.n)
    try:
        secuencia.apply_steps(c, [p.model_dump() for p in pasos])
    except secuencia.SequenceError as err:
        raise HTTPException(status_code=400, detail=str(err))
    await secuencia.rerender_pending(db, c)
    await db.commit()
    return await _out(db)


@router.put("/admin/prospecting/sequence/active", response_model=SecuenciaOut)
async def set_active(payload: ActivaIn, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    await set_setting(db, SettingKey.prospeccion_automatica_activa, payload.activa)
    await db.commit()
    return await _out(db)


@router.post("/admin/prospecting/sequence/test", status_code=202)
async def send_test(payload: PruebaIn, admin: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    """El paso elegido, armado para una empresa de ejemplo, al mail de la admin (por el canal de
    avisos: no gasta cupo de prospección ni toca la reputación de las casillas)."""
    from app.services.email.prospect_dispatch import render_for_prospect

    c = await secuencia.get_or_create(db)
    pasos = secuencia.steps_of(c)
    if payload.n > len(pasos) or not pasos[payload.n - 1]["body"].strip():
        raise HTTPException(status_code=400, detail="Ese mail está vacío")
    paso = pasos[payload.n - 1]
    ejemplo = Prospect(id=uuid.uuid4(), name="Empresa de Ejemplo SRL", locality="Bahía Blanca",
                       source="prueba", external_id="prueba")
    subject, rendered = render_for_prospect(ejemplo, subject=paso["subject"] or f"Re: {pasos[0]['subject']}",
                                            body=paso["body"], cta_label=None, cta_url=None)
    db.add(EmailOutbox(
        id=uuid.uuid4(), user_id=admin.id, to_email=admin.email, category=EmailCategory.admin.value,
        template_key="prospeccion_prueba", subject=f"[Prueba · mail {payload.n}] {subject}"[:500],
        html=rendered.html, text=rendered.text, status=EmailStatus.pending.value, attempts=0,
        scheduled_at=datetime.now(timezone.utc),
    ))
    await db.commit()
    return {"queued": True}
