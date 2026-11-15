"""Rerank: el Evaluador (IA) decide requisito por requisito; el código cita, valida y puntúa.

Desde el 15/11/2026 (IA-AGENTES-PLAN.md §2) la IA hace **una sola cosa**: por requisito, el
veredicto y el id del fragmento donde lo vio. La cita literal y los motivos los arma el código:
eran lo que el modelo barato hacía peor (citas con el fragmento equivocado o irrelevantes, motivos
sin evidencia) y además es salida, que cuesta 8 veces más que la entrada.

- **Evaluador y Revisor:** el mismo esquema y la misma validación; el Revisor usa
  `GEMINI_REVIEW_MODEL` y sus propias instrucciones, y solo se llama para la franja dudosa
  (ver `pipeline.REVIEW_MIN`/`REVIEW_MAX`).
- **Una ficha por llamada (R9):** con varias, un candidato podía escribir en su CV algo que
  bajara a los otros, y las citas se mezclaban entre fichas.
- **Evidencia literal (R10):** cada "si", "parcial" o "no" necesita una frase de *esa* ficha que
  tenga que ver con el requisito, de al menos 12 caracteres, que no sea una autoevaluación. La
  elige el código (`pick_evidence`). Si no hay, pasa a `sin_datos` (que no cuenta como "no").
- **Salida filtrada (R12, LLM05):** motivos y evidencias sin mails, teléfonos, URLs ni nombres
  de empleadores o instituciones (identifican a un perfil ciego). La salida es dato: el frontend
  y los mails la escapan.
- La IA no tiene herramientas ni puede cambiar nada: sólo devuelve JSON (LLM06).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field

from app.core.config import settings
from app.integrations.gemini_client import AIProvider, AIUsage, ServiceTier
from app.services.ai import agentes
from app.services.ai.requirements import Requirement
from app.services.ai.scoring import RequirementEval

AGENTES = ("evaluador", "revisor")
# Versión de cada agente: cambia sola si cambian sus instrucciones. Lo guardado con cualquiera de
# las dos vigentes se reutiliza; con otra (o con el rerank viejo, "rerank-2026-10-06"), se recalcula.
VERSIONES = {a: agentes.version(a) for a in AGENTES}
PROMPT_VERSION = VERSIONES["evaluador"]
MIN_EVIDENCE_CHARS = 12
MAX_EVIDENCE_CHARS = 300
MAX_REASONS = 3
MAX_REASON_CHARS = 200


class EvalItem(BaseModel):
    id: str = Field(max_length=10)
    cumple: Literal["si", "parcial", "no", "sin_datos"]
    fragmento: str = Field(default="", max_length=10)


class RerankOut(BaseModel):
    ref: str = Field(max_length=20)
    requisitos: list[EvalItem] = Field(max_length=20)


# Autoevaluaciones, no hechos: "cumplo todos los requisitos", "soy el candidato ideal". Sin
# atrapar evidencia legítima como "Cumplí funciones de cajero".
_SELF = re.compile(
    r"\bcumpl\w*\s+(con\s+)?(todos\s+)?los\s+requisitos|\bcandidat[oa]\s+ideal|\bmejor\s+candidat\w*"
    r"|\bperfect[oa]\s+para\s+(el|este)\s+puesto|\bmeets\s+all|\bbest\s+candidate",
    re.IGNORECASE,
)
_CONTACT = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+|https?://|www\.|\b\d[\d\s().-]{7,}\d\b", re.IGNORECASE)


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"\s+", " ", s).strip()


@dataclass
class Fragment:
    id: str
    text: str


@dataclass
class RerankResult:
    evals: list[RequirementEval]
    evidence: dict[str, str]                 # req_id → cita validada
    reasons: list[str]
    usage: AIUsage | None = None
    degraded: int = 0                        # ítems pasados a sin_datos por evidencia inválida
    notes: list[str] = field(default_factory=list)


_STOP = {"experiencia", "manejo", "conocimiento", "conocimientos", "disponibilidad", "capacidad",
         "deseable", "excluyente", "requisito", "minima", "minimo", "para", "con", "como", "sobre"}


# Palabras distintas para lo mismo, frecuentes en los avisos de la zona. Con Gemini real pasó que
# «conteo de inventario semanal» no valía para "control de stock" por no compartir palabras.
_EQUIV = {"inven": "stock", "exist": "stock", "carne": "licen"}


# Siglas y códigos cortos que sí significan algo: SAP, PHP, SQL, AFIP ya entra por largo; licencia
# B1, D2. Se buscan en el texto original (con mayúsculas), antes de normalizar.
_SHORT = re.compile(r"\b(?:[A-Z][A-Z0-9]{1,2}|[A-Za-z][0-9])\b")


def _stems(text: str) -> set[str]:
    """Raíces (5 letras) de las palabras significativas: 'autoelevador'/'autoelevadores' coinciden.
    Más las siglas cortas (SAP, PHP, B1): sin ellas, «Manejo de SAP» no tenía ninguna palabra que
    buscar y nunca encontraba la cita."""
    stems = {w[:5] for w in re.findall(r"[a-z0-9]{4,}", _norm(text)) if w not in _STOP}
    folded = "".join(c for c in unicodedata.normalize("NFKD", text or "") if unicodedata.category(c) != "Mn")
    short = {m.lower() for m in _SHORT.findall(folded)}
    return stems | short | {_EQUIV[s] for s in stems if s in _EQUIV}


def relevant(evidence: str, requirement: str) -> bool:
    """La cita tiene que tener que ver con el requisito: al menos una palabra significativa en
    común. Con Gemini real pasó que citó «Zona: Centro» como prueba de manejar autoelevador:
    literal, pero irrelevante."""
    return bool(_stems(evidence) & _stems(requirement))


def _mentions(text: str, names: list[str]) -> bool:
    t = _norm(text)
    return any(len(n) >= 3 and _norm(n) in t for n in names if n)


# Frases: después de . ; ! ?, en cada renglón, y en viñetas (• · - –).
_SENTENCE = re.compile(r"(?<=[.;!?])\s+|\n+|\s+[•·]\s+|\s+[-–]\s+")


def _sentences(text: str) -> list[str]:
    out = (s.strip(" .;,-–•·") for s in _SENTENCE.split(text or "") if s)
    return [s for s in out if s]


def _clip(sentence: str) -> str:
    if len(sentence) <= MAX_EVIDENCE_CHARS:
        return sentence
    cut = sentence[:MAX_EVIDENCE_CHARS].rsplit(" ", 1)[0]
    return cut + "…"


def pick_evidence(requirement: str, fragments: list[Fragment], cited: str | None, *,
                  forbidden_names: list[str], blind: bool) -> str:
    """La frase de la ficha que respalda el requisito, o "" si no hay ninguna válida.

    Primero el fragmento que eligió la IA y después los demás del mismo candidato (con Gemini real
    pasó que el id venía equivocado). Gana la frase con más palabras en común con el requisito; tiene
    que compartir al menos una (con Gemini real pasó «Zona: Centro» como prueba de manejar
    autoelevador). Nunca una autoevaluación, un dato de contacto ni, en un perfil ciego, el nombre
    de un empleador o una institución."""
    want = _stems(requirement)
    ordered = sorted(fragments, key=lambda f: f.id != (cited or "").strip())
    best, best_score = "", 0
    for f in ordered:
        for s in _sentences(f.text):
            if len(s) < MIN_EVIDENCE_CHARS or _SELF.search(s) or _CONTACT.search(s):
                continue
            if blind and _mentions(s, forbidden_names):
                continue
            score = len(_stems(s) & want)
            if score > best_score:          # estricto: ante empate, el fragmento citado primero
                best, best_score = s, score
    return _clip(best) if best_score else ""


def validate(
    out: RerankOut, *, ref: str, requirements: list[Requirement], fragments: list[Fragment],
    forbidden_names: list[str], blind: bool,
) -> RerankResult:
    """Convierte la salida del modelo en evaluaciones confiables. Pura: la prueban los tests."""
    if out.ref.strip() != ref:
        raise ValueError("La IA devolvió otra referencia")
    reqs = {r.id: r for r in requirements}
    seen: dict[str, EvalItem] = {}
    for item in out.requisitos:
        if item.id in reqs and item.id not in seen:
            seen[item.id] = item

    result = RerankResult(evals=[], evidence={}, reasons=[])
    for req in requirements:
        item = seen.get(req.id)
        verdict = item.cumple if item else "sin_datos"
        if verdict != "sin_datos":
            evidence = pick_evidence(req.texto, fragments, item.fragmento,
                                     forbidden_names=forbidden_names, blind=blind)
            if evidence:
                result.evidence[req.id] = evidence
            else:
                verdict = "sin_datos"
                result.degraded += 1
        result.evals.append(RequirementEval(req_id=req.id, kind=req.tipo, verdict=verdict))
    result.reasons = reasons_from_evals(result.evals, reqs)
    return result


def _lista(textos: list[str]) -> str:
    textos = [t[:1].lower() + t[1:] for t in textos]
    return textos[0] if len(textos) == 1 else ", ".join(textos[:-1]) + " y " + textos[-1]


def reasons_from_evals(evals: list[RequirementEval], reqs: dict[str, Requirement]) -> list[str]:
    """Motivos armados en código a partir de las evaluaciones ya validadas."""
    grupos: dict[str, list[str]] = {"si": [], "parcial": [], "no": [], "sin_datos": []}
    for e in evals:
        grupos[e.verdict].append(reqs[e.req_id].texto)
    frases = []
    if grupos["si"]:
        frases.append(f"Cumple: {_lista(grupos['si'])}.")
    if grupos["parcial"]:
        frases.append(f"Cumple en parte: {_lista(grupos['parcial'])}.")
    if grupos["no"]:
        frases.append(f"No cumple: {_lista(grupos['no'])}.")
    if grupos["sin_datos"] and len(frases) < MAX_REASONS:
        frases.append(f"Su perfil no dice nada sobre {_lista(grupos['sin_datos'])}.")
    return [f[:MAX_REASON_CHARS] for f in frases[:MAX_REASONS]]


def build_prompt(ref: str, requirements: list[Requirement], fragments: list[Fragment]) -> str:
    reqs = "\n".join(f"- {r.id} ({r.tipo}): {r.texto}" for r in requirements)
    frags = "\n".join(f"[{f.id}] {f.text}" for f in fragments)
    return (
        f"Referencia: {ref}\nRequisitos de la búsqueda:\n{reqs}\n\n"
        f"<FICHA_NO_CONFIABLE>\n{frags}\n</FICHA_NO_CONFIABLE>"
    )


async def rerank_one(
    provider: AIProvider, *, ref: str, requirements: list[Requirement], fragments: list[Fragment],
    forbidden_names: list[str], blind: bool, company_id: str | None, service_tier: ServiceTier = "standard",
    agente: str = "evaluador",
) -> RerankResult:
    """Una llamada del Evaluador (o del Revisor, con `agente="revisor"`) para un candidato."""
    if agente not in AGENTES:
        raise ValueError(f"Agente desconocido: {agente}")
    extra = {"model_name": settings.GEMINI_REVIEW_MODEL} if agente == "revisor" else {}
    result = await provider.generate_json(
        system=agentes.instrucciones(agente), prompt=build_prompt(ref, requirements, fragments), model=RerankOut,
        feature=agente, company_id=company_id, max_output_tokens=600, service_tier=service_tier, **extra,
    )
    validated = validate(result.data, ref=ref, requirements=requirements, fragments=fragments,
                         forbidden_names=forbidden_names, blind=blind)
    validated.usage = result.usage
    return validated
