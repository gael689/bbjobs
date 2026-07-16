import datetime
from app.models.candidate import Experience, Education, EducationLevel
from app.services.applicant_stats import (
    _years_of_experience, _highest_education_level, _calculate_age,
)


def _exp(start: datetime.date, end: datetime.date | None) -> Experience:
    return Experience(company_name="Acme", role_title="Dev", start_date=start, end_date=end)


def _edu(level: EducationLevel) -> Education:
    return Education(institution="UNS", level=level, start_date=datetime.date(2015, 1, 1), in_progress=False)


def test_years_of_experience_sums_multiple_jobs():
    experiences = [
        _exp(datetime.date(2020, 1, 1), datetime.date(2021, 1, 1)),  # ~1 año
        _exp(datetime.date(2021, 1, 1), datetime.date(2023, 1, 1)),  # ~2 años
    ]
    assert _years_of_experience(experiences) == 3.0


def test_years_of_experience_uses_today_for_ongoing_job():
    today = datetime.date.today()
    experiences = [_exp(today - datetime.timedelta(days=365), None)]
    result = _years_of_experience(experiences)
    assert 0.9 <= result <= 1.1


def test_years_of_experience_empty_list_is_zero():
    assert _years_of_experience([]) == 0.0


def test_highest_education_level_picks_the_ranked_max():
    educations = [_edu(EducationLevel.secundario), _edu(EducationLevel.universitario), _edu(EducationLevel.terciario)]
    assert _highest_education_level(educations) == str(EducationLevel.universitario)


def test_highest_education_level_none_when_empty():
    assert _highest_education_level([]) is None


def test_calculate_age_before_birthday_this_year():
    today = datetime.date.today()
    # Cumple mañana → todavía no sumó el año actual.
    birth_date = today.replace(year=today.year - 30) + datetime.timedelta(days=1)
    assert _calculate_age(birth_date) == 29


def test_calculate_age_after_birthday_this_year():
    today = datetime.date.today()
    birth_date = today.replace(year=today.year - 30) - datetime.timedelta(days=1)
    assert _calculate_age(birth_date) == 30


def test_calculate_age_none_when_no_birth_date():
    assert _calculate_age(None) is None
