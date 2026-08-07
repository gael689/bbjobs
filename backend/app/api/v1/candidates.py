from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from pydantic import BaseModel
from app.api.deps import get_db, require_role
from app.models.core import User, UserRole
from app.models.candidate import (
    CandidateProfile, Experience, Education, CandidateSkill, Language,
    MAX_SKILLS_PER_CATEGORY,
)
from app.models.catalogs import Skill, SkillCategory, SKILL_SLUG_OTRA
from app.schemas.candidate import (
    CandidateProfileResponse, CandidateProfileUpdate,
    ExperienceCreate, ExperienceResponse,
    EducationCreate, EducationResponse,
    CandidateSkillItem, CandidateSkillsUpdate, CandidateSkillsResponse,
    LanguageCreate, LanguageResponse,
)
from fastapi.concurrency import run_in_threadpool
from app.schemas.documents import SignedDocumentLink
from app.integrations.cloudinary_client import upload_pdf, upload_image, signed_document_url
from app.services.profile_completion import compute_profile_completion_for_candidate
from app.services.history import log_candidate_activity
import uuid
import datetime

router = APIRouter()

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_candidate_profile(user_id: uuid.UUID, db: AsyncSession) -> CandidateProfile:
    result = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# ── Profile ───────────────────────────────────────────────────────────────────

async def _build_profile_response(profile: CandidateProfile, db: AsyncSession) -> CandidateProfileResponse:
    completion = await compute_profile_completion_for_candidate(db, profile)
    response = CandidateProfileResponse.model_validate(profile)
    return response.model_copy(update={
        "completion_percent": completion.percent,
        "missing_fields": completion.missing,
    })


