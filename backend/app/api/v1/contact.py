from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.contact import ContactMessage
from app.schemas.contact import ContactMessageCreate
from app.services.notifications import notify_all_admins

router = APIRouter()


@router.post("/contact")
async def submit_contact_message(
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
        body=f"{payload.name} escribió ({'empresa' if payload.topic.value == 'empresa' else 'general'}).",
        link="/dashboard/admin/mensajes",
    )

    await db.commit()
    return {"status": "ok"}
