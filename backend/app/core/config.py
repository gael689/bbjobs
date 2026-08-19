from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str

    DATABASE_URL: str
    # Rol de mínimo privilegio para runtime (sin DDL). Alembic necesita CREATE TABLE/ALTER TABLE,
    # que ese rol no tiene — las migraciones corren con esta URL separada (rol con privilegios de
    # owner/DDL) en vez de DATABASE_URL. Si no está seteada, cae a DATABASE_URL (mismo rol para
    # todo) — no rompe nada para quien no haya hecho el split todavía.
    MIGRATIONS_DATABASE_URL: str | None = None

    @field_validator("DATABASE_URL", "MIGRATIONS_DATABASE_URL")
    @classmethod
    def _use_asyncpg_scheme(cls, v: str | None) -> str | None:
        # Railway (y Heroku antes) autogeneran DATABASE_URL con scheme `postgres://` o
        # `postgresql://` — ninguno de los dos es válido para create_async_engine, que necesita
        # `postgresql+asyncpg://`. Sin esto, copiar la URL autogenerada tal cual rompe el arranque.
        if v and v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v and v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    ALLOWED_ORIGINS: str = "http://localhost:3000"
    # Para armar back_urls de Mercado Pago (adónde vuelve el usuario tras el checkout).
    FRONTEND_URL: str = "http://localhost:3000"

    # Clerk (auth provider — ver docs/planning/backend/09-migracion-clerk-auth.md)
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_AUTHORIZED_PARTIES: str = "http://localhost:3000"

    SENTRY_DSN: str | None = None

    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None
    
    # Precios de prueba. Sirven para hacer un cobro real de monto bajo sin tocar el código:
    # se cargan como variable en Railway, se prueba, y para volver al precio de verdad se
    # **borra la variable**. Antes esto obligaba a editar la constante en el backend y sus dos
    # espejos del frontend, deployar, y acordarse de revertir los tres — y si se revertía mal,
    # la empresa veía un precio y se le cobraba otro.
    # Dejar en None en operación normal.
    TALENT_PACK_PRICE: float | None = None
    FEATURED_JOB_PRICE: float | None = None

    MP_ACCESS_TOKEN: str | None = None
    MP_PUBLIC_KEY: str | None = None
    MP_WEBHOOK_SECRET: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def migrations_database_url(self) -> str:
        return self.MIGRATIONS_DATABASE_URL or self.DATABASE_URL

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def clerk_authorized_parties(self) -> List[str]:
        return [party.strip() for party in self.CLERK_AUTHORIZED_PARTIES.split(",")]

settings = Settings()
