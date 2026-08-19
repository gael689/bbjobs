"""Estadísticas agregadas sobre los postulantes de una búsqueda.

Los cortes salen del documento de Eugenia (agosto/2026), que tomó como referencia lo que
muestran Bumeran y Computrabajo: cantidad de postulaciones, salario pretendido promedio, nivel
educativo más frecuente, y distribuciones por edad, años de experiencia, nivel educativo y
habilidades más declaradas.

El mismo cálculo alimenta tres vistas — la empresa que publicó, el candidato que se postuló
(que además ve resaltada *su* franja) y el panel de Talency. Que sea uno solo es deliberado:
tres implementaciones del mismo gráfico terminan dando tres números distintos.
"""
import datetime
import enum
import uuid
from typing import Dict, List, Optional, Sequence
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.candidate import (
    CandidateProfile, CandidateSkill, Education, EducationLevel, EducationStatus, Experience,
)
from app.models.catalogs import Skill

# Mismo orden que app/api/v1/jobs.py (_EDUCATION_RANK) — se duplica en vez de importar entre
# routers para no acoplar candidates/jobs solo por esta constante.
_EDUCATION_RANK = {
    EducationLevel.secundario: 0,
    EducationLevel.terciario: 1,
    EducationLevel.universitario: 2,
    EducationLevel.posgrado: 3,
}

# Franjas etarias. Arrancan en 18 (edad mínima para registrarse) y la última es abierta.
_FRANJAS_EDAD: List[tuple] = [
    ("18-24", 18, 24),
    ("25-34", 25, 34),
    ("35-44", 35, 44),
    ("45-54", 45, 54),
    ("55+", 55, None),
]

# Franjas de experiencia, en años.
_ORDEN_EXPERIENCIA = [
    "Sin experiencia",
    "Menos de 1 año",
    "Entre 1 y 3 años",
    "Entre 3 y 5 años",
    "Más de 5 años",
]

# Cuántas habilidades entran en el gráfico de "más declaradas".
TOP_SKILLS = 10


class Bucket(BaseModel):
    """Una barra o porción de un gráfico."""
    label: str
    count: int
    percent: float


class ApplicantStats(BaseModel):
    total: int

    # Tarjetas de arriba
    avg_age: Optional[float] = None
    avg_experience_years: Optional[float] = None
    expected_salary_min_avg: Optional[float] = None
    expected_salary_max_avg: Optional[float] = None
    expected_salary_reported: int = 0
    top_education_level: Optional[str] = None
    immediate_availability_count: int = 0

    # Distribuciones (gráficos)
    age_buckets: List[Bucket] = []
    experience_buckets: List[Bucket] = []
    education_buckets: List[Bucket] = []
    top_skills: List[Bucket] = []

    # Se mantienen del panel anterior — los sigue usando la barra de filtros de la empresa.
    education_distribution: Dict[str, int] = {}
    mobility: Dict[str, int] = {}
    availability: Dict[str, int] = {}


def _bucketize(conteo: Dict[str, int], orden: Sequence[str], total: int) -> List[Bucket]:
    """Arma las barras respetando el orden natural de las franjas, no el de mayor a menor:
    un eje de edad o de experiencia se lee mal si las franjas vienen desordenadas."""
    if total == 0:
        return []
    return [
        Bucket(
            label=label,
            count=conteo.get(label, 0),
            percent=round(conteo.get(label, 0) / total * 100, 1),
        )
        for label in orden
    ]


def _franja_edad(edad: int) -> Optional[str]:
    for label, desde, hasta in _FRANJAS_EDAD:
        if edad >= desde and (hasta is None or edad <= hasta):
            return label
    return None


def _franja_experiencia(anios: float) -> str:
    if anios <= 0:
        return "Sin experiencia"
    if anios < 1:
        return "Menos de 1 año"
    if anios < 3:
        return "Entre 1 y 3 años"
    if anios < 5:
        return "Entre 3 y 5 años"
    return "Más de 5 años"


