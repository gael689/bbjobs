"""Agentes de IA: registro, instrucciones versionadas, precios y costos estimados (IA-AGENTES-PLAN.md)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.services.ai import agentes, precios
from app.services.ai.requirements import Requirement
from app.services.ai.rerank import EvalItem, Fragment, RerankOut, validate


def test_every_ai_agent_has_its_instructions_file_and_a_version_from_its_text():
    for a in agentes.AGENTES:
        if not a.con_instrucciones:
            continue
        texto = agentes.instrucciones(a.clave)
        assert texto and not texto.endswith("\n")
        assert agentes.version(a.clave).startswith(f"{a.clave}@") and len(agentes.version(a.clave)) == len(a.clave) + 9


def test_every_agent_says_what_the_code_does_and_what_it_costs():
    claves = set(agentes.POR_CLAVE)
    assert set(agentes.CODIGO) == claves == set(agentes.TOKENS_TIPICOS)
    assert all(agentes.costo_estimado(k) > 0 for k in claves)
    assert all(paso in claves for kind, paso in agentes.RECORRIDO if kind == "agente")


def test_the_revisor_price_doubles_on_january_first_2027():
    assert precios.precio("gemini-3.8-flash", date(2026, 12, 31)) == (0.75, 3.75)
    assert precios.precio("gemini-3.8-flash", date(2027, 1, 1)) == (1.50, 7.50)
    assert precios.precio("gemini-3.5-flash-lite", date(2027, 6, 1)) == (0.30, 2.50)
    assert agentes.costo_por_busqueda(date(2027, 1, 2)) > agentes.costo_por_busqueda(date(2026, 12, 1))


def test_unknown_models_are_charged_high_so_the_daily_cap_cuts_earlier():
    assert precios.precio("gemini-que-no-existe") == precios.POR_DEFECTO
    assert precios.costo("gemini-3.5-flash-lite", 1_000_000, 0) == Decimal("0.3")
    assert precios.costo("gemini-3.5-flash-lite", 1_000_000, 0, flex=True) == Decimal("0.15")


def test_the_split_rerank_is_cheaper_than_the_old_one():
    # El rerank viejo pedía cita y motivos: ~1400 de entrada y ~600 de salida por candidato.
    viejo = float(precios.costo("gemini-3.5-flash-lite", 1400, 600))
    assert agentes.costo_estimado("evaluador") < viejo / 2


def test_acronyms_are_found_as_evidence():
    # «Manejo de SAP» no tenía ninguna palabra de 4+ letras que buscar: nunca encontraba la cita.
    reqs = [Requirement("r1", "Manejo de SAP", "excluyente", "herramienta"),
            Requirement("r2", "Licencia de conducir B1", "deseable", "licencia")]
    frags = [Fragment("f1", "Carga de pedidos en SAP todos los días. Registro B1 vigente.")]
    out = RerankOut(ref="#A1", requisitos=[EvalItem(id="r1", cumple="si", fragmento="f1"),
                                           EvalItem(id="r2", cumple="si", fragmento="f1")])
    r = validate(out, ref="#A1", requirements=reqs, fragments=frags, forbidden_names=[], blind=False)
    assert [e.verdict for e in r.evals] == ["si", "si"]
    assert r.evidence == {"r1": "Carga de pedidos en SAP todos los días", "r2": "Registro B1 vigente"}
