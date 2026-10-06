"""Lo que hace la empresa con una postulación y lo que se entera el postulante.

Tres cosas, todas del lado de la empresa (ver AVISOS-POR-ACCION-Y-NOTAS-PLAN.md §2–§3):

- **Cambio de estado** (`change_status`): lo que antes vivía entero en el endpoint `PATCH
  .../status`. Opcionalmente lleva una nota; si la nota es visible, viaja **dentro** del aviso
  de ese estado (con "No avanza", en el mail de las 24 h, que se cancela igual que siempre si la
  empresa cambia el estado en el medio).
- **"Vieron tu CV"** (`mark_seen`): la primera vez que la empresa abre el perfil completo o el CV
  desde una postulación, la postulación pasa sola a "Perfil revisado" y el postulante recibe el
  aviso. Sólo con la compuerta de módulos nuevos abierta.
- **Notas** (`add_note`, `list_notes`, `delete_note`, `visible_notes`): privadas por defecto.
  Una privada no le llega al postulante por ningún camino (endpoint, notificación ni mail), y
  tampoco la lee Talency: ningún endpoint de admin las devuelve (decisión del 06/10/2026).

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
from app.models.history import ApplicationNote
from app.models.job import Application, ApplicationStatus, JobPosting
from app.services.history import log_application_status_change
from app.services.notifications import create_notification

NOTE_MAX_LENGTH = 1000
CANDIDATE_LINK = "/dashboard/candidate/postulaciones"
# Cómo se presenta la nota visible dentro del aviso del cambio de estado.
COMPANY_MESSAGE_PREFIX = "Mensaje de la empresa: "


class NoteError(Exception):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# "Vieron tu CV": lo dispara la plataforma, no la empresa a mano (texto del brief a Eugenia).
SEEN_AUTO_TITLE = "Una empresa vio tu CV"
SEEN_AUTO_BODY = "{company} revisó tu perfil para la búsqueda '{job_title}'."
NOTE_TITLE = "La empresa te dejó un mensaje"
NOTE_BODY = "{company} te dejó un mensaje sobre tu postulación a '{job_title}':\n\n{note}"


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
    note_visible: bool = False,
) -> ApplicationNote | None:
    """Cambia el estado, deja el historial y avisa al postulante. No commitea.

    La nota sólo se guarda con la compuerta de módulos nuevos abierta: con la compuerta
    cerrada el `PATCH` se comporta exactamente como antes. Devuelve la nota creada, si hubo."""
    texto = _clean(note) if new_modules_enabled() else ""
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
            id=uuid.uuid4(), application_id=app.id, company_id=company.id,
            author_user_id=company.user_id, body=texto, visible_to_candidate=note_visible,
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
            "Miraron tu perfil",
            "La empresa revisó tu perfil para la búsqueda '{job_title}'.",
        ),
        ApplicationStatus.contacted: (
            "application_contacted",
            "¡Una empresa quiere contactarte!",
            "Te marcaron como contactado en la búsqueda '{job_title}'. Estate atento al teléfono y al mail.",
        ),
        ApplicationStatus.in_process: (
            "application_in_process",
            "Avanzaste en una búsqueda",
            "Entraste en proceso de selección para '{job_title}'.",
        ),
        ApplicationStatus.finalist: (
            "application_finalist",
            "¡Quedaste entre los finalistas!",
            "Quedaste entre los finalistas de '{job_title}'.",
        ),
        ApplicationStatus.selected: (
            "application_selected",
            "¡Te seleccionaron!",
            "¡Te seleccionaron para '{job_title}'! La empresa se va a contactar con vos.",
        ),
        ApplicationStatus.discarded: (
            "application_discarded",
            "Novedades en tu postulación",
            "Tu postulación a '{job_title}' no avanzó en esta oportunidad. ¡Seguí participando en otras búsquedas!",
        ),
    }
    notif = candidate_notif.get(ApplicationStatus(new_status))
    if notif:
        job, candidate = await _job_and_candidate(db, app)
        if job and candidate:
            notif_type, notif_title, notif_body = notif
            body = notif_body.format(job_title=job.title)
            # Sólo la nota **visible** entra al aviso. La privada no toca la notificación ni el
            # mail: es la garantía que prueba tests/test_application_notes_db.py.
            if nota is not None and nota.visible_to_candidate:
                body = f"{body}\n\n{COMPANY_MESSAGE_PREFIX}{nota.body}"
                nota.notified_at = now
            await create_notification(
                db,
                user_id=candidate.user_id,
                type=notif_type,
                title=notif_title,
                body=body,
                link=CANDIDATE_LINK,
                # Para revalidar al enviar: "No avanza" sale 24 h después y se cancela si la
                # empresa cambió el estado en el medio (auditoría R9/M18). La nota visible viaja
                # en ese mismo mail, así que se cancela con él.
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
                ref_id=app_id,
            )
    return [app_id for app_id, _ in avisadas]


# ── Notas ─────────────────────────────────────────────────────────────────────────────

async def add_note(
    db: AsyncSession,
    *,
    company: CompanyProfile,
    app: Application,
    body: str,
    visible: bool = False,
    now: datetime | None = None,
) -> ApplicationNote:
    """Nota suelta (sin cambio de estado). No commitea.

    Si es visible, el postulante recibe `application_note`, como mucho un aviso por día por
    postulación (las siguientes del mismo día se ven igual en su línea de tiempo). El mail,
    además, sale como mucho uno por día por persona (catálogo, `once_per_day`)."""
    texto = _clean(body)
    if not texto:
        raise NoteError("La nota está vacía.")
    if len(texto) > NOTE_MAX_LENGTH:
        raise NoteError(f"La nota puede tener hasta {NOTE_MAX_LENGTH} caracteres.")
    now = now or _now()

    nota = ApplicationNote(
        id=uuid.uuid4(), application_id=app.id, company_id=company.id,
        author_user_id=company.user_id, body=texto, visible_to_candidate=visible,
    )
    if not visible:
        db.add(nota)
        return nota

    from app.services.email.policy import local_day_start

    avisadas_hoy = (await db.execute(
        select(func.count()).select_from(ApplicationNote).where(
            ApplicationNote.application_id == app.id,
            ApplicationNote.company_id == company.id,
            ApplicationNote.status_at_time.is_(None),
            ApplicationNote.notified_at >= local_day_start(now),
        )
    )).scalar_one()
    db.add(nota)
    if avisadas_hoy:
        return nota

    job, candidate = await _job_and_candidate(db, app)
    if job and candidate and candidate.deleted_at is None:
        await create_notification(
            db,
            user_id=candidate.user_id,
            type="application_note",
            title=NOTE_TITLE,
            body=NOTE_BODY.format(company=company.legal_name, job_title=job.title, note=texto),
            link=CANDIDATE_LINK,
            ref_id=app.id,
        )
        nota.notified_at = now
    return nota


async def list_notes(db: AsyncSession, *, company: CompanyProfile, app: Application) -> list[ApplicationNote]:
    """Todas las notas (privadas y visibles) de la postulación, sólo las de esta empresa."""
    return list((await db.execute(
        select(ApplicationNote)
        .where(
            ApplicationNote.application_id == app.id,
            ApplicationNote.company_id == company.id,
            ApplicationNote.deleted_at.is_(None),
        )
        .order_by(ApplicationNote.created_at, ApplicationNote.id)
    )).scalars().all())


async def delete_note(
    db: AsyncSession, *, company: CompanyProfile, app: Application, note_id: uuid.UUID
) -> bool:
    """Borrado lógico. `False` si la nota no existe o no es de esta empresa. Una nota visible
    sale de la vista del postulante, pero el aviso que ya recibió no vuelve. No commitea."""
    nota = (await db.execute(
        select(ApplicationNote).where(
            ApplicationNote.id == note_id,
            ApplicationNote.application_id == app.id,
            ApplicationNote.company_id == company.id,
            ApplicationNote.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if nota is None:
        return False
    nota.deleted_at = _now()
    return True


async def visible_notes(db: AsyncSession, application_id: uuid.UUID) -> list[ApplicationNote]:
    """Lo único que el postulante puede leer de las notas: las visibles, no borradas. Las
    privadas no pasan por acá ni por ningún otro camino de candidato."""
    return list((await db.execute(
        select(ApplicationNote)
        .where(
            ApplicationNote.application_id == application_id,
            ApplicationNote.visible_to_candidate.is_(True),
            ApplicationNote.deleted_at.is_(None),
            ApplicationNote.body.is_not(None),
        )
        .order_by(ApplicationNote.created_at, ApplicationNote.id)
    )).scalars().all())