def _years_of_experience(experiences: Sequence[Experience]) -> float:
    """Días cubiertos por AL MENOS un tramo, no la suma cruda de duraciones — dos trabajos
    simultáneos (part-time + freelance, o un cambio de puesto sin cerrar el anterior a tiempo)
    no tienen que contar doble. Se fusionan los intervalos superpuestos antes de sumar
    (algoritmo estándar: ordenar por inicio, extender el actual mientras el próximo arranca
    antes de que termine)."""
    today = datetime.date.today()
    intervalos = sorted(
        (exp.start_date, max(exp.start_date, exp.end_date or today)) for exp in experiences
    )
    if not intervalos:
        return 0.0

    total_days = 0
    inicio_actual, fin_actual = intervalos[0]
    for inicio, fin in intervalos[1:]:
        if inicio <= fin_actual:
            fin_actual = max(fin_actual, fin)
        else:
            total_days += (fin_actual - inicio_actual).days
            inicio_actual, fin_actual = inicio, fin
    total_days += (fin_actual - inicio_actual).days

    return round(total_days / 365.25, 1)


def _highest_education(educations: Sequence[Education]) -> Optional[Education]:
    if not educations:
        return None
    return max(educations, key=lambda e: _EDUCATION_RANK.get(e.level, -1))


def _highest_education_level(educations: Sequence[Education]) -> Optional[str]:
    mejor = _highest_education(educations)
    return _valor(mejor.level) if mejor else None


# Alias público — se reusa desde admin.py para el filtro de "título alcanzado" en
# GET /admin/candidates, además del uso interno de compute_applicant_stats.
get_highest_education_level = _highest_education_level


_ESTADO_EDUCACION_LABEL = {
    EducationStatus.graduado: "Graduado",
    EducationStatus.en_curso: "En curso",
    EducationStatus.abandonado: "Abandonado",
}


