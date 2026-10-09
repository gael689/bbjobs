"""Buscador de /empleos: normalización, sinónimos, plurales y validación de la búsqueda con IA.
Funciones puras, sin base (las de punta a punta están en test_job_search_db.py)."""

from app.services import job_search as js


def words(q):
    return [t.word for t in js.parse_query(q).terms]


def variants(q):
    return set(js.parse_query(q).terms[0].variants)


def test_normalize_strips_accents_and_case():
    assert js.normalize_text("Técnico ÑANDÚ Güemes") == "tecnico nandu guemes"
    assert js.tokenize("Vendedor/a — Bahía Blanca!") == ["vendedor", "a", "bahia", "blanca"]


def test_stopwords_are_dropped():
    assert words("Busco trabajo de cajero en Bahía Blanca") == ["cajero", "bahia", "blanca"]
    assert words("trabajo de la") == []
    assert js.parse_query("empleo").terms == []


def test_plural_and_gender_variants():
    assert {"vendedor", "vendedores"} <= variants("vendedores")
    assert {"cajera", "cajero"} <= variants("cajeras")
    assert "vendedor" in variants("vendedora")
    assert "enfermero" in variants("enfermera")
    assert "administracion" in variants("administraciones")


def test_synonyms_cross_both_ways():
    assert {"conductor", "camionero"} <= variants("chofer")
    assert "chofer" in variants("conductores")
    assert {"camarero", "moza"} <= variants("mozo")
    assert {"desarrollador", "developer"} <= variants("programador")
    assert {"ventas", "comercial"} <= variants("vendedor")
    assert "profesor" in variants("docente")
    assert "maestranza" in variants("limpieza")
    assert "auxiliar" in variants("ayudante")


def test_multiword_synonyms_are_one_term():
    terms = js.parse_query("data entry part time").terms
    assert [t.word for t in terms] == ["data entry", "part time"]
    assert "carga de datos" in terms[0].variants
    # "carga de datos" se reconoce antes de sacar el "de"
    assert words("carga de datos") == ["carga de datos"]


def test_teacher_does_not_match_cleaning():
    # "maestro" no debe recortarse a "maestr" (estaría dentro de "maestranza").
    assert not any(v.startswith("maestr") and v not in ("maestro", "maestra") for v in variants("maestro"))


def test_limits_long_phrases():
    parsed = js.parse_query("x" * 5000)
    assert len(parsed.terms) == 1 and len(parsed.terms[0].word) <= js.MAX_QUERY_CHARS
    many = " ".join(f"palabra{i}" for i in range(20))
    assert len(js.parse_query(many).terms) == js.MAX_WORDS


def test_like_wildcards_are_escaped():
    assert js.escape_like("100%_a\\b") == "100\\%\\_a\\\\b"
    # y además no sobreviven a la tokenización
    assert words("%_%") == []


def test_fuzzy_only_for_long_alpha_words():
    flags = {t.word: t.fuzzy_ok for t in js.parse_query("desarollador c++ bar data entry").terms}
    assert flags == {"desarollador": True, "c++": False, "bar": False, "data entry": False}
