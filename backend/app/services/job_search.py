"""Buscador léxico de /empleos (Frente 5.1 de MAILS-SEO-IA-OCTUBRE-PLAN.md).

Antes era `ILIKE '%frase%'` sobre título y descripción: "tecnico" no encontraba "Técnico",
"vendedor bahia" no encontraba nada y la empresa no se buscaba aunque el cuadro lo prometía.

Cómo funciona ahora:

1. **Normalización** (`parse_query`): minúsculas, sin tildes, sin palabras vacías ("de", "en",
   "trabajo", "busco"…), cortada a 100 caracteres y 8 palabras.
2. **Variantes por palabra**: singular/plural simple, masculino/femenino ("vendedora" ↔
   "vendedor", "cajeras" → "cajera" → "cajero") y sinónimos de un diccionario chico de rubros
   (chofer ↔ conductor, mozo ↔ camarero…). Frases de varias palabras ("carga de datos") se
   reconocen antes de sacar las palabras vacías.
3. **Filtro**: cada palabra tiene que aparecer (AND entre palabras, OR entre variantes) en el
   título, la descripción, la empresa, el sector, la zona, la modalidad, los beneficios o las
   habilidades del aviso. Todo se compara como `f_unaccent(lower(campo))` (función de la migración
   `c7d1e5f9a2b4`) contra la palabra ya normalizada en Python, así que las tildes dan igual de los
   dos lados.
4. **Errores de tipeo**: una palabra de 5+ letras que no aparece literal en **ningún** aviso
   visible se busca por parecido contra el título (`word_similarity >= 0.5`). La compuerta es
   global y no por aviso a propósito: "operador" se parece 0,56 a "operario", y si hay avisos que
   dicen "operador" no queremos mezclarle los de operario. Umbral medido el 08/10/2026 contra
   pares reales: los tipeos van de 0,54 a 0,82 ("repocitor"/"repositor" 0,54, "tecnco"/"tecnico"
   0,57, "desarollador"/"desarrollador" 0,80) y los falsos parecidos de 0,22 a 0,75.
5. **Orden** con texto: por relevancia (cada palabra suma 3 si está en el título, 2 si está en
   empresa/sector/zona/modalidad, 1 si sólo está en descripción/beneficios/habilidades), con
   `word_similarity` de la frase contra el título como desempate, y después destacado y fecha.
   Sin texto, el orden de siempre (destacado y fecha).

Nada de esto toca la visibilidad: el que llama arma la consulta base (activa + aprobada + no
borrada) y esto sólo le agrega condiciones.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from sqlalchemy import Select, and_, case, exists, func, literal, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalogs import Industry, Skill, Zone
from app.models.job import JobModerationStatus, JobPosting, JobPostingSkill, JobPostingStatus

MAX_QUERY_CHARS = 100
MAX_WORDS = 8
MIN_FUZZY_LEN = 5
FUZZY_THRESHOLD = 0.5

# Palabras que no aportan al filtro: si quedaran, "trabajo de cajero" exigiría que el aviso diga
# "trabajo". Van normalizadas (sin tildes).
STOPWORDS = frozenset("""
a al algo alguna alguno ante como con cerca de del desde donde e el en entre es esta este hay la las
le lo los me mi mis o para pero por que se si sin su sus te tu un una unas uno unos y ya
busco buscando busca buscar quiero necesito empleo empleos trabajo trabajos laburo puesto puestos
oferta ofertas vacante vacantes aviso avisos
""".split())

# Grupos de sinónimos del rubro (normalizados, en singular). Una palabra de un grupo trae a todas
# las demás. Mantenerlo chico y obvio: un sinónimo flojo ensucia más de lo que ayuda.
SYNONYM_GROUPS: tuple[tuple[str, ...], ...] = (
    ("chofer", "conductor", "camionero", "transportista"),
    ("mozo", "moza", "camarero", "camarera", "mesero", "mesera"),
    ("programador", "desarrollador", "developer", "programacion", "desarrollo de software"),
    ("vendedor", "ventas", "venta", "comercial"),
    ("administrativo", "administracion"),
    ("repositor", "reposicion"),
    ("cajero", "caja"),
    ("operario", "operaria"),
    ("enfermero", "enfermeria"),
    ("docente", "profesor", "maestro", "maestra"),
    ("cocinero", "cocina", "chef"),
    ("limpieza", "maestranza"),
    ("electricista", "electrico", "electricidad"),
    ("contador", "contable", "contabilidad"),
    ("recepcionista", "recepcion"),
    ("ayudante", "auxiliar"),
    ("data entry", "carga de datos"),
    ("atencion al cliente", "atencion al publico", "call center"),
    ("recursos humanos", "rrhh"),
    ("soldador", "soldadura"),
    ("mecanico", "mecanica"),
    ("cadete", "repartidor", "delivery"),
    ("seguridad", "vigilador", "vigilancia"),
    ("part time", "medio tiempo", "media jornada"),
    ("full time", "tiempo completo", "jornada completa"),
    ("remoto", "home office", "teletrabajo"),
)

_TOKEN = re.compile(r"[a-z0-9+#]+")


def normalize_text(text: str | None) -> str:
    """Minúsculas y sin tildes, igual que `f_unaccent(lower())` en la base (ñ → n, ü → u)."""
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).lower()


def tokenize(text: str | None) -> list[str]:
    return _TOKEN.findall(normalize_text((text or "")[:MAX_QUERY_CHARS]))


def inflections(word: str) -> set[str]:
    """Variantes de número y género. Como se compara por "contiene", el singular ya encuentra el
    plural ("vendedor" está dentro de "vendedores"); lo que hace falta es ir del plural al singular
    y cruzar el género. Las variantes raras que salen ("limpiezo") no hacen daño: no matchean."""
    out = {word}
    singulars = {word}
    if len(word) >= 5 and word.endswith("es"):
        singulars |= {word[:-2], word[:-1]}
    elif len(word) >= 4 and word.endswith("s") and not word.endswith("ss"):
        singulars.add(word[:-1])
    for s in singulars:
        out.add(s)
        if len(s) < 4:
            continue
        if s.endswith("ora"):
            out.add(s[:-1])                      # vendedora → vendedor
        elif s.endswith("o"):
            out.add(s[:-1] + "a")                # cajero → cajera
        elif s.endswith("a"):
            out.add(s[:-1] + "o")                # enfermera → enfermero
    return {v for v in out if len(v) >= 2}


def _build_synonym_index() -> dict[str, tuple[str, ...]]:
    index: dict[str, tuple[str, ...]] = {}
    for group in SYNONYM_GROUPS:
        for member in group:
            for form in inflections(member) if " " not in member else {member}:
                index.setdefault(form, group)
    return index


_SYNONYMS = _build_synonym_index()
# Frases de varias palabras, de la más larga a la más corta, como tuplas de tokens.
_PHRASES = sorted(
    {tuple(m.split()) for g in SYNONYM_GROUPS for m in g if " " in m}, key=len, reverse=True
)


@dataclass(frozen=True)
class Term:
    """Una palabra (o frase) de la búsqueda con todas las formas que la satisfacen."""

    word: str
    variants: tuple[str, ...]
    fuzzy_ok: bool = False          # ¿se puede probar por parecido si no aparece literal?


@dataclass
class ParsedQuery:
    terms: list[Term] = field(default_factory=list)

    @property
    def phrase(self) -> str:
        return " ".join(t.word for t in self.terms)


def _expand(word: str) -> set[str]:
    variants = set(inflections(word)) if " " not in word else {word}
    for form in list(variants):
        group = _SYNONYMS.get(form)
        if group:
            for member in group:
                variants |= inflections(member) if " " not in member else {member}
    return variants


def parse_query(q: str | None) -> ParsedQuery:
    tokens = tokenize(q)
    words: list[str] = []
    i = 0
    while i < len(tokens):
        for phrase in _PHRASES:
            if tuple(tokens[i:i + len(phrase)]) == phrase:
                words.append(" ".join(phrase))
                i += len(phrase)
                break
        else:
            tok = tokens[i]
            i += 1
            if tok in STOPWORDS or (len(tok) < 2 and not tok.isdigit()):
                continue
            words.append(tok)
    seen: set[str] = set()
    terms: list[Term] = []
    for w in words:
        if w in seen:
            continue
        seen.add(w)
        terms.append(Term(word=w, variants=tuple(sorted(_expand(w))),
                          fuzzy_ok=" " not in w and len(w) >= MIN_FUZZY_LEN and w.isalpha()))
        if len(terms) == MAX_WORDS:
            break
    return ParsedQuery(terms=terms)


# ── SQL ─────────────────────────────────────────────────────────────────────────────────

def norm(column):
    """`f_unaccent(lower(col))`: la misma expresión que los índices de trigramas."""
    return func.f_unaccent(func.lower(column))


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _contains_any(column, variants) -> object:
    return or_(*[norm(column).like(f"%{escape_like(v)}%", escape="\\") for v in variants])


def visible_jobs_filter():
    return and_(
        JobPosting.status == JobPostingStatus.active,
        JobPosting.moderation_status == JobModerationStatus.approved,
        JobPosting.deleted_at.is_(None),
    )


def _skills_match(variants):
    return exists(
        select(literal(1))
        .select_from(JobPostingSkill)
        .join(Skill, Skill.id == JobPostingSkill.skill_id)
        .where(JobPostingSkill.job_posting_id == JobPosting.id, _contains_any(Skill.name, variants))
    )


def _term_parts(term: Term, *, fuzzy: bool):
    title = _contains_any(JobPosting.title, term.variants)
    if fuzzy:
        title = or_(title, func.word_similarity(term.word, norm(JobPosting.title)) >= FUZZY_THRESHOLD)
    mid = or_(
        _contains_any(JobPosting.company_legal_name_snapshot, term.variants),
        _contains_any(Industry.name, term.variants),
        _contains_any(Zone.name, term.variants),
        _contains_any(JobPosting.modality, term.variants),
    )
    low = or_(
        _contains_any(JobPosting.description, term.variants),
        _contains_any(JobPosting.benefits, term.variants),
        _skills_match(term.variants),
    )
    return title, mid, low


async def _literal_hits(db: AsyncSession, term: Term) -> bool:
    """¿Alguna búsqueda visible contiene la palabra (o una variante) en algún lado?"""
    title, mid, low = _term_parts(term, fuzzy=False)
    stmt = (
        select(literal(1))
        .select_from(JobPosting)
        .join(Industry, Industry.id == JobPosting.industry_id)
        .join(Zone, Zone.id == JobPosting.zone_id)
        .where(visible_jobs_filter(), or_(title, mid, low))
        .limit(1)
    )
    return (await db.execute(stmt)).first() is not None


async def apply_search(db: AsyncSession, query: Select, q: str | None) -> tuple[Select, list] | None:
    """Le agrega a `query` (un `select(JobPosting)` ya filtrado) las condiciones de la frase.

    Devuelve `(query, order_by)` o `None` si la frase no deja ninguna palabra útil (sólo palabras
    vacías): en ese caso el que llama no filtra por texto y ordena como siempre."""
    parsed = parse_query(q)
    if not parsed.terms:
        return None

    query = (
        query.join(Industry, Industry.id == JobPosting.industry_id)
        .join(Zone, Zone.id == JobPosting.zone_id)
    )
    score = literal(0)
    for term in parsed.terms:
        fuzzy = term.fuzzy_ok and not await _literal_hits(db, term)
        title, mid, low = _term_parts(term, fuzzy=fuzzy)
        query = query.where(or_(title, mid, low))
        score = score + case((title, 3), (mid, 2), else_=1)

    similarity = func.word_similarity(parsed.phrase, norm(JobPosting.title))
    order_by = [
        score.desc(), similarity.desc(), JobPosting.is_featured.desc(), JobPosting.published_at.desc(),
    ]
    return query, order_by


async def suggest(db: AsyncSession, q: str, limit: int) -> list[tuple[str, str]]:
    """Autocompletado: títulos y empresas visibles que contienen todas las palabras (sin tildes,
    sin sinónimos: lo que se sugiere tiene que parecerse a lo que se está tipeando). Primero los
    que empiezan con la frase, después por parecido. Devuelve `[(label, "title"|"company")]`."""
    words = [w for w in tokenize(q) if len(w) >= 2 or w.isdigit()][:MAX_WORDS]
    if not words:
        return []
    phrase = " ".join(words)
    out: list[tuple[str, str]] = []
    for column, kind in ((JobPosting.title, "title"), (JobPosting.company_legal_name_snapshot, "company")):
        conditions = [norm(column).like(f"%{escape_like(w)}%", escape="\\") for w in words]
        starts = func.max(case((norm(column).like(f"{escape_like(phrase)}%", escape="\\"), 1), else_=0))
        similarity = func.max(func.word_similarity(phrase, norm(column)))
        rows = await db.execute(
            select(column)
            .where(visible_jobs_filter(), *conditions)
            .group_by(column)
            .order_by(starts.desc(), similarity.desc(), column)
            .limit(limit)
        )
        out += [(label, kind) for label in rows.scalars().all()]
    return out[:limit]
