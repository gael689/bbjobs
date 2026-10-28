"""Buscador y filtros de los postulantes de una búsqueda (empresa y admin).

Pedido de Eugenia (22/10/2026, BUSCADOR-Y-SEGUIMIENTO-POSTULANTES-PLAN.md): encontrar dentro de
una búsqueda al postulante que ya había visto ("técnico electromecánico", "Gómez", "Profertil")
sin recorrer 400 filas, y filtrar por estado y por la estrella.

Antes había un solo campo, `position`, que era `ILIKE '%x%'` sobre el puesto de la experiencia:
sin tildes, sin nombre ni empresa, y "tecnico electromecanico" no encontraba "Técnico
Electromecánico" porque buscaba la frase entera.

- **Texto (`q`)**: reusa la normalización de `job_search.py` (sin tildes, palabras vacías,
  singular/plural, masculino/femenino, sinónimos de rubro). **AND entre palabras, OR entre
  variantes**: cada palabra tiene que aparecer en alguno de nombre y apellido, puesto, empresa
  o descripción de una experiencia, título o institución de un estudio, habilidades, resumen u
  "otra habilidad". Una palabra de 5+ letras que no aparece literal en **ningún postulante de la
  búsqueda** se prueba por parecido contra puesto y empresa (`word_similarity >= 0.5`, el mismo
  umbral medido para avisos): "profertl" encuentra "Profertil".
- **Años de experiencia en SQL** (`anios_experiencia_sql`): antes se filtraban en memoria y con
  ese filtro se traía la búsqueda entera para paginar en Python. `range_agg` (Postgres ≥ 14;
  Railway corre 16) fusiona los tramos superpuestos igual que `applicant_stats._years_of_experience`,
  así que la paginación vuelve a ser `LIMIT/OFFSET` siempre.
- **Estado, estrella y visto.** La estrella y el visto son de cada lado (`Lado`): la empresa
  filtra por los suyos y el admin por los de Talency. Nunca se cruzan.

Nada de esto toca el acceso: el que llama arma la consulta base (las postulaciones de **una**
búsqueda, ya validada contra `company_id` del lado de la empresa) y esto sólo le agrega
condiciones.
"""
from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass, field
from typing import List, Literal, Optional

from fastapi import Query
from sqlalchemy import Select, case, exists, func, literal, literal_column, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import (
    Availability, CandidateProfile, CandidateSkill, Education, Experience, Gender,
)
from app.models.catalogs import Skill
from app.models.job import Application, ApplicationStatus
from app.services.job_search import (
    FUZZY_THRESHOLD, Term, escape_like, normalize_text, norm, parse_query,
)

Lado = Literal["empresa", "admin"]
Orden = Literal["recientes", "estrella"]

MAX_Q_CHARS = 200


@dataclass
class FiltrosPostulantes:
    q: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    gender: Optional[Gender] = None
    has_own_transport: Optional[bool] = None
    availability: Optional[Availability] = None
    immediate_availability: Optional[bool] = None
    zone_id: Optional[uuid.UUID] = None
    experience_min: Optional[float] = None
    experience_max: Optional[float] = None
    status: list[ApplicationStatus] = field(default_factory=list)
    starred: Optional[bool] = None
    seen: Optional[bool] = None
    orden: Orden = "recientes"


