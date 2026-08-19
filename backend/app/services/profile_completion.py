import datetime
import uuid
from typing import Dict, List, NamedTuple, Sequence
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
    que no tienen ya las listas de experiencia/educación/skills/idiomas en memoria.

    Es para **un** candidato suelto. Si son varios va compute_profile_completion_bulk: llamar a
    ésta adentro de un `for` es exactamente el N+1 que esa otra existe para evitar."""

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


async def compute_profile_completion_bulk(
    db: AsyncSession, profiles: Sequence[CandidateProfile]
) -> Dict[uuid.UUID, ProfileCompletion]:
    """Lo mismo que compute_profile_completion_for_candidate, pero para un lote entero: 4
    consultas fijas en lugar de 4 por candidato.

    Los cuatro llamadores que la necesitan (los dos listados de postulantes, /admin/candidates y
    el recordatorio diario del scheduler) llamaban a la variante de a uno adentro de un `for`.
    Con los 143 candidatos de hoy eso ya eran ~572 idas a la base para pintar una pantalla, y el
    número crece con la base — que es justo lo que no se puede permitir en el recordatorio, que
    los recorre a todos sí o sí. Acá el costo no depende de cuántos sean.

    Devuelve un dict indexado por id de perfil: los llamadores filtran su propia lista después
    (por ejemplo /admin/candidates descarta por nivel educativo) y necesitan poder buscar por id,
    no por posición."""
    if not profiles:
        return {}

    ids = [p.id for p in profiles]

    async def _con_registros(columna) -> set:
        # Sólo importa la existencia, así que se piden los candidate_id distintos y nada más:
        # traer las filas enteras devolvería una por cada experiencia/idioma cargado y habría
        # que descartarlas en Python.
        return set(
            (await db.execute(select(columna).where(columna.in_(ids)).distinct())).scalars().all()
        )

    con_experiencia = await _con_registros(Experience.candidate_id)
    con_educacion = await _con_registros(Education.candidate_id)
    con_habilidades = await _con_registros(CandidateSkill.candidate_id)
    con_idiomas = await _con_registros(Language.candidate_id)

    return {
        p.id: compute_profile_completion(
            p,
            has_experience=p.id in con_experiencia,
            has_education=p.id in con_educacion,
            has_skills=p.id in con_habilidades,
            has_languages=p.id in con_idiomas,
        )
        for p in profiles
    }


def should_send_completion_reminder(profile: CandidateProfile, percent: int) -> bool:
    if percent >= 100:
        return False
    if profile.last_completion_reminder_at is None:
        return True
    elapsed = datetime.datetime.now(datetime.timezone.utc) - profile.last_completion_reminder_at
    return elapsed.days >= REMINDER_MIN_INTERVAL_DAYS
