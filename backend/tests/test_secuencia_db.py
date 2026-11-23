"""Prospección automática (services/email/secuencia.py) y textos editables de los mails
automáticos (api/v1/admin_textos.py), contra Postgres descartable."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_email_dispatch_db import (  # noqa: F401  (fixtures)
    NOON, TEST_DB, _get, _user, client, maker,
)

pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    from sqlalchemy import select, text

    from app.api.deps import get_current_user
    from app.core.config import settings
    from app.models.core import User
    from app.models.email import EmailCampaign, EmailOutbox
    from app.models.prospect import Prospect, ProspectEmail
    from app.models.settings import SettingKey, SiteSetting
    from app.services.email import dispatcher, prospect_dispatch as pd, secuencia
    from app.services.email.policy import AR_TZ
    from app.services.email.provider import SimulatedProvider
    from app.services.notifications import create_notification

TEN = datetime(2030, 3, 6, 10, 0, tzinfo=AR_TZ).astimezone(timezone.utc) if TEST_DB else None   # miércoles


@pytest.fixture(autouse=True)
async def _limpio(maker, monkeypatch):
    monkeypatch.setattr(settings, "PROSPECT_DAILY_CAP", 3)
    monkeypatch.setattr(settings, "PROSPECT_MODE", "simulate")
    monkeypatch.setattr(pd, "REQUEST_INTERVAL_SECONDS", 0)
    async with maker() as db:
        await db.execute(text("TRUNCATE email_mailboxes, email_campaigns, prospect_emails, prospects CASCADE"))
        await db.commit()
    yield


async def _activa(maker, on=True):
    async with maker() as db:
        await db.execute(text("DELETE FROM site_settings WHERE key = :k"), {"k": SettingKey.prospeccion_automatica_activa.value})
        db.add(SiteSetting(key=SettingKey.prospeccion_automatica_activa.value, enabled=on))
        await db.commit()


async def _empresas(maker, n, stage="nueva"):
    ids = []
    async with maker() as db:
        for i in range(n):
            p = Prospect(id=uuid.uuid4(), external_id=f"x-{uuid.uuid4().hex}", name=f"Empresa {i}", stage=stage)
            db.add(p)
            await db.flush()
            db.add(ProspectEmail(prospect_id=p.id, email=f"e{i}-{uuid.uuid4().hex[:6]}@empresa.com", is_primary=True))
            ids.append(p.id)
        await db.commit()
    return ids


async def _encolar(maker, now=TEN):
    async with maker() as db:
        n = await secuencia.enqueue_new(db, now)
        await db.commit()
    return n


async def _filas(maker):
    async with maker() as db:
        return list((await db.execute(select(EmailOutbox).where(EmailOutbox.category == "prospeccion"))).scalars().all())


async def test_apagada_no_encola_nada(maker):
    await _empresas(maker, 2)
    assert await _encolar(maker) == 0


async def test_prendida_encola_empresas_nuevas_sin_pasarse_del_tope_ni_repetir(maker):
    await _activa(maker)
    await _empresas(maker, 5)
    await _empresas(maker, 1, stage="contactada")          # ya contactada: no entra
    assert await _encolar(maker) == 3                       # el tope diario de prospección
    assert await _encolar(maker) == 0                       # la cola ya tiene el cupo del día
    filas = await _filas(maker)
    assert len(filas) == 3 and all(f.touch == 1 for f in filas)
    assert "Empresa" in filas[0].text and "Para no recibir más mails" in filas[0].text


async def test_sale_y_programa_el_seguimiento_editado(maker):
    await _activa(maker)
    await _empresas(maker, 1)
    async with maker() as db:
        c = await secuencia.get_or_create(db)
        secuencia.apply_steps(c, [
            {"subject": "Hola {{empresa}}", "body": "Primer mail para {{empresa}}."},
            {"after_days": 2, "subject": "", "body": "Seguimiento editado por Eugenia."},
        ])
        await db.commit()
    assert await _encolar(maker) == 1
    stats = await pd.dispatch_prospects(session_maker=maker, sender=pd.SimulatedProspectSender(), now=TEN,
                                        use_configured_sender=False)
    assert stats.sent == 1 and stats.followups_queued == 1
    filas = sorted(await _filas(maker), key=lambda f: f.touch)
    assert filas[0].subject == "Hola Empresa 0"
    assert filas[1].touch == 2 and "Seguimiento editado por Eugenia." in filas[1].text
    assert filas[1].scheduled_at == TEN + timedelta(days=2)


async def test_pausada_los_mails_de_la_secuencia_esperan(maker):
    await _activa(maker)
    await _empresas(maker, 1)
    assert await _encolar(maker) == 1
    await _activa(maker, on=False)
    stats = await pd.dispatch_prospects(session_maker=maker, sender=pd.SimulatedProspectSender(), now=TEN,
                                        use_configured_sender=False)
    assert stats.sent == 0 and (await _filas(maker))[0].status == "pending"


async def test_guardar_rearma_los_mails_que_esperan_en_la_cola(maker):
    await _activa(maker)
    await _empresas(maker, 2)
    assert await _encolar(maker) == 2
    async with maker() as db:
        c = await secuencia.get_or_create(db)
        secuencia.apply_steps(c, [{"subject": "Nuevo asunto {{empresa}}", "body": "Texto nuevo de Eugenia."}])
        assert await secuencia.rerender_pending(db, c) == 2
        await db.commit()
    filas = await _filas(maker)
    assert all(f.subject.startswith("Nuevo asunto Empresa") and "Texto nuevo de Eugenia." in f.text for f in filas)


def test_validacion_de_los_pasos():
    c = EmailCampaign(subject="", body="", follow_ups=[])
    with pytest.raises(secuencia.SequenceError):
        secuencia.apply_steps(c, [{"subject": "", "body": "x"}])
    with pytest.raises(secuencia.SequenceError):
        secuencia.apply_steps(c, [{"subject": "a", "body": "b"}, {"after_days": 0, "body": "c"}])


async def _como_admin(maker):
    from app.main import app

    uid = await _user(maker, email=f"admin-{uuid.uuid4().hex[:6]}@bbjobs.com.ar", role="admin")
    async with maker() as db:
        user = (await db.execute(select(User).where(User.id == uid))).scalar_one()
    app.dependency_overrides[get_current_user] = lambda: user
    return user


async def test_api_de_la_secuencia(client, maker):
    await _como_admin(maker)
    r = await client.get("/api/v1/admin/prospecting/sequence")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["activa"] is False and len(d["pasos"]) == 3 and d["pasos"][1]["after_days"] == 4
    d["pasos"][0]["subject"] = "Asunto nuevo"
    r = await client.put("/api/v1/admin/prospecting/sequence", json={"pasos": d["pasos"]})
    assert r.status_code == 200 and r.json()["pasos"][0]["subject"] == "Asunto nuevo"
    r = await client.put("/api/v1/admin/prospecting/sequence/active", json={"activa": True})
    assert r.json()["activa"] is True
    assert (await client.post("/api/v1/admin/prospecting/sequence/test", json={"n": 2})).status_code == 202
    # No aparece entre las campañas.
    assert all(c["name"] != "Prospección automática" for c in (await client.get("/api/v1/admin/campaigns")).json())


async def test_texto_editado_llega_al_mail_y_se_puede_volver_al_original(client, maker):
    await _como_admin(maker)
    lista = (await client.get("/api/v1/admin/mail/templates")).json()
    sel = next(t for t in lista if t["key"] == "application_selected")
    assert "{{puesto}}" in sel["asunto"] and sel["editado"] is False
    r = await client.put("/api/v1/admin/mail/templates/application_selected",
                         json={"asunto": "¡Quedaste para {{puesto}}!", "texto": "Felicitaciones, {{nombre}}."})
    assert r.status_code == 200 and r.json()["editado"] is True

    uid = await _user(maker, email="ana@mail.com")
    async with maker() as db:
        await create_notification(db, user_id=uid, type="application_selected", title="t", body="b",
                                  link="/dashboard/candidate/postulaciones", email_vars={"puesto": "Cajero"})
        await db.commit()
        row = (await db.execute(select(EmailOutbox).where(EmailOutbox.user_id == uid))).scalar_one()
    assert row.subject == "¡Quedaste para Cajero!" and "Felicitaciones" in row.text

    r = await client.delete("/api/v1/admin/mail/templates/application_selected")
    assert r.json()["editado"] is False and r.json()["asunto"] == sel["asunto"]


async def test_lista_todos_los_mails_automaticos_y_se_apagan_los_que_arma_el_sistema(client, maker):
    await _como_admin(maker)
    lista = {t["key"]: t for t in (await client.get("/api/v1/admin/mail/templates")).json()}
    assert lista["digest_para_vos"]["editable"] is False and lista["digest_para_vos"]["activo"] is True
    assert "aviso_busquedas" in lista and "digest_equipo" in lista
    assert "application_new_status" not in lista      # sólo web, no manda mail
    assert "job_pending_review" not in lista          # va adentro del resumen del equipo
    r = await client.put("/api/v1/admin/mail/templates/digest_para_vos", json={"activo": False})
    assert r.status_code == 200 and r.json()["activo"] is False
    assert (await client.put("/api/v1/admin/mail/templates/digest_para_vos", json={"texto": "x"})).status_code == 400
    lista = {t["key"]: t for t in (await client.get("/api/v1/admin/mail/templates")).json()}
    assert lista["digest_para_vos"]["activo"] is False


async def test_cuota_y_costo_sin_resend_cuenta_la_cola(client, maker, monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    await _como_admin(maker)
    r = await client.get("/api/v1/admin/mail/overview")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["cuota"]["fuente"] == "bbjobs" and d["costo"]["plan_usd"] == 20.0
    assert d["costo"]["total_mes_usd"] >= 20.0
    assert (await client.get("/api/v1/admin/mail/sent", params={"template_key": "digest_para_vos"})).status_code == 200
