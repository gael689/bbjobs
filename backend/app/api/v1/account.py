"""
Hard-delete / account deletion endpoint — Ley 25.326 compliance.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models.core import User, UserRole, AdminProfile
from app.models.candidate import CandidateProfile, Experience, Education, CandidateSkill, Language
from app.models.company import CompanyProfile
from app.models.job import Application
from app.models.alerts import JobAlert, JobAlertNotification
from app.models.tests import TestSubmission, TestAnswer
from app.integrations.clerk_client import delete_clerk_user

router = APIRouter()


class DeleteAccountPayload(BaseModel):
    confirm: str


@router.delete("/me/account", status_code=200)
async def delete_account(
    payload: DeleteAccountPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Admins cannot self-delete via this endpoint
    if str(current_user.role) == str(UserRole.admin):
        raise HTTPException(status_code=403, detail="Los administradores no pueden eliminar su cuenta por este medio")

    # Ya no tenemos contraseña propia para re-autenticar (Clerk es dueño de las
    # credenciales) — la confirmación es tipeada, validada también server-side.
    if payload.confirm.strip().upper() != "ELIMINAR":
        raise HTTPException(status_code=400, detail="Confirmación inválida")

    clerk_user_id = current_user.clerk_user_id

    if str(current_user.role) == str(UserRole.candidate):
        await _delete_candidate(current_user, db)
    elif str(current_user.role) == str(UserRole.company):
        await _anonymize_company(current_user, db)

    await db.commit()

    if clerk_user_id:
        try:
            delete_clerk_user(clerk_user_id)
        except Exception:
            pass  # el webhook user.deleted reconcilia si esto falla

    return {"status": "ok", "message": "Cuenta eliminada correctamente"}


async def _delete_candidate(user: User, db: AsyncSession) -> None:
    """
    Full hard-delete for a candidate.
    - Deletes all personal data and sub-records
    - Anonymizes Application rows (cover_letter = None) so companies see "Candidato eliminado"
    """
    # Get profile
    result = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
    profile = result.scalar_one_or_none()

    if profile:
        candidate_id = profile.id

        # Get all submission IDs to delete answers first
        submissions_result = await db.execute(
            select(TestSubmission.id).where(TestSubmission.candidate_id == candidate_id)
        )
        submission_ids = [row[0] for row in submissions_result.fetchall()]

        if submission_ids:
            await db.execute(delete(TestAnswer).where(TestAnswer.submission_id.in_(submission_ids)))
            await db.execute(delete(TestSubmission).where(TestSubmission.candidate_id == candidate_id))

        # Get all alert IDs to delete alert notifications
        alerts_result = await db.execute(
            select(JobAlert.id).where(JobAlert.candidate_id == candidate_id)
        )
        alert_ids = [row[0] for row in alerts_result.fetchall()]

        if alert_ids:
            await db.execute(delete(JobAlertNotification).where(JobAlertNotification.alert_id.in_(alert_ids)))
            await db.execute(delete(JobAlert).where(JobAlert.candidate_id == candidate_id))

        # Anonymize applications (don't delete — company history must remain)
        apps_result = await db.execute(
            select(Application).where(Application.candidate_id == candidate_id)
        )
        for app in apps_result.scalars().all():
            app.cover_letter = None

        # Delete sub-records (cascade would handle most, but explicit is safer)
        await db.execute(delete(CandidateSkill).where(CandidateSkill.candidate_id == candidate_id))
        await db.execute(delete(Language).where(Language.candidate_id == candidate_id))
        await db.execute(delete(Education).where(Education.candidate_id == candidate_id))
        await db.execute(delete(Experience).where(Experience.candidate_id == candidate_id))

        # Delete the profile itself
        await db.delete(profile)

    # Delete the user — ON DELETE CASCADE will handle refresh tokens, notifications, etc.
    await db.delete(user)


async def _anonymize_company(user: User, db: AsyncSession) -> None:
    """
    GDPR/Ley 25.326 anonymization for a company.
    - Personal data is scrubbed from CompanyProfile
    - Job postings are preserved (company_legal_name_snapshot already saved)
    - User row is deleted
    """
    result = await db.execute(select(CompanyProfile).where(CompanyProfile.user_id == user.id))
    company = result.scalar_one_or_none()

    if company:
        company.is_anonymized = True
        company.legal_name = "Empresa eliminada"
        company.cuit = "00000000000"
        company.responsible_full_name = ""
        company.responsible_phone = ""
        company.responsible_email = "deleted@deleted.com"
        company.logo_url = None
        company.website = None
        company.description = None

    # Delete the user — ON DELETE CASCADE handles refresh tokens, notifications etc.
    await db.delete(user)