def _valor(v) -> str:
    """El valor plano de un enum, venga de donde venga.

    Estas columnas son `String` y no un ENUM de Postgres, así que al leer de la base el
    atributo es un `str` pelado, pero un objeto recién construido en memoria trae el Enum.
    `str()` sobre un `class X(str, Enum)` devuelve "X.miembro", no "miembro" — o sea que la
    etiqueta salía distinta según el origen del dato. Normalizar acá evita ese doble camino.
    """
    return v.value if isinstance(v, enum.Enum) else str(v)


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
    """Cuenta postulaciones, no candidatos únicos — mismo criterio que el resto del panel."""
    if not candidate_ids:
        return ApplicantStats(total=0)

    profiles_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.id.in_(candidate_ids))
    )
    profiles = {p.id: p for p in profiles_result.scalars().all()}
    ids_unicos = list(profiles.keys())

    # Educación, experiencia y habilidades de todos los postulantes en 3 queries, no 3 por
    # candidato — antes esto era un N+1 dentro del for.
    educaciones: Dict[uuid.UUID, List[Education]] = {}
    for e in (await db.execute(
        select(Education).where(Education.candidate_id.in_(ids_unicos))
    )).scalars().all():
        educaciones.setdefault(e.candidate_id, []).append(e)

    experiencias: Dict[uuid.UUID, List[Experience]] = {}
    for x in (await db.execute(
        select(Experience).where(Experience.candidate_id.in_(ids_unicos))
    )).scalars().all():
        experiencias.setdefault(x.candidate_id, []).append(x)

    skills_por_candidato: Dict[uuid.UUID, List[str]] = {}
    for cid, nombre in (await db.execute(
        select(CandidateSkill.candidate_id, Skill.name)
        .join(Skill, Skill.id == CandidateSkill.skill_id)
        .where(CandidateSkill.candidate_id.in_(ids_unicos))
    )).all():
        skills_por_candidato.setdefault(cid, []).append(nombre)

    edades: List[int] = []
    experiencia_anios: List[float] = []
    salarios_min: List[float] = []
    salarios_max: List[float] = []
    mobility = {"yes": 0, "no": 0, "unknown": 0}
    availability: Dict[str, int] = {"full_time": 0, "part_time": 0, "ambos": 0, "unknown": 0}
    immediate_count = 0

    conteo_edad: Dict[str, int] = {}
    conteo_experiencia: Dict[str, int] = {}
    conteo_educacion: Dict[str, int] = {}
    education_distribution: Dict[str, int] = {}
    conteo_skills: Dict[str, int] = {}

    for cid in candidate_ids:
        profile = profiles.get(cid)
        if not profile:
            continue

        edad = _calculate_age(profile.birth_date)
        if edad is not None:
            edades.append(edad)
            franja = _franja_edad(edad)
            if franja:
                conteo_edad[franja] = conteo_edad.get(franja, 0) + 1

        if profile.has_own_transport is None:
            mobility["unknown"] += 1
        elif profile.has_own_transport:
            mobility["yes"] += 1
        else:
            mobility["no"] += 1

        avail_key = _valor(profile.availability) if profile.availability else "unknown"
        availability[avail_key] = availability.get(avail_key, 0) + 1

        if profile.immediate_availability:
            immediate_count += 1

        if profile.expected_salary_min is not None:
            salarios_min.append(float(profile.expected_salary_min))
        if profile.expected_salary_max is not None:
            salarios_max.append(float(profile.expected_salary_max))

        # Nivel educativo: se toma el más alto alcanzado y se etiqueta con su estado, que es
        # como lo muestra Bumeran ("Universitario · En curso").
        mejor = _highest_education(educaciones.get(cid, []))
        if mejor:
            etiqueta = f"{_valor(mejor.level).capitalize()} · {_ESTADO_EDUCACION_LABEL.get(mejor.status, _valor(mejor.status))}"
            conteo_educacion[etiqueta] = conteo_educacion.get(etiqueta, 0) + 1
            education_distribution[_valor(mejor.level)] = education_distribution.get(_valor(mejor.level), 0) + 1

        exps = experiencias.get(cid, [])
        anios = _years_of_experience(exps) if exps else 0.0
        experiencia_anios.append(anios)
        franja_exp = _franja_experiencia(anios)
        conteo_experiencia[franja_exp] = conteo_experiencia.get(franja_exp, 0) + 1

        for nombre in skills_por_candidato.get(cid, []):
            conteo_skills[nombre] = conteo_skills.get(nombre, 0) + 1

    total = len(candidate_ids)
    con_experiencia = [a for a in experiencia_anios if a > 0]

    top_skills = [
        Bucket(label=nombre, count=cuenta, percent=round(cuenta / total * 100, 1))
        for nombre, cuenta in sorted(conteo_skills.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_SKILLS]
    ]

    # La tarjeta muestra el nivel, sin el estado: "Universitario", no "Universitario · En curso".
    top_education = (
        max(education_distribution.items(), key=lambda kv: kv[1])[0]
        if education_distribution else None
    )

    return ApplicantStats(
        total=total,
        avg_age=round(sum(edades) / len(edades), 1) if edades else None,
        avg_experience_years=(
            round(sum(con_experiencia) / len(con_experiencia), 1) if con_experiencia else None
        ),
        expected_salary_min_avg=round(sum(salarios_min) / len(salarios_min)) if salarios_min else None,
        expected_salary_max_avg=round(sum(salarios_max) / len(salarios_max)) if salarios_max else None,
        expected_salary_reported=max(len(salarios_min), len(salarios_max)),
        top_education_level=top_education,
        immediate_availability_count=immediate_count,
        age_buckets=_bucketize(conteo_edad, [f[0] for f in _FRANJAS_EDAD], total),
        experience_buckets=_bucketize(conteo_experiencia, _ORDEN_EXPERIENCIA, total),
        education_buckets=sorted(
            [Bucket(label=k, count=v, percent=round(v / total * 100, 1)) for k, v in conteo_educacion.items()],
            key=lambda b: -b.count,
        ),
        top_skills=top_skills,
        education_distribution=education_distribution,
        mobility=mobility,
        availability=availability,
    )


def franja_edad_de(edad: Optional[int]) -> Optional[str]:
    """La franja etaria de una persona — para resaltar la suya en la vista del candidato."""
    return _franja_edad(edad) if edad is not None else None


def franja_experiencia_de(anios: Optional[float]) -> Optional[str]:
    return _franja_experiencia(anios) if anios is not None else None


def anios_de_experiencia(experiences: Sequence[Experience]) -> float:
    """Expuesto para la vista comparativa del candidato, que necesita ubicar *su* franja."""
    return _years_of_experience(experiences)


def etiqueta_educacion(education: Optional[Education]) -> Optional[str]:
    if not education:
        return None
    return f"{_valor(education.level).capitalize()} · {_ESTADO_EDUCACION_LABEL.get(education.status, _valor(education.status))}"


def educacion_mas_alta(educations: Sequence[Education]) -> Optional[Education]:
    return _highest_education(educations)
