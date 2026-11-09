"""Aviso de "está en otro proceso" (M4) contra un Postgres real (base descartable).

Necesita `TEST_DATABASE_URL` (ver `scripts/probar_local_mails.ps1`). Cubre MEJORAS-Y-MAILS-EMPRESAS-OCTUBRE-PLAN.md
§4.3 con lo que respondió Eugenia (22/10/2026, P6): sólo En proceso o Seleccionado en **otra**
empresa, últimos 90 días, sin decir cuál; con el interruptor apagado devuelve 0.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_application_notes_db import (  # noqa: F401  (fixtures)
    TEST_DB,
    _world,
    client,
    maker,
)

pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    from sqlalchemy import text

    from app.models.legal import LegalAcceptance
    from app.models.settings import SettingKey, SiteSetting


async def _set(maker, app_id, status, days_ago=0):
    async with maker() as db:
        await db.execute(
            text("UPDATE applications SET status=:s, status_updated_at=:t WHERE id=:id"),
            {"s": status, "t": datetime.now(timezone.utc) - timedelta(days=days_ago), "id": app_id},
        )
        await db.commit()


async def _switch(maker, on: bool):
    async with maker() as db:
        db.add(SiteSetting(key=SettingKey.aviso_otros_procesos_activo.value, enabled=on))
        await db.commit()


async def _accept(maker, w, version="3.0"):
    """La persona aceptó la privacidad que informa el aviso (3.0): sin eso no se cuenta."""
    async with maker() as db:
        db.add(LegalAcceptance(user_id=w["cand_user"].id, document="privacidad", version=version))
        await db.commit()


async def _world_ok(maker):
    w = await _world(maker)
    await _accept(maker, w)
    return w


def _url(app_id):
    return f"/api/v1/me/company/applications/{app_id}/other-processes"


async def test_switch_off_by_default_returns_zero(client, maker):
    w = await _world(maker)
    await _set(maker, w["b"]["app"].id, "in_process")
    client.as_user(w["a"]["user"])
    resp = await client.get(_url(w["a"]["app"].id))
    assert resp.status_code == 200 and resp.json() == {"en_proceso": 0}


@pytest.mark.parametrize("status,esperado", [
    ("in_process", 1), ("selected", 1), ("new", 0), ("seen", 0), ("discarded", 0),
])
async def test_counts_only_in_process_and_selected_in_other_companies(client, maker, status, esperado):
    w = await _world_ok(maker)
    await _switch(maker, True)
    await _set(maker, w["b"]["app"].id, status)
    client.as_user(w["a"]["user"])
    assert (await client.get(_url(w["a"]["app"].id))).json() == {"en_proceso": esperado}


async def test_own_company_processes_do_not_count(client, maker):
    w = await _world_ok(maker)
    await _switch(maker, True)
    await _set(maker, w["a"]["app"].id, "in_process")
    client.as_user(w["a"]["user"])
    assert (await client.get(_url(w["a"]["app"].id))).json() == {"en_proceso": 0}


async def test_ninety_day_window(client, maker):
    w = await _world_ok(maker)
    await _switch(maker, True)
    client.as_user(w["a"]["user"])
    await _set(maker, w["b"]["app"].id, "selected", days_ago=89)
    assert (await client.get(_url(w["a"]["app"].id))).json() == {"en_proceso": 1}
    await _set(maker, w["b"]["app"].id, "selected", days_ago=91)
    assert (await client.get(_url(w["a"]["app"].id))).json() == {"en_proceso": 0}


async def test_response_never_names_the_other_company_or_search(client, maker):
    w = await _world_ok(maker)
    await _switch(maker, True)
    await _set(maker, w["b"]["app"].id, "in_process")
    client.as_user(w["a"]["user"])
    resp = await client.get(_url(w["a"]["app"].id))
    assert set(json.loads(resp.text)) == {"en_proceso"}
    for secreto in ("Metalúrgica", "Norte", str(w["b"]["app"].id), str(w["b"]["job"].id), str(w["b"]["company"].id),
                    w["b"]["job"].title):
        assert secreto not in resp.text


async def test_company_b_cannot_query_company_a_application(client, maker):
    w = await _world(maker)
    await _switch(maker, True)
    client.as_user(w["b"]["user"])
    assert (await client.get(_url(w["a"]["app"].id))).status_code == 404


async def test_the_switch_can_be_turned_on_from_the_admin_panel(client, maker):
    w = await _world(maker)
    client.as_user(w["admin"])
    assert (await client.get("/api/v1/admin/settings")).json()["aviso_otros_procesos_activo"] is False
    resp = await client.patch("/api/v1/admin/settings", json={"aviso_otros_procesos_activo": True})
    assert resp.status_code == 200 and resp.json()["aviso_otros_procesos_activo"] is True


async def test_not_counted_without_the_v3_acceptance(client, maker):
    w = await _world(maker)
    await _accept(maker, w, version="2.0")
    await _switch(maker, True)
    await _set(maker, w["b"]["app"].id, "in_process")
    client.as_user(w["a"]["user"])
    assert (await client.get(_url(w["a"]["app"].id))).json() == {"en_proceso": 0}


async def test_not_counted_if_the_person_opted_out(client, maker):
    w = await _world_ok(maker)
    await _switch(maker, True)
    await _set(maker, w["b"]["app"].id, "in_process")
    client.as_user(w["cand_user"])
    url = "/api/v1/me/candidate/privacy-preferences"
    resp = await client.post(url, json={"other_processes_opt_out": True})
    assert resp.status_code == 200 and resp.json()["other_processes_opt_out"] is True
    assert resp.json()["ai_opt_out"] is False
    client.as_user(w["a"]["user"])
    assert (await client.get(_url(w["a"]["app"].id))).json() == {"en_proceso": 0}
    client.as_user(w["cand_user"])
    await client.post(url, json={"other_processes_opt_out": False})
    client.as_user(w["a"]["user"])
    assert (await client.get(_url(w["a"]["app"].id))).json() == {"en_proceso": 1}
