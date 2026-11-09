"""Lo que hace la empresa con una postulación y lo que se entera el postulante.

Tres cosas, todas del lado de la empresa (ver AVISOS-POR-ACCION-Y-NOTAS-PLAN.md §2–§3):

- **Cambio de estado** (`change_status`): lo que antes vivía entero en el endpoint `PATCH
  .../status`. Opcionalmente lleva una observación privada (caso típico: "No avanza" + motivo).
- **"Vieron tu CV"** (`mark_seen`): la primera vez que la empresa abre el perfil completo o el CV
  desde una postulación, la postulación pasa sola a "Perfil revisado" y el postulante recibe el
  aviso. Sólo con la compuerta de módulos nuevos abierta.
- **Observaciones** (`add_note`, `list_candidate_notes`, `delete_note`, `admin_candidate_notes`):
  **siempre privadas** (Eugenia, 22/10/2026). No le llegan al postulante por ningún camino
  (endpoint, notificación ni mail) y ni siquiera sabe que existen. Las lee la empresa que las
  escribió, en cualquier búsqueda futura sobre esa persona, y el equipo de Talency en sólo
  lectura, con un registro de cada lectura.

Toda consulta de empresa filtra por `company_id`. El texto de la nota es de la empresa, o sea
no confiable: se guarda tal cual y se escapa al mostrarlo (React en la web, `render_email` en el
mail), sin links.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.features import new_modules_enabled
from app.models.candidate import CandidateProfile
from app.models.company import CompanyProfile
from app.models.alerts import AuditLog
from app.models.history import ApplicationNote
from app.models.job import SELECTABLE_STATUSES, Application, ApplicationStatus, JobPosting
from app.services.history import log_application_status_change
from app.services.notifications import create_notification

NOTE_MAX_LENGTH = 1000
CANDIDATE_LINK = "/dashboard/candidate/postulaciones"


class NoteError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# "Vieron tu CV": lo dispara la plataforma, no la empresa a mano (texto del brief a Eugenia).
SEEN_AUTO_TITLE = "Una empresa vio tu CV"
SEEN_AUTO_BODY = "{company} revisó tu perfil para la búsqueda '{job_title}'."


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _clean(body: str | None) -> str:
    return (body or "").strip()


async def company_application(
    db: AsyncSession, company: CompanyProfile, application_id: uuid.UUID
) -> Application | None:
    """La postulación, sólo si es de una búsqueda de esta empresa. `None` si no (el endpoint
    responde 404, nunca 403: no se confirma que exista)."""
    return (await db.execute(
        select(Application)
        .join(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(Application.id == application_id, JobPosting.company_id == company.id)
    )).scalar_one_or_none()


async def _job_and_candidate(db: AsyncSession, app: Application):
    job = (await db.execute(select(JobPosting).where(JobPosting.id == app.job_posting_id))).scalar_one_or_none()
    candidate = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == app.candidate_id)
    )).scalar_one_or_none()
    return job, candidate


# ── Cambio de estado ──────────────────────────────────────────────────────────────────

async def change_status(
    db: AsyncSession,
    *,
    company: CompanyProfile,
    app: Application,
    new_status: ApplicationStatus,
    note: str | None = None,
    note_tags: list[str] | None = None,
) -> ApplicationNote | None:
    """Cambia el estado, deja el historial y avisa al postulante. No commitea.

    La observación (siempre privada) sólo se guarda con la compuerta de módulos nuevos abierta:
    con la compuerta cerrada el `PATCH` se comporta exactamente como antes. Devuelve la nota
    creada, si hubo."""
    texto = _clean(note) if new_modules_enabled() else ""
    # "Contactado" y "Finalista" ya no se eligen (Eugenia, 08/10/2026). Una postulación vieja en
    # uno de ellos puede quedarse ahí o pasar a otro, pero nadie la puede volver a poner.
    if ApplicationStatus(new_status) not in SELECTABLE_STATUSES and app.status != ApplicationStatus(new_status).value:
        raise NoteError("Ese estado ya no se puede elegir.")
    if len(texto) > NOTE_MAX_LENGTH:
        raise NoteError(f"La nota puede tener hasta {NOTE_MAX_LENGTH} caracteres.")
    now = _now()
    previous_status = app.status
    app.status = new_status
    app.status_updated_at = now
    if new_status != ApplicationStatus.new and not app.seen_at:
        app.seen_at = now

    await log_application_status_change(
        db, application_id=app.id, from_status=previous_status, to_status=new_status,
        changed_by_user_id=company.user_id,
    )

    nota = None
    if texto:
        nota = ApplicationNote(
            id=uuid.uuid4(), candidate_id=app.candidate_id, application_id=app.id, company_id=company.id,
            author_user_id=company.user_id, body=texto, tags=list(note_tags or []),
            status_at_time=ApplicationStatus(new_status).value,
        )
        db.add(nota)

    # Al candidato le llega notificación en **los siete** estados (decisión de Talency,
    # agosto/2026) — antes sólo en tres de cinco, así que quedaba a ciegas justo cuando la
    # empresa lo miraba por primera vez. El diccionario vive dentro de la función a propósito:
    # el test del catálogo (test_email_policy.py) lee los `type` de las tuplas de la función
    # que llama a create_notification.
    candidate_notif: dict[ApplicationStatus, tuple[str, str, str]] = {
        ApplicationStatus.new: (
            "application_new_status",
            "Tu postulación quedó registrada",
            "Registramos tu postulación a '{job_title}'.",
        ),
        ApplicationStatus.seen: (
            "application_seen",
            "Tu perfil fue revisado",
            "El equipo responsable de la búsqueda '{job_title}' revisó tu perfil.",
        ),
        ApplicationStatus.contacted: (
            "application_contacted",
            "¡Una empresa quiere contactarte!",
            "Te marcaron como contactado en la búsqueda '{job_title}'. Estate atento al teléfono y al mail.",
        ),
        ApplicationStatus.in_process: (
            "application_in_process",
            "¡Tu postulación avanzó!",
            "Tu postulación a '{job_title}' está en proceso. Prestá atención a tu correo y teléfono.",
        ),
        ApplicationStatus.finalist: (
            "application_finalist",
            "¡Quedaste entre los finalistas!",
            "Quedaste entre los finalistas de '{job_title}'.",
        ),
        ApplicationStatus.selected: (
            "application_selected",
            "¡Fuiste seleccionado/a!",
            "Confirmaron tu selección para '{job_title}'. Los detalles de tu incorporación los coordinás con la empresa.",
        ),
        ApplicationStatus.discarded: (
            "application_discarded",
            "Novedades sobre tu postulación",
            "Tu postulación a '{job_title}' no continúa en esta oportunidad. ¡Seguí postulándote a otras búsquedas!",
        ),
        ApplicationStatus.discarded_interview: (
            "application_discarded_interview",
            "Novedades sobre tu postulación",
            "Gracias por participar del proceso de '{job_title}'. En esta oportunidad, tu candidatura no continúa.",
        ),
    }
    notif = candidate_notif.get(ApplicationStatus(new_status))
    if notif:
        job, candidate = await _job_and_candidate(db, app)
        if job and candidate:
            notif_type, notif_title, notif_body = notif
            body = notif_body.format(job_title=job.title)
            # La observación no toca la notificación ni el mail: es la garantía que prueba
            # tests/test_application_notes_db.py.
            email_vars = {"puesto": job.title}
            await create_notification(
                db,
                user_id=candidate.user_id,
                type=notif_type,
                title=notif_title,
                body=body,
                link=CANDIDATE_LINK,
                email_vars=email_vars,
                # Para revalidar al enviar: "No avanza" sale 24 h después y se cancela si la
                # empresa cambió el estado en el medio (auditoría R9/M18).
                ref_id=app.id,
            )
    return nota


# ── "Vieron tu CV" ────────────────────────────────────────────────────────────────────

async def mark_seen(
    db: AsyncSession,
    *,
    company: CompanyProfile,
    candidate_id: uuid.UUID,
    application_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> list[uuid.UUID]:
    """La empresa abrió el perfil completo o el CV. No commitea; devuelve las postulaciones que
    pasaron a "Perfil revisado".

    - Con `application_id` (abrió desde una postulación): sólo esa, y sólo si es de esta empresa.
    - Sin él: las postulaciones del candidato **en estado Nueva** a búsquedas de esta empresa.
    - Sólo la primera vez (`seen_at` vacío). Si ya estaba más adelante (Contactado, etc.), sólo
      se completa `seen_at`, sin aviso.

    Es un único `UPDATE … WHERE seen_at IS NULL RETURNING`: dos pestañas abiertas a la vez no
    avisan dos veces (la segunda espera el lock de la fila y, al releerla, ya no cumple).
    Quién lo llama decide quién dispara: sólo los endpoints de empresa. Abrirlo desde el panel de
    Talency usa otros endpoints y no avisa."""
    if not new_modules_enabled():
        return []
    now = now or _now()

    previos = (
        select(Application.id.label("app_id"), Application.status.label("old_status"))
        .join(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(
            Application.candidate_id == candidate_id,
            JobPosting.company_id == company.id,
            Application.seen_at.is_(None),
            Application.deleted_at.is_(None),
        )
    )
    if application_id is not None:
        previos = previos.where(Application.id == application_id)
    else:
        previos = previos.where(Application.status == ApplicationStatus.new.value)
    previos = previos.subquery()

    era_nueva = Application.status == ApplicationStatus.new.value
    filas = (await db.execute(
        update(Application)
        .where(Application.id == previos.c.app_id, Application.seen_at.is_(None))
        .values(
            seen_at=now,
            status=case((era_nueva, ApplicationStatus.seen.value), else_=Application.status),
            status_updated_at=case((era_nueva, now), else_=Application.status_updated_at),
        )
        .returning(Application.id, Application.job_posting_id, previos.c.old_status)
        .execution_options(synchronize_session=False)
    )).all()

    avisadas = [(app_id, job_id) for app_id, job_id, old in filas if old == ApplicationStatus.new.value]
    if not avisadas:
        return []

    candidate = (await db.execute(
        select(CandidateProfile).where(CandidateProfile.id == candidate_id)
    )).scalar_one_or_none()
    titulos = dict((await db.execute(
        select(JobPosting.id, JobPosting.title).where(JobPosting.id.in_([j for _, j in avisadas]))
    )).all())

    for app_id, job_id in avisadas:
        await log_application_status_change(
            db, application_id=app_id, from_status=ApplicationStatus.new,
            to_status=ApplicationStatus.seen, changed_by_user_id=company.user_id, automatico=True,
        )
        if candidate is not None and candidate.deleted_at is None:
            await create_notification(
                db,
                user_id=candidate.user_id,
                type="application_seen",
                title=SEEN_AUTO_TITLE,
                body=SEEN_AUTO_BODY.format(company=company.legal_name, job_title=titulos.get(job_id, "")),
                link=CANDIDATE_LINK,
                email_vars={"puesto": titulos.get(job_id, "")},
                ref_id=app_id,
            )
    return [app_id for app_id, _ in avisadas]


# ── Observaciones ─────────────────────────────────────────────────────────────────────

async def add_note(
    db: AsyncSession,
    *,
    company: CompanyProfile,
    candidate_id: uuid.UUID,
    body: str,
    application: Application | None = None,
    tags: list[str] | None = None,
) -> ApplicationNote:
    """Observación privada sobre una persona. No commitea y **nunca avisa a nadie**.

    Quién llama ya comprobó que la empresa tiene acceso al candidato (se postuló a una búsqueda
    suya o lo desbloqueó en la Base de Talento). `application`, si viene, es de esta empresa y de
    este candidato: sólo sirve para recordar de qué búsqueda salió."""
    texto = _clean(body)
    if not texto:
        raise NoteError("La observación está vacía.")
    if len(texto) > NOTE_MAX_LENGTH:
        raise NoteError(f"La observación puede tener hasta {NOTE_MAX_LENGTH} caracteres.")
    if application is not None and application.candidate_id != candidate_id:
        raise NoteError("La postulación no es de esta persona.")
    nota = ApplicationNote(
        id=uuid.uuid4(), candidate_id=candidate_id, company_id=company.id,
        application_id=application.id if application is not None else None,
        author_user_id=company.user_id, body=texto, tags=list(tags or []),
    )
    db.add(nota)
    return nota


def _con_titulo(filas) -> list[ApplicationNote]:
    """Cada nota con `job_title` (la búsqueda de origen, si hay) como atributo suelto, sólo para
    armar la respuesta."""
    resultado = []
    for nota, titulo in filas:
        nota.job_title = titulo
        resultado.append(nota)
    return resultado


async def list_candidate_notes(
    db: AsyncSession, *, company: CompanyProfile, candidate_id: uuid.UUID
) -> list[ApplicationNote]:
    """Todas las observaciones de **esta empresa** sobre la persona, de la más nueva a la más
    vieja. Nunca las de otra empresa."""
    filas = (await db.execute(
        select(ApplicationNote, JobPosting.title)
        .outerjoin(Application, ApplicationNote.application_id == Application.id)
        .outerjoin(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(
            ApplicationNote.company_id == company.id,
            ApplicationNote.candidate_id == candidate_id,
            ApplicationNote.deleted_at.is_(None),
        )
        .order_by(ApplicationNote.created_at.desc(), ApplicationNote.id)
    )).all()
    return _con_titulo(filas)


async def count_notes_by_candidate(
    db: AsyncSession, *, company_id: uuid.UUID, candidate_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """Cuántas observaciones vigentes tiene **esta empresa** sobre cada persona: una sola
    consulta agrupada para toda la página de la lista de postulantes (el ícono "Tiene
    observaciones"). Las personas sin observaciones no aparecen en el resultado."""
    if not candidate_ids:
        return {}
    filas = (await db.execute(
        select(ApplicationNote.candidate_id, func.count())
        .where(
            ApplicationNote.company_id == company_id,
            ApplicationNote.candidate_id.in_(candidate_ids),
            ApplicationNote.deleted_at.is_(None),
        )
        .group_by(ApplicationNote.candidate_id)
    )).all()
    return {candidate_id: n for candidate_id, n in filas}


async def delete_note(db: AsyncSession, *, company: CompanyProfile, note_id: uuid.UUID) -> bool:
    """Borrado lógico. `False` si la observación no existe o no es de esta empresa. No commitea."""
    nota = (await db.execute(
        select(ApplicationNote).where(
            ApplicationNote.id == note_id,
            ApplicationNote.company_id == company.id,
            ApplicationNote.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if nota is None:
        return False
    nota.deleted_at = _now()
    return True


AUDIT_READ_NOTES = "admin_read_notes"


async def admin_candidate_notes(
    db: AsyncSession, *, admin_user_id: uuid.UUID, candidate_id: uuid.UUID
) -> list[tuple[ApplicationNote, str | None]]:
    """Lo que lee Talency: las observaciones de **todas** las empresas sobre la persona, con el
    nombre de la empresa. Sólo lectura, y cada lectura deja un registro (`AuditLog`). No
    commitea: quien llama confirma junto con el registro."""
    filas = (await db.execute(
        select(ApplicationNote, JobPosting.title, CompanyProfile.legal_name)
        .join(CompanyProfile, ApplicationNote.company_id == CompanyProfile.id)
        .outerjoin(Application, ApplicationNote.application_id == Application.id)
        .outerjoin(JobPosting, Application.job_posting_id == JobPosting.id)
        .where(ApplicationNote.candidate_id == candidate_id, ApplicationNote.deleted_at.is_(None))
        .order_by(ApplicationNote.created_at.desc(), ApplicationNote.id)
    )).all()
    db.add(AuditLog(
        admin_user_id=admin_user_id, action=AUDIT_READ_NOTES, target_entity="candidate",
        target_id=candidate_id, notes=f"{len(filas)} observaciones",
    ))
    resultado = []
    for nota, titulo, empresa in filas:
        nota.job_title = titulo
        resultado.append((nota, empresa))
    return resultado


# ── Vista previa del aviso al postulante ──────────────────────────────────────────────

# Qué aviso dispara cada estado (el mismo `type` que usa change_status).
STATUS_EMAIL_TYPE: dict[ApplicationStatus, str] = {
    ApplicationStatus.new: "application_new_status",
    ApplicationStatus.seen: "application_seen",
    ApplicationStatus.contacted: "application_contacted",
    ApplicationStatus.in_process: "application_in_process",
    ApplicationStatus.finalist: "application_finalist",
    ApplicationStatus.selected: "application_selected",
    ApplicationStatus.discarded: "application_discarded",
    ApplicationStatus.discarded_interview: "application_discarded_interview",
}


async def status_email_preview(
    db: AsyncSession,
    *,
    company: CompanyProfile,
    app: Application,
    new_status: ApplicationStatus,
) -> dict:
    """El mail que le llegaría al postulante si la empresa confirma el cambio (pedido de Eugenia:
    "que le muestre el mensaje que le va a llegar al candidato"). Mismo texto y mismo renderer
    que la cola (`copy.py` + `build_content`), con el nombre y el puesto reales. No guarda nada.

    Una observación nunca entra al mail ni a la vista previa."""
    from app.services.email.catalog import rule_for
    from app.services.email.copy import first_name
    from app.services.email.outbox import build_content, template_override

    notif_type = STATUS_EMAIL_TYPE[ApplicationStatus(new_status)]
    rule = rule_for(notif_type)
    job, candidate = await _job_and_candidate(db, app)
    override = await template_override(db, notif_type)
    if rule.mode != "instant" or job is None or candidate is None or (override is not None and not override.enabled):
        return {"sends_email": False, "type": notif_type, "delay_hours": 0,
                "subject": None, "html": None, "text": None}
    variables = {"puesto": job.title, "nombre": first_name(candidate.first_name)}
    subject, rendered = build_content(
        user_id=candidate.user_id, category=rule.category, title="", body="", link=CANDIDATE_LINK,
        cta_label=rule.cta_label, unsubscribable=rule.unsubscribable, override=override,
        type=notif_type, variables=variables, role="candidate",
    )
    return {
        "sends_email": True, "type": notif_type,
        "delay_hours": int(rule.delay.total_seconds() // 3600),
        "subject": subject, "html": rendered.html, "text": rendered.text,
    }
