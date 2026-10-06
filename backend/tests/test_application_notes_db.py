""""Vieron tu CV" y notas de la empresa contra un Postgres real (base descartable).

Necesitan `TEST_DATABASE_URL` (ver `scripts/probar_local_mails.ps1`); sin la variable se
saltean. Cubren AVISOS-POR-ACCION-Y-NOTAS-PLAN.md §5.6: primera vista avisa y la segunda no;
admin no dispara; una nota privada nunca llega al candidato (endpoint, notificación y mail) ni
la lee Talency; la visible viaja con "No avanza" y se cancela si cambia el estado; cruce entre
empresas (404); borrado de cuenta.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

TEST_DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL no definida (base descartable)")

if TEST_DB:
    import httpx
    from sqlalchemy import func, select, text
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.api.deps import get_current_user, get_db
    from app.api.v1 import applications as applications_api
    from app.core.config import settings
    from app.models.alerts import Notification
    from app.models.candidate import CandidateProfile
    from app.models.catalogs import ContractType, Industry, Zone
    from app.models.company import CompanyProfile
    from app.models.core import User
    from app.models.email import EmailOutbox
    from app.models.history import ApplicationNote, ApplicationStatusHistory
    from app.models.job import Application, JobPosting
    from app.models.settings import SettingKey, SiteSetting
    from app.services.account_deletion import delete_account
    from app.services.email import dispatcher
    from app.services.email.policy import AR_TZ
    from app.services.email.provider import SimulatedProvider

NOON = datetime(2030, 3, 6, 12, 0, tzinfo=AR_TZ).astimezone(timezone.utc) if TEST_DB else None
PRIVADA = "Nota interna: no nos convence, tiene muchos cambios de trabajo"
VISIBLE = "Buscamos a alguien con carnet de autoelevador vigente"


@pytest.fixture
async def maker(monkeypatch):
    engine = create_async_engine(TEST_DB)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE application_notes, application_status_history, email_outbox, notifications, "
            "applications, job_postings, candidate_profiles, company_profiles, site_settings, "
            "audit_logs, users RESTART IDENTITY CASCADE"
        ))
    async with session_maker() as db:
        db.add(SiteSetting(key=SettingKey.emails_automaticos_activos.value, enabled=True))
        await db.commit()
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", True)
    monkeypatch.setattr(settings, "EMAIL_MODE", "simulate")
    monkeypatch.setattr(settings, "EMAIL_DAILY_CAP", 0)
    monkeypatch.setattr(dispatcher, "REQUEST_INTERVAL_SECONDS", 0)
    monkeypatch.setattr(applications_api, "signed_document_url", lambda url, attachment=False: "https://cdn.test/cv.pdf")
    yield session_maker
    await engine.dispose()


@pytest.fixture
async def client(maker):
    from app.main import app

    async def _db():
        async with maker() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        c.as_user = lambda user: app.dependency_overrides.__setitem__(get_current_user, lambda: user)
        yield c
    app.dependency_overrides.clear()


async def _world(maker):
    """Dos empresas verificadas con una búsqueda cada una, un candidato postulado a las dos y
    un admin de Talency."""
    tag = uuid.uuid4().hex[:6]
    async with maker() as db:
        ind = Industry(id=uuid.uuid4(), name=f"Ind {tag}", slug=f"ind-{tag}")
        zone = Zone(id=uuid.uuid4(), name=f"Centro {tag}", slug=f"centro-{tag}")
        ct = ContractType(id=uuid.uuid4(), name=f"Efectivo {tag}")
        admin = User(id=uuid.uuid4(), email=f"eugenia-{tag}@talency.com", role="admin", is_active=True)
        cand_user = User(id=uuid.uuid4(), email=f"ana-{tag}@mail.com", role="candidate", is_active=True)
        db.add_all([ind, zone, ct, admin, cand_user])
        await db.flush()
        cand = CandidateProfile(id=uuid.uuid4(), user_id=cand_user.id, first_name="Ana", last_name="Pérez",
                                phone="2915551234", cv_file_url="https://res.cloudinary.com/demo/raw/private/cv.pdf")
        db.add(cand)
        w = {"admin": admin, "cand_user": cand_user, "cand": cand}
        for key, name in (("a", "Logística Sur"), ("b", "Metalúrgica Norte")):
            u = User(id=uuid.uuid4(), email=f"{key}-{tag}@empresa.com", role="company", is_active=True)
            db.add(u)
            await db.flush()
            c = CompanyProfile(id=uuid.uuid4(), user_id=u.id, legal_name=name, cuit=f"30-{tag}{key}-9",
                               industry_id=ind.id, responsible_full_name="R", responsible_phone="2910000000",
                               responsible_email=f"r{key}-{tag}@empresa.com", verification_status="verified")
            db.add(c)
            await db.flush()
            job = JobPosting(id=uuid.uuid4(), company_id=c.id, company_legal_name_snapshot=name,
                             title=f"Operario/a de depósito {key}", description="x", industry_id=ind.id,
                             zone_id=zone.id, contract_type_id=ct.id, modality="presencial", status="active",
                             moderation_status="approved", published_at=datetime.now(timezone.utc))
            db.add(job)
            await db.flush()
            app = Application(id=uuid.uuid4(), candidate_id=cand.id, job_posting_id=job.id, status="new")
            db.add(app)
            w[key] = {"user": u, "company": c, "job": job, "app": app}
        await db.commit()
    return w


async def _app(maker, app_id) -> "Application":
    async with maker() as db:
        return (await db.execute(select(Application).where(Application.id == app_id))).scalar_one()


async def _notifs(maker, user_id, type_=None) -> list["Notification"]:
    async with maker() as db:
        q = select(Notification).where(Notification.user_id == user_id)
        if type_:
            q = q.where(Notification.type == type_)
        return list((await db.execute(q)).scalars().all())


async def _mails(maker, user_id, key=None) -> list["EmailOutbox"]:
    async with maker() as db:
        q = select(EmailOutbox).where(EmailOutbox.user_id == user_id)
        if key:
            q = q.where(EmailOutbox.template_key == key)
        return list((await db.execute(q)).scalars().all())


# ── "Vieron tu CV" ──────────────────────────────────────────────────────────────────────

async def test_first_view_marks_seen_notifies_and_the_second_does_not(client, maker):
    w = await _world(maker)
    a = w["a"]
    client.as_user(a["user"])
    url = f"/api/v1/me/company/candidates/{w['cand'].id}"
    assert (await client.get(url, params={"application_id": str(a["app"].id)})).status_code == 200

    saved = await _app(maker, a["app"].id)
    assert saved.status == "seen" and saved.seen_at is not None
    async with maker() as db:
        hist = (await db.execute(select(ApplicationStatusHistory).where(
            ApplicationStatusHistory.application_id == a["app"].id))).scalar_one()
    assert (hist.from_status, hist.to_status, hist.automatico, hist.changed_by_user_id) == \
        ("new", "seen", True, a["user"].id)
    [notif] = await _notifs(maker, w["cand_user"].id, "application_seen")
    assert notif.title == "Una empresa vio tu CV" and "Logística Sur" in notif.body
    assert len(await _mails(maker, w["cand_user"].id, "application_seen")) == 1

    # Otra vez el perfil, y ahora el CV: no se repite nada.
    assert (await client.get(url, params={"application_id": str(a["app"].id)})).status_code == 200
    assert (await client.get(f"{url}/cv/link", params={"application_id": str(a["app"].id)})).status_code == 200
    assert len(await _notifs(maker, w["cand_user"].id, "application_seen")) == 1
    # La postulación a la otra empresa no se tocó.
    assert (await _app(maker, w["b"]["app"].id)).status == "new"


async def test_cv_link_without_application_id_only_touches_new_applications_of_that_company(client, maker):
    w = await _world(maker)
    client.as_user(w["a"]["user"])
    resp = await client.get(f"/api/v1/me/company/candidates/{w['cand'].id}/cv/link")
    assert resp.status_code == 200 and resp.json()["url"] == "https://cdn.test/cv.pdf"
    assert (await _app(maker, w["a"]["app"].id)).status == "seen"
    assert (await _app(maker, w["b"]["app"].id)).status == "new"


async def test_already_advanced_application_only_fills_seen_at(client, maker):
    w = await _world(maker)
    async with maker() as db:
        await db.execute(text("UPDATE applications SET status='contacted' WHERE id=:id"), {"id": w["a"]["app"].id})
        await db.commit()
    client.as_user(w["a"]["user"])
    await client.get(f"/api/v1/me/company/candidates/{w['cand'].id}",
                     params={"application_id": str(w["a"]["app"].id)})
    saved = await _app(maker, w["a"]["app"].id)
    assert saved.status == "contacted" and saved.seen_at is not None
    assert await _notifs(maker, w["cand_user"].id) == []


async def test_admin_opening_profile_or_cv_does_not_trigger(client, maker):
    w = await _world(maker)
    client.as_user(w["admin"])
    assert (await client.get(f"/api/v1/admin/candidates/{w['cand'].id}")).status_code == 200
    assert (await client.get(f"/api/v1/admin/candidates/{w['cand'].id}/cv/link")).status_code in (200, 502)
    assert (await _app(maker, w["a"]["app"].id)).seen_at is None
    assert await _notifs(maker, w["cand_user"].id) == []


async def test_nothing_happens_with_the_gate_closed(client, maker, monkeypatch):
    monkeypatch.setattr(settings, "MODULOS_NUEVOS_ACTIVOS", False)
    w = await _world(maker)
    client.as_user(w["a"]["user"])
    await client.get(f"/api/v1/me/company/candidates/{w['cand'].id}",
                     params={"application_id": str(w["a"]["app"].id)})
    assert (await _app(maker, w["a"]["app"].id)).status == "new"
    assert await _notifs(maker, w["cand_user"].id) == []
    # Las rutas nuevas no existen y el PATCH ignora la nota.
    notes_url = f"/api/v1/me/company/applications/{w['a']['app'].id}/notes"
    assert (await client.get(notes_url)).status_code == 404
    assert (await client.post(notes_url, json={"body": "hola"})).status_code == 404
    resp = await client.patch(f"/api/v1/me/company/applications/{w['a']['app'].id}/status",
                              json={"status": "discarded", "note": VISIBLE, "note_visible": True})
    assert resp.status_code == 200
    async with maker() as db:
        assert (await db.execute(select(func.count()).select_from(ApplicationNote))).scalar_one() == 0
    [notif] = await _notifs(maker, w["cand_user"].id)
    assert VISIBLE not in notif.body


async def test_two_companies_same_day_one_mail_two_web_notices(client, maker):
    w = await _world(maker)
    for key in ("a", "b"):
        client.as_user(w[key]["user"])
        await client.get(f"/api/v1/me/company/candidates/{w['cand'].id}",
                         params={"application_id": str(w[key]["app"].id)})
    assert len(await _notifs(maker, w["cand_user"].id, "application_seen")) == 2
    assert len(await _mails(maker, w["cand_user"].id, "application_seen")) == 1


async def test_a_company_cannot_mark_another_companys_application_as_seen(client, maker):
    w = await _world(maker)
    client.as_user(w["b"]["user"])
    # El candidato también se postuló a B, así que B puede verlo; pero el application_id es de A.
    resp = await client.get(f"/api/v1/me/company/candidates/{w['cand'].id}",
                            params={"application_id": str(w["a"]["app"].id)})
    assert resp.status_code == 200
    assert (await _app(maker, w["a"]["app"].id)).status == "new"
    assert (await _app(maker, w["b"]["app"].id)).status == "new"


# ── Notas: privadas ─────────────────────────────────────────────────────────────────────

async def _candidate_history(client, w, app_id):
    client.as_user(w["cand_user"])
    resp = await client.get(f"/api/v1/me/candidate/applications/{app_id}/history")
    assert resp.status_code == 200
    return resp.json()


async def test_private_note_never_reaches_the_candidate(client, maker):
    w = await _world(maker)
    app_id = w["a"]["app"].id
    client.as_user(w["a"]["user"])
    resp = await client.patch(f"/api/v1/me/company/applications/{app_id}/status",
                              json={"status": "discarded", "note": PRIVADA})
    assert resp.status_code == 200
    resp = await client.post(f"/api/v1/me/company/applications/{app_id}/notes", json={"body": PRIVADA + " (2)"})
    assert resp.status_code == 201 and resp.json()["visible_to_candidate"] is False

    # La empresa las ve.
    notas = (await client.get(f"/api/v1/me/company/applications/{app_id}/notes")).json()
    assert [n["visible_to_candidate"] for n in notas] == [False, False]
    assert notas[0]["status_at_time"] == "discarded"

    # El postulante, por ningún camino.
    history = await _candidate_history(client, w, app_id)
    assert all(h["kind"] == "status" for h in history)
    assert PRIVADA not in str(history)
    notifs = await _notifs(maker, w["cand_user"].id)
    assert [n.type for n in notifs] == ["application_discarded"]
    assert all(PRIVADA not in n.body for n in notifs)
    mails = await _mails(maker, w["cand_user"].id)
    assert mails and all(PRIVADA not in (m.html + (m.text or "") + m.subject) for m in mails)
    async with maker() as db:
        assert all(n.notified_at is None for n in (await db.execute(select(ApplicationNote))).scalars())


async def test_talency_cannot_read_private_notes(client, maker):
    w = await _world(maker)
    app_id, job_id = w["a"]["app"].id, w["a"]["job"].id
    client.as_user(w["a"]["user"])
    await client.post(f"/api/v1/me/company/applications/{app_id}/notes", json={"body": PRIVADA})

    client.as_user(w["admin"])
    # Los endpoints de notas son de la empresa: un admin no entra.
    assert (await client.get(f"/api/v1/me/company/applications/{app_id}/notes")).status_code == 403
    # Y nada del panel de admin las devuelve.
    for url in (
        f"/api/v1/admin/applications/{app_id}/history",
        f"/api/v1/admin/jobs/{job_id}/applications",
        f"/api/v1/admin/candidates/{w['cand'].id}",
        f"/api/v1/admin/candidates/{w['cand'].id}/activity",
    ):
        resp = await client.get(url)
        assert resp.status_code == 200, url
        assert PRIVADA not in resp.text, url


def test_no_admin_or_candidate_module_reads_the_notes_table():
    """Garantía estructural: sólo el servicio y los endpoints de empresa tocan las notas. Si
    mañana alguien suma un endpoint de admin que las lea, este test lo frena (decisión de
    Talency del 06/10/2026: las notas privadas son sólo de la empresa)."""
    v1 = Path(__file__).resolve().parents[1] / "app" / "api" / "v1"
    for path in v1.glob("*.py"):
        if path.name == "applications.py":
            continue
        source = path.read_text(encoding="utf-8")
        assert "ApplicationNote" not in source and "application_notes" not in source, path.name
        assert "list_notes" not in source and "visible_notes" not in source, path.name


# ── Notas: visibles ─────────────────────────────────────────────────────────────────────

async def test_visible_note_travels_inside_discarded_and_is_canceled_with_it(client, maker):
    w = await _world(maker)
    app_id = w["a"]["app"].id
    client.as_user(w["a"]["user"])
    before = datetime.now(timezone.utc)
    resp = await client.patch(f"/api/v1/me/company/applications/{app_id}/status",
                              json={"status": "discarded", "note": VISIBLE, "note_visible": True})
    assert resp.status_code == 200

    [notif] = await _notifs(maker, w["cand_user"].id)
    assert notif.type == "application_discarded"
    assert f"Mensaje de la empresa: {VISIBLE}" in notif.body
    [mail] = await _mails(maker, w["cand_user"].id)
    assert mail.template_key == "application_discarded" and VISIBLE in mail.text
    assert mail.scheduled_at >= before + timedelta(hours=23, minutes=59)
    # Una sola notificación: la nota no genera un aviso aparte.
    assert await _notifs(maker, w["cand_user"].id, "application_note") == []

    history = await _candidate_history(client, w, app_id)
    assert [h["note"] for h in history if h["kind"] == "note"] == [VISIBLE]

    # La empresa se arrepiente antes de las 24 h: el mail (con la nota) no sale.
    client.as_user(w["a"]["user"])
    await client.patch(f"/api/v1/me/company/applications/{app_id}/status", json={"status": "in_process"})
    async with maker() as db:
        await db.execute(text("UPDATE email_outbox SET scheduled_at=:t WHERE id=:id"),
                         {"t": NOON - timedelta(minutes=1), "id": mail.id})
        await db.commit()
    stats = await dispatcher.dispatch_due(session_maker=maker, provider=SimulatedProvider(), now=NOON)
    assert stats.canceled == 1
    async with maker() as db:
        assert (await db.execute(select(EmailOutbox.status).where(EmailOutbox.id == mail.id))).scalar_one() == "canceled"


async def test_standalone_visible_note_notifies_once_per_day_per_application(client, maker):
    w = await _world(maker)
    app_id = w["a"]["app"].id
    client.as_user(w["a"]["user"])
    for body in ("Gracias por postularte. La semana que viene llamamos a entrevistas.", "Te escribimos el lunes."):
        resp = await client.post(f"/api/v1/me/company/applications/{app_id}/notes",
                                 json={"body": body, "visible_to_candidate": True})
        assert resp.status_code == 201
    [notif] = await _notifs(maker, w["cand_user"].id, "application_note")
    assert notif.title == "La empresa te dejó un mensaje" and "entrevistas" in notif.body
    assert len(await _mails(maker, w["cand_user"].id, "application_note")) == 1
    history = await _candidate_history(client, w, app_id)
    assert len([h for h in history if h["kind"] == "note"]) == 2


async def test_deleted_note_leaves_the_candidate_timeline(client, maker):
    w = await _world(maker)
    app_id = w["a"]["app"].id
    client.as_user(w["a"]["user"])
    note_id = (await client.post(f"/api/v1/me/company/applications/{app_id}/notes",
                                 json={"body": VISIBLE, "visible_to_candidate": True})).json()["id"]
    assert (await client.delete(f"/api/v1/me/company/applications/{app_id}/notes/{note_id}")).status_code == 204
    assert (await client.get(f"/api/v1/me/company/applications/{app_id}/notes")).json() == []
    assert [h for h in await _candidate_history(client, w, app_id) if h["kind"] == "note"] == []


async def test_note_validation(client, maker):
    w = await _world(maker)
    app_id = w["a"]["app"].id
    client.as_user(w["a"]["user"])
    url = f"/api/v1/me/company/applications/{app_id}/notes"
    assert (await client.post(url, json={"body": "x" * 1001})).status_code == 422
    assert (await client.post(url, json={"body": "   "})).status_code == 422
    resp = await client.patch(f"/api/v1/me/company/applications/{app_id}/status",
                              json={"status": "seen", "note": "x" * 1001})
    assert resp.status_code == 422
    assert (await _app(maker, app_id)).status == "new"


# ── Cruce entre empresas ────────────────────────────────────────────────────────────────

async def test_company_b_cannot_read_write_or_delete_company_a_notes(client, maker):
    w = await _world(maker)
    a_app, b_app = w["a"]["app"].id, w["b"]["app"].id
    client.as_user(w["a"]["user"])
    note_id = (await client.post(f"/api/v1/me/company/applications/{a_app}/notes",
                                 json={"body": PRIVADA})).json()["id"]

    client.as_user(w["b"]["user"])
    base = f"/api/v1/me/company/applications/{a_app}"
    assert (await client.get(f"{base}/notes")).status_code == 404
    assert (await client.post(f"{base}/notes", json={"body": "intrusa"})).status_code == 404
    assert (await client.delete(f"{base}/notes/{note_id}")).status_code == 404
    assert (await client.patch(f"{base}/status", json={"status": "discarded", "note": "x"})).status_code == 404
    # Con su propia postulación pero la nota de A: tampoco.
    assert (await client.delete(f"/api/v1/me/company/applications/{b_app}/notes/{note_id}")).status_code == 404
    assert PRIVADA not in (await client.get(f"/api/v1/me/company/applications/{b_app}/notes")).text

    async with maker() as db:
        notas = (await db.execute(select(ApplicationNote))).scalars().all()
    assert [(n.body, n.deleted_at) for n in notas] == [(PRIVADA, None)]


async def test_another_candidate_cannot_read_the_history(client, maker):
    w = await _world(maker)
    async with maker() as db:
        otro = User(id=uuid.uuid4(), email="beto@mail.com", role="candidate", is_active=True)
        db.add(otro)
        await db.flush()
        db.add(CandidateProfile(id=uuid.uuid4(), user_id=otro.id, first_name="Beto", last_name="Gómez", phone="1"))
        await db.commit()
    client.as_user(otro)
    resp = await client.get(f"/api/v1/me/candidate/applications/{w['a']['app'].id}/history")
    assert resp.status_code == 404


# ── Borrado de cuenta ───────────────────────────────────────────────────────────────────

async def test_candidate_deletion_empties_the_notes(client, maker):
    w = await _world(maker)
    client.as_user(w["a"]["user"])
    for visible in (False, True):
        await client.post(f"/api/v1/me/company/applications/{w['a']['app'].id}/notes",
                          json={"body": VISIBLE, "visible_to_candidate": visible})
    async with maker() as db:
        u = (await db.execute(select(User).where(User.id == w["cand_user"].id))).scalar_one()
        preview = await delete_account(db, u, actor=None, reason="test", delete_in_clerk=False)
    assert preview.mode.value == "tombstone"
    async with maker() as db:
        bodies = (await db.execute(select(ApplicationNote.body))).scalars().all()
    assert bodies == [None, None]


async def test_company_deletion_drops_private_notes_and_keeps_visible_ones(client, maker):
    w = await _world(maker)
    client.as_user(w["a"]["user"])
    for body, visible in ((PRIVADA, False), (VISIBLE, True)):
        await client.post(f"/api/v1/me/company/applications/{w['a']['app'].id}/notes",
                          json={"body": body, "visible_to_candidate": visible})
    async with maker() as db:
        u = (await db.execute(select(User).where(User.id == w["a"]["user"].id))).scalar_one()
        preview = await delete_account(db, u, actor=None, reason="test", delete_in_clerk=False)
    assert preview.mode.value == "tombstone"
    async with maker() as db:
        rows = (await db.execute(select(ApplicationNote.body, ApplicationNote.visible_to_candidate))).all()
    assert rows == [(VISIBLE, True)]
