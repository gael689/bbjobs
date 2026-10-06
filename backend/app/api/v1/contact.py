import secrets

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.limiter import limiter
from app.models.contact import ContactMessage, ContactTopic
from app.schemas.contact import ArrepentimientoCreate, ArrepentimientoResponse, ContactMessageCreate
from app.services.notifications import notify_all_admins

router = APIRouter()


@router.post("/contact")
@limiter.limit("5/minute")
async def submit_contact_message(
    request: Request,
    payload: ContactMessageCreate,
    db: AsyncSession = Depends(get_db),
):
    msg = ContactMessage(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        company_name=payload.company_name,
        topic=payload.topic,
        message=payload.message,
    )
    db.add(msg)

    await notify_all_admins(
        db,
        type="contact_message_received",
        title="Nuevo mensaje de contacto",
        body=(
            f"{payload.name} escribió ({'empresa' if payload.topic.value == 'empresa' else 'general'})"
            f" · Tel: {payload.phone}"
        ),
        link="/dashboard/admin/mensajes",
    )

    await db.commit()
    return {"status": "ok"}


COMPRAS = {"destacado": "Aviso destacado", "pack": "Pack de la Base de Talento", "otro": "Otro"}
# Sin 0/O ni 1/I: el código se dicta por teléfono o se copia a mano.
_ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def nuevo_codigo() -> str:
    return "ARR-" + "".join(secrets.choice(_ALFABETO) for _ in range(6))


@router.post("/contact/arrepentimiento", response_model=ArrepentimientoResponse)
@limiter.limit("5/minute")
async def submit_arrepentimiento(
    request: Request,
    payload: ArrepentimientoCreate,
    db: AsyncSession = Depends(get_db),
):
    """Botón de arrepentimiento. El código se muestra en pantalla en el momento: la norma pide
    darlo dentro de las 24 h. La devolución la hace Talency desde Mercado Pago."""
    codigo = nuevo_codigo()
    while (await db.execute(select(ContactMessage.id).where(ContactMessage.tracking_code == codigo))).first():
        codigo = nuevo_codigo()
    partes = [f"Compra: {COMPRAS[payload.compra]}", f"Detalle: {payload.detalle.strip()}"]
    if payload.comentario and payload.comentario.strip():
        partes.append(f"Comentario: {payload.comentario.strip()}")
    msg = ContactMessage(
        name=payload.name.strip(),
        email=payload.email,
        phone=(payload.phone or "").strip() or None,
        topic=ContactTopic.arrepentimiento,
        message="\n".join(partes),
        tracking_code=codigo,
    )
    db.add(msg)
    await notify_all_admins(
        db,
        type="contact_message_received",
        title="Pedido de arrepentimiento",
        body=f"{payload.name.strip()} pidió la devolución de: {COMPRAS[payload.compra]} · {codigo}",
        link="/dashboard/admin/mensajes",
    )
    await db.commit()
    await db.refresh(msg)
    return ArrepentimientoResponse(codigo=codigo, recibido=msg.created_at)
