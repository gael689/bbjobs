from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str
    
    DATABASE_URL: str

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
    
    MP_ACCESS_TOKEN: str | None = None
    MP_PUBLIC_KEY: str | None = None
    MP_WEBHOOK_SECRET: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def clerk_authorized_parties(self) -> List[str]:
        return [party.strip() for party in self.CLERK_AUTHORIZED_PARTIES.split(",")]

settings = Settings()
