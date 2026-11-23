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
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.features import require_new_modules
from app.models.core import User, UserRole
from app.models.email import EmailTemplate
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
    # Sólo los que de verdad salen por mail (tienen regla en el catálogo).
    return [_out(k, c, overrides.get(k)) for k, c in COPY.items() if k in RULES]


@router.put("/admin/mail/templates/{key}", response_model=TextoOut)
async def save_template(key: str, payload: TextoIn, _: User = Depends(_admin), db: AsyncSession = Depends(get_db)):
    copy = COPY.get(key)
    if copy is None or key not in RULES:
        raise HTTPException(status_code=404, detail="Ese mail no existe")
    t = (await db.execute(select(EmailTemplate).where(EmailTemplate.key == key))).scalar_one_or_none()
    if t is None:
        t = EmailTemplate(id=uuid.uuid4(), key=key, enabled=True)
        db.add(t)
    if payload.activo is not None:
        t.enabled = payload.activo
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
