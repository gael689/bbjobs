import datetime
from app.schemas.candidate import calculate_age


def test_calculate_age_none_when_no_birth_date():
    assert calculate_age(None) is None


def test_calculate_age_after_birthday():
    today = datetime.date.today()
    birth_date = today.replace(year=today.year - 25) - datetime.timedelta(days=2)
    assert calculate_age(birth_date) == 25


def test_calculate_age_before_birthday():
    today = datetime.date.today()
    birth_date = today.replace(year=today.year - 25) + datetime.timedelta(days=2)
    assert calculate_age(birth_date) == 24


def test_calculate_age_matches_applicant_stats_private_copy():
    # schemas/candidate.py::calculate_age y services/applicant_stats.py::_calculate_age son
    # implementaciones separadas a propósito (ver comentario ahí: "no acoplar candidates/jobs
    # sólo por esta constante") — este test asegura que no diverjan en el resultado.
    from app.services.applicant_stats import _calculate_age

    today = datetime.date.today()
    for offset_years in (0, 1, 17, 18, 40, 65):
        birth_date = today.replace(year=today.year - offset_years) if offset_years else today
        assert calculate_age(birth_date) == _calculate_age(birth_date)
