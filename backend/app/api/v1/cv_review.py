"""Revisión de CV: compra del postulante y cola de Talency.

Módulo en desarrollo: todas las rutas responden 404 con la compuerta cerrada
(`MODULOS_NUEVOS_ACTIVOS`). Aislamiento sin RLS (ver CLAUDE.md): **toda consulta del postulante
filtra por su `candidate_id`**, y lo prueba un test de acceso cruzado.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.features import require_new_modules
from app.integrations import cloudinary_client
from app.models.candidate import CandidateProfile
from app.models.core import User, UserRole
from app.models.payment import CvReviewOrder, CvReviewStatus
from app.schemas.payment import CV_REVIEW_CURRENCY, cv_review_price
from app.services import cv_review as service

router = APIRouter(dependencies=[Depends(require_new_modules)])


async def _my_profile(db: AsyncSession, user: User) -> CandidateProfile:
    profile = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user.id, CandidateProfile.deleted_at.is_(None))
    )).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return profile


def _raise(err: service.CvReviewError):
    raise HTTPException(status_code=err.status_code, detail=err.message)


# ── Postulante ──────────────────────────────────────────────────────────────────────────

class CandidateOrder(BaseModel):
    id: uuid.UUID
    status: str
    contact_channel: str
    objective: Optional[str] = None
    price: float
    currency: str
    created_at: datetime
    paid_at: Optional[datetime] = None
    taken_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None


class CandidateOverview(BaseModel):
    price: float
    currency: str
    can_buy: bool
    reason: Optional[str] = None
    orders: list[CandidateOrder]


def _candidate_order(o: CvReviewOrder) -> CandidateOrder:
    return CandidateOrder(
        id=o.id, status=o.status, contact_channel=o.contact_channel, objective=o.objective,
        price=float(o.price), currency=o.currency, created_at=o.created_at, paid_at=o.paid_at,
        taken_at=o.taken_at, delivered_at=o.delivered_at,
    )


@router.get("/me/candidate/cv-review", response_model=CandidateOverview)
async def my_cv_review(
    user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    profile = await _my_profile(db, user)
    check = await service.eligibility(db, profile)
    orders = (await db.execute(
        select(CvReviewOrder).where(CvReviewOrder.candidate_id == profile.id)
        .order_by(CvReviewOrder.created_at.desc())
    )).scalars().all()
    return CandidateOverview(
        price=cv_review_price(), currency=CV_REVIEW_CURRENCY, can_buy=check.can_buy,
        reason=check.reason, orders=[_candidate_order(o) for o in orders],
    )


class CheckoutRequest(BaseModel):
    objective: Optional[str] = Field(default=None, max_length=service.OBJECTIVE_MAX)
    contact_channel: Literal["whatsapp", "email"]
    contact_value: Optional[str] = Field(default=None, max_length=255)
    consent: bool


class CheckoutResponse(BaseModel):
    init_point: str
    order_id: uuid.UUID
    payment_id: uuid.UUID


@router.post("/me/candidate/cv-review/checkout", response_model=CheckoutResponse)
async def checkout(
    payload: CheckoutRequest,
    user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    profile = await _my_profile(db, user)
    try:
        order, payment, init_point = await service.start_checkout(
            db, user=user, candidate=profile, objective=payload.objective,
            contact_channel=payload.contact_channel, contact_value=payload.contact_value,
            consent=payload.consent,
        )
    except service.CvReviewError as err:
        _raise(err)
    return CheckoutResponse(init_point=init_point, order_id=order.id, payment_id=payment.id)


@router.get("/me/candidate/cv-review/{order_id}", response_model=CandidateOrder)
async def my_order(
    order_id: uuid.UUID,
    user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    """Para el polling al volver de Mercado Pago. Filtra por el candidato: la de otro es 404."""
    profile = await _my_profile(db, user)
    order = (await db.execute(
        select(CvReviewOrder).where(CvReviewOrder.id == order_id, CvReviewOrder.candidate_id == profile.id)
    )).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return _candidate_order(order)


# ── Talency ─────────────────────────────────────────────────────────────────────────────

class AdminOrder(BaseModel):
    id: uuid.UUID
    status: str
    candidate_id: uuid.UUID
    candidate_name: str
    candidate_phone: Optional[str] = None
    contact_channel: str
    contact_value: Optional[str] = None
    objective: Optional[str] = None
    price: float
    currency: str
    admin_note: Optional[str] = None
    cv_changed: bool
    created_at: datetime
    paid_at: Optional[datetime] = None
    taken_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None


def _admin_order(o: CvReviewOrder, p: CandidateProfile) -> AdminOrder:
    return AdminOrder(
        id=o.id, status=o.status, candidate_id=p.id,
        candidate_name=f"{p.first_name} {p.last_name}".strip(), candidate_phone=p.phone or None,
        contact_channel=o.contact_channel, contact_value=o.contact_value, objective=o.objective,
        price=float(o.price), currency=o.currency, admin_note=o.admin_note,
        cv_changed=bool(o.cv_file_url_snapshot) and o.cv_file_url_snapshot != p.cv_file_url,
        created_at=o.created_at, paid_at=o.paid_at, taken_at=o.taken_at,
        delivered_at=o.delivered_at, refunded_at=o.refunded_at,
    )


@router.get("/admin/cv-reviews", response_model=list[AdminOrder])
async def admin_list(
    status: Optional[CvReviewStatus] = Query(default=None),
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(CvReviewOrder, CandidateProfile)
        .join(CandidateProfile, CandidateProfile.id == CvReviewOrder.candidate_id)
        .order_by(CvReviewOrder.paid_at.asc().nulls_last(), CvReviewOrder.created_at.desc())
    )
    if status is not None:
        query = query.where(CvReviewOrder.status == status.value)
    else:
        # Por defecto, lo que tiene que atender Talency.
        query = query.where(CvReviewOrder.status.in_([CvReviewStatus.paid.value, CvReviewStatus.in_progress.value]))
    return [_admin_order(o, p) for o, p in (await db.execute(query)).all()]


class AdminUpdate(BaseModel):
    status: Optional[CvReviewStatus] = None
    admin_note: Optional[str] = Field(default=None, max_length=2000)


async def _admin_get(db: AsyncSession, order_id: uuid.UUID) -> tuple[CvReviewOrder, CandidateProfile]:
    row = (await db.execute(
        select(CvReviewOrder, CandidateProfile)
        .join(CandidateProfile, CandidateProfile.id == CvReviewOrder.candidate_id)
        .where(CvReviewOrder.id == order_id)
    )).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return row[0], row[1]


@router.patch("/admin/cv-reviews/{order_id}", response_model=AdminOrder)
async def admin_update(
    order_id: uuid.UUID,
    payload: AdminUpdate,
    admin: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    order, profile = await _admin_get(db, order_id)
    try:
        if payload.status is not None:
            await service.change_status(db, order, payload.status, admin=admin, note=payload.admin_note)
        elif payload.admin_note is not None:
            order.admin_note = payload.admin_note.strip() or None
    except service.CvReviewError as err:
        _raise(err)
    await db.commit()
    return _admin_order(order, profile)


class SignedLink(BaseModel):
    url: str
    cv_changed: bool


@router.get("/admin/cv-reviews/{order_id}/cv", response_model=SignedLink)
async def admin_cv_link(
    order_id: uuid.UUID,
    _: User = Depends(require_role([UserRole.admin])),
    db: AsyncSession = Depends(get_db),
):
    """Link firmado de vida corta al CV que se pagó (o al actual, si el pagado ya no existe)."""
    order, profile = await _admin_get(db, order_id)
    source = order.cv_file_url_snapshot or profile.cv_file_url
    url = cloudinary_client.signed_document_url(source) if source else None
    if not url:
        raise HTTPException(status_code=404, detail="El postulante no tiene CV cargado")
    return SignedLink(url=url, cv_changed=_admin_order(order, profile).cv_changed)
