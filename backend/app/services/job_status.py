from app.models.job import JobPostingStatus

# Única fuente de verdad para qué transiciones de estado están permitidas — antes vivía
# duplicado inline en jobs.py::update_job_posting. Extraído para poder testearlo directo
# (regresión del bug de comparar `str(Enum)` en vez del Enum, ver admin.py/jobs.py/account.py
# antes del fix) sin necesitar levantar toda la app ni una base de datos.
_ALLOWED_TRANSITIONS: dict[JobPostingStatus, set[JobPostingStatus]] = {
    JobPostingStatus.draft: {JobPostingStatus.active, JobPostingStatus.closed},
    JobPostingStatus.active: {JobPostingStatus.paused, JobPostingStatus.closed},
    JobPostingStatus.paused: {JobPostingStatus.active, JobPostingStatus.closed},
    # closed/expired son terminales para la EMPRESA — no aparecen como key acá, así que
    # cualquier intento suyo de salir de ahí resuelve a False. El admin tiene su propia
    # transición (ver can_admin_reopen) para el caso "se dio de baja por error".
}


def can_transition(current: JobPostingStatus, new: JobPostingStatus) -> bool:
    """True si `current` puede pasar a `new` según la máquina de estados de una búsqueda.
    Compara los Enum directamente (nunca `str(...)`) — comparar por representación en texto
    fue la causa de un bug real donde ninguna transición funcionaba nunca."""
    return new in _ALLOWED_TRANSITIONS.get(current, set())


def can_admin_reopen(current: JobPostingStatus) -> bool:
    """Sólo el admin puede sacar una búsqueda de `closed` — la empresa no (ver arriba).
    Cubre el caso real: Talency da de baja o la empresa cierra por error y no hay
    vuelta atrás para nadie. `expired` no se reabre acá: vencer es por tiempo, no por
    decisión, y reabrirla implica extender el plazo, que es otra operación."""
    return current == JobPostingStatus.closed
