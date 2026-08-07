import datetime
import uuid
from typing import List, NamedTuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.candidate import CandidateProfile, Experience, Education, CandidateSkill, Language
from app.schemas.candidate import ProfileMissingItem

# Recordatorio "completá tu perfil": no repetir antes de este intervalo.
REMINDER_MIN_INTERVAL_DAYS = 7

_PROFILE_LINK = "/dashboard/candidate/perfil"


class ProfileCompletion(NamedTuple):
    percent: int
    missing: List[ProfileMissingItem]


def compute_profile_completion(
    profile: CandidateProfile,
    *,
    has_experience: bool,
    has_education: bool,
    has_skills: bool,
    has_languages: bool,
) -> ProfileCompletion:
    """Un solo cálculo de % de perfil completo — candidato y empresa ven el mismo número.
    Ítems con igual peso; cada uno representa un dato que alimenta los filtros de Fase 1.5.
    Recibe booleanos (no listas completas) para no forzar fetches pesados en los llamadores
    que sólo necesitan saber si el candidato cargó al menos un registro de cada tipo.

    Los idiomas cuentan como ítem propio **además** de existir como habilidad técnica
    (decisión de Gael, 06/08/2026: "que esté en los 2 lados"). Ojo al efecto: para sumar este
    ítem hay que cargar un idioma, y para cargarlo hay que tildar la habilidad "Idiomas", que
    ocupa uno de los 6 cupos técnicos."""
    items = [
        ("photo_url", bool(profile.photo_url), "Foto de perfil"),
        ("birth_date", profile.birth_date is not None, "Fecha de nacimiento"),
        ("gender", profile.gender is not None, "Sexo"),
        ("location_zone_id", profile.location_zone_id is not None, "Zona"),
        ("has_own_transport", profile.has_own_transport is not None, "Movilidad"),
        ("availability", profile.availability is not None, "Disponibilidad"),
        ("summary", bool(profile.summary), "Descripción personal"),
        (
            "modality_pref",
            profile.accepts_remote or profile.accepts_hybrid or profile.accepts_onsite,
            "Preferencia de modalidad de trabajo",
        ),
        ("cv_file_url", bool(profile.cv_file_url), "CV"),
        ("experience", has_experience, "Experiencia laboral"),
        ("education", has_education, "Educación"),
        ("skills", has_skills, "Habilidades"),
        ("languages", has_languages, "Idiomas"),
    ]

    done = sum(1 for _, ok, _ in items if ok)
    percent = round(done / len(items) * 100)
    missing = [
        ProfileMissingItem(key=key, label=label, link=_PROFILE_LINK)
        for key, ok, label in items
        if not ok
    ]
    return ProfileCompletion(percent=percent, missing=missing)


async def compute_profile_completion_for_candidate(
    db: AsyncSession, profile: CandidateProfile
) -> ProfileCompletion:
    """Variante que resuelve los booleanos con queries livianas (LIMIT 1) — para llamadores
    que no tienen ya las listas de experiencia/educación/skills/idiomas en memoria."""

    async def _has_any(model) -> bool:
        result = await db.execute(select(model.id).where(model.candidate_id == profile.id).limit(1))
        return result.scalar_one_or_none() is not None

    has_skills = (await db.execute(
        select(CandidateSkill.candidate_id).where(CandidateSkill.candidate_id == profile.id).limit(1)
    )).scalar_one_or_none() is not None

    return compute_profile_completion(
        profile,
        has_experience=await _has_any(Experience),
        has_education=await _has_any(Education),
        has_skills=has_skills,
        has_languages=await _has_any(Language),
    )


def should_send_completion_reminder(profile: CandidateProfile, percent: int) -> bool:
    if percent >= 100:
        return False
    if profile.last_completion_reminder_at is None:
        return True
    elapsed = datetime.datetime.now(datetime.timezone.utc) - profile.last_completion_reminder_at
    return elapsed.days >= REMINDER_MIN_INTERVAL_DAYS