def filtros_postulantes(
    q: Optional[str] = Query(None, max_length=MAX_Q_CHARS,
                             description="Nombre, apellido, puesto, empresa, estudios o habilidades"),
    position: Optional[str] = Query(None, max_length=MAX_Q_CHARS,
                                    description="Obsoleto: alias de `q` para el frontend anterior"),
    age_min: Optional[int] = Query(None, ge=0),
    age_max: Optional[int] = Query(None, ge=0),
    gender: Optional[Gender] = Query(None),
    has_own_transport: Optional[bool] = Query(None),
    availability: Optional[Availability] = Query(None),
    immediate_availability: Optional[bool] = Query(None),
    zone_id: Optional[uuid.UUID] = Query(None, description="Zona donde vive el candidato"),
    experience_min: Optional[float] = Query(None, ge=0, description="Años de experiencia, mínimo"),
    experience_max: Optional[float] = Query(None, ge=0, description="Años de experiencia, máximo"),
    status: Optional[List[ApplicationStatus]] = Query(None, description="Uno o varios estados"),
    starred: Optional[bool] = Query(None, description="Sólo con estrella (true) o sin estrella (false)"),
    seen: Optional[bool] = Query(None, description="Sólo vistos (true) o sin ver (false)"),
    orden: Orden = Query("recientes", description="recientes | estrella (las marcadas primero)"),
) -> FiltrosPostulantes:
    """Los parámetros del listado, declarados una vez para la empresa y el admin."""
    return FiltrosPostulantes(
        q=q or position, age_min=age_min, age_max=age_max, gender=gender,
        has_own_transport=has_own_transport, availability=availability,
        immediate_availability=immediate_availability, zone_id=zone_id,
        experience_min=experience_min, experience_max=experience_max,
        status=list(status or []), starred=starred, seen=seen, orden=orden,
    )


def columna_estrella(lado: Lado):
    return Application.company_starred_at if lado == "empresa" else Application.admin_starred_at


def columna_visto(lado: Lado):
    return Application.seen_at if lado == "empresa" else Application.admin_seen_at


def birth_date_cutoff(years_ago: int) -> datetime.date:
    """Fecha de nacimiento límite para un filtro de edad — corrimiento de N años desde hoy,
    con fallback si el 29/feb no existe en el año resultante (no bisiesto)."""
    today = datetime.date.today()
    try:
        return today.replace(year=today.year - years_ago)
    except ValueError:
        return today.replace(month=2, day=28, year=today.year - years_ago)


# Años de experiencia del candidato de la fila, calculados en la base. `range_agg` une los
# tramos que se pisan (dos trabajos simultáneos no cuentan doble) y `upper - lower` de cada
# rango fusionado son sus días. Mismo cálculo que `_years_of_experience`: un trabajo sin fecha
# de fin cuenta hasta hoy, uno que todavía no empezó cuenta cero, y se redondea a un decimal.
# Va como SQL literal porque `unnest` de un multirango no tiene forma limpia en SQLAlchemy;
# se correlaciona con `candidate_profiles` por nombre, que es como lo une la consulta base.
_ANIOS_EXPERIENCIA = literal_column(
    "(SELECT round(coalesce(sum(upper(r) - lower(r)), 0) / 365.25, 1)"
    " FROM unnest((SELECT range_agg(daterange(e.start_date,"
    " greatest(e.start_date, coalesce(e.end_date, current_date))))"
    " FROM experiences e WHERE e.candidate_id = candidate_profiles.id)) AS r)"
)


def anios_experiencia_sql():
    return _ANIOS_EXPERIENCIA


# ── Texto ─────────────────────────────────────────────────────────────────────────────

def _nombre_completo():
    # `first_name || ' ' || last_name` con el espacio literal (no como parámetro): es la
    # expresión exacta del índice `ix_candidate_profiles_nombre_trgm`.
    return norm(
        CandidateProfile.first_name.op("||")(literal_column("' '")).op("||")(CandidateProfile.last_name)
    )


def _contiene(expr_normalizada, variants) -> object:
    return or_(*[expr_normalizada.like(f"%{escape_like(v)}%", escape="\\") for v in variants])


def _condicion_termino(term: Term, *, parecido: bool):
    v = term.variants
    en_experiencia = [
        _contiene(norm(Experience.role_title), v),
        _contiene(norm(Experience.company_name), v),
        _contiene(norm(Experience.description), v),
    ]
    if parecido:
        en_experiencia += [
            func.word_similarity(term.word, norm(Experience.role_title)) >= FUZZY_THRESHOLD,
            func.word_similarity(term.word, norm(Experience.company_name)) >= FUZZY_THRESHOLD,
        ]
    # EXISTS y no JOIN: un candidato con tres trabajos que coinciden no tiene que salir tres veces.
    experiencia = exists(
        select(literal(1)).where(Experience.candidate_id == CandidateProfile.id, or_(*en_experiencia))
    )
    estudios = exists(
        select(literal(1)).where(
            Education.candidate_id == CandidateProfile.id,
            or_(_contiene(norm(Education.degree), v), _contiene(norm(Education.institution), v)),
        )
    )
    habilidades = exists(
        select(literal(1))
        .select_from(CandidateSkill)
        .join(Skill, Skill.id == CandidateSkill.skill_id)
        .where(CandidateSkill.candidate_id == CandidateProfile.id, _contiene(norm(Skill.name), v))
    )
    return or_(
        _contiene(_nombre_completo(), v),
        _contiene(norm(CandidateProfile.summary), v),
        _contiene(norm(CandidateProfile.other_skill), v),
        experiencia, estudios, habilidades,
    )


