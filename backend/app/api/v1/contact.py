import secrets

import structlog
from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import bearer_scheme, get_db
from app.core.limiter import limiter
from app.integrations.clerk_client import verify_session_token
from app.models.contact import ContactMessage, ContactTopic
from app.models.core import User, UserRole
from app.schemas.contact import (
    ArrepentimientoCreate, ArrepentimientoResponse, ContactMessageCreate, ProblemaCreate,
)
from app.services.notifications import notify_all_admins

router = APIRouter()
logger = structlog.get_logger("app.contact")

TEMAS = {
    ContactTopic.general: "general",
    ContactTopic.empresa: "empresa",
    ContactTopic.seleccion: "selección de personal",
}


def armar_mensaje(payload: ContactMessageCreate) -> str:
    """Puesto, sector y vacantes (opcionales, formulario de selección) van como encabezado del
    mensaje: así Talency los lee en el panel sin columnas nuevas."""
    datos = []
    if payload.puesto:
        datos.append(f"Puesto a cubrir: {payload.puesto}")
    if payload.sector:
        datos.append(f"Sector: {payload.sector}")
    if payload.vacantes:
        datos.append(f"Vacantes: {payload.vacantes}")
    return "\n".join(datos) + "\n\n" + payload.message if datos else payload.message


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
        message=armar_mensaje(payload),
    )
    db.add(msg)

    await notify_all_admins(
        db,
        type="contact_message_received",
        title="Consulta por selección de personal" if payload.topic == ContactTopic.seleccion else "Nuevo mensaje de contacto",
        body=f"{payload.name} escribió ({TEMAS.get(payload.topic, 'general')}) · Tel: {payload.phone}",
        link="/dashboard/admin/mensajes",
    )

    await db.commit()
    return {"status": "ok"}


COMPRAS = {"destacado": "Aviso destacado", "pack": "Pack de la Base de Talento", "revision_cv": "Revisión de CV",
           "otro": "Otro"}
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


ROLES = {UserRole.candidate: "Postulante", UserRole.company: "Empresa", UserRole.admin: "Admin"}


async def usuario_opcional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """El que reporta puede estar o no logueado. Con un token válido se sabe quién es; con uno
    vencido o inválido se toma como visitante (reportar no debe fallar por la sesión)."""
    if credentials is None:
        return None
    try:
        payload = await verify_session_token(credentials.credentials)
    except Exception:  # token vencido o inválido, o Clerk sin responder: se reporta igual
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    return (await db.execute(select(User).where(User.clerk_user_id == sub))).scalar_one_or_none()


def armar_reporte(payload: ProblemaCreate, user: User | None, navegador: str | None) -> str:
    lineas = [f"Página: {payload.pagina or '(sin dato)'}"]
    if user is not None:
        lineas.append(f"Usuario: {ROLES.get(user.role, str(user.role))} · {user.email}")
    else:
        lineas.append("Usuario: visitante sin sesión")
        if payload.contacto:
            lineas.append(f"Contacto: {payload.contacto}")
    if navegador:
        lineas.append(f"Navegador: {navegador[:300]}")
    return "\n".join(lineas) + "\n\n" + payload.descripcion


@router.post("/contact/problema")
@limiter.limit("5/minute")
async def report_problem(
    request: Request,
    payload: ProblemaCreate,
    user: User | None = Depends(usuario_opcional),
    db: AsyncSession = Depends(get_db),
):
    """Botón "Reportar un problema" del sitio y de los paneles. Va a Admin → Mensajes con el tema
    `problema` y avisa a los admins, igual que el formulario de contacto."""
    contacto = payload.contacto if user is None else None
    msg = ContactMessage(
        name=(ROLES.get(user.role, "Usuario") if user else "Visitante")[:255],
        email=user.email if user else (contacto if contacto and "@" in contacto else None),
        phone=None if user or not contacto or "@" in contacto else contacto[:50],
        topic=ContactTopic.problema,
        message=armar_reporte(payload, user, request.headers.get("user-agent")),
    )
    db.add(msg)
    await notify_all_admins(
        db,
        type="contact_message_received",
        title="Reportaron un problema",
        body=(payload.pagina or "") + " · " + payload.descripcion[:120],
        link="/dashboard/admin/mensajes",
    )
    await db.commit()
    logger.info("problema_reportado", con_sesion=user is not None, pagina=(payload.pagina or "")[:200])
    return {"status": "ok"}
