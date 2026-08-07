import datetime
from app.models.candidate import Experience, Education, EducationLevel, EducationStatus
from app.services.applicant_stats import (
    _years_of_experience, _highest_education_level, _calculate_age,
    franja_edad_de, franja_experiencia_de, etiqueta_educacion,
)


def _exp(start: datetime.date, end: datetime.date | None) -> Experience:
    return Experience(company_name="Acme", role_title="Dev", start_date=start, end_date=end)


def _edu(level: EducationLevel, status: EducationStatus = EducationStatus.graduado) -> Education:
    return Education(
        institution="UNS", level=level, start_date=datetime.date(2015, 1, 1), status=status,
    )


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
    # El valor plano ("universitario"), que es lo que guarda la base y con lo que filtra el
    # panel de admin — no "EducationLevel.universitario", que es lo que devolvía str() sobre
    # un objeto en memoria.
    assert _highest_education_level(educations) == "universitario"


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


# ── Franjas de los gráficos (Bloque D, agosto/2026) ──────────────────────────

def test_franja_edad_cubre_los_bordes():
    assert franja_edad_de(18) == "18-24"
    assert franja_edad_de(24) == "18-24"
    assert franja_edad_de(25) == "25-34"
    assert franja_edad_de(80) == "55+"


def test_franja_edad_por_debajo_del_minimo_no_entra_en_ninguna():
    # Nadie debería tener menos de 18 (se valida al guardar), pero si hay data vieja no se
    # la mete a la fuerza en la primera franja: quedaría contada como si tuviera 18-24.
    assert franja_edad_de(15) is None
    assert franja_edad_de(None) is None


def test_franja_experiencia_por_tramo():
    assert franja_experiencia_de(0) == "Sin experiencia"
    assert franja_experiencia_de(0.5) == "Menos de 1 año"
    assert franja_experiencia_de(1) == "Entre 1 y 3 años"
    assert franja_experiencia_de(2.9) == "Entre 1 y 3 años"
    assert franja_experiencia_de(3) == "Entre 3 y 5 años"
    assert franja_experiencia_de(12) == "Más de 5 años"


def test_etiqueta_educacion_incluye_el_estado():
    # El estado es justamente lo que Eugenia pidió poder distinguir en el gráfico.
    assert etiqueta_educacion(_edu(EducationLevel.universitario, EducationStatus.en_curso)) == "Universitario · En curso"
    assert etiqueta_educacion(_edu(EducationLevel.terciario, EducationStatus.abandonado)) == "Terciario · Abandonado"
    assert etiqueta_educacion(None) is None
