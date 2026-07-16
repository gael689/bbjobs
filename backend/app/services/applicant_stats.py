import datetime
import uuid
from typing import Dict, List, Optional, Sequence
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.candidate import CandidateProfile, Education, Experience, EducationLevel

# Mismo orden que app/api/v1/jobs.py (_EDUCATION_RANK) — se duplica en vez de importar entre
# routers para no acoplar candidates/jobs solo por esta constante.
_EDUCATION_RANK = {
    EducationLevel.secundario: 0,
    EducationLevel.terciario: 1,
    EducationLevel.universitario: 2,
    EducationLevel.posgrado: 3,
}


class ApplicantStats(BaseModel):
    total: int
    avg_age: Optional[float] = None
    avg_experience_years: Optional[float] = None
    education_distribution: Dict[str, int] = {}
    mobility: Dict[str, int] = {}
    availability: Dict[str, int] = {}
    immediate_availability_count: int = 0


def _years_of_experience(experiences: Sequence[Experience]) -> float:
    today = datetime.date.today()
    total_days = sum(max(0, ((exp.end_date or today) - exp.start_date).days) for exp in experiences)
    return round(total_days / 365.25, 1)


def _highest_education_level(educations: Sequence[Education]) -> Optional[str]:
    if not educations:
        return None
    best = max(educations, key=lambda e: _EDUCATION_RANK.get(e.level, -1))
    return str(best.level)


# Alias público — se reusa desde admin.py para el filtro de "título alcanzado" en
# GET /admin/candidates, además del uso interno de compute_applicant_stats.
get_highest_education_level = _highest_education_level


def _calculate_age(birth_date: Optional[datetime.date]) -> Optional[int]:
    if birth_date is None:
        return None
    today = datetime.date.today()
    years = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        years -= 1
    return years


async def compute_applicant_stats(
    db: AsyncSession, candidate_ids: Sequence[uuid.UUID]
) -> ApplicantStats:
    """Estadísticas agregadas sobre un conjunto de postulaciones (por candidate_id de cada
    Application) — se usa tanto para una búsqueda puntual como para el agregado de toda la
    empresa. Cuenta postulaciones, no candidatos únicos (mismo criterio que el resto del panel
    de estadísticas: si un candidato se postuló dos veces, cuenta dos veces)."""
    if not candidate_ids:
        return ApplicantStats(total=0)

    profiles_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id.in_(candidate_ids))
    )
    profiles = {p.id: p for p in profiles_result.scalars().all()}

    ages: List[int] = []
    mobility = {"yes": 0, "no": 0, "unknown": 0}
    availability: Dict[str, int] = {"full_time": 0, "part_time": 0, "ambos": 0, "unknown": 0}
    immediate_count = 0
    education_distribution: Dict[str, int] = {}
    experience_years: List[float] = []

    for cid in candidate_ids:
        profile = profiles.get(cid)
        if not profile:
            continue

        age = _calculate_age(profile.birth_date)
        if age is not None:
            ages.append(age)

        if profile.has_own_transport is None:
            mobility["unknown"] += 1
        elif profile.has_own_transport:
            mobility["yes"] += 1
        else:
            mobility["no"] += 1

        avail_key = str(profile.availability) if profile.availability else "unknown"
        availability[avail_key] = availability.get(avail_key, 0) + 1

        if profile.immediate_availability:
            immediate_count += 1

        educations = (
            await db.execute(select(Education).where(Education.candidate_id == cid))
        ).scalars().all()
        level = _highest_education_level(educations)
        if level:
            education_distribution[level] = education_distribution.get(level, 0) + 1

        experiences = (
            await db.execute(select(Experience).where(Experience.candidate_id == cid))
        ).scalars().all()
        if experiences:
            experience_years.append(_years_of_experience(experiences))

    return ApplicantStats(
        total=len(candidate_ids),
        avg_age=round(sum(ages) / len(ages), 1) if ages else None,
        avg_experience_years=(
            round(sum(experience_years) / len(experience_years), 1) if experience_years else None
        ),
        education_distribution=education_distribution,
        mobility=mobility,
        availability=availability,
        immediate_availability_count=immediate_count,
    )
