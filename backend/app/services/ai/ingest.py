"""Ingesta de CVs y textos de usuarios antes de que lleguen a la IA.

# SECURITY: LLM01 (Prompt Injection) / LLM10 (Unbounded Consumption) — nivel B (Moderado),
# decisión P1 de la auditoría (04/10/2026). Patrón: sanitize_external_content.
# Applied by: llm-secure-patterns v1.0.0 / Secure External Ingestion.
#
# Capas, en orden:
# 1. Tipo real por bytes (`%PDF-`), no por extensión. Tope de tamaño y de páginas.
# 2. Extracción con pypdf **descartando el texto oculto**: blanco (o casi) y de tamaño < 2 pt.
#    Es el truco clásico para colarle instrucciones a un filtro de CV.
# 3. Normalización Unicode NFKC + fuera los invisibles (ancho cero, bidi, bloque Tags U+E00xx)
#    y los caracteres de control. Los metadatos del PDF no se leen.
# 4. Presupuesto de tokens: el texto se recorta (`MAX_CHARS`).
# 5. `detect_injection`: marca la ficha si trae instrucciones. Una ficha marcada se ordena sólo
#    con el puntaje híbrido, sin IA de texto (auditoría R10). Es heurística, no una barrera:
#    la barrera real es que la IA no tiene herramientas y su salida se valida (rerank.py).
#
# Lo que NO cubre (conocido): inyección semántica bien escrita, codificaciones nuevas. Por eso
# además hay una ficha por llamada (R9) y evidencia literal validada en código (R10).
"""
from __future__ import annotations

import io
import re
import unicodedata
from dataclasses import dataclass, field

MAX_PDF_BYTES = 5 * 1024 * 1024
MAX_PAGES = 6
MAX_CHARS = 12_000          # ~1.500–2.000 palabras: lo que entra a fragmentos
MIN_TEXT_CHARS = 200        # menos que esto en un PDF con páginas = escaneo (imagen)
TINY_FONT_PT = 2.0
WHITE_THRESHOLD = 0.95

_INVISIBLE = re.compile(
    "[​-‏‪-‮⁠-⁤⁦-⁩﻿­᠎"
    "\U000e0000-\U000e007f]"
)
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SPACES = re.compile(r"[ \t ]+")
_BLANK_LINES = re.compile(r"\n{3,}")


@dataclass
class CvExtraction:
    status: str                    # ok | scanned | not_pdf | too_large | encrypted | failed
    text: str = ""
    pages: int = 0
    truncated: bool = False
    hidden_chars_dropped: int = 0
    notes: list[str] = field(default_factory=list)


def sanitize_text(text: str | None, max_chars: int = MAX_CHARS) -> str:
    """NFKC, sin invisibles ni controles, espacios colapsados, recortado al presupuesto."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = _INVISIBLE.sub("", text)
    text = _CONTROL.sub(" ", text)
    text = _SPACES.sub(" ", text)
    text = "\n".join(line.strip() for line in text.splitlines())
    text = _BLANK_LINES.sub("\n\n", text).strip()
    return text[:max_chars]


def _is_white(color: tuple | None) -> bool:
    if not color:
        return False
    if len(color) == 1:                       # gris
        return color[0] >= WHITE_THRESHOLD
    if len(color) == 3:                       # RGB
        return all(c >= WHITE_THRESHOLD for c in color)
    if len(color) == 4:                       # CMYK: blanco = sin tinta
        return all(c <= 1 - WHITE_THRESHOLD for c in color)
    return False


def extract_cv_text(data: bytes) -> CvExtraction:
    """Extrae el texto visible de un CV en PDF. Sincrónica: el que llama la corre en un hilo
    con tiempo límite (un PDF armado a propósito puede colgar el parser)."""
    if not data or not data[:5] == b"%PDF-":
        return CvExtraction(status="not_pdf")
    if len(data) > MAX_PDF_BYTES:
        return CvExtraction(status="too_large")

    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                return CvExtraction(status="encrypted")
        pages = reader.pages
        total_pages = len(pages)
    except Exception as exc:
        return CvExtraction(status="failed", notes=[f"no se pudo abrir: {type(exc).__name__}"])

    out = CvExtraction(status="ok", pages=total_pages, truncated=total_pages > MAX_PAGES)
    pieces: list[str] = []
    for page in list(pages)[:MAX_PAGES]:
        state = {"fill": None}

        def before(operator, args, cm, tm, _state=state):
            op = operator.decode() if isinstance(operator, bytes) else operator
            try:
                if op in ("rg", "g", "k"):
                    _state["fill"] = tuple(float(a) for a in args)
                elif op in ("sc", "scn") and args and all(isinstance(a, (int, float)) or hasattr(a, "__float__") for a in args):
                    _state["fill"] = tuple(float(a) for a in args)
            except (TypeError, ValueError):
                pass

        def visit(text, cm, tm, font_dict, font_size, _state=state):
            if not text:
                return
            scale = abs(tm[3] * cm[3]) if tm and cm else 1.0
            effective = (font_size or 0) * (scale or 1.0)
            if _is_white(_state["fill"]) or (0 < effective < TINY_FONT_PT):
                out.hidden_chars_dropped += len(text.strip())
                return
            pieces.append(text)

        try:
            page.extract_text(visitor_operand_before=before, visitor_text=visit)
        except Exception as exc:
            out.notes.append(f"página ilegible: {type(exc).__name__}")
        pieces.append("\n")

    out.text = sanitize_text("".join(pieces))
    if len(out.text) < MIN_TEXT_CHARS:
        out.status = "scanned"
        out.text = ""
    if out.hidden_chars_dropped:
        out.notes.append(f"se descartaron {out.hidden_chars_dropped} caracteres ocultos")
    return out


# ── Inyección ───────────────────────────────────────────────────────────────────────────

_INJECTION = [
    ("instrucciones", re.compile(r"\b(ignor[aáe]\w*|olvid[aáe]\w*|desestim\w*)\b.{0,40}\b(instrucci\w*|indicaci\w*|reglas|anteriores|previas)", re.I)),
    ("instructions", re.compile(r"\b(ignore|disregard|forget)\b.{0,40}\b(instruction|prompt|previous|above|rules)", re.I)),
    ("rol", re.compile(r"\b(system\s*prompt|you are (now )?an?|act[uú]a como|sos un[ao]? (asistente|modelo|ia)|as an ai)\b", re.I)),
    ("puntaje", re.compile(r"\b(asign\w*|d[aá]le|pon[eé]le|give|rate|score)\b.{0,30}\b(puntaje|puntuaci\w*|nota|score|rating|100|m[aá]xim\w*)", re.I)),
    ("autoevaluacion", re.compile(r"\b(es|soy) (el|la) (mejor|candidat[oa] ideal)\b|\bcumple (con )?todos los requisitos\b|\bmeets all (the )?requirements\b", re.I)),
    ("marcadores", re.compile(r"<\|[^|]{1,30}\|>|\[/?(INST|SYS)\]|<<SYS>>|###\s*(system|instruction)", re.I)),
    ("codificado", re.compile(r"[A-Za-z0-9+/]{120,}={0,2}")),
]


def detect_injection(text: str | None) -> list[str]:
    """Qué patrones de instrucciones aparecen en el texto (vacío = nada sospechoso)."""
    if not text:
        return []
    return [name for name, pattern in _INJECTION if pattern.search(text)]
