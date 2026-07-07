from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str
    
    DATABASE_URL: str
    
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MINUTES: int = 30
    REFRESH_TOKEN_TTL_DAYS: int = 30

    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Clerk (auth provider — ver docs/planning/backend/09-migracion-clerk-auth.md)
    CLERK_SECRET_KEY: str = ""
    CLERK_WEBHOOK_SECRET: str = ""
    CLERK_AUTHORIZED_PARTIES: str = "http://localhost:3000"
    
    SENTRY_DSN: str | None = None

    RESEND_API_KEY: str | None = None
    EMAIL_FROM: str = "BBJobs <noreply@bbjobs.com.ar>"

    FEATURE_DURATION_DAYS: int = 7
    
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
