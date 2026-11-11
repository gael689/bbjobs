""""Búsquedas para vos" en el panel del candidato (hasta ahora sólo llegaban por mail).

Mismas fuentes que los mails, sin llamar a Gemini en el pedido:

- **Evaluada por la IA** (`JobRecommendation.rerank_status == "done"`) y el candidato aceptó la
  privacidad 3.0 sin oponerse a la IA: manda esa fila. Entra con `final_score ≥ 70` (el umbral de
  `scoring.py`), y "Encaja muy bien" desde `NEW_FIT_THRESHOLD`, igual que en Recomendados.
- **Si no:** el puntaje simple del aviso al candidato (`digests.score_for_candidate`, con la tabla
  de cercanía de `services/zonas.py`) y el mismo umbral (`matches.SIMPLE_MATCH_MIN`).

El "por qué" se arma acá, en código y con datos del propio candidato: zona (cercanía),
modalidad, habilidades técnicas en común y, si la IA la evaluó, su nivel. **Nunca** sale el texto
de evidencia ni los motivos que la IA escribió para la empresa (`evidence`, `reasons`,
`req_evals`): esos son del lado de la empresa.

Orden (plan final §2.4): primero "Encaja muy bien", después "Encaja"; dentro de cada nivel, lo
evaluado por la IA antes que lo no evaluado (las dos fórmulas no son comparables); después el
puntaje y lo más nuevo. Sin N+1: una consulta por cosa (búsquedas, habilidades, filas de la IA,
mapa de zonas), no una por búsqueda.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.candidate import CandidateProfile, CandidateSkill
from app.models.catalogs import Skill, SkillCategory, Zone
from app.models.job import Application, JobPosting, JobPostingSkill

ENCAJA = "Encaja"
ENCAJA_MUY_BIEN = "Encaja muy bien"
# Puntaje simple de "encaja muy bien": zona y modalidad más dos habilidades en común (2 + 1 + 4).
# Depende de la escala de `score_for_candidate`, como `matches.SIMPLE_MATCH_MIN`.
SIMPLE_STRONG_MIN = 5.5  # 7 → 5,5 el 11/11, por la zona (digests.ZONE_POINTS)
MAX_ITEMS = 10
MAX_IDS = 200
MAX_SKILLS_IN_REASON = 3

_MODALIDAD = {
    "presencial": ("onsite", "Presencial"),
    "remoto": ("remote", "Remoto"),
    "híbrido": ("hybrid", "Híbrido"),
}


@dataclass
class Recomendada:
    job: JobPosting
    zone_name: str | None
    level: str
    ai_evaluated: bool
    score: float
    reasons: list[str] = field(default_factory=list)

    @property
    def strong(self) -> bool:
        return self.level == ENCAJA_MUY_BIEN


def _modalities(profile: CandidateProfile) -> set[str]:
    return {m for m, f in (("onsite", profile.accepts_onsite), ("hybrid", profile.accepts_hybrid),
                           ("remote", profile.accepts_remote)) if f}


def _join_names(names: list[str]) -> str:
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} y {names[-1]}"


def build_reasons(job: JobPosting, *, proximity: float | None, modalities: set[str],
                  common_technical: list[str], ai_level: str | None) -> list[str]:
    """Frases cortas del "por qué". Sólo afirma lo que sale del perfil del propio candidato."""
    reasons: list[str] = []
    modality = str(getattr(job.modality, "value", job.modality))
    if modality != "remoto":
        if proximity is not None and proximity >= 1:
            reasons.append("En tu zona")
        elif proximity is not None and proximity >= 0.8:
            reasons.append("Cerca de tu zona")
    needed, label = _MODALIDAD.get(modality, (None, None))
    if needed and needed in modalities:
        reasons.append(f"{label}, como buscás")
    if common_technical:
        shown = common_technical[:MAX_SKILLS_IN_REASON]
        rest = len(common_technical) - len(shown)
        text = _join_names(shown) if not rest else f"{', '.join(shown)} y {rest} más"
        reasons.append(f"Pide {text}")
    if ai_level:
        reasons.append(f"Revisada con IA: {ai_level.lower()}")
    return reasons


async def profile_gaps(db: AsyncSession, profile: CandidateProfile) -> list[str]:
    """Lo que le falta al perfil para recibir recomendaciones: zona y habilidades técnicas."""
    gaps = []
    if profile.location_zone_id is None:
        gaps.append("zona")
    has_technical = (await db.execute(
        select(exists().where(CandidateSkill.candidate_id == profile.id, CandidateSkill.skill_id == Skill.id,
                              Skill.category == SkillCategory.technical.value))
    )).scalar()
    if not has_technical:
        gaps.append("habilidades")
    return gaps


async def recommended_jobs(db: AsyncSession, profile: CandidateProfile, *, limit: int | None = MAX_ITEMS) -> list[Recomendada]:
    """Búsquedas activas, aprobadas y publicadas a las que `profile` no se postuló, que encajan
    con su perfil, en orden. Todo filtrado por `profile.id`: nunca toca a otro candidato."""
    from app.core.legal import accepted_ai_terms
    from app.models.ai import JobRecommendation
    from app.services.ai.scoring import NEW_FIT_THRESHOLD, RECOMMENDED_THRESHOLD
    from app.services.email.digests import score_for_candidate
    from app.services.email.matches import SIMPLE_MATCH_MIN
    from app.services.job_search import visible_jobs_filter
    from app.services.zonas import proximidad_ids, slugs_por_id

    jobs = (await db.execute(
        select(JobPosting, Zone.name).outerjoin(Zone, Zone.id == JobPosting.zone_id).where(
            visible_jobs_filter(), JobPosting.published_at.is_not(None),
            ~exists().where(Application.candidate_id == profile.id, Application.job_posting_id == JobPosting.id),
        )
    )).all()
    if not jobs:
        return []
    job_ids = [j.id for j, _ in jobs]

    job_skills: dict = {}
    for job_id, skill_id in (await db.execute(
        select(JobPostingSkill.job_posting_id, JobPostingSkill.skill_id)
        .where(JobPostingSkill.job_posting_id.in_(job_ids))
    )).all():
        job_skills.setdefault(job_id, set()).add(skill_id)

    cand_skills: set = set()
    technical: dict = {}   # skill_id → nombre, sólo las técnicas (las blandas pesan 0 en el puntaje de la IA)
    for skill_id, name, category in (await db.execute(
        select(Skill.id, Skill.name, Skill.category).join(CandidateSkill, CandidateSkill.skill_id == Skill.id)
        .where(CandidateSkill.candidate_id == profile.id)
    )).all():
        cand_skills.add(skill_id)
        if str(getattr(category, "value", category)) == SkillCategory.technical.value:
            technical[skill_id] = name

    # La IA cuenta sólo para quien la aceptó (privacidad 3.0) y no se opuso.
    ai_ok = profile.ai_opt_out_at is None and bool((await db.execute(
        select(accepted_ai_terms(profile.user_id))
    )).scalar())
    ai_rows: dict = {}
    if ai_ok:
        ai_rows = dict((await db.execute(
            select(JobRecommendation.job_id, JobRecommendation.final_score).where(
                JobRecommendation.candidate_id == profile.id, JobRecommendation.job_id.in_(job_ids),
                JobRecommendation.rerank_status == "done")
        )).all())

    zone_slugs = await slugs_por_id(db)
    modalities = _modalities(profile)
    out: list[Recomendada] = []
    for job, zone_name in jobs:
        skills = job_skills.get(job.id, set())
        if job.id in ai_rows:
            score = float(ai_rows[job.id])
            if score < RECOMMENDED_THRESHOLD:
                continue   # la IA la evaluó y no encaja: manda la IA
            level = ENCAJA_MUY_BIEN if score >= NEW_FIT_THRESHOLD else ENCAJA
            ai_level = level
        else:
            score = score_for_candidate(job, skills, cand_skills, profile.location_zone_id, modalities, zone_slugs)
            if score < SIMPLE_MATCH_MIN:
                continue
            level = ENCAJA_MUY_BIEN if score >= SIMPLE_STRONG_MIN else ENCAJA
            ai_level = None
        common = sorted(technical[s] for s in skills & technical.keys())
        out.append(Recomendada(
            job=job, zone_name=zone_name, level=level, ai_evaluated=ai_level is not None, score=score,
            reasons=build_reasons(job, proximity=proximidad_ids(profile.location_zone_id, job.zone_id, zone_slugs),
                                  modalities=modalities, common_technical=common, ai_level=ai_level),
        ))

    out.sort(key=lambda r: (not r.strong, not r.ai_evaluated, -r.score, -r.job.published_at.timestamp()))
    return out[:limit] if limit else out