@router.get("/me/candidate/profile", response_model=CandidateProfileResponse)
async def get_my_candidate_profile(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    return await _build_profile_response(profile, db)

@router.patch("/me/candidate/profile", response_model=CandidateProfileResponse)
async def update_my_candidate_profile(
    payload: CandidateProfileUpdate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(profile, key):
            setattr(profile, key, value)

    if update_data:
        await log_candidate_activity(
            db, candidate_id=profile.id, event_type="profile_update",
            summary="Actualizó sus datos personales",
        )

    await db.commit()
    await db.refresh(profile)
    return await _build_profile_response(profile, db)

class TalentPoolDecision(BaseModel):
    accepted: bool


@router.post("/me/candidate/talent-pool", response_model=CandidateProfileResponse)
async def decide_talent_pool(
    payload: TalentPoolDecision,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    """Registra la respuesta del candidato al aviso de la Base de Talento.

    Se separa del PATCH genérico de perfil a propósito: esto es un consentimiento sobre el
    que después se cobra un plan a las empresas, así que queda con fecha propia y con una
    entrada en el historial de actividad — tiene que poder auditarse."""
    profile = await _get_candidate_profile(current_user.id, db)

    now = datetime.datetime.now(datetime.timezone.utc)
    profile.visible_in_talent_pool = payload.accepted
    profile.talent_pool_decided_at = now
    if profile.talent_pool_asked_at is None:
        profile.talent_pool_asked_at = now

    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="talent_pool_consent",
        summary=(
            "Autorizó aparecer en la Base de Talento"
            if payload.accepted
            else "Rechazó aparecer en la Base de Talento"
        ),
    )

    await db.commit()
    await db.refresh(profile)
    return await _build_profile_response(profile, db)


@router.post("/me/candidate/talent-pool/dismiss", response_model=CandidateProfileResponse)
async def dismiss_talent_pool_prompt(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    """"Ahora no" — marca el aviso como mostrado sin fijar una decisión, así no lo perseguimos
    en cada visita. Sigue pudiendo activarlo desde su perfil cuando quiera."""
    profile = await _get_candidate_profile(current_user.id, db)
    if profile.talent_pool_asked_at is None:
        profile.talent_pool_asked_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(profile)
    return await _build_profile_response(profile, db)


@router.post("/me/candidate/cv", response_model=CandidateProfileResponse)
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo muy grande. Máximo 5MB")

    profile = await _get_candidate_profile(current_user.id, db)

    try:
        # run_in_threadpool: el SDK de Cloudinary es sincrónico y, llamado directo desde un
        # `async def`, bloquea el event loop — o sea que mientras alguien sube un archivo la
        # API entera deja de responderle a todo el mundo. Era la causa del "se tilda bastante"
        # que reportó Eugenia al cargar la foto de perfil.
        url = await run_in_threadpool(
            upload_pdf,
            content,
            folder="bbjobs/cvs",
            public_id=str(profile.id),
            content_type="application/pdf",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    profile.cv_file_url = url
    profile.cv_uploaded_at = datetime.datetime.now(datetime.timezone.utc)

    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="cv_upload", summary="Subió/actualizó su CV",
    )

    await db.commit()
    await db.refresh(profile)
    return await _build_profile_response(profile, db)

@router.post("/me/candidate/photo", response_model=CandidateProfileResponse)
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes")

    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Archivo muy grande. Máximo 2MB")

    profile = await _get_candidate_profile(current_user.id, db)

    try:
        url = await run_in_threadpool(
            upload_image,
            content,
            folder="bbjobs/candidate_photos",
            public_id=str(profile.id),
            content_type=file.content_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    profile.photo_url = url

    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="photo_upload", summary="Actualizó su foto de perfil",
    )

    await db.commit()
    await db.refresh(profile)
    return await _build_profile_response(profile, db)


@router.get("/me/candidate/cv/link", response_model=SignedDocumentLink)
async def get_my_cv_link(
    attachment: bool = False,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db),
):
    """Link firmado al CV propio. La URL de Cloudinary guardada en `cv_file_url` no se puede
    abrir directo (la cuenta tiene restringida la entrega de PDF y devuelve 401) — este endpoint
    es la única puerta."""
    profile = await _get_candidate_profile(current_user.id, db)
    if not profile.cv_file_url:
        raise HTTPException(status_code=404, detail="Todavía no subiste tu CV")

    url = signed_document_url(profile.cv_file_url, attachment=attachment)
    if not url:
        raise HTTPException(status_code=502, detail="No se pudo generar el link al CV")
    return SignedDocumentLink(url=url)


# ── Experience ────────────────────────────────────────────────────────────────

@router.get("/me/candidate/experience", response_model=List[ExperienceResponse])
async def list_experience(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    result = await db.execute(select(Experience).where(Experience.candidate_id == profile.id))
    return result.scalars().all()

@router.post("/me/candidate/experience", response_model=ExperienceResponse)
async def add_experience(
    payload: ExperienceCreate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    exp = Experience(
        candidate_id=profile.id,
        company_name=payload.company_name,
        role_title=payload.role_title,
        start_date=payload.start_date,
        end_date=payload.end_date,
        description=payload.description,
    )
    db.add(exp)
    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="experience_add",
        summary=f"Agregó experiencia: {payload.role_title} en {payload.company_name}",
    )
    await db.commit()
    await db.refresh(exp)
    return exp

@router.delete("/me/candidate/experience/{exp_id}", status_code=204)
async def delete_experience(
    exp_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    result = await db.execute(
        select(Experience).where(Experience.id == exp_id, Experience.candidate_id == profile.id)
    )
    exp = result.scalar_one_or_none()
    if not exp:
        raise HTTPException(status_code=404, detail="Experience not found")

    await db.delete(exp)
    await db.commit()


# ── Education ─────────────────────────────────────────────────────────────────

@router.get("/me/candidate/education", response_model=List[EducationResponse])
async def list_education(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    result = await db.execute(select(Education).where(Education.candidate_id == profile.id))
    return result.scalars().all()

@router.post("/me/candidate/education", response_model=EducationResponse)
async def add_education(
    payload: EducationCreate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    edu = Education(
        candidate_id=profile.id,
        institution=payload.institution,
        degree=payload.degree,
        level=payload.level,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
    )
    db.add(edu)
    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="education_add",
        summary=f"Agregó educación: {payload.degree} en {payload.institution}",
    )
    await db.commit()
    await db.refresh(edu)
    return edu

@router.delete("/me/candidate/education/{edu_id}", status_code=204)
async def delete_education(
    edu_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    result = await db.execute(
        select(Education).where(Education.id == edu_id, Education.candidate_id == profile.id)
    )
    edu = result.scalar_one_or_none()
    if not edu:
        raise HTTPException(status_code=404, detail="Education not found")

    await db.delete(edu)
    await db.commit()


# ── Skills ────────────────────────────────────────────────────────────────────

async def _build_skills_response(db: AsyncSession, profile: CandidateProfile) -> CandidateSkillsResponse:
    """Las habilidades del candidato, ya separadas en los dos grupos y en el orden del catálogo."""
    result = await db.execute(
        select(Skill)
        .join(CandidateSkill, CandidateSkill.skill_id == Skill.id)
        .where(CandidateSkill.candidate_id == profile.id)
        .order_by(Skill.sort_order.asc())
    )
    elegidas = [
        CandidateSkillItem(
            skill_id=s.id, skill_name=s.name, slug=s.slug, category=s.category
        )
        for s in result.scalars().all()
    ]
    return CandidateSkillsResponse(
        soft=[s for s in elegidas if s.category == SkillCategory.soft],
        technical=[s for s in elegidas if s.category == SkillCategory.technical],
        other_skill=profile.other_skill,
    )

@router.get("/me/candidate/skills", response_model=CandidateSkillsResponse)
async def list_my_skills(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    return await _build_skills_response(db, profile)


@router.put("/me/candidate/skills", response_model=CandidateSkillsResponse)
async def set_my_skills(
    payload: CandidateSkillsUpdate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    """Reemplaza la selección completa de habilidades.

    Es un PUT del conjunto entero y no un alta/baja de a una porque el tope de 6 por grupo sólo
    se puede validar mirando la selección completa: con endpoints de a uno, dos pedidos en
    paralelo pueden pasar el chequeo por separado y dejar 7 guardadas.
    """
    profile = await _get_candidate_profile(current_user.id, db)

    pedidas = list(dict.fromkeys(payload.skill_ids))  # sin duplicados, preservando el orden
    catalogo = {}
    if pedidas:
        result = await db.execute(select(Skill).where(Skill.id.in_(pedidas)))
        catalogo = {s.id: s for s in result.scalars().all()}

    desconocidas = [str(sid) for sid in pedidas if sid not in catalogo]
    if desconocidas:
        raise HTTPException(status_code=400, detail=f"Habilidades inexistentes: {', '.join(desconocidas)}")

    inactivas = [catalogo[sid].name for sid in pedidas if not catalogo[sid].is_active]
    if inactivas:
        raise HTTPException(status_code=400, detail=f"Habilidades fuera del catálogo: {', '.join(inactivas)}")

    for categoria, etiqueta in ((SkillCategory.soft, "blandas"), (SkillCategory.technical, "técnicas")):
        cuantas = sum(1 for sid in pedidas if catalogo[sid].category == categoria)
        if cuantas > MAX_SKILLS_PER_CATEGORY:
            raise HTTPException(
                status_code=400,
                detail=f"Podés elegir hasta {MAX_SKILLS_PER_CATEGORY} habilidades {etiqueta}.",
            )

    # El texto libre sólo tiene sentido si eligió "Otra"; si la destildó, se limpia solo para
    # que no quede un dato huérfano que la empresa ve sin contexto.
    eligio_otra = any(catalogo[sid].slug == SKILL_SLUG_OTRA for sid in pedidas)
    other_skill = (payload.other_skill or "").strip() or None
    if not eligio_otra:
        other_skill = None
    elif not other_skill:
        raise HTTPException(status_code=400, detail="Contanos cuál es esa otra habilidad.")

    previas = set((await db.execute(
        select(CandidateSkill.skill_id).where(CandidateSkill.candidate_id == profile.id)
    )).scalars().all())
    nuevas = set(pedidas)

    if nuevas != previas or profile.other_skill != other_skill:
        await db.execute(
            delete(CandidateSkill).where(CandidateSkill.candidate_id == profile.id)
        )
        for sid in pedidas:
            db.add(CandidateSkill(candidate_id=profile.id, skill_id=sid))
        profile.other_skill = other_skill

        await log_candidate_activity(
            db, candidate_id=profile.id, event_type="skill_update",
            summary=f"Actualizó sus habilidades ({len(pedidas)} seleccionadas)",
        )

    await db.commit()
    await db.refresh(profile)
    return await _build_skills_response(db, profile)


# ── Languages ─────────────────────────────────────────────────────────────────

@router.get("/me/candidate/languages", response_model=List[LanguageResponse])
async def list_languages(
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)
    result = await db.execute(select(Language).where(Language.candidate_id == profile.id))
    return result.scalars().all()

@router.post("/me/candidate/languages", response_model=LanguageResponse)
async def add_language(
    payload: LanguageCreate,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    lang = Language(
        candidate_id=profile.id,
        language_name=payload.language_name,
        level=payload.level,
    )
    db.add(lang)
    await log_candidate_activity(
        db, candidate_id=profile.id, event_type="language_add",
        summary=f"Agregó idioma: {payload.language_name} ({payload.level})",
    )
    await db.commit()
    await db.refresh(lang)
    return lang

@router.delete("/me/candidate/languages/{lang_id}", status_code=204)
async def delete_language(
    lang_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.candidate])),
    db: AsyncSession = Depends(get_db)
):
    profile = await _get_candidate_profile(current_user.id, db)

    result = await db.execute(
        select(Language).where(Language.id == lang_id, Language.candidate_id == profile.id)
    )
    lang = result.scalar_one_or_none()
    if not lang:
        raise HTTPException(status_code=404, detail="Language not found")

    await db.delete(lang)
    await db.commit()
