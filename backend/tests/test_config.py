from app.core.config import Settings


def _settings(**overrides) -> Settings:
    defaults = dict(SECRET_KEY="test-secret", DATABASE_URL="postgresql+asyncpg://u:p@host/db")
    defaults.update(overrides)
    return Settings(**defaults)


def test_postgres_scheme_from_railway_is_normalized_to_asyncpg():
    s = _settings(DATABASE_URL="postgres://u:p@reseau.proxy.rlwy.net:37069/railway")
    assert s.DATABASE_URL == "postgresql+asyncpg://u:p@reseau.proxy.rlwy.net:37069/railway"


def test_postgresql_scheme_is_normalized_to_asyncpg():
    s = _settings(DATABASE_URL="postgresql://u:p@reseau.proxy.rlwy.net:37069/railway")
    assert s.DATABASE_URL == "postgresql+asyncpg://u:p@reseau.proxy.rlwy.net:37069/railway"


def test_already_correct_scheme_is_left_untouched():
    s = _settings(DATABASE_URL="postgresql+asyncpg://u:p@reseau.proxy.rlwy.net:37069/railway")
    assert s.DATABASE_URL == "postgresql+asyncpg://u:p@reseau.proxy.rlwy.net:37069/railway"


def test_migrations_database_url_is_normalized_independently():
    s = _settings(
        DATABASE_URL="postgresql+asyncpg://app_user:p@host/db",
        MIGRATIONS_DATABASE_URL="postgres://postgres:p@host/db",
    )
    assert s.MIGRATIONS_DATABASE_URL == "postgresql+asyncpg://postgres:p@host/db"


def test_none_migrations_database_url_is_left_untouched():
    s = _settings(MIGRATIONS_DATABASE_URL=None)
    assert s.MIGRATIONS_DATABASE_URL is None