async def _aparece_literal(db: AsyncSession, base: Select, term: Term) -> bool:
    """¿Algún postulante de esta búsqueda tiene la palabra (o una variante) tal cual?

    La compuerta del parecido es por búsqueda y no por fila, como en avisos: si en la búsqueda
    hay un "operador", a quien escribió "operador" no le mezclamos los "operario"."""
    stmt = base.with_only_columns(literal(1)).where(_condicion_termino(term, parecido=False)).limit(1)
    return (await db.execute(stmt)).first() is not None


async def aplicar_filtros(
    db: AsyncSession, query: Select, filtros: FiltrosPostulantes, *, lado: Lado
) -> Select:
    """Le agrega a `query` —un `select(...)` de `Application` unido a `CandidateProfile`, ya
    acotado a una búsqueda— todos los filtros y el orden."""
    f = filtros
    if f.gender is not None:
        query = query.where(CandidateProfile.gender == f.gender)
    if f.has_own_transport is not None:
        query = query.where(CandidateProfile.has_own_transport == f.has_own_transport)
    if f.availability is not None:
        query = query.where(CandidateProfile.availability == f.availability)
    if f.immediate_availability is not None:
        query = query.where(CandidateProfile.immediate_availability == f.immediate_availability)
    if f.age_min is not None:
        # edad >= age_min  <=>  nació en o antes de "hoy - age_min años"
        query = query.where(CandidateProfile.birth_date <= birth_date_cutoff(f.age_min))
    if f.age_max is not None:
        # edad <= age_max  <=>  nació después de "hoy - (age_max+1) años"
        query = query.where(CandidateProfile.birth_date > birth_date_cutoff(f.age_max + 1))
    if f.zone_id is not None:
        query = query.where(CandidateProfile.location_zone_id == f.zone_id)
    if f.experience_min is not None:
        query = query.where(anios_experiencia_sql() >= f.experience_min)
    if f.experience_max is not None:
        query = query.where(anios_experiencia_sql() <= f.experience_max)

    # Estado, estrella y visto van antes del texto: la compuerta del parecido mira sólo a los
    # postulantes que ya pasaron los demás filtros.
    if f.status:
        query = query.where(Application.status.in_([s.value for s in f.status]))
    estrella = columna_estrella(lado)
    if f.starred is not None:
        query = query.where(estrella.is_not(None) if f.starred else estrella.is_(None))
    visto = columna_visto(lado)
    if f.seen is not None:
        query = query.where(visto.is_not(None) if f.seen else visto.is_(None))

    for term in parse_query(f.q).terms:
        parecido = term.fuzzy_ok and not await _aparece_literal(db, query, term)
        query = query.where(_condicion_termino(term, parecido=parecido))

    # Orden determinístico y no sólo "prolijo": sin un desempate estable, dos postulaciones
    # con el mismo created_at pueden salir en distinto orden en cada consulta y el OFFSET
    # repetir una en la página 2 mientras se saltea otra.
    orden = [Application.created_at.desc(), Application.id.desc()]
    if f.orden == "estrella":
        orden = [case((estrella.is_(None), 1), else_=0), estrella.desc(), *orden]
    return query.order_by(*orden)


# ── Por qué apareció ──────────────────────────────────────────────────────────────────

def _acierta(texto: str | None, term: Term) -> bool:
    t = normalize_text(texto)
    return bool(t) and any(v in t for v in term.variants)


