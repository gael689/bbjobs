"""Admin → Textos de los mails: Eugenia edita el asunto y el texto de cada mail automático, o lo
apaga (Gael, 23/11/2026: "que ella pueda MODIFICAR").

Usa `email_templates`, que el envío ya respeta (`outbox.build_content` y `policy`): la fila no
existe hasta que alguien toca algo, y mientras tanto vale el texto del código (`copy.py`). Lo
editado usa variables con doble llave (`{{puesto}}`), las mismas que el resto de los textos
editables del panel.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.features import require_new_modules
from app.models.core import User, UserRole
from app.models.email import EmailOutbox, EmailStatus, EmailTemplate
from app.services.email.catalog import RULES
from app.services.email.copy import COPY, MailCopy

router = APIRouter(dependencies=[Depends(require_new_modules)])
_admin = require_role([UserRole.admin])

_UNA_LLAVE = re.compile(r"(?<!\{)\{([a-z_]+)\}(?!\})")
# Lo que arma el sistema y no conviene ofrecer para escribir a mano.
_INTERNAS = {"variante", "enlace", "whatsapp"}

VARIABLES = {
    "nombre": "Nombre de quien recibe", "puesto": "Título de la búsqueda", "empresa": "Nombre de la empresa",
    "motivo": "Motivo (rechazos)", "cantidad": "Cantidad", "puestos": "Lista de búsquedas",
    "titulo": "Título de la notificación", "mensaje": "Texto de la notificación",
}

GRUPO = {"candidato": "A postulantes", "empresa": "A empresas"}

# Mails que el sistema arma solo (resúmenes, avisos al equipo, revisión de CV…): no tienen texto
# editable acá, pero se ven, se cuentan y se pueden apagar igual (el envío respeta el interruptor).
SIN_TEXTO: dict[str, tuple[str, str]] = {
    "digest_para_vos": ("Resumen «Para vos»: búsquedas que te pueden interesar", "A postulantes"),
    "aviso_busquedas": ("Aviso: hay búsquedas nuevas que encajan con tu perfil", "A postulantes"),
    "application_new_status": ("Cambió el estado de tu postulación", "A postulantes"),
    "cv_review_paid": ("Revisión de CV: recibimos tu pago", "A postulantes"),
    "cv_review_in_progress": ("Revisión de CV: estamos revisando tu CV", "A postulantes"),
    "cv_review_delivered": ("Revisión de CV: tu revisión está lista", "A postulantes"),
    "cv_review_payment_rejected": ("Revisión de CV: el pago no se aprobó", "A postulantes"),
    "skill_suggestions_ready": ("Sugerencias para mejorar tu perfil", "A postulantes"),
    "digest_empresa": ("Resumen diario de postulaciones nuevas", "A empresas"),
    "application_new": ("Nueva postulación a tu búsqueda", "A empresas"),
    "job_pending_review": ("Tu búsqueda quedó en revisión", "A empresas"),
    "digest_equipo": ("Resumen diario: empresas a verificar, búsquedas a revisar y mensajes de contacto",
                      "Al equipo de Talency"),
    "admin_company_pending": ("Empresa nueva para verificar", "Al equipo de Talency"),
    "admin_company_reapplied": ("Empresa que volvió a pedir verificación", "Al equipo de Talency"),
    "admin_payment_received": ("Pago recibido", "Al equipo de Talency"),
    "admin_payment_refunded": ("Pago devuelto", "Al equipo de Talency"),
    "admin_cv_review_new": ("Revisión de CV nueva para hacer", "Al equipo de Talency"),
    "admin_cv_review_overdue": ("Revisión de CV atrasada", "Al equipo de Talency"),
    "admin_cv_review_duplicate_payment": ("Revisión de CV pagada dos veces", "Al equipo de Talency"),
    "admin_ai_new_fits": ("La IA encontró candidatos que encajan", "Al equipo de Talency"),
    "admin_campaign_draft_ready": ("Borrador de campaña listo", "Al equipo de Talency"),
    "admin_campaign_weekly_ready": ("Campaña semanal lista para revisar", "Al equipo de Talency"),
    "admin_email_health": ("Alerta de salud de los mails", "Al equipo de Talency"),
    "contact_message_received": ("Mensaje nuevo desde el formulario de contacto", "Al equipo de Talency"),
}


def _dobles(texto: str) -> str:
    return _UNA_LLAVE.sub(r"{{\1}}", texto)


def _default_body(copy: MailCopy) -> str:
    return _dobles("\n\n".join(copy.paragraphs))


def _nombre(copy: MailCopy) -> str:
    base = copy.heading or copy.subject
    return _UNA_LLAVE.sub("…", base).strip()


class TextoOut(BaseModel):
    key: str
    nombre: str
    grupo: str
    categoria: str
    activo: bool
    asunto: str
    texto: str
    asunto_original: str
    texto_original: str
    editado: bool
    variables: dict[str, str]
    # False = lo arma el sistema (resúmenes, avisos al equipo): se ve y se apaga, el texto no se edita.
    editable: bool = True
    enviados_30d: int = 0
    ultimo_envio: Optional[datetime] = None


class TextoIn(BaseModel):
    activo: Optional[bool] = None
    asunto: Optional[str] = Field(default=None, max_length=500)
    texto: Optional[str] = Field(default=None, max_length=8000)


def _out(key: str, copy: MailCopy, t: EmailTemplate | None) -> TextoOut:
    asunto_o, texto_o = _dobles(copy.subject), _default_body(copy)
    usados = set(re.findall(r"\{([a-z_]+)\}", copy.subject + " " + " ".join(copy.paragraphs))) - _INTERNAS
    rule = RULES.get(key)
    return TextoOut(
        key=key, nombre=_nombre(copy), grupo=GRUPO.get(copy.voice, "Otros"),
        categoria=str(getattr(rule.category, "value", rule.category)) if rule else "",
        activo=t.enabled if t else True,
        asunto=(t.subject_override if t and t.subject_override else asunto_o),
        texto=(t.body_override if t and t.body_override else texto_o),
        asunto_original=asunto_o, texto_original=texto_o,
        editado=bool(t and (t.subject_override or t.body_override)),
        variables={v: VARIABLES.get(v, v) for v in sorted(usados | {"nombre"})},
    )


@router.get("/admin/mail/templates", response_model=list[TextoOut])
async def list_templates(_: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    overrides = {t.key: t for t in (await db.execute(select(EmailTemplate))).scalars().all()}
    since = datetime.now(timezone.utc) - timedelta(days=30)
    usos = {k: (n, u) for k, n, u in (await db.execute(
        select(EmailOutbox.template_key, func.count().filter(EmailOutbox.sent_at >= since), func.max(EmailOutbox.sent_at))
        .where(EmailOutbox.status == EmailStatus.sent.value).group_by(EmailOutbox.template_key))).all()}
    # Sólo los que de verdad salen por mail (tienen regla en el catálogo).
    out = []
    for k, c in COPY.items():
        if k in RULES:
            o = _out(k, c, overrides.get(k))
            o.enviados_30d, o.ultimo_envio = usos.get(k, (0, None))
            out.append(o)
    for k, rule in RULES.items():
        # `none` no manda mail; los demás `digest` van adentro de un resumen (que sí se lista).
        if k in COPY or rule.mode == "none" or (rule.mode == "digest" and not k.startswith(("digest_", "aviso_"))):
            continue
        nombre, grupo = SIN_TEXTO.get(k, (k.replace("_", " ").capitalize(), "Otros"))
        t = overrides.get(k)
        n, u = usos.get(k, (0, None))
        out.append(TextoOut(
            key=k, nombre=nombre, grupo=grupo, categoria=str(getattr(rule.category, "value", rule.category)),
            activo=t.enabled if t else True, asunto="", texto="", asunto_original="", texto_original="",
            editado=False, variables={}, editable=False, enviados_30d=n, ultimo_envio=u))
    return out


@router.put("/admin/mail/templates/{key}", response_model=TextoOut)
async def save_template(key: str, payload: TextoIn, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    copy = COPY.get(key)
    if key not in RULES:
        raise HTTPException(status_code=404, detail="Ese mail no existe")
    if copy is None and (payload.asunto is not None or payload.texto is not None):
        raise HTTPException(status_code=400, detail="El texto de este mail lo arma el sistema: sólo se puede prender o apagar")
    t = (await db.execute(select(EmailTemplate).where(EmailTemplate.key == key))).scalar_one_or_none()
    if t is None:
        t = EmailTemplate(id=uuid.uuid4(), key=key, enabled=True)
        db.add(t)
    if payload.activo is not None:
        t.enabled = payload.activo
    if copy is None:
        await db.commit()
        rule = RULES[key]
        nombre, grupo = SIN_TEXTO.get(key, (key.replace("_", " ").capitalize(), "Otros"))
        return TextoOut(key=key, nombre=nombre, grupo=grupo, categoria=str(getattr(rule.category, "value", rule.category)),
                        activo=t.enabled, asunto="", texto="", asunto_original="", texto_original="",
                        editado=False, variables={}, editable=False)
    if payload.asunto is not None:
        a = payload.asunto.strip()
        if not a:
            raise HTTPException(status_code=400, detail="El asunto no puede quedar vacío")
        # Igual al original = sin editar (así el texto del código sigue mandando si cambia).
        t.subject_override = None if a == _dobles(copy.subject) else a
    if payload.texto is not None:
        x = payload.texto.strip()
        if not x:
            raise HTTPException(status_code=400, detail="El texto no puede quedar vacío")
        t.body_override = None if x == _default_body(copy) else x
    await db.commit()
    return _out(key, copy, t)


@router.delete("/admin/mail/templates/{key}", response_model=TextoOut)
async def reset_template(key: str, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    """Vuelve al texto original (y lo deja prendido)."""
    copy = COPY.get(key)
    if copy is None or key not in RULES:
        raise HTTPException(status_code=404, detail="Ese mail no existe")
    t = (await db.execute(select(EmailTemplate).where(EmailTemplate.key == key))).scalar_one_or_none()
    if t is not None:
        await db.delete(t)
        await db.commit()
    return _out(key, copy, None)
