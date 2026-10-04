"""Fragmentos de la ficha de un candidato (auditoría R1-bis).

Un vector por fragmento, no uno por candidato: con un solo vector, la experiencia que importa
se diluye entre las otras. Los fragmentos son por sección, y **nada de lo que sale de acá
identifica a la persona**: sin nombre, contacto, edad, género, foto, empleadores ni
instituciones (auditoría R12, v3 §5.2). Todo texto libre pasa por `redact`.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date

from app.services.ai.ingest import detect_injection, sanitize_text
from app.services.ai.redact import redact

MAX_CHUNKS = 12
MAX_EXPERIENCE_CHUNKS = 5
CV_CHUNK_CHARS = 1600       # ~400 tokens
CV_OVERLAP_CHARS = 200

AVAILABILITY = {"full_time": "jornada completa", "part_time": "media jornada", "ambos": "jornada completa o media"}
MODALITY = {"onsite": "presencial", "hybrid": "híbrido", "remote": "remoto"}


@dataclass
class Experience:
    role_title: str
    start: date | None
    end: date | None
    description: str | None = None
    company_name: str | None = None      # NO entra al texto: sólo sirve para filtrar la salida


@dataclass
class Education:
    level: str
    degree: str | None
    status: str | None
    institution: str | None = None       # NO entra al texto


@dataclass
class CandidateData:
    id: str
    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    email: str = ""
    zone_name: str | None = None
    availability: str | None = None
    modalities: list[str] = field(default_factory=list)      # onsite | hybrid | remote
    own_transport: bool | None = None
    immediate: bool | None = None
    technical_skills: list[str] = field(default_factory=list)
    other_skill: str | None = None
    languages: list[tuple[str, str]] = field(default_factory=list)
    summary: str | None = None
    experiences: list[Experience] = field(default_factory=list)
    educations: list[Education] = field(default_factory=list)
    cv_text: str | None = None


@dataclass
class Chunk:
    kind: str          # perfil | experiencia | formacion | cv
    ordinal: int
    text: str


@dataclass
class Ficha:
    chunks: list[Chunk]
    ficha_hash: str
    injection_flags: list[str]
    redaction_stats: dict[str, int]
    employer_names: list[str]
    institution_names: list[str]


def _months(start: date | None, end: date | None, today: date) -> int | None:
    if not start:
        return None
    end = end or today
    return max(0, (end.year - start.year) * 12 + end.month - start.month)


def _duration(months: int | None) -> str:
    if months is None:
        return "duración sin dato"
    years, rest = divmod(months, 12)
    if years and rest:
        return f"{years} años y {rest} meses"
    if years:
        return f"{years} años" if years > 1 else "1 año"
    return f"{rest} meses"


def _split(text: str) -> list[str]:
    """Trozos de ~400 tokens con solapamiento, cortando en un salto de línea o un punto."""
    parts, start = [], 0
    while start < len(text):
        end = min(len(text), start + CV_CHUNK_CHARS)
        if end < len(text):
            cut = max(text.rfind("\n", start + CV_CHUNK_CHARS // 2, end), text.rfind(". ", start + CV_CHUNK_CHARS // 2, end))
            if cut > start:
                end = cut + 1
        parts.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - CV_OVERLAP_CHARS, start + 1)
    return [p for p in parts if p]


def build_ficha(c: CandidateData, today: date | None = None) -> Ficha:
    today = today or date.today()
    names = [c.first_name, c.last_name, f"{c.first_name} {c.last_name}"]
    phones = [c.phone] if c.phone else []
    emails = [c.email] if c.email else []
    stats: dict[str, int] = {}
    flags: set[str] = set()

    def clean(text: str | None) -> str:
        if not text:
            return ""
        sanitized = sanitize_text(text)
        flags.update(detect_injection(sanitized))
        r = redact(sanitized, known_names=names, known_phones=phones, known_emails=emails)
        for k, v in r.stats.items():
            stats[k] = stats.get(k, 0) + v
        return r.text

    chunks: list[Chunk] = []

    perfil = []
    if c.technical_skills:
        perfil.append("Habilidades técnicas: " + ", ".join(sorted(c.technical_skills)) + ".")
    if c.other_skill:
        perfil.append(f"Otras habilidades: {clean(c.other_skill)}.")
    if c.languages:
        perfil.append("Idiomas: " + ", ".join(f"{n} ({lvl})" for n, lvl in c.languages) + ".")
    if c.zone_name:
        perfil.append(f"Zona: {c.zone_name}.")
    if c.availability in AVAILABILITY:
        perfil.append(f"Disponibilidad: {AVAILABILITY[c.availability]}.")
    if c.modalities:
        perfil.append("Acepta trabajo " + ", ".join(MODALITY[m] for m in c.modalities if m in MODALITY) + ".")
    if c.own_transport:
        perfil.append("Tiene movilidad propia.")
    if c.immediate:
        perfil.append("Disponibilidad inmediata.")
    if c.summary:
        perfil.append(f"Resumen: {clean(c.summary)}")
    if perfil:
        chunks.append(Chunk("perfil", 0, " ".join(perfil)))

    exps = sorted(c.experiences, key=lambda e: e.start or date.min, reverse=True)[:MAX_EXPERIENCE_CHUNKS]
    for i, e in enumerate(exps):
        text = f"Puesto: {clean(e.role_title)}. Duración: {_duration(_months(e.start, e.end, today))}"
        text += " (actual)." if e.end is None and e.start else "."
        if e.description:
            text += f" Tareas: {clean(e.description)}"
        chunks.append(Chunk("experiencia", i, text))

    if c.educations:
        edu = "; ".join(
            f"{e.level}" + (f" — {clean(e.degree)}" if e.degree else "") + (f" ({e.status})" if e.status else "")
            for e in c.educations
        )
        chunks.append(Chunk("formacion", 0, f"Formación: {edu}."))

    if c.cv_text:
        for i, part in enumerate(_split(clean(c.cv_text))):
            if len(chunks) >= MAX_CHUNKS:
                break
            chunks.append(Chunk("cv", i, part))

    chunks = chunks[:MAX_CHUNKS]
    digest = hashlib.sha256("\n".join(f"{ch.kind}:{ch.ordinal}:{ch.text}" for ch in chunks).encode()).hexdigest()
    return Ficha(
        chunks=chunks, ficha_hash=digest, injection_flags=sorted(flags), redaction_stats=stats,
        employer_names=[e.company_name for e in c.experiences if e.company_name],
        institution_names=[e.institution for e in c.educations if e.institution],
    )
