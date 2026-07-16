"""Regresión directa del bug real: comparar `str(Enum)` en vez del Enum hacía que ninguna
transición de estado de una búsqueda funcionara nunca (ver git log — fix cce0eb0). Estos tests
existen para que ese bug específico no pueda volver a colarse sin que un test falle."""
from app.models.job import JobPostingStatus
from app.services.job_status import can_transition


def test_active_can_pause_or_close():
    assert can_transition(JobPostingStatus.active, JobPostingStatus.paused) is True
    assert can_transition(JobPostingStatus.active, JobPostingStatus.closed) is True


def test_paused_can_reactivate_or_close():
    assert can_transition(JobPostingStatus.paused, JobPostingStatus.active) is True
    assert can_transition(JobPostingStatus.paused, JobPostingStatus.closed) is True


def test_draft_can_activate_or_close():
    assert can_transition(JobPostingStatus.draft, JobPostingStatus.active) is True
    assert can_transition(JobPostingStatus.draft, JobPostingStatus.closed) is True


def test_closed_and_expired_are_terminal():
    for target in (JobPostingStatus.active, JobPostingStatus.paused, JobPostingStatus.draft):
        assert can_transition(JobPostingStatus.closed, target) is False
        assert can_transition(JobPostingStatus.expired, target) is False


def test_cannot_transition_to_same_status():
    # No es un "transition" real — ningún estado se lista a sí mismo como destino permitido.
    for status in JobPostingStatus:
        assert can_transition(status, status) is False


def test_enum_members_compare_correctly_not_by_string_repr():
    # `str(JobPostingStatus.active)` es "JobPostingStatus.active", no "active" — comparar por
    # str() en vez del Enum directo es exactamente lo que rompía todas las transiciones antes.
    assert str(JobPostingStatus.active) != "active"
    assert JobPostingStatus.active == JobPostingStatus.active
    assert can_transition(JobPostingStatus.active, JobPostingStatus.paused) is True