def _mejor(candidatos: list[tuple[str, list[str | None]]], terms: list[Term]) -> tuple[int, str | None]:
    """El renglón (de una lista de `(renglón, [campos])`) que acierta más palabras."""
    mejor = (0, None)
    for renglon, campos in candidatos:
        n = sum(1 for t in terms if any(_acierta(c, t) for c in campos))
        if n > mejor[0]:
            mejor = (n, renglon)
    return mejor


async def coincidencias(
    db: AsyncSession, candidatos: list[CandidateProfile], q: str | None
) -> dict[uuid.UUID, str]:
    """Para cada candidato de la página, un renglón corto que explica por qué apareció
    ("Experiencia: Técnico electromecánico en Profertil"). Sólo cuando hay texto, y sólo sobre la
    página ya cortada (≤ 100 candidatos, tres consultas fijas). Si sólo coincidió el nombre —que
    ya se ve en la fila— o fue por parecido, no hay renglón."""
    terms = parse_query(q).terms
    if not terms or not candidatos:
        return {}
    ids = [c.id for c in candidatos]
    exps: dict[uuid.UUID, list[Experience]] = {}
    for e in (await db.execute(select(Experience).where(Experience.candidate_id.in_(ids)))).scalars():
        exps.setdefault(e.candidate_id, []).append(e)
    edus: dict[uuid.UUID, list[Education]] = {}
    for e in (await db.execute(select(Education).where(Education.candidate_id.in_(ids)))).scalars():
        edus.setdefault(e.candidate_id, []).append(e)
    skills: dict[uuid.UUID, list[str]] = {}
    for cid, name in (await db.execute(
        select(CandidateSkill.candidate_id, Skill.name)
        .join(Skill, Skill.id == CandidateSkill.skill_id)
        .where(CandidateSkill.candidate_id.in_(ids))
    )).all():
        skills.setdefault(cid, []).append(name)

    out: dict[uuid.UUID, str] = {}
    for c in candidatos:
        opciones: list[tuple[str, list[str | None]]] = []
        for e in sorted(exps.get(c.id, []), key=lambda e: e.start_date, reverse=True):
            opciones.append((f"Experiencia: {e.role_title} en {e.company_name}",
                             [e.role_title, e.company_name, e.description]))
        for e in edus.get(c.id, []):
            opciones.append((f"Estudios: {e.degree} ({e.institution})", [e.degree, e.institution]))
        nombres = [s for s in skills.get(c.id, []) if any(_acierta(s, t) for t in terms)]
        if nombres:
            opciones.append((f"Habilidades: {', '.join(nombres[:3])}", nombres))
        if c.other_skill:
            opciones.append((f"Habilidades: {c.other_skill}", [c.other_skill]))
        if c.summary:
            opciones.append(("Coincide con su presentación", [c.summary]))
        _, renglon = _mejor(opciones, terms)
        if renglon:
            out[c.id] = renglon
    return out


# ── Conteos para los chips ────────────────────────────────────────────────────────────

async def conteos(db: AsyncSession, job_id: uuid.UUID, *, lado: Lado) -> dict:
    """Cuántos postulantes tiene la búsqueda por estado, con estrella y sin ver. Sobre la
    búsqueda entera, no sobre el filtro aplicado: los chips son el mapa, no el resultado."""
    estrella, visto = columna_estrella(lado), columna_visto(lado)
    filas = (await db.execute(
        select(
            Application.status,
            func.count(),
            func.count(estrella),
            func.count().filter(visto.is_(None)),
        )
        .where(Application.job_posting_id == job_id)
        .group_by(Application.status)
    )).all()
    return {
        "total": sum(int(n) for _s, n, _e, _v in filas),
        "by_status": {str(getattr(s, "value", s)): int(n) for s, n, _e, _v in filas},
        "starred": sum(int(e) for _s, _n, e, _v in filas),
        "unseen": sum(int(v) for _s, _n, _e, v in filas),
    }


def condiciones_texto(q: str | None) -> list:
    """Las condiciones de texto sin la compuerta del parecido, para listados que no son de una
    búsqueda (`/admin/candidates`, que busca entre todos los candidatos)."""
    return [_condicion_termino(term, parecido=False) for term in parse_query(q).terms]
