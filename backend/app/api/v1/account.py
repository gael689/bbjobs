"""
Cuenta propia: auto-borrado (Ley 25.326) y "me equivoqué de tipo de cuenta".

La lógica de borrado vive en services/account_deletion.py, compartida con el panel de la
admin y el webhook de Clerk. Antes este archivo tenía su propia versión, que para empresas no
funcionaba: la anonimización era código muerto (el CASCADE de users borraba el perfil igual),
se llevaba puestas las postulaciones de otros candidatos, y con un solo pago registrado el
DELETE explotaba por el RESTRICT de payments.company_id.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.core import User, UserRole
from app.services.account_deletion import (
    AccountDeletionError,
    delete_account as delete_account_service,
    preview_deletion,
    reset_role,
)

router = APIRouter()


class DeleteAccountPayload(BaseModel):
    confirm: str


class MyDeletionPreview(BaseModel):
    mode: str  # "full" | "tombstone"
    counts: dict[str, int]
    # Sin actividad: puede cambiar de tipo de cuenta sin registrarse de nuevo.
    can_reset_role: bool


def _reject_admin(user: User) -> None:
    if user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Los administradores no pueden eliminar su cuenta por este medio")


@router.get("/me/account/deletion-preview", response_model=MyDeletionPreview)
async def my_deletion_preview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _reject_admin(current_user)
    p = await preview_deletion(db, current_user)
    return MyDeletionPreview(mode=p.mode.value, counts=p.counts, can_reset_role=p.is_empty)


@router.delete("/me/account", status_code=200)
async def delete_account(
    payload: DeleteAccountPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _reject_admin(current_user)
    # Clerk es dueño de las credenciales y no hay contraseña propia para re-autenticar: la
    # confirmación es tipeada y se valida también acá, no sólo en el botón.
    if payload.confirm.strip().upper() != "ELIMINAR":
        raise HTTPException(status_code=400, detail="Confirmación inválida")
    try:
        await delete_account_service(db, current_user, actor=current_user, reason="eliminada por el usuario")
    except AccountDeletionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    return {"status": "ok", "message": "Cuenta eliminada correctamente"}


@router.post("/me/account/reset-role", status_code=200)
async def reset_account_role(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Borra el perfil (sólo si la cuenta no tiene actividad) y deja vivo el login: la persona
    vuelve al onboarding y elige el otro tipo de cuenta sin registrarse de nuevo."""
    _reject_admin(current_user)
    try:
        await reset_role(db, current_user)
    except AccountDeletionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    return {"status": "ok"}
