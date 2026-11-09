"""Redacción de datos personales antes de que un texto salga hacia la IA.

Regla de la v3 (§5.2-bis) y la auditoría: **a la IA nunca le llega el nombre, el teléfono, el
mail, el DNI ni la foto**, y tampoco edad, fecha de nacimiento, estado civil ni hijos
(anti-discriminación, Ley 23.592). El PDF crudo nunca sale del servidor: esto trabaja sobre el
texto ya extraído.

Capas (todas locales):
1. Líneas con datos personales ("Fecha de nacimiento: …", "DNI …", "Estado civil …",
   "Domicilio …") se eliminan enteras, estén donde estén. Se rescata la licencia de conducir,
   que es un requisito laboral real.
2. Datos conocidos del propio candidato: nombre, apellido, teléfono y mail.
3. Patrones argentinos: CUIL/CUIT (con dígito verificador), DNI, teléfonos, mails y URLs.
4. Edad en el texto ("tengo 34 años", "34 años de edad", "25 años" suelto), fechas de
   nacimiento sin rótulo, domicilios (calle y altura + localidad, piso, depto), el nombre de una
   referencia dentro de una línea y lo que queda del nombre al lado de un dato tachado.

Lo que no se puede garantizar: un nombre propio de otra persona o un lugar en texto libre.
Un NER local (spaCy) se puede enchufar en `extra_redactors` si la medición de CVs reales
lo justifica (auditoría R20, decisión pendiente de la medición).
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from typing import Callable

TOKEN = "[DATO]"

_PERSONAL_LINE = re.compile(
    r"^.{0,40}\b(fecha\s+(de\s+)?nac\w*|f\.?\s*nac\w*|nacid[oa]|lugar\s+(de\s+)?nac\w*|edad|estado\s+civil|"
    r"nacionalidad|domicilio|direcci[oó]n|d\.?\s?n\.?\s?i\.?|documento|c\.?\s?u\.?\s?i\.?\s?l|c\.?\s?u\.?\s?i\.?\s?t|"
    r"pasaporte|hij[oa]s|casad[oa]|solter[oa]|divorciad[oa]|viud[oa]|sexo|g[eé]nero|"
    r"tel[eé]fono|tel\.|celular|cel\.|m[oó]vil|whats\s?app|e-?mail|correo)\b",
    re.IGNORECASE,
)
_DRIVER_LICENSE = re.compile(r"\b(licencia|registro)\s+de\s+conduc\w*", re.IGNORECASE)

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+", re.IGNORECASE)
_URL = re.compile(r"\b(https?://\S+|www\.\S+|\S+\.(com|ar|net|org|io)(/\S*)?|linkedin\.com/\S+)", re.IGNORECASE)
_CUIL = re.compile(r"\b(20|23|24|27|30|33|34)[-\s.]?(\d{2}[.\s]?\d{3}[.\s]?\d{3})[-\s.]?(\d)\b")
# Termina en (?!\d) y no en \b: en los PDFs el número suele quedar pegado a la palabra siguiente
# ("2915033116Atención", medición del 28/10).
_DNI = re.compile(r"\b\d{1,2}[.\s]\d{3}[.\s]\d{3}(?!\d)|\b\d{7,8}(?!\d)")
_PHONE = re.compile(r"(\+?54[\s-]*)?(9[\s-]*)?(\(?0?\d{2,4}\)?[\s-]*)?(15[\s-]*)?\d{3,4}[\s-]?\d{4}(?!\d)")
_YEAR_RANGE = re.compile(r"(19|20)\d{2}\s*[-–/]?\s*(19|20)\d{2}")
_AGE = re.compile(r"\b(tengo|edad:?)\s*\d{2}\s*años\b|\b\d{2}\s*años\s+de\s+edad\b", re.IGNORECASE)

# Medición de CVs reales del 28/10 (revisión a mano de 37): se escapaban fecha de nacimiento,
# edad, domicilio y nombres que no están en el perfil. Las reglas de abajo cubren cada caso.

# "Fecha Nac.: …" o el rótulo pegado a la palabra anterior ("OperativoFecha de Nacimiento: …"),
# que la regla de línea no ve porque no hay límite de palabra.
_BIRTH_FIELD = re.compile(r"(fecha\s*(de\s*)?nac\w*|lugar\s*(de\s*)?nac\w*)\.?\s*:?[^\n]*", re.IGNORECASE)
_MONTHS = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre"
_FULL_DATE = re.compile(
    rf"\b\d{{1,2}}[/.-]\d{{1,2}}[/.-]((?:19|20)\d{{2}})\b|\b\d{{1,2}}\s+de\s+(?:{_MONTHS})\s+del?\s+((?:19|20)\d{{2}})\b",
    re.IGNORECASE)
_RANGE_AFTER = re.compile(r"^\s*(-|–|—|al\b|a\b|hasta\b)", re.IGNORECASE)
_RANGE_BEFORE = re.compile(r"(-|–|—|\bal|\bdesde)\s*$", re.IGNORECASE)
_MIN_AGE = 14
# Edad suelta ("[nombre] 25 años"). No es edad si sigue "de experiencia", "en el rubro"… ni si
# antes dice "más de", "durante"…
_AGE_LOOSE = re.compile(r"(?<![\w.])[1-7]\d\s*años\b(?!\s*(de|en|como|trabajando|dentro)\b)", re.IGNORECASE)
_NOT_AGE_BEFORE = re.compile(
    r"\b(m[aá]s\s+de|hace|durante|por|con|tras|casi|unos|[uú]ltimos|menos\s+de)\s*$", re.IGNORECASE)
# Domicilio: calle y número seguidos de localidad, piso o departamento. Un año ("Diciembre 2024,
# Bahía Blanca") no es una altura.
_ADDRESS = re.compile(
    r"\b(?:[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü.]*\s+){1,3}(\d{2,5})\b(?=\s*,?\s*(?i:bah[ií]a\s+blanca|b\.\s*bca|"
    r"bca\b|ing(?:eniero|\.)\s*white|punta\s+alta|monte\s+hermoso|piso\b|dpto|depto|departamento|mbk|"
    r"monoblock|torre\b|\d{4}\b))")
_ADDRESS_PART = re.compile(
    r"\b(?i:piso|dpto|depto|departamento|mbk|monoblock|torre|manzana|mz|lote)\.?\s*(\d{1,3}|[A-Z])\b|"
    r"\b(?i:c\.?p\.?\s*)?8000\b(?=\s*(?i:bah[ií]a|b\.\s*bca))")
# "Referencia: Ana Gómez 291…" dentro de una línea de experiencia (la sección entera ya se descarta).
_INLINE_REFERENCE = re.compile(
    r"\b(referencias?(\s+(laborales|personales|comerciales|profesionales))?|ref\.)\s*:\s*[^|\n]{1,60}", re.IGNORECASE)
# "bajo la dirección de la Prof. Ana Gómez": nombre de un tercero detrás de un tratamiento. Lic.,
# Ing. y Cr. quedan afuera: suelen ser el título del propio candidato o el nombre de un estudio.
_TITLED_NAME = re.compile(r"\b(Prof|Profa|Dr|Dra)\.\s*(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+\s*){1,3}")

# Línea con un dato tachado y dos o tres palabras sueltas al lado: casi siempre el resto del
# nombre ("[DATO] PEDRAZA", segundo nombre o apellido que no está en el perfil) o un tercero
# junto a su teléfono. Se conserva si alguna palabra es vocabulario de CV.
_CV_WORDS = {
    "experiencia", "profesional", "laboral", "laborales", "formacion", "academica", "educacion", "estudios",
    "perfil", "habilidades", "competencias", "conocimientos", "idiomas", "cursos", "capacitacion", "datos",
    "personales", "contacto", "informacion", "movilidad", "propia", "propio", "disponibilidad", "horaria",
    "inmediata", "licencia", "carnet", "objetivo", "resumen", "aptitudes", "herramientas", "logros",
    "certificaciones", "tecnica", "tecnico", "licenciado", "licenciada", "ingeniero", "ingeniera", "estudiante",
    "analista", "administrativa", "administrativo", "contador", "contadora", "operario", "operaria",
    "vendedor", "vendedora", "chofer", "cajera", "cajero", "recepcionista", "secundario", "completo",
    "universitario", "terciario", "ingles", "excel", "office",
}
_CONNECTORS = {"en", "con", "para", "a", "al", "el", "por", "que", "se", "mi", "su", "sin", "como"}
_WORD = re.compile(r"[A-Za-zÁÉÍÓÚÑáéíóúñü]+")


def _is_birth_date(text: str, m: re.Match) -> bool:
    year = int(m.group(1) or m.group(2))
    if not 1940 <= year <= date.today().year - _MIN_AGE:
        return False
    # "01/03/2005 - 15/06/2010" es un período de trabajo, no un nacimiento.
    return not (_RANGE_AFTER.match(text[m.end():m.end() + 8]) or _RANGE_BEFORE.search(text[max(0, m.start() - 8):m.start()]))


def _is_age(text: str, m: re.Match) -> bool:
    return not _NOT_AGE_BEFORE.search(text[max(0, m.start() - 14):m.start()])


def _is_address(text: str, m: re.Match) -> bool:
    n = int(m.group(1))
    return not (len(m.group(1)) == 4 and 1950 <= n <= 2035)


def _sub_checked(pattern: re.Pattern, text: str, check: Callable[[str, re.Match], bool],
                 out: "Redaction", key: str) -> str:
    def repl(m: re.Match) -> str:
        if check(text, m):
            out.add(key)
            return TOKEN
        return m.group(0)
    return pattern.sub(repl, text)


def _leftover_name(line: str) -> bool:
    if TOKEN not in line or any(c.isdigit() for c in line.replace(TOKEN, "")):
        return False
    words = [_plain(w) for w in _WORD.findall(line.replace(TOKEN, " "))]
    if any(w in _CONNECTORS or w in _CV_WORDS for w in words):
        return False
    return 1 <= len([w for w in words if w not in _NAME_PARTICLES]) <= 3


def _plain(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


# Partículas de nombres compuestos ("María de los Ángeles"): no son el nombre. La medición de
# CVs reales del 04/10 mostró que tachar "los" lo borraba en todo el CV.
_NAME_PARTICLES = {"de", "del", "la", "las", "los", "lo", "y", "e", "da", "das", "do", "dos", "di", "van", "von", "san"}
_ACCENTED = {"a": "aáàâäã", "e": "eéèêë", "i": "iíìîï", "o": "oóòôöõ", "u": "uúùûü", "n": "nñ", "c": "cç"}


def _name_parts(name: str | None) -> list[str]:
    return [p for p in re.split(r"[\s,]+", (name or "").strip())
            if len(p) >= 3 and _plain(p) not in _NAME_PARTICLES]


def _accent_insensitive(part: str) -> str:
    """Patrón que encuentra la palabra con o sin acentos: en la base dice "Gimenez" y en el CV
    "GIMÉNEZ" (medición del 04/10: 12 nombres se escapaban así)."""
    return "".join(f"[{_ACCENTED[c]}]" if c in _ACCENTED else re.escape(c) for c in _plain(part))


# Sección de referencias: son nombres y teléfonos de terceros, que no aportan nada para comparar
# con una búsqueda. Se descarta desde el título hasta la próxima sección (medición del 04/10: 9 de
# 33 CVs traían nombres de terceros ahí).
_REFERENCES_HEADING = re.compile(
    r"^\W*referencias?(\s+(laborales|personales|comerciales|profesionales))?\s*:?\s*$", re.IGNORECASE)
_SECTION_HEADING = re.compile(
    r"^\W*(experiencia|educaci[oó]n|formaci[oó]n|estudios|habilidades|competencias|conocimientos|"
    r"idiomas|cursos|capacitaci|certificac|perfil|resumen|objetivo|aptitudes|herramientas|"
    r"inform[aá]tica|disponibilidad|licencias?|otros|datos\s+adicionales|intereses|logros)\b", re.IGNORECASE)
_MAX_REFERENCE_LINES = 25


def cuit_is_valid(digits: str) -> bool:
    """Dígito verificador de CUIL/CUIT (módulo 11)."""
    if len(digits) != 11 or not digits.isdigit():
        return False
    weights = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    total = sum(int(d) * w for d, w in zip(digits[:10], weights))
    check = 11 - total % 11
    check = 0 if check == 11 else 9 if check == 10 else check
    return check == int(digits[10])


@dataclass
class Redaction:
    text: str
    stats: dict[str, int] = field(default_factory=dict)

    def add(self, key: str, n: int = 1) -> None:
        if n:
            self.stats[key] = self.stats.get(key, 0) + n


def redact(
    text: str | None,
    *,
    known_names: list[str] | None = None,
    known_phones: list[str] | None = None,
    known_emails: list[str] | None = None,
    extra_redactors: list[Callable[[str], tuple[str, int]]] | None = None,
) -> Redaction:
    out = Redaction(text="")
    if not text:
        return out

    kept: list[str] = []
    in_references = 0   # líneas que faltan descartar de una sección de referencias
    for line in text.splitlines():
        if _REFERENCES_HEADING.match(line.strip()):
            in_references = _MAX_REFERENCE_LINES
            out.add("referencias")
            continue
        if in_references:
            if _SECTION_HEADING.match(line.strip()):
                in_references = 0
            else:
                in_references -= 1
                continue
        if _PERSONAL_LINE.search(line) and not _DRIVER_LICENSE.search(line):
            out.add("lineas_personales")
            continue
        kept.append(line)
    text = "\n".join(kept)
    text, n = _BIRTH_FIELD.subn(TOKEN, text)
    out.add("fecha_nacimiento", n)

    # Datos conocidos del propio candidato (los más confiables: se sabe exactamente qué buscar).
    for email in known_emails or []:
        if email:
            text, n = re.subn(re.escape(email), TOKEN, text, flags=re.IGNORECASE)
            out.add("mail_propio", n)
    for phone in known_phones or []:
        digits = re.sub(r"\D", "", phone or "")
        if len(digits) >= 6:
            tail = digits[-6:]
            pattern = r"[\d\s().+-]*".join(re.escape(d) for d in tail)
            text, n = re.subn(r"[\d(+][\d\s().+-]*" + pattern, TOKEN, text)
            out.add("telefono_propio", n)
    for name in known_names or []:
        for part in _name_parts(name):
            text, n = re.subn(rf"\b{_accent_insensitive(part)}\b", TOKEN, text, flags=re.IGNORECASE)
            out.add("nombre_propio", n)

    text, n = _EMAIL.subn(TOKEN, text)
    out.add("mails", n)
    text, n = _URL.subn(TOKEN, text)
    out.add("urls", n)

    def _cuil(m: re.Match) -> str:
        digits = re.sub(r"\D", "", m.group(0))
        if cuit_is_valid(digits):
            out.add("cuil_cuit")
            return TOKEN
        return m.group(0)

    text = _CUIL.sub(_cuil, text)
    text, n = _AGE.subn(TOKEN, text)
    out.add("edad", n)
    text = _sub_checked(_AGE_LOOSE, text, _is_age, out, "edad")
    text = _sub_checked(_FULL_DATE, text, _is_birth_date, out, "fecha_nacimiento")
    text = _sub_checked(_ADDRESS, text, _is_address, out, "domicilio")
    text, n = _ADDRESS_PART.subn(TOKEN, text)
    out.add("domicilio", n)
    text, n = _INLINE_REFERENCE.subn(TOKEN, text)
    out.add("referencias", n)
    text, n = _TITLED_NAME.subn(TOKEN + " ", text)
    out.add("terceros", n)

    def _phone(m: re.Match) -> str:
        digits = re.sub(r"\D", "", m.group(0))
        # "2018-2020" son años de una experiencia, no un teléfono: borrarlos le saca a la IA
        # justamente la duración de los trabajos.
        if _YEAR_RANGE.fullmatch(m.group(0).strip()):
            return m.group(0)
        if len(digits) >= 8:
            out.add("telefonos")
            return TOKEN
        return m.group(0)

    text = _PHONE.sub(_phone, text)
    text, n = _DNI.subn(TOKEN, text)
    out.add("dni", n)

    lines = text.split("\n")
    for i, line in enumerate(lines):
        if _leftover_name(line):
            lines[i] = TOKEN
            out.add("nombre_contiguo")
    text = "\n".join(lines)

    for redactor in extra_redactors or []:
        text, n = redactor(text)
        out.add("ner", n)

    text = re.sub(rf"({re.escape(TOKEN)}[\s,;.-]*){{2,}}", TOKEN + " ", text)
    out.text = text.strip()
    return out


def leaks(text: str, *, known_names: list[str], known_phones: list[str], known_emails: list[str]) -> list[str]:
    """Qué dato del candidato sigue apareciendo después de redactar. Lo usan los tests y el
    script de medición (criterio de salida: cero fugas en la muestra)."""
    found = []
    plain = _plain(text)
    for name in known_names:
        for part in _name_parts(name):
            if re.search(rf"\b{re.escape(_plain(part))}\b", plain):
                found.append(f"nombre:{part}")
    digits = re.sub(r"\D", "", text)
    for phone in known_phones:
        d = re.sub(r"\D", "", phone or "")
        if len(d) >= 6 and d[-6:] in digits:
            found.append("telefono")
    for email in known_emails:
        if email and email.lower() in text.lower():
            found.append("mail")
    if _EMAIL.search(text):
        found.append("otro_mail")
    if any(len(re.sub(r"\D", "", m.group(0))) >= 10 for m in _PHONE.finditer(text)):
        found.append("otro_telefono")
    if _BIRTH_FIELD.search(text) or any(_is_birth_date(text, m) for m in _FULL_DATE.finditer(text)):
        found.append("fecha_nacimiento")
    if _AGE.search(text) or any(_is_age(text, m) for m in _AGE_LOOSE.finditer(text)):
        found.append("edad")
    if any(_is_address(text, m) for m in _ADDRESS.finditer(text)) or _ADDRESS_PART.search(text):
        found.append("domicilio")
    return found
