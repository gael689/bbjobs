"""Tope de IA del día: el presupuesto del mes repartido por día de la semana (Gael, 25/11/2026)."""
from datetime import date, timedelta

from app.services.ai.pipeline import budget_for_day, weekday_weights

W = [1.5, 1.2, 1.0, 1.0, 1.0, 0.5, 0.4]


def test_month_adds_up_to_the_budget_when_every_day_spends_its_share():
    spent, d = 0.0, date(2026, 12, 1)
    while d.month == 12:
        cap = budget_for_day(d, 10.0, spent, ceiling=5.0, weights=W)
        spent += cap
        d += timedelta(days=1)
    assert abs(spent - 10.0) < 0.01


def test_monday_gets_more_than_weekend():
    # Mes en el que cada día gasta su tope: el lunes tiene ~3 veces lo del domingo de esa semana.
    caps, spent, d = {}, 0.0, date(2026, 12, 1)
    while d.month == 12:
        caps[d] = budget_for_day(d, 10.0, spent, ceiling=5.0, weights=W)
        spent += caps[d]
        d += timedelta(days=1)
    monday, saturday, sunday = caps[date(2026, 12, 7)], caps[date(2026, 12, 12)], caps[date(2026, 12, 13)]
    assert monday > saturday > sunday and monday > 3 * sunday
    assert 0.45 < monday < 0.55 and 0.12 < sunday < 0.16


def test_what_is_not_spent_rolls_over():
    tight = budget_for_day(date(2026, 12, 15), 10.0, 6.0, ceiling=5.0, weights=W)
    loose = budget_for_day(date(2026, 12, 15), 10.0, 2.0, ceiling=5.0, weights=W)
    assert loose > tight


def test_ceiling_and_exhausted_month():
    # Último día con todo el mes sin gastar: no se lo gasta de golpe (1,5 × su parte normal).
    last = budget_for_day(date(2026, 12, 31), 10.0, 0.0, ceiling=5.0, weights=W)
    assert 0.4 < last < 0.6
    assert budget_for_day(date(2026, 12, 7), 100.0, 0.0, ceiling=1.0, weights=W) == 1.0
    assert budget_for_day(date(2026, 12, 20), 10.0, 12.0, ceiling=1.0, weights=W) == 0.0


def test_without_monthly_budget_is_the_fixed_ceiling():
    assert budget_for_day(date(2026, 12, 7), 0.0, 3.0, ceiling=0.7) == 0.7


def test_bad_weights_fall_back_to_equal(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "AI_WEEKDAY_WEIGHTS", "1,2,x")
    assert weekday_weights() == [1.0] * 7
    monkeypatch.setattr(settings, "AI_WEEKDAY_WEIGHTS", "1.5,1.2,1.0,1.0,1.0,0.5,0.4")
    assert weekday_weights() == W
