import datetime
from app.models.candidate import CandidateProfile
from app.services.profile_completion import compute_profile_completion, should_send_completion_reminder


def _empty_profile(**overrides) -> CandidateProfile:
    """CandidateProfile en memoria, sin tocar la base — sólo lo que necesita
    compute_profile_completion()/should_send_completion_reminder() para calcular."""
    defaults = dict(
        first_name="Ana", last_name="Gómez", phone="291-1234567",
        photo_url=None, birth_date=None, gender=None, has_own_transport=None,
        availability=None, summary=None, cv_file_url=None,
        accepts_remote=False, accepts_hybrid=False, accepts_onsite=False,
        location_zone_id=None, last_completion_reminder_at=None,
    )
    defaults.update(overrides)
    return CandidateProfile(**defaults)


def test_fully_empty_profile_is_zero_percent():
    profile = _empty_profile()
    result = compute_profile_completion(
        profile, has_experience=False, has_education=False, has_skills=False, has_languages=False,
    )
    assert result.percent == 0
    assert len(result.missing) == 13  # un ítem por cada campo del cálculo


def test_fully_filled_profile_is_100_percent():
    profile = _empty_profile(
        photo_url="https://example.com/photo.jpg",
        birth_date=datetime.date(1995, 1, 1),
        gender="masculino",
        has_own_transport=True,
        availability="full_time",
        summary="Desarrollador con experiencia en Python.",
        cv_file_url="https://example.com/cv.pdf",
        accepts_onsite=True,
        location_zone_id="00000000-0000-0000-0000-000000000000",
    )
    result = compute_profile_completion(
        profile, has_experience=True, has_education=True, has_skills=True, has_languages=True,
    )
    assert result.percent == 100
    assert result.missing == []


def test_modality_preference_counts_as_one_item_regardless_of_which_flag():
    # accepts_remote/hybrid/onsite son tres columnas separadas en la base, pero cuentan como
    # un solo ítem de completitud ("modality_pref") — cualquiera de las tres alcanza.
    only_remote = _empty_profile(accepts_remote=True)
    only_hybrid = _empty_profile(accepts_hybrid=True)
    none_selected = _empty_profile()

    r_remote = compute_profile_completion(only_remote, has_experience=False, has_education=False, has_skills=False, has_languages=False)
    r_hybrid = compute_profile_completion(only_hybrid, has_experience=False, has_education=False, has_skills=False, has_languages=False)
    r_none = compute_profile_completion(none_selected, has_experience=False, has_education=False, has_skills=False, has_languages=False)

    assert not any(m.key == "modality_pref" for m in r_remote.missing)
    assert not any(m.key == "modality_pref" for m in r_hybrid.missing)
    assert any(m.key == "modality_pref" for m in r_none.missing)


def test_missing_field_keys_match_what_the_frontend_expects():
    # frontend/src/app/dashboard/candidate/perfil/page.tsx mapea cada key a un paso del wizard
    # (MISSING_TARGETS/STEPS) — si esta lista cambia sin avisar, ese mapeo queda roto en silencio.
    profile = _empty_profile()
    result = compute_profile_completion(
        profile, has_experience=False, has_education=False, has_skills=False, has_languages=False,
    )
    keys = {m.key for m in result.missing}
    assert keys == {
        "photo_url", "birth_date", "gender", "location_zone_id", "has_own_transport",
        "availability", "summary", "modality_pref", "cv_file_url",
        "experience", "education", "skills", "languages",
    }


def test_reminder_sent_when_never_sent_before_and_profile_incomplete():
    profile = _empty_profile(last_completion_reminder_at=None)
    assert should_send_completion_reminder(profile, percent=40) is True


def test_reminder_not_sent_when_profile_is_complete():
    profile = _empty_profile(last_completion_reminder_at=None)
    assert should_send_completion_reminder(profile, percent=100) is False


def test_reminder_throttled_within_seven_days():
    profile = _empty_profile(
        last_completion_reminder_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=3),
    )
    assert should_send_completion_reminder(profile, percent=50) is False


def test_reminder_sent_again_after_seven_days():
    profile = _empty_profile(
        last_completion_reminder_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=8),
    )
    assert should_send_completion_reminder(profile, percent=50) is True
